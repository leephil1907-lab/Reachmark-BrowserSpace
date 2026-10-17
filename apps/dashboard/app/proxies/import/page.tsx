"use client";

import { useState } from "react";
import { ArrowLeft, FileUp, LockKeyhole, ShieldCheck, Wifi } from "lucide-react";
import Link from "next/link";

type Protocol = "http" | "https" | "socks5";
type SavedProxy = { id: string; name: string; host: string; port: number; protocol: Protocol; hasCredentials: boolean };
type BrowserSpaceApi = {
  createProxy: (proxy: { name: string; protocol: Protocol; host: string; port: number; username?: string; password?: string }) => Promise<SavedProxy>;
};
declare global { interface Window { browserSpace?: BrowserSpaceApi } }

type ParsedProxy = { host: string; port: number; username: string; password: string; line: number };

function parseProxyFile(text: string): { proxies: ParsedProxy[]; errors: string[] } {
  const proxies: ParsedProxy[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const parts = line.split(":");
    if (parts.length !== 4) {
      errors.push(`Line ${index + 1}: expected host:port:username:password`);
      return;
    }
    const [host, rawPort, username, password] = parts;
    const port = Number(rawPort);
    if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !username || !password) {
      errors.push(`Line ${index + 1}: invalid host, port, username, or password`);
      return;
    }
    proxies.push({ host, port, username, password, line: index + 1 });
  });
  return { proxies, errors };
}

export default function ImportProxiesPage() {
  const [fileText, setFileText] = useState("");
  const [fileName, setFileName] = useState("");
  const [protocol, setProtocol] = useState<Protocol>("http");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const parsed = parseProxyFile(fileText);

  async function readFile(file?: File) {
    if (!file) return;
    setFileName(file.name);
    setMessage("");
    setErrors([]);
    setFileText(await file.text());
  }

  async function importProxies() {
    if (!window.browserSpace) {
      setMessage("Open this page inside the BrowserSpace desktop app. The web preview cannot securely save proxy credentials.");
      return;
    }
    if (!parsed.proxies.length) {
      setErrors(parsed.errors.length ? parsed.errors : ["No valid proxy entries were found."]);
      return;
    }
    setBusy(true);
    setMessage("");
    setErrors(parsed.errors);
    let saved = 0;
    const failures: string[] = [];
    try {
      for (let index = 0; index < parsed.proxies.length; index++) {
        const item = parsed.proxies[index];
        setProgress(`Saving proxy ${index + 1} of ${parsed.proxies.length}…`);
        try {
          await window.browserSpace.createProxy({
            name: `Webshare ${item.host}:${item.port}`,
            protocol,
            host: item.host,
            port: item.port,
            username: item.username,
            password: item.password
          });
          saved++;
        } catch (error) {
          failures.push(`Line ${item.line}: ${error instanceof Error ? error.message : "Could not save proxy"}`);
        }
      }
      setMessage(`Imported ${saved} of ${parsed.proxies.length} proxy entries. Credentials were passed to the desktop secure-storage handler; they are not displayed here.`);
      if (failures.length) setErrors((current) => [...current, ...failures]);
      if (saved > 0) setProgress("Import finished. Return to Proxy manager and test each endpoint.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0d100e", color: "#f1f3ed", padding: "32px 18px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#d6f269", textDecoration: "none", marginBottom: 28 }}>
          <ArrowLeft size={16} /> Back to BrowserSpace
        </Link>
        <div style={{ border: "1px solid #2a3229", background: "#141914", borderRadius: 20, padding: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span style={{ display: "grid", placeItems: "center", width: 46, height: 46, borderRadius: 13, background: "#252d1b", color: "#d6f269" }}><FileUp size={23} /></span>
            <div><div style={{ color: "#d6f269", fontSize: 11, letterSpacing: 2, fontWeight: 700 }}>PROXY MANAGER</div><h1 style={{ margin: "4px 0 0", fontSize: 28 }}>Import proxy list</h1></div>
          </div>
          <p style={{ color: "#a9b2a7", lineHeight: 1.6 }}>Import a provider text file formatted as <code>host:port:username:password</code>. Credentials are processed locally by this page and passed directly to BrowserSpace’s desktop IPC handler for OS-backed encryption. They are not sent to a web API or printed on screen.</p>

          <label style={{ display: "block", margin: "22px 0 8px", fontWeight: 650 }}>Proxy list (.txt)</label>
          <input type="file" accept=".txt,text/plain" disabled={busy} onChange={(event) => void readFile(event.target.files?.[0])} style={{ display: "block", width: "100%", boxSizing: "border-box", padding: 12, borderRadius: 10, border: "1px solid #384137", background: "#0d100e", color: "#f1f3ed" }} />
          {fileName && <p style={{ color: "#a9b2a7", fontSize: 13, marginTop: 8 }}>Selected file: {fileName}</p>}

          <label style={{ display: "block", margin: "20px 0 8px", fontWeight: 650 }}>Proxy protocol</label>
          <select value={protocol} onChange={(event) => setProtocol(event.target.value as Protocol)} disabled={busy} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #384137", background: "#0d100e", color: "#f1f3ed" }}>
            <option value="http">HTTP (typical for Webshare endpoint lists)</option>
            <option value="https">HTTPS</option>
            <option value="socks5">SOCKS5</option>
          </select>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18, color: "#b9c4b5", fontSize: 13 }}>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><LockKeyhole size={15} /> Credentials never shown</span>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><ShieldCheck size={15} /> OS-backed encryption required</span>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Wifi size={15} /> Test after import</span>
          </div>

          <div style={{ marginTop: 22, padding: 14, border: "1px solid #303a2d", borderRadius: 12, background: "#101510" }}>
            <strong>{parsed.proxies.length} valid entries detected</strong>
            {parsed.errors.length > 0 && <p style={{ color: "#f2b8ad", marginBottom: 0 }}>{parsed.errors.length} malformed lines will be skipped.</p>}
          </div>

          {message && <div role="status" style={{ marginTop: 16, padding: 13, borderRadius: 10, background: "#1a2416", border: "1px solid #384b25", lineHeight: 1.5 }}>{message}</div>}
          {progress && <p style={{ color: "#d6f269" }}>{progress}</p>}
          {errors.length > 0 && <div role="alert" style={{ marginTop: 14, color: "#f2b8ad", fontSize: 13, lineHeight: 1.6 }}><strong>Items to review</strong><ul>{errors.map((error, index) => <li key={index}>{error}</li>)}</ul></div>}

          <button type="button" onClick={() => void importProxies()} disabled={busy || parsed.proxies.length === 0} style={{ width: "100%", marginTop: 22, border: 0, borderRadius: 11, padding: "13px 16px", background: busy || parsed.proxies.length === 0 ? "#51594a" : "#d6f269", color: "#151911", fontWeight: 750, cursor: busy || parsed.proxies.length === 0 ? "not-allowed" : "pointer" }}>
            {busy ? "Importing securely…" : `Import ${parsed.proxies.length} proxies`}
          </button>
          <p style={{ color: "#899486", fontSize: 12, lineHeight: 1.5, marginTop: 14 }}>This import does not verify whether proxies are online or identify their countries. It only saves valid entries. Run the built-in Test for each proxy after importing. If an import is interrupted, check the catalogue before retrying to avoid duplicates.</p>
        </div>
      </div>
    </main>
  );
}
