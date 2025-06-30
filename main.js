const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')

// Configure auto updater
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  win.loadFile('index.html')

  // Check for updates when app starts
  autoUpdater.checkForUpdates()

  // Auto updater events
  autoUpdater.on('update-available', (info) => {
    win.webContents.send('update-available', info)
  })

  autoUpdater.on('download-progress', (progressObj) => {
    win.webContents.send('download-progress', progressObj)
  })

  autoUpdater.on('update-downloaded', (info) => {
    win.webContents.send('update-downloaded', info)
  })
}

app.whenReady().then(() => {
  createWindow()
})

// Handle get printers request
ipcMain.handle('get-printers', async (event) => {
  const win = BrowserWindow.getFocusedWindow()
  try {
    const printers = await win.webContents.getPrintersAsync()
    return { success: true, printers }
  } catch (error) {
    console.error('Error getting printers:', error)
    return { success: false, error: error.message }
  }
})

// Handle printing request
ipcMain.on('print-file', async (event, { filePath, printerName }) => {
  const win = BrowserWindow.getFocusedWindow()
  
  try {
    const data = {
      silent: false,
      printBackground: true,
      deviceName: printerName || '', // Use selected printer or show dialog if empty
    }
    
    // If filePath is provided, print that file, otherwise print current window
    if (filePath) {
      // Create a new window to load and print the file
      const printWindow = new BrowserWindow({ show: false })
      await printWindow.loadFile(filePath)
      const result = await printWindow.webContents.print(data)
      printWindow.close()
      event.reply('print-complete', { success: result })
    } else {
      // Print the current window
      const result = await win.webContents.print(data)
      event.reply('print-complete', { success: result })
    }
  } catch (error) {
    console.error('Printing error:', error)
    event.reply('print-complete', { 
      success: false, 
      error: error.message || 'Failed to print. Please make sure a printer is properly connected and try again.'
    })
  }
})

// Handle update download request
ipcMain.on('download-update', () => {
  autoUpdater.downloadUpdate()
})

// Handle update installation request
ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
