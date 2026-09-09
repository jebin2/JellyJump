const { contextBridge, ipcRenderer } = require('electron');

// Exposed through contextBridge rather than assigned onto `window`: the
// renderer runs with context isolation on, so preload and page globals are
// separate worlds and a plain assignment here would never be visible there.
// Everything below crosses as structured-cloneable values (plain objects,
// strings, ArrayBuffers) or as proxied functions, both of which the bridge
// supports.
contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,

    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
    getFileStats: (filePath) => ipcRenderer.invoke('get-file-stats', filePath),
    openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),

    readConfig: () => ipcRenderer.invoke('read-config'),
    writeConfig: (data) => ipcRenderer.invoke('write-config', data),

    // Media scanning. Results arrive as a stream of events rather than one
    // resolved array, so a large tree fills in progressively.
    // Library sharing over Tailscale. Every call returns the full state, so the
    // UI never has to infer what happened from a boolean.
    getShareStatus: () => ipcRenderer.invoke('share-status'),
    enableShare: () => ipcRenderer.invoke('share-enable'),
    disableShare: () => ipcRenderer.invoke('share-disable'),
    regenerateShareToken: () => ipcRenderer.invoke('share-regenerate-token'),

    startMediaScan: (options) => ipcRenderer.invoke('start-media-scan', options),
    cancelMediaScan: () => ipcRenderer.invoke('cancel-media-scan'),
    onMediaScanEvent: (callback) => {
        const listener = (_event, payload) => callback(payload);
        ipcRenderer.on('media-scan-event', listener);
        return () => ipcRenderer.removeListener('media-scan-event', listener);
    },
});
