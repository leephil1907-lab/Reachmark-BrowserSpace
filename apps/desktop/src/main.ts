import { app, BrowserWindow, ipcMain, safeStorage, session, shell, type Session } from "electron";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { profilePartition } from "./profile-utils.js";

type Protocol = "http" | "https" | "socks5";
type ProxyRecord = {
  id: string; name: string; protocol: Protocol; host: string; port: number; createdAt: string;
  usernameCiphertext?: string; passwordCiphertext?: string;
  lastTestAt?: string; lastTestStatus?: "passed" | "failed"; lastTestMessage?: string; lastEgressIp?: string;
};
type Profile = { id: string; name: string; createdAt: string; proxyId?: string; proxy?: { protocol: Protocol; host: string; port: number; usernameCiphertext?: string; passwordCiphertext?: string }; startUrl?: string };
const dataFile = () => path.join(app.getPath("userData"), "profiles.json");
const proxyFile = () => path.join(app.getPath("userData"), "proxies.json");
const windows = new Map<string, BrowserWindow>();
let profiles: Profile[] = [];
let proxies: ProxyRecord[] = [];

async function writeJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2), { mode: 0o600 });
}
async function saveProfiles() { await writeJson(dataFile(), profiles); }
async function saveProxies() { await writeJson(proxyFile(), proxies); }
async function loadJson(file: string): Promise<unknown> {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return undefined; }
}
async function loadData() {
  const storedProfiles = await loadJson(dataFile());
  if (Array.isArray(storedProfiles)) profiles = storedProfiles.filter((p): p is Profile =>
    !!p && typeof p === "object" && typeof (p as Profile).id === "string" && typeof (p as Profile).name === "string");
  const storedProxies = await loadJson(proxyFile());
  if (Array.isArray(storedProxies)) proxies = storedProxies.filter((p): p is ProxyRecord =>
    !!p && typeof p === "object" && typeof (p as ProxyRecord).id === "string" && typeof (p as ProxyRecord).host === "string");
  // Migrate older profile-local proxy settings into the shared catalogue once.
  let migrated = false;
  for (const profile of profiles) {
    if (!profile.proxy || profile.proxyId) continue;
    const old = profile.proxy;
    let shared = proxies.find((item) => item.protocol === old.protocol && item.host === old.host && item.port === old.port);
    if (!shared) {
      shared = {
        id: randomUUID(), name: old.host, protocol: old.protocol, host: old.host, port: old.port,
        createdAt: new Date().toISOString(), usernameCiphertext: old.usernameCiphertext, passwordCiphertext: old.passwordCiphertext
      };
      proxies.push(shared);
    }
    profile.proxyId = shared.id;
    profile.proxy = undefined;
    migrated = true;
  }
  if (migrated) { await saveProxies(); await saveProfiles(); }
}
function validateName(value: unknown, label = "Name"): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 64) throw new Error(label + " must contain 1–64 characters.");
  return value.trim();
}
function validateEndpoint(value: unknown): { protocol: Protocol; host: string; port: number } {
  if (!value || typeof value !== "object") throw new Error("Proxy configuration is required.");
  const p = value as { protocol?: unknown; host?: unknown; port?: unknown };
  if (!["http", "https", "socks5"].includes(String(p.protocol))) throw new Error("Choose HTTP, HTTPS, or SOCKS5.");
  if (typeof p.host !== "string") throw new Error("Proxy host is required.");
  const host = p.host.trim().replace(/^\[|\]$/g, "");
  // IPv6 literals are accepted only in bracket-free canonical form; DNS labels/IPs are otherwise checked strictly.
  const ipv6 = host.includes(":") && /^[0-9a-fA-F:.]+$/.test(host);
  const dns = /^[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?$/.test(host) && !host.includes("..");
  if (!host || host.length > 253 || (!ipv6 && !dns)) throw new Error("Enter a valid proxy hostname or IP address.");
  const port = Number(p.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Proxy port must be between 1 and 65535.");
  return { protocol: p.protocol as Protocol, host, port };
}
function encryptCredential(value: unknown, label: string, maxLength: number): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string" || value.length > maxLength) throw new Error(label + " is invalid or too long.");
  if (!safeStorage.isEncryptionAvailable() || safeStorage.getSelectedStorageBackend() === "basic_text") {
    throw new Error("OS-backed secure credential storage is unavailable. Credentials were not saved.");
  }
  return safeStorage.encryptString(value).toString("base64");
}
function safeProxy(proxy: ProxyRecord) {
  return {
    id: proxy.id, name: proxy.name, protocol: proxy.protocol, host: proxy.host, port: proxy.port,
    createdAt: proxy.createdAt, lastTestAt: proxy.lastTestAt, lastTestStatus: proxy.lastTestStatus,
    lastTestMessage: proxy.lastTestMessage, lastEgressIp: proxy.lastEgressIp,
    hasCredentials: Boolean(proxy.usernameCiphertext)
  };
}
function safeProfile(profile: Profile) {
  const assigned = profile.proxyId ? proxies.find((item) => item.id === profile.proxyId) : undefined;
  const legacy = profile.proxy;
  return {
    id: profile.id, name: profile.name, createdAt: profile.createdAt, proxyId: profile.proxyId,
    proxy: assigned ? { protocol: assigned.protocol, host: assigned.host, port: assigned.port } :
      legacy ? { protocol: legacy.protocol, host: legacy.host, port: legacy.port } : undefined
  };
}
function decryptCredentials(proxy: ProxyRecord) {
  if (!proxy.usernameCiphertext) return undefined;
  return {
    username: safeStorage.decryptString(Buffer.from(proxy.usernameCiphertext, "base64")),
    password: proxy.passwordCiphertext ? safeStorage.decryptString(Buffer.from(proxy.passwordCiphertext, "base64")) : ""
  };
}
function getProfileProxy(profile: Profile): ProxyRecord | undefined {
  if (profile.proxyId) return proxies.find((item) => item.id === profile.proxyId);
  if (!profile.proxy) return undefined;
  return {
    id: "legacy", name: profile.proxy.host, protocol: profile.proxy.protocol, host: profile.proxy.host, port: profile.proxy.port,
    createdAt: profile.createdAt, usernameCiphertext: profile.proxy.usernameCiphertext, passwordCiphertext: profile.proxy.passwordCiphertext
  };
}
function proxyRules(proxy: Pick<ProxyRecord, "protocol" | "host" | "port">) {
  const host = proxy.host.includes(":") ? "[" + proxy.host + "]" : proxy.host;
  return proxy.protocol + "://" + host + ":" + proxy.port;
}
async function configureSession(ses: Session, proxy?: ProxyRecord) {
  await ses.setProxy(proxy
    ? { mode: "fixed_servers", proxyRules: proxyRules(proxy), proxyBypassRules: "<local>" }
    : { mode: "system" });
}
function attachProxyAuth(ses: Session, proxy: ProxyRecord) {
  ses.on("login", (event, _webContents, _details, authInfo, callback) => {
    if (!authInfo.isProxy || authInfo.host !== proxy.host || authInfo.port !== proxy.port || !proxy.usernameCiphertext) return;
    try {
      const credentials = decryptCredentials(proxy);
      if (!credentials) return;
      event.preventDefault();
      callback(credentials.username, credentials.password);
    } catch {
      // Never log or expose credentials; leave the normal authentication failure flow intact.
    }
  });
}
async function launchProfile(id: string) {
  const profile = profiles.find((p) => p.id === id);
  if (!profile) throw new Error("Profile not found.");
  const existing = windows.get(id);
  if (existing && !existing.isDestroyed()) { existing.focus(); return { alreadyOpen: true, profile: safeProfile(profile) }; }
  const ses = session.fromPartition(profilePartition(profile.id));
  const proxy = getProfileProxy(profile);
  await configureSession(ses, proxy);
  if (proxy) attachProxyAuth(ses, proxy);
  const win = new BrowserWindow({
    width: 1280, height: 850, minWidth: 760, minHeight: 560, title: "BrowserSpace — " + profile.name,
    webPreferences: { session: ses, contextIsolation: true, nodeIntegration: false, sandbox: true, webviewTag: false }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.on("closed", () => windows.delete(id));
  windows.set(id, win);
  try {
    const url = profile.startUrl && /^https?:\/\//i.test(profile.startUrl) ? profile.startUrl : "https://www.google.com";
    await win.loadURL(url);
  } catch (error) {
    windows.delete(id);
    if (!win.isDestroyed()) win.close();
    throw error;
  }
  return { alreadyOpen: false, profile: safeProfile(profile) };
}
async function testProxy(proxy: ProxyRecord) {
  const probe = session.fromPartition("browserspace-probe-" + randomUUID());
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  if (proxy.usernameCiphertext) attachProxyAuth(probe, proxy);
  try {
    await configureSession(probe, proxy);
    const response = await probe.fetch("https://api.ipify.org?format=json", { signal: controller.signal });
    if (!response.ok) throw new Error("Proxy reached the test service but it returned HTTP " + response.status + ".");
    const data = await response.json() as { ip?: unknown };
    const ip = typeof data.ip === "string" ? data.ip : undefined;
    if (!ip) throw new Error("The test service returned no public IP address.");
    proxy.lastTestAt = new Date().toISOString();
    proxy.lastTestStatus = "passed";
    proxy.lastTestMessage = "Connection successful";
    proxy.lastEgressIp = ip;
    await saveProxies();
    return { ...safeProxy(proxy), ok: true, egressIp: ip, elapsedMs: undefined };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "Connection timed out after 12 seconds."
      : error instanceof Error ? error.message.slice(0, 240) : "Proxy connectivity test failed.";
    proxy.lastTestAt = new Date().toISOString();
    proxy.lastTestStatus = "failed";
    proxy.lastTestMessage = message;
    proxy.lastEgressIp = undefined;
    await saveProxies();
    return { ...safeProxy(proxy), ok: false, error: message };
  } finally {
    clearTimeout(timeout);
    try { await probe.closeAllConnections(); } catch { /* disposable probe session */ }
  }
}
async function verifyProfileIsolation() {
  const targets = profiles.slice(0, 2);
  if (targets.length < 2) throw new Error("Create at least two profiles to run the isolation check.");
  const marker = "__browserspace_isolation_probe";
  const sessions = targets.map((profile) => ({ profile, ses: session.fromPartition(profilePartition(profile.id)) }));
  // Read before writing: a matching marker here proves the persistent profile partition survived a prior app run.
  const priorMarkers = await Promise.all(sessions.map(async ({ profile, ses }) => {
    const cookies = await ses.cookies.get({ url: "https://browserspace.invalid/", name: marker });
    return { profileId: profile.id, persistedFromPreviousRun: cookies.some((cookie) => cookie.value === profile.id) };
  }));
  for (const { profile, ses } of sessions) {
    await ses.cookies.set({
      url: "https://browserspace.invalid/", name: marker, value: profile.id, path: "/", secure: true, httpOnly: true,
      expirationDate: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 180
    });
  }
  const reads = await Promise.all(sessions.map(async ({ profile, ses }) => {
    const cookies = await ses.cookies.get({ url: "https://browserspace.invalid/", name: marker });
    return { profileId: profile.id, ownMarker: cookies.some((cookie) => cookie.value === profile.id), foreignMarkers: cookies.filter((cookie) => cookie.value !== profile.id).length };
  }));
  const passed = reads.every((item) => item.ownMarker && item.foreignMarkers === 0);
  const persistenceVerified = priorMarkers.every((item) => item.persistedFromPreviousRun);
  return {
    passed, partitionNamesStable: sessions.every(({ profile }) => profilePartition(profile.id) === "persist:browserspace-" + profile.id),
    persistenceVerified, baselineCreated: !persistenceVerified, profilesChecked: reads.length,
    details: reads.map((item) => ({ profileId: item.profileId, isolated: item.ownMarker && item.foreignMarkers === 0 })),
    persistence: priorMarkers
  };
}
function registerIpc() {
  ipcMain.handle("profiles:list", () => profiles.map(safeProfile));
  ipcMain.handle("profiles:status", (_event, input: { id?: unknown }) => {
    if (typeof input?.id !== "string") throw new Error("Profile ID is required.");
    const win = windows.get(input.id);
    return { running: !!win && !win.isDestroyed() };
  });
  ipcMain.handle("profiles:create", async (_event, input: { name?: unknown }) => {
    const profile: Profile = { id: randomUUID(), name: validateName(input?.name, "Profile name"), createdAt: new Date().toISOString() };
    profiles.push(profile); await saveProfiles(); return safeProfile(profile);
  });
  ipcMain.handle("profiles:rename", async (_event, input: { id?: unknown; name?: unknown }) => {
    const p = profiles.find((item) => item.id === input?.id);
    if (!p) throw new Error("Profile not found.");
    p.name = validateName(input?.name, "Profile name"); await saveProfiles();
    const win = windows.get(p.id); if (win && !win.isDestroyed()) win.setTitle("BrowserSpace — " + p.name);
    return safeProfile(p);
  });
  ipcMain.handle("profiles:set-proxy", async (_event, input: { id?: unknown; proxyId?: unknown }) => {
    const p = profiles.find((item) => item.id === input?.id);
    if (!p) throw new Error("Profile not found.");
    if (input.proxyId == null || input.proxyId === "") { p.proxyId = undefined; p.proxy = undefined; }
    else {
      if (typeof input.proxyId !== "string") throw new Error("Proxy ID is invalid.");
      const proxy = proxies.find((item) => item.id === input.proxyId);
      if (!proxy) throw new Error("Proxy not found in the shared catalogue.");
      p.proxyId = proxy.id; p.proxy = undefined;
    }
    await saveProfiles(); return safeProfile(p);
  });
  ipcMain.handle("profiles:launch", (_event, input: { id?: unknown }) => {
    if (typeof input?.id !== "string") throw new Error("Profile ID is required.");
    return launchProfile(input.id);
  });
  ipcMain.handle("profiles:stop", (_event, input: { id?: unknown }) => {
    if (typeof input?.id !== "string") throw new Error("Profile ID is required.");
    const win = windows.get(input.id); if (win && !win.isDestroyed()) win.close();
    windows.delete(input.id); return { stopped: true };
  });
  ipcMain.handle("profiles:delete", async (_event, input: { id?: unknown }) => {
    if (typeof input?.id !== "string") throw new Error("Profile ID is required.");
    const index = profiles.findIndex((p) => p.id === input.id);
    if (index < 0) throw new Error("Profile not found.");
    const win = windows.get(input.id); if (win && !win.isDestroyed()) win.close();
    windows.delete(input.id); profiles.splice(index, 1); await saveProfiles();
    return { deleted: true, profileId: input.id, sessionDataPreserved: true };
  });
  ipcMain.handle("proxies:list", () => proxies.map(safeProxy));
  ipcMain.handle("proxies:create", async (_event, input: { name?: unknown; protocol?: unknown; host?: unknown; port?: unknown; username?: unknown; password?: unknown }) => {
    const endpoint = validateEndpoint(input);
    const proxy: ProxyRecord = {
      id: randomUUID(), name: validateName(input?.name, "Proxy name"), ...endpoint, createdAt: new Date().toISOString(),
      usernameCiphertext: encryptCredential(input?.username, "Proxy username", 512),
      passwordCiphertext: encryptCredential(input?.password, "Proxy password", 2048)
    };
    proxies.push(proxy);
    try { await saveProxies(); } catch (error) { proxies = proxies.filter((item) => item.id !== proxy.id); throw error; }
    return safeProxy(proxy);
  });
  ipcMain.handle("proxies:delete", async (_event, input: { id?: unknown }) => {
    if (typeof input?.id !== "string") throw new Error("Proxy ID is required.");
    const index = proxies.findIndex((p) => p.id === input.id);
    if (index < 0) throw new Error("Proxy not found.");
    const [removed] = proxies.splice(index, 1);
    const changed = profiles.filter((p) => p.proxyId === input.id || p.proxy?.host === removed.host && p.proxy?.port === removed.port);
    for (const profile of changed) { profile.proxyId = undefined; profile.proxy = undefined; }
    await Promise.all([saveProxies(), saveProfiles()]);
    return { deleted: true, detachedProfiles: changed.length };
  });
  ipcMain.handle("proxies:test", async (_event, input: { id?: unknown }) => {
    if (typeof input?.id !== "string") throw new Error("Proxy ID is required.");
    const proxy = proxies.find((p) => p.id === input.id);
    if (!proxy) throw new Error("Proxy not found.");
    return testProxy(proxy);
  });
  ipcMain.handle("profiles:verify-isolation", () => verifyProfileIsolation());
}

app.on("login", (event, webContents, _details, authInfo, callback) => {
  if (!authInfo.isProxy) return;
  const profile = profiles.find((item) => {
    const win = windows.get(item.id);
    const proxy = getProfileProxy(item);
    return !!win && !win.isDestroyed() && win.webContents.id === webContents?.id &&
      !!proxy && proxy.host === authInfo.host && proxy.port === authInfo.port && !!proxy.usernameCiphertext;
  });
  const proxy = profile ? getProfileProxy(profile) : undefined;
  if (!proxy?.usernameCiphertext) return;
  try {
    const credentials = decryptCredentials(proxy);
    if (!credentials) return;
    event.preventDefault();
    callback(credentials.username, credentials.password);
  } catch { /* Never log credential material. */ }
});

app.whenReady().then(async () => {
  await loadData();
  if (!profiles.length) {
    profiles = [{ id: randomUUID(), name: "Personal", createdAt: new Date().toISOString() }];
    await saveProfiles();
  }
  registerIpc();
  const dashboardUrl = process.env.BROWSERSPACE_DASHBOARD_URL || "http://localhost:3000";
  const parsedDashboardUrl = new URL(dashboardUrl);
  if (parsedDashboardUrl.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(parsedDashboardUrl.hostname)) {
    throw new Error("For security, the desktop dashboard URL must be a local HTTP origin.");
  }
  const win = new BrowserWindow({ width: 1360, height: 900, minWidth: 900, minHeight: 620, title: "BrowserSpace",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, navigationUrl) => {
    try {
      if (new URL(navigationUrl).origin !== parsedDashboardUrl.origin) {
        event.preventDefault();
        if (navigationUrl.startsWith("https://") || navigationUrl.startsWith("http://")) void shell.openExternal(navigationUrl);
      }
    } catch { event.preventDefault(); }
  });
  try { await win.loadURL(parsedDashboardUrl.toString()); }
  catch {
    const html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>BrowserSpace</title><style>body{background:#0d0f0e;color:#f0f3ed;font:15px system-ui;padding:48px;max-width:680px;margin:auto}h1{font-size:34px}b{color:#d6f269}.card{border:1px solid #293129;background:#151a16;border-radius:12px;padding:20px;line-height:1.7}</style><h1>BrowserSpace <b>Desktop</b></h1><p>The desktop runtime is ready, but the dashboard could not be reached.</p><div class="card"><p>Start the dashboard in another terminal with <code>npm run dev</code>, then relaunch this window.</p><p>Persistent profile sessions are available when the dashboard is connected.</p></div>';
    await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  }
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
