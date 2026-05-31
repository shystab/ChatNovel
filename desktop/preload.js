const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("novelDesktop", {
  versions: () => ipcRenderer.invoke("desktop:versions"),
  openExternal: (url) => ipcRenderer.invoke("desktop:open-external", url),
});
