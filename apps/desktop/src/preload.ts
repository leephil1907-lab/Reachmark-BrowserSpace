import { contextBridge, ipcRenderer } from "electron";

type Protocol = "http" | "https" | "socks5";
type ProxyInput = { name: string; protocol: Protocol; host: string; port: number; username?: string; password?: string };

contextBridge.exposeInMainWorld("browserSpace", {
  listProfiles: () => ipcRenderer.invoke("profiles:list"),
  getProfileStatus: (id: string) => ipcRenderer.invoke("profiles:status", { id }),
  createProfile: (name: string) => ipcRenderer.invoke("profiles:create", { name }),
  renameProfile: (id: string, name: string) => ipcRenderer.invoke("profiles:rename", { id, name }),
  setProfileProxy: (id: string, proxyId?: string) => ipcRenderer.invoke("profiles:set-proxy", { id, proxyId }),
  launchProfile: (id: string) => ipcRenderer.invoke("profiles:launch", { id }),
  stopProfile: (id: string) => ipcRenderer.invoke("profiles:stop", { id }),
  deleteProfile: (id: string) => ipcRenderer.invoke("profiles:delete", { id }),
  listProxies: () => ipcRenderer.invoke("proxies:list"),
  createProxy: (proxy: ProxyInput) => ipcRenderer.invoke("proxies:create", proxy),
  deleteProxy: (id: string) => ipcRenderer.invoke("proxies:delete", { id }),
  testProxy: (id: string) => ipcRenderer.invoke("proxies:test", { id }),
  verifyProfileIsolation: () => ipcRenderer.invoke("profiles:verify-isolation")
});
