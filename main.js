const { app, BrowserWindow, ipcMain } = require('electron')
const { autoUpdater } = require('electron-updater')

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
  autoUpdater.checkForUpdates()
}

// App lifecycle events
app.whenReady().then(createWindow)

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

// Print handling
ipcMain.on('print-file', async (event) => {
  const win = BrowserWindow.getFocusedWindow()
  
  try {
    const printOptions = {
      silent: false,
      printBackground: true,
      color: true,
      margins: { marginType: 'none' },
      landscape: false,
      scaleFactor: 100,
    }
    
    const success = await new Promise((resolve) => {
      win.webContents.print(printOptions, (success) => resolve(success))
    })
    
    event.reply('print-complete', { success })
  } catch (error) {
    console.error('Print error:', error)
    event.reply('print-complete', { 
      success: false, 
      error: error.message || 'Failed to print. Please check your printer connection.'
    })
  }
})

// Auto-update events
autoUpdater.on('update-available', (info) => {
  BrowserWindow.getFocusedWindow()?.webContents.send('update-available', info)
})

autoUpdater.on('download-progress', (progressObj) => {
  BrowserWindow.getFocusedWindow()?.webContents.send('download-progress', progressObj)
})

autoUpdater.on('update-downloaded', (info) => {
  BrowserWindow.getFocusedWindow()?.webContents.send('update-downloaded', info)
})

// Update handling
ipcMain.on('download-update', () => {
  autoUpdater.downloadUpdate()
})

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall()
})
