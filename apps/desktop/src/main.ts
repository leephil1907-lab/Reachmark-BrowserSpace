import { app, BrowserWindow, ipcMain, session, shell } from "electron";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ProxyConfig = { protocol: "http" | "https" | "socks5"; host: string; port: number };
type Profile = { id: string; name: string; createdAt: string; proxy?: ProxyConfig; startUrl?: string };
const dataFile = () => path.join(app.getPath("userData"), "profiles.json");
const windows = new Map<string, BrowserWindow>();
let profiles: Profile[] = [];

async function saveProfiles() {
  await mkdir(path.dirname(dataFile()), { recursive: true });
  await writeFile(dataFile(), JSON.stringify(profiles, null, 2), { mode: 0o600 });
}
async function loadProfiles() {
  try {
    const value: unknown = JSON.parse(await readFile(dataFile(), "utf8"));
    if (Array.isArray(value)) profiles = value.filter((p): p is Profile =>
      !!p && typeof p === "object" && typeof (p as Profile).id === "string" && typeof (p as Profile).name === "string");
  } catch { profiles = []; }
}
function validateName(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 48) throw new Error("Profile name must contain 1–48 characters.");
  return value.trim();
}
function validateProxy(value: unknown): ProxyConfig | undefined {
  if (value == null) return undefined;
  if (typeof value !== "object") throw new Error("Invalid proxy configuration.");
  const p = value as Partial<ProxyConfig>;
  if (!["http", "https", "socks5"].includes(String(p.protocol))) throw new Error("Unsupported proxy protocol.");
  if (typeof p.host !== "string" || !/^[a-zA-Z0-9.-]{1,253}$/.test(p.host)) throw new Error("Invalid proxy host.");
  if (!Number.isInteger(p.port) || Number(p.port) < 1 || Number(p.port) > 65535) throw new Error("Proxy port must be between 1 and 65535.");
  return { protocol: p.protocol as ProxyConfig["protocol"], host: p.host, port: Number(p.port) };
}
function safeProfile(profile: Profile) { return { ...profile, proxy: profile.proxy ? { ...profile.proxy } : undefined }; }

async function launchProfile(id: string) {
  const profile = profiles.find((p) => p.id === id);
  if (!profile) throw new Error("Profile not found.");
  const ses = session.fromPartition("persist:browserspace-" + profile.id);
  if (profile.proxy) {
    await ses.setProxy({ mode: "fixed_servers", proxyRules: profile.proxy.protocol + "://" + profile.proxy.host + ":" + profile.proxy.port, proxyBypassRules: "<local>" });
  } else {
    await ses.setProxy({ mode: "system" });
  }
  const existing = windows.get(id);
  if (existing && !existing.isDestroyed()) { existing.focus(); return { alreadyOpen: true, profile: safeProfile(profile) }; }
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
  const url = profile.startUrl && /^https?:\/\//i.test(profile.startUrl) ? profile.startUrl : "https://www.google.com";
  await win.loadURL(url);
  return { alreadyOpen: false, profile: safeProfile(profile) };
}

function registerIpc() {
  ipcMain.handle("profiles:list", () => profiles.map(safeProfile));
  ipcMain.handle("profiles:create", async (_event, input: { name?: unknown }) => {
    const profile: Profile = { id: randomUUID(), name: validateName(input?.name), createdAt: new Date().toISOString() };
    profiles.push(profile); await saveProfiles(); return safeProfile(profile);
  });
  ipcMain.handle("profiles:rename", async (_event, input: { id?: unknown; name?: unknown }) => {
    const p = profiles.find((item) => item.id === input?.id);
    if (!p) throw new Error("Profile not found.");
    p.name = validateName(input?.name); await saveProfiles();
    const win = windows.get(p.id); if (win && !win.isDestroyed()) win.setTitle("BrowserSpace — " + p.name);
    return safeProfile(p);
  });
  ipcMain.handle("profiles:set-proxy", async (_event, input: { id?: unknown; proxy?: unknown }) => {
    const p = profiles.find((item) => item.id === input?.id);
    if (!p) throw new Error("Profile not found.");
    p.proxy = validateProxy(input?.proxy); await saveProfiles(); return safeProfile(p);
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
}

app.whenReady().then(async () => {
  await loadProfiles(); registerIpc();
  if (!profiles.length) { profiles = [{ id: randomUUID(), name: "Personal", createdAt: new Date().toISOString() }]; await saveProfiles(); }
  const win = new BrowserWindow({ width: 900, height: 620, title: "BrowserSpace — Desktop runtime",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  const html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>BrowserSpace</title><style>body{background:#0d0f0e;color:#f0f3ed;font:15px system-ui;padding:48px;max-width:680px;margin:auto}h1{font-size:34px}b{color:#d6f269}.card{border:1px solid #293129;background:#151a16;border-radius:12px;padding:20px;line-height:1.7}</style><h1>BrowserSpace <b>Desktop</b></h1><p>Persistent profile runtime is online.</p><div class="card"><p>Profiles use separate persistent Chromium sessions.</p><p>HTTP, HTTPS and SOCKS5 proxy routing is available for unauthenticated endpoints.</p><p>Authenticated proxy credentials, live proxy checks and dashboard integration are not implemented yet.</p></div>';
  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
