import { contextBridge, ipcRenderer } from "electron";

type ProxyConfig = { protocol: "http" | "https" | "socks5"; host: string; port: number; username?: string; password?: string };

contextBridge.exposeInMainWorld("browserSpace", {
  listProfiles: () => ipcRenderer.invoke("profiles:list"),
  getProfileStatus: (id: string) => ipcRenderer.invoke("profiles:status", { id }),
  createProfile: (name: string) => ipcRenderer.invoke("profiles:create", { name }),
  renameProfile: (id: string, name: string) => ipcRenderer.invoke("profiles:rename", { id, name }),
  setProfileProxy: (id: string, proxy?: ProxyConfig) => ipcRenderer.invoke("profiles:set-proxy", { id, proxy }),
  launchProfile: (id: string) => ipcRenderer.invoke("profiles:launch", { id }),
  stopProfile: (id: string) => ipcRenderer.invoke("profiles:stop", { id }),
  deleteProfile: (id: string) => ipcRenderer.invoke("profiles:delete", { id })
});
