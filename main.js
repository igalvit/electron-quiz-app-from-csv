// main.js

// Import required modules from Electron and Node.js.
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

/**
 * createWindow - Creates and configures the main application window.
 * The window is set up with Node integration enabled and context isolation disabled.
 */
function createWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      // Enable Node.js integration in the renderer process.
      nodeIntegration: true,
      // Disable context isolation for simplicity.
      // (For production, consider using preload scripts and contextBridge for better security.)
      contextIsolation: false
    }
  });

  // Load the main HTML file into the window.
  win.loadFile('index.html');
}

// When Electron is ready, create the application window.
app.whenReady().then(createWindow);

/**
 * IPC Handler: 'select-csv-file'
 * This handler listens for IPC invocations from the renderer process,
 * opens a native file dialog to select a CSV file, and returns the selected file path.
 */
ipcMain.handle('select-csv-file', async (event) => {
  const result = await dialog.showOpenDialog({
    title: 'Select CSV File',
    filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    properties: ['openFile']
  });
  console.log("Dialog result:", result);

  // If the user cancels or does not select a file, return null.
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  // Otherwise, return the first selected file path.
  return result.filePaths[0];
});

// macOS: Re-create a window when the app is re-activated (for example, when clicking the dock icon).
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Quit the application when all windows are closed (except on macOS).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
