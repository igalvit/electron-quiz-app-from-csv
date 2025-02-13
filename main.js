// main.js
//
// This file serves as the entry point for the Electron Quiz App from CSV.
// It is responsible for creating the main application window, handling IPC (Inter-Process Communication)
// for file selection, and managing application lifecycle events such as window creation and app termination.

// -----------------------------------------------------------------------------
// Import Required Modules
// -----------------------------------------------------------------------------
// Import Electron modules:
//  - app: Controls the application's lifecycle.
//  - BrowserWindow: Used to create and manage application windows.
//  - ipcMain: Handles inter-process communication (IPC) from the renderer process.
//  - dialog: Provides native dialog APIs (e.g., open file dialog).
const { app, BrowserWindow, ipcMain, dialog } = require('electron');

// Import Node.js 'path' module for handling and transforming file paths.
const path = require('path');

// -----------------------------------------------------------------------------
// Function: createWindow
// -----------------------------------------------------------------------------
// Description:
//   Creates and configures the main application window (BrowserWindow).
//   The window is configured with a fixed width and height, and its webPreferences
//   enable Node.js integration in the renderer process and disable context isolation.
//   (Note: Disabling context isolation may be acceptable for development, but for production,
//          consider using preload scripts and the contextBridge for improved security.)
//
// Returns:
//   A new instance of BrowserWindow that loads the main HTML file.
function createWindow() {
  // Create a new BrowserWindow instance with specified dimensions and web preferences.
  const win = new BrowserWindow({
    width: 1024,  // Set the window width to 1024 pixels.
    height: 768,  // Set the window height to 768 pixels.
    webPreferences: {
      nodeIntegration: true,   // Allow Node.js integration in the renderer process.
      contextIsolation: false  // Disable context isolation (consider enabling for security in production).
    }
  });

  // Load the main HTML file into the window.
  win.loadFile('index.html');
}

// -----------------------------------------------------------------------------
// App Lifecycle: Window Creation
// -----------------------------------------------------------------------------
// When Electron has finished initializing and is ready to create browser windows,
// call the createWindow function to open the main application window.
app.whenReady().then(createWindow);

// -----------------------------------------------------------------------------
// IPC Handler: 'select-csv-file'
// -----------------------------------------------------------------------------
// Description:
//   This handler listens for IPC invocations from the renderer process with the channel 'select-csv-file'.
//   When invoked, it opens a native file dialog that allows the user to select a CSV file.
//   After the dialog is closed, the handler returns the selected file path back to the renderer.
//   If the user cancels the dialog or does not select a file, the handler returns null.
ipcMain.handle('select-csv-file', async (event) => {
  // Show the native open file dialog with the specified options.
  const result = await dialog.showOpenDialog({
    title: 'Select CSV File',               // Dialog title.
    filters: [{ name: 'CSV Files', extensions: ['csv'] }], // Only allow files with the .csv extension.
    properties: ['openFile']                // Restrict dialog to file selection.
  });
  console.log("Dialog result:", result);

  // If the user cancels the dialog or if no file is selected, return null.
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  // Otherwise, return the first selected file path.
  return result.filePaths[0];
});

// -----------------------------------------------------------------------------
// App Lifecycle: macOS Window Activation
// -----------------------------------------------------------------------------
// On macOS, it's common for an app to remain active even when all windows are closed.
// This event listener re-creates a new window when the app is activated (e.g., when the dock icon is clicked)
// and there are no open windows.
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// -----------------------------------------------------------------------------
// App Lifecycle: Window All Closed
// -----------------------------------------------------------------------------
// This event listener is triggered when all windows have been closed.
// On platforms other than macOS, the application will quit.
// (On macOS, applications typically remain active until the user explicitly quits.)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
