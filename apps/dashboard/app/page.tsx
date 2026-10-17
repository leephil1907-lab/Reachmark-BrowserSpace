"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownUp, ArrowUpRight, Check, ChevronDown, CircleHelp,
  Clock3, Command, Globe2, Layers3, LockKeyhole, MoreHorizontal, Plus,
  Search, Settings2, ShieldCheck, Wifi, X
} from "lucide-react";

type Profile = {
  id: string;
  name: string;
  description: string;
  color: string;
  proxy: string | null;
  lastUsed: string;
  status: "Ready" | "Stopped";
};

type DesktopProfile = { id: string; name: string; createdAt: string; proxy?: { protocol: "http" | "https" | "socks5"; host: string; port: number } };
type DesktopApi = {
  listProfiles: () => Promise<DesktopProfile[]>;
  getProfileStatus: (id: string) => Promise<{ running: boolean }>;
  createProfile: (name: string) => Promise<DesktopProfile>;
  launchProfile: (id: string) => Promise<unknown>;
  stopProfile: (id: string) => Promise<unknown>;
  setProfileProxy: (id: string, proxy?: { protocol: "http" | "https" | "socks5"; host: string; port: number }) => Promise<unknown>;
};
declare global { interface Window { browserSpace?: DesktopApi } }

type ProxyItem = {
  id: string;
  name: string;
  endpoint: string;
  protocol: "HTTP" | "HTTPS" | "SOCKS5";
  region: string;
  assigned: number;
};

const initialProfiles: Profile[] = [
  { id: "profile-001", name: "Research", description: "Reading & reference", color: "lime", proxy: null, lastUsed: "Just now", status: "Ready" },
  { id: "profile-002", name: "Client work", description: "Work accounts", color: "blue", proxy: null, lastUsed: "Yesterday", status: "Stopped" },
  { id: "profile-003", name: "Personal", description: "Everyday browsing", color: "violet", proxy: null, lastUsed: "Oct 14", status: "Stopped" }
];

const initialProxies: ProxyItem[] = [];

const navItems = [
  { label: "Overview", icon: Layers3 },
  { label: "Profiles", icon: Globe2 },
  { label: "Proxies", icon: Wifi },
  { label: "Activity", icon: Activity }
];

export default function HomePage() {
  const [activeNav, setActiveNav] = useState("Overview");
  const [profiles, setProfiles] = useState(initialProfiles);
  const [proxies, setProxies] = useState(initialProxies);
  const [query, setQuery] = useState("");
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [showProxyForm, setShowProxyForm] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [proxyName, setProxyName] = useState("");
  const [proxyHost, setProxyHost] = useState("");
  const [proxyProtocol, setProxyProtocol] = useState<ProxyItem["protocol"]>("HTTP");
  const [desktopConnected, setDesktopConnected] = useState(false);
  const [notice, setNotice] = useState("Workspace preview — changes stay in this tab and are not connected to a browser engine yet.");

  useEffect(() => {
    const api = window.browserSpace;
    if (!api) return;
    let cancelled = false;
    setDesktopConnected(true);
    void api.listProfiles().then(async (items) => {
      const mapped = await Promise.all(items.map(async (item, index) => {
        const state = await api.getProfileStatus(item.id);
        const proxyId = item.proxy ? `${item.proxy.protocol}://${item.proxy.host}:${item.proxy.port}` : null;
        return {
          id: item.id, name: item.name, description: "Persistent desktop profile",
          color: ["lime", "blue", "violet"][index % 3],
          proxy: proxyId, lastUsed: "Local desktop", status: state.running ? "Ready" as const : "Stopped" as const,
          proxyConfig: item.proxy
        };
      }));
      if (cancelled) return;
      const unique = new Map<string, ProxyItem>();
      for (const item of mapped) {
        if (!item.proxyConfig) continue;
        const id = `${item.proxyConfig.protocol}://${item.proxyConfig.host}:${item.proxyConfig.port}`;
        if (!unique.has(id)) unique.set(id, { id, name: `${item.proxyConfig.host}`, endpoint: `${item.proxyConfig.host}:${item.proxyConfig.port}`, protocol: item.proxyConfig.protocol.toUpperCase() as ProxyItem["protocol"], region: "Saved locally", assigned: 0 });
      }
      setProxies(Array.from(unique.values()));
      setProfiles(mapped.map(({ proxyConfig: _proxyConfig, ...item }) => item));
      setNotice("Desktop runtime connected. Profile creation, launch/stop, and assigned proxy routing use the local Electron runtime.");
    }).catch(() => {
      if (!cancelled) setNotice("Desktop bridge detected, but profiles could not be loaded. Restart the desktop app and check its runtime logs.");
    });
    return () => { cancelled = true; };
  }, []);

  const filteredProfiles = useMemo(
    () => profiles.filter((profile) => (profile.name + " " + profile.description).toLowerCase().includes(query.toLowerCase())),
    [profiles, query]
  );

  async function createProfile() {
    const name = profileName.trim();
    if (!name) return;
    if (window.browserSpace) {
      try {
        const created = await window.browserSpace.createProfile(name);
        setProfiles((current) => [...current, { id: created.id, name: created.name, description: "Persistent desktop profile", color: "lime", proxy: null, lastUsed: "Never", status: "Stopped" }]);
        setNotice(`“${name}” was saved to the local desktop profile store.`);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Could not create the desktop profile.");
        return;
      }
    } else {
      const id = `profile-${String(Date.now()).slice(-6)}`;
      setProfiles((current) => [...current, { id, name, description: "New profile", color: "lime", proxy: null, lastUsed: "Never", status: "Stopped" }]);
      setNotice(`“${name}” was added to this preview. Run the desktop app to persist profiles and launch browser sessions.`);
    }
    setProfileName("");
    setShowProfileForm(false);
  }

  function createProxy() {
    const name = proxyName.trim();
    const endpoint = proxyHost.trim();
    if (!name || !endpoint) return;
    const id = `proxy-${String(Date.now()).slice(-6)}`;
    setProxies((current) => [...current, { id, name, endpoint, protocol: proxyProtocol, region: "Not tested", assigned: 0 }]);
    setProxyName("");
    setProxyHost("");
    setShowProxyForm(false);
    setNotice("Proxy settings were added to the preview only. Credentials and real connectivity checks require the secure desktop/API service.");
    setActiveNav("Proxies");
  }

  async function toggleProfile(profileId: string) {
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) return;
    if (window.browserSpace && desktopConnected) {
      try {
        if (profile.status === "Ready") {
          await window.browserSpace.stopProfile(profileId);
          setProfiles((current) => current.map((item) => item.id === profileId ? { ...item, status: "Stopped" } : item));
          setNotice(`“${profile.name}” browser window was closed.`);
        } else {
          await window.browserSpace.launchProfile(profileId);
          setProfiles((current) => current.map((item) => item.id === profileId ? { ...item, status: "Ready", lastUsed: "Just now" } : item));
          setNotice(`“${profile.name}” launched in its own persistent browser session.`);
        }
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "The desktop runtime could not change this profile state.");
      }
      return;
    }
    setProfiles((current) => current.map((item) => item.id === profileId ? { ...item, status: item.status === "Ready" ? "Stopped" : "Ready", lastUsed: item.status === "Ready" ? item.lastUsed : "Just now" } : item));
    setNotice(profile.status === "Ready"
      ? `“${profile.name}” was marked stopped in the preview. No real browser process was changed.`
      : `“${profile.name}” was marked ready in the preview. Launch the desktop app to open a real session.`);
  }

  async function assignProxy(profileId: string, proxyId: string) {
    if (window.browserSpace && desktopConnected) {
      try {
        const selected = proxies.find((proxy) => proxy.id === proxyId);
        if (selected) {
          const match = /^(.+):(\d{1,5})$/.exec(selected.endpoint);
          if (!match) throw new Error("Proxy endpoint must be a hostname or IP address followed by a port.");
          await window.browserSpace.setProfileProxy(profileId, {
            protocol: selected.protocol.toLowerCase() as "http" | "https" | "socks5",
            host: match[1], port: Number(match[2])
          });
        } else {
          await window.browserSpace.setProfileProxy(profileId, undefined);
        }
        setProfiles((current) => current.map((item) => item.id === profileId ? { ...item, proxy: proxyId || null } : item));
        setProxies((current) => current.map((proxy) => ({ ...proxy, assigned: profiles.filter((profile) => profile.id !== profileId && profile.proxy === proxy.id).length + (proxy.id === proxyId ? 1 : 0) })));
        setNotice("Proxy assignment saved to the desktop profile. The setting takes effect the next time you launch that profile.");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Could not save the proxy assignment.");
      }
      return;
    }
    setProfiles((current) => current.map((item) => item.id === profileId ? { ...item, proxy: proxyId || null } : item));
    setProxies((current) => current.map((proxy) => ({ ...proxy, assigned: profiles.filter((profile) => profile.id !== profileId && profile.proxy === proxy.id).length + (proxy.id === proxyId ? 1 : 0) })));
    setNotice("Assignment updated in this preview only. Launch the desktop app to persist proxy settings and route traffic.");
  }

  async function removeProxy(proxyId: string) {
    const assignedProfiles = profiles.filter((profile) => profile.proxy === proxyId);
    if (window.browserSpace && desktopConnected) {
      try {
        await Promise.all(assignedProfiles.map((profile) => window.browserSpace!.setProfileProxy(profile.id, undefined)));
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Could not remove proxy assignments.");
        return;
      }
    }
    setProxies((current) => current.filter((item) => item.id !== proxyId));
    setProfiles((current) => current.map((profile) => profile.proxy === proxyId ? { ...profile, proxy: null } : profile));
    setNotice(desktopConnected
      ? "Proxy removed from the dashboard and detached from assigned desktop profiles."
      : "Proxy removed from this preview and detached from preview profiles.");
  }

  const activeProfiles = profiles.filter((profile) => profile.status === "Ready").length;

  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setActiveNav("Overview"); }}>
          <span className="brand-mark">B</span>
          <span><strong>BrowserSpace</strong><small>by Reachmark</small></span>
        </a>
        <div className="workspace-label">WORKSPACE <ChevronDown size={14} /></div>
        <div className="workspace-card"><span className="workspace-avatar">R</span><span><b>Personal workspace</b><small>Local preview</small></span><MoreHorizontal size={17} /></div>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={activeNav === label ? "nav-item active" : "nav-item"} onClick={() => setActiveNav(label)}>
              <Icon size={17} strokeWidth={1.8} /> {label}
              {label === "Profiles" && <span className="nav-count">{profiles.length}</span>}
              {label === "Proxies" && <span className="nav-count">{proxies.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="secure-note"><LockKeyhole size={16} /><span><b>Privacy by design</b><small>Sessions stay separate</small></span></div>
          <button className="nav-item" onClick={() => setNotice("Settings are planned; no account or cloud sync is configured in this preview.")}><Settings2 size={17} /> Settings</button>
          <button className="nav-item" onClick={() => setNotice("Help documentation will be added with the desktop runtime.")}><CircleHelp size={17} /> Help & docs</button>
          <div className="user-chip"><div className="user-avatar">R</div><span><b>Reachmark user</b><small>Local workspace</small></span><MoreHorizontal size={17} /></div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><b>{activeNav}</b></div>
          <div className="top-actions"><span className="local-badge"><span className="pulse-dot" /> {desktopConnected ? "Desktop connected" : "Local preview"}</span><button className="icon-button" aria-label="Activity" onClick={() => setActiveNav("Activity")}><Clock3 size={17} /></button><div className="user-avatar small">R</div></div>
        </header>

        <div className="content">
          <div className="welcome-row">
            <div><div className="eyebrow"><span className="eyebrow-line" /> YOUR PRIVATE WORKSPACE</div><h1>{activeNav === "Overview" ? "Your browser, organized." : activeNav}</h1><p className="subtitle">{activeNav === "Overview" ? "Keep browsing sessions separate, persistent, and easy to manage." : activeNav === "Profiles" ? "Create and organize independent browsing sessions." : activeNav === "Proxies" ? "Manage proxy configurations and profile assignments." : "A transparent record of workspace actions."}</p></div>
            <div className="welcome-actions"><button className="button secondary" onClick={() => setShowProxyForm(true)}><Wifi size={16} /> Add proxy</button><button className="button primary" onClick={() => setShowProfileForm(true)}><Plus size={17} /> New profile</button></div>
          </div>

          <div className="notice"><ShieldCheck size={17} /><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice("")}><X size={15} /></button></div>

          {activeNav === "Overview" && <div className="stats-grid">
            <div className="stat-card"><div className="stat-top"><span>Browser profiles</span><span className="stat-icon"><Globe2 size={17} /></span></div><div className="stat-value">{profiles.length.toString().padStart(2, "0")}</div><div className="stat-foot"><span className="stat-neutral">Local preview</span><span>profiles configured</span></div></div>
            <div className="stat-card"><div className="stat-top"><span>Active sessions</span><span className="stat-icon green"><Activity size={17} /></span></div><div className="stat-value">{activeProfiles.toString().padStart(2, "0")}</div><div className="stat-foot"><span className="stat-neutral">Preview state</span><span>not real processes</span></div></div>
            <div className="stat-card"><div className="stat-top"><span>Saved proxies</span><span className="stat-icon purple"><Wifi size={17} /></span></div><div className="stat-value">{proxies.length.toString().padStart(2, "0")}</div><div className="stat-foot"><span className="stat-neutral">Not tested</span><span>routing unverified</span></div></div>
          </div>}

          {(activeNav === "Overview" || activeNav === "Profiles") && <section className="panel">
            <div className="panel-header"><div><h2>Browser profiles</h2><p>Separate sessions for different parts of your life and work.</p></div><div className="table-actions"><label className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search profiles" /></label><button className="icon-button" aria-label="Sort profiles" onClick={() => setProfiles((current) => [...current].reverse())}><ArrowDownUp size={16} /></button><button className="button compact" onClick={() => setShowProfileForm(true)}><Plus size={15} /> Create</button></div></div>
            <div className="table-wrap"><table><thead><tr><th>PROFILE</th><th>PROXY</th><th>LAST USED</th><th>STATUS</th><th /></tr></thead><tbody>
              {filteredProfiles.map((profile) => <tr key={profile.id}><td><div className="profile-cell"><span className={`profile-icon ${profile.color}`}><Globe2 size={17} /></span><span><b>{profile.name}</b><small>{profile.description}</small></span></div></td><td><select className="proxy-select" value={profile.proxy ?? ""} onChange={(event) => assignProxy(profile.id, event.target.value)} aria-label={`Proxy for ${profile.name}`}><option value="">Direct connection</option>{proxies.map((proxy) => <option key={proxy.id} value={proxy.id}>{proxy.name}</option>)}</select></td><td className="muted-cell">{profile.lastUsed}</td><td><span className={profile.status === "Ready" ? "status ready" : "status stopped"}><span />{profile.status}</span></td><td><button className="row-action" onClick={() => toggleProfile(profile.id)}>{profile.status === "Ready" ? "Stop" : "Launch"} <ArrowUpRight size={14} /></button></td></tr>)}
              {filteredProfiles.length === 0 && <tr><td colSpan={5} className="empty-state">No profiles match “{query}”.</td></tr>}
            </tbody></table></div>
            <div className="panel-footer"><span>Showing {filteredProfiles.length} of {profiles.length} profiles</span><span className="footer-note"><LockKeyhole size={13} /> {desktopConnected ? "Isolated desktop sessions" : "Profile isolation requires desktop runtime"}</span></div>
          </section>}

          {(activeNav === "Overview" || activeNav === "Proxies") && <section className="panel proxy-panel">
            <div className="panel-header"><div><h2>Proxy manager</h2><p>Keep proxy settings organized and assign them per profile.</p></div><button className="button secondary compact" onClick={() => setShowProxyForm(true)}><Plus size={15} /> Add proxy</button></div>
            {proxies.length === 0 ? <div className="empty-proxies"><Wifi size={22} /><b>No proxies configured</b><span>Add a proxy endpoint to prepare a profile assignment.</span></div> : <div className="proxy-list">{proxies.map((proxy) => <div className="proxy-row" key={proxy.id}><div className="proxy-symbol"><Wifi size={17} /></div><div className="proxy-details"><b>{proxy.name}</b><span>{proxy.protocol} · {proxy.endpoint}</span></div><span className="proxy-region"><span className="status-ring" />{proxy.region}</span><span className="assigned-count">{profiles.filter((profile) => profile.proxy === proxy.id).length} profiles</span><button className="row-action" onClick={() => { void removeProxy(proxy.id); }}>Remove <X size={13} /></button></div>)}</div>}
            <div className="proxy-hint"><ShieldCheck size={15} /><span>Credentials and live proxy diagnostics are not yet exposed in the dashboard. Saved profile assignments are applied by the desktop runtime.</span></div>
          </section>}

          {activeNav === "Activity" && <section className="panel activity-panel"><div className="panel-header"><div><h2>Workspace activity</h2><p>Actions in this session.</p></div><Clock3 size={18} /></div><div className="activity-item"><span className="activity-icon"><Check size={15} /></span><span><b>Workspace opened</b><small>Preview UI loaded successfully. No browser processes or network checks were run.</small></span><time>Now</time></div><div className="activity-item"><span className="activity-icon"><LockKeyhole size={15} /></span><span><b>Privacy boundary active</b><small>This dashboard does not collect proxy passwords or profile cookies.</small></span><time>Now</time></div></section>}

          <footer className="bottom-note"><span><Command size={13} /> Built for focused browsing</span><span><span className="footer-dot" /> {desktopConnected ? "Desktop engine connected" : "Desktop engine not connected"}</span><a href="https://github.com/leephil1907-lab/Reachmark-BrowserSpace" target="_blank" rel="noreferrer">View repository <ArrowUpRight size={13} /></a></footer>
        </div>
      </section>

      {(showProfileForm || showProxyForm) && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setShowProfileForm(false); setShowProxyForm(false); } }}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-top"><div><span className="modal-eyebrow">{showProfileForm ? "PROFILE SETUP" : "NETWORK SETUP"}</span><h2 id="modal-title">{showProfileForm ? "Create a profile" : "Add a proxy"}</h2><p>{showProfileForm ? "Give this browsing session a clear purpose." : "Save endpoint details for this workspace; assigning it to a desktop profile persists the routing settings."}</p></div><button className="icon-button" aria-label="Close" onClick={() => { setShowProfileForm(false); setShowProxyForm(false); }}><X size={17} /></button></div>
          {showProfileForm ? <form onSubmit={(event) => { event.preventDefault(); createProfile(); }}><label className="field-label">Profile name<input autoFocus value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="e.g. Design research" maxLength={48} required /></label><div className="field-note"><LockKeyhole size={14} /> {desktopConnected ? "This profile will be saved to the local desktop store." : "Run the desktop app to save this profile persistently."}</div><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setShowProfileForm(false)}>Cancel</button><button type="submit" className="button primary"><Plus size={15} /> Create profile</button></div></form> : <form onSubmit={(event) => { event.preventDefault(); createProxy(); }}><label className="field-label">Proxy name<input autoFocus value={proxyName} onChange={(event) => setProxyName(event.target.value)} placeholder="e.g. Office gateway" maxLength={48} required /></label><label className="field-label">Protocol<select value={proxyProtocol} onChange={(event) => setProxyProtocol(event.target.value as ProxyItem["protocol"])}><option>HTTP</option><option>HTTPS</option><option>SOCKS5</option></select></label><label className="field-label">Host and port<input value={proxyHost} onChange={(event) => setProxyHost(event.target.value)} placeholder="proxy.example.net:8080" required pattern="[^\s:/]+:[0-9]{1,5}" title="Enter a hostname or IP address followed by a colon and port, e.g. proxy.example.net:8080" /></label><div className="field-note"><LockKeyhole size={14} /> Credentials and live connectivity tests are not available in this form yet.</div><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setShowProxyForm(false)}>Cancel</button><button type="submit" className="button primary"><Plus size={15} /> Add proxy</button></div></form>}
        </section>
      </div>}
      <div className="bottom-spacer" />
    </main>
  );
}
