const path = require('path');

// Start Express API server (server.js handles SQLite & Express routes)
require('./server');

// Try requiring Electron (if running via Electron)
let electron;
try {
    electron = require('electron');
} catch (e) {
    electron = null;
}

if (electron && electron.app) {
    const { app, BrowserWindow } = electron;

    function createWindow() {
        const win = new BrowserWindow({
            width: 1280,
            height: 800,
            title: "Klinik Sehat - Sistem Antrian Terpadu",
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });

        win.loadURL('http://localhost:5000/admin.html');
    }

    app.whenReady().then(createWindow);

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
}