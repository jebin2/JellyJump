const { ipcRenderer } = require('electron');

window.electronAPI = {
    isElectron: true,

    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
    getFileStats: (filePath) => ipcRenderer.invoke('get-file-stats', filePath),
    openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options)
};
