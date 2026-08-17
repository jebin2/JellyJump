const { ipcRenderer } = require('electron');

window.electronAPI = {
    isElectron: true,

    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
    getFileStats: (filePath) => ipcRenderer.invoke('get-file-stats', filePath),
    openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),

    readConfig: () => ipcRenderer.invoke('read-config'),
    writeConfig: (data) => ipcRenderer.invoke('write-config', data),

    // Media scanning. Results arrive as a stream of events rather than one
    // resolved array, so a large tree fills in progressively.
    startMediaScan: (options) => ipcRenderer.invoke('start-media-scan', options),
    cancelMediaScan: () => ipcRenderer.invoke('cancel-media-scan'),
    onMediaScanEvent: (callback) => {
        const listener = (_event, payload) => callback(payload);
        ipcRenderer.on('media-scan-event', listener);
        return () => ipcRenderer.removeListener('media-scan-event', listener);
    },
};
