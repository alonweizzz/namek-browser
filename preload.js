const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('namek', {
  call: (command, payload) => ipcRenderer.invoke('namek:command', { command, payload }),
  onState: (handler) => {
    const listener = (_event, state) => handler(state);
    ipcRenderer.on('namek:state', listener);
    return () => ipcRenderer.removeListener('namek:state', listener);
  }
});
