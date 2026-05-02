const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cookieApp', {
  getAppState: () => ipcRenderer.invoke('get-app-state'),
  refreshCookie: () => ipcRenderer.invoke('refresh-cookie'),
  testCookieValidity: () => ipcRenderer.invoke('test-cookie-validity'),
  copyCookie: () => ipcRenderer.invoke('copy-cookie'),
  saveCookie: () => ipcRenderer.invoke('save-cookie'),
  reloadLoginPage: () => ipcRenderer.invoke('reload-login-page'),
  onCookieUpdated: (callback) => {
    ipcRenderer.on('cookie-updated', (_event, payload) => callback(payload));
  },
});
