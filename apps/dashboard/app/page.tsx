"use client";

import { useMemo, useState } from "react";
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

type ProxyItem = {
  id: string;
  name: string;
  endpoint: string;
  protocol: "HTTP" | "HTTPS" | "SOCKS5";
  region: string;
  assigned: number;
};

const initialProfiles: Profile[] = [
  { id: "profile-001", name: "Research", description: "Reading & reference", color: "lime", proxy: "proxy-01", lastUsed: "Just now", status: "Ready" },
  { id: "profile-002", name: "Client work", description: "Work accounts", color: "blue", proxy: null, lastUsed: "Yesterday", status: "Stopped" },
  { id: "profile-003", name: "Personal", description: "Everyday browsing", color: "violet", proxy: null, lastUsed: "Oct 14", status: "Stopped" }
];

const initialProxies: ProxyItem[] = [
  { id: "proxy-01", name: "Office gateway", endpoint: "proxy.example.net:8080", protocol: "HTTP", region: "Not verified", assigned: 1 }
];

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
  const [notice, setNotice] = useState("Workspace preview — changes stay in this tab and are not connected to a browser engine yet.");

  const filteredProfiles = useMemo(
    () => profiles.filter((profile) => (profile.name + " " + profile.description).toLowerCase().includes(query.toLowerCase())),
    [profiles, query]
  );

  function createProfile() {
    const name = profileName.trim();
    if (!name) return;
    const id = `profile-${String(Date.now()).slice(-6)}`;
    setProfiles((current) => [...current, { id, name, description: "New profile", color: "lime", proxy: null, lastUsed: "Never", status: "Stopped" }]);
    setProfileName("");
    setShowProfileForm(false);
    setNotice(`“${name}” was added to this preview. Persistent browser storage will be wired into the desktop runtime.`);
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

  function toggleProfile(profileId: string) {
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) return;
    setProfiles((current) => current.map((item) => item.id === profileId ? { ...item, status: item.status === "Ready" ? "Stopped" : "Ready", lastUsed: item.status === "Ready" ? item.lastUsed : "Just now" } : item));
    setNotice(profile.status === "Ready"
      ? `“${profile.name}” was marked stopped in the preview. No real browser process was started or stopped.`
      : `“${profile.name}” was marked ready in the preview. Desktop launch integration is not connected yet.`);
  }

  function assignProxy(profileId: string, proxyId: string) {
    setProfiles((current) => current.map((item) => item.id === profileId ? { ...item, proxy: proxyId || null } : item));
    setProxies((current) => current.map((proxy) => ({ ...proxy, assigned: profiles.filter((profile) => profile.id !== profileId && profile.proxy === proxy.id).length + (proxy.id === proxyId ? 1 : 0) })));
    setNotice("Assignment updated in this preview. Traffic routing is not active until the desktop session layer is connected.");
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
          <div className="top-actions"><span className="local-badge"><span className="pulse-dot" /> Local preview</span><button className="icon-button" aria-label="Activity" onClick={() => setActiveNav("Activity")}><Clock3 size={17} /></button><div className="user-avatar small">R</div></div>
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
            <div className="panel-footer"><span>Showing {filteredProfiles.length} of {profiles.length} profiles</span><span className="footer-note"><LockKeyhole size={13} /> Profile isolation is planned for the desktop runtime</span></div>
          </section>}

          {(activeNav === "Overview" || activeNav === "Proxies") && <section className="panel proxy-panel">
            <div className="panel-header"><div><h2>Proxy manager</h2><p>Keep proxy settings organized and assign them per profile.</p></div><button className="button secondary compact" onClick={() => setShowProxyForm(true)}><Plus size={15} /> Add proxy</button></div>
            {proxies.length === 0 ? <div className="empty-proxies"><Wifi size={22} /><b>No proxies configured</b><span>Add a proxy endpoint to prepare a profile assignment.</span></div> : <div className="proxy-list">{proxies.map((proxy) => <div className="proxy-row" key={proxy.id}><div className="proxy-symbol"><Wifi size={17} /></div><div className="proxy-details"><b>{proxy.name}</b><span>{proxy.protocol} · {proxy.endpoint}</span></div><span className="proxy-region"><span className="status-ring" />{proxy.region}</span><span className="assigned-count">{profiles.filter((profile) => profile.proxy === proxy.id).length} profiles</span><button className="row-action" onClick={() => { setProxies((current) => current.filter((item) => item.id !== proxy.id)); setProfiles((current) => current.map((profile) => profile.proxy === proxy.id ? { ...profile, proxy: null } : profile)); setNotice("Proxy removed from the preview and detached from preview profiles. No live network configuration was changed."); }}>Remove <X size={13} /></button></div>)}</div>}
            <div className="proxy-hint"><ShieldCheck size={15} /><span>Proxy credentials are not collected in this preview. Secure credential storage and live connection testing are part of the service layer.</span></div>
          </section>}

          {activeNav === "Activity" && <section className="panel activity-panel"><div className="panel-header"><div><h2>Workspace activity</h2><p>Actions in this session.</p></div><Clock3 size={18} /></div><div className="activity-item"><span className="activity-icon"><Check size={15} /></span><span><b>Workspace opened</b><small>Preview UI loaded successfully. No browser processes or network checks were run.</small></span><time>Now</time></div><div className="activity-item"><span className="activity-icon"><LockKeyhole size={15} /></span><span><b>Privacy boundary active</b><small>This dashboard does not collect proxy passwords or profile cookies.</small></span><time>Now</time></div></section>}

          <footer className="bottom-note"><span><Command size={13} /> Built for focused browsing</span><span><span className="footer-dot" /> Desktop engine not connected</span><a href="https://github.com/leephil1907-lab/Reachmark-BrowserSpace" target="_blank" rel="noreferrer">View repository <ArrowUpRight size={13} /></a></footer>
        </div>
      </section>

      {(showProfileForm || showProxyForm) && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setShowProfileForm(false); setShowProxyForm(false); } }}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-top"><div><span className="modal-eyebrow">{showProfileForm ? "PROFILE SETUP" : "NETWORK SETUP"}</span><h2 id="modal-title">{showProfileForm ? "Create a profile" : "Add a proxy"}</h2><p>{showProfileForm ? "Give this browsing session a clear purpose." : "Save non-secret connection details for the prototype."}</p></div><button className="icon-button" aria-label="Close" onClick={() => { setShowProfileForm(false); setShowProxyForm(false); }}><X size={17} /></button></div>
          {showProfileForm ? <form onSubmit={(event) => { event.preventDefault(); createProfile(); }}><label className="field-label">Profile name<input autoFocus value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="e.g. Design research" maxLength={48} required /></label><div className="field-note"><LockKeyhole size={14} /> A real isolated browser session will be created once the desktop runtime is integrated.</div><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setShowProfileForm(false)}>Cancel</button><button type="submit" className="button primary"><Plus size={15} /> Create profile</button></div></form> : <form onSubmit={(event) => { event.preventDefault(); createProxy(); }}><label className="field-label">Proxy name<input autoFocus value={proxyName} onChange={(event) => setProxyName(event.target.value)} placeholder="e.g. Office gateway" maxLength={48} required /></label><label className="field-label">Protocol<select value={proxyProtocol} onChange={(event) => setProxyProtocol(event.target.value as ProxyItem["protocol"])}><option>HTTP</option><option>HTTPS</option><option>SOCKS5</option></select></label><label className="field-label">Host and port<input value={proxyHost} onChange={(event) => setProxyHost(event.target.value)} placeholder="proxy.example.net:8080" required pattern="[^\s:/]+:[0-9]{1,5}" title="Enter a hostname or IP address followed by a colon and port, e.g. proxy.example.net:8080" /></label><div className="field-note"><LockKeyhole size={14} /> Do not enter credentials here. This preview does not securely store passwords or test connectivity.</div><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setShowProxyForm(false)}>Cancel</button><button type="submit" className="button primary"><Plus size={15} /> Add proxy</button></div></form>}
        </section>
      </div>}
      <div className="bottom-spacer" />
    </main>
  );
}
