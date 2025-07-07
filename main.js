const { app, BrowserWindow, ipcMain } = require('electron')
const { autoUpdater } = require('electron-updater')

// Configure auto updater
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

let mainWindow

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  mainWindow.loadFile('index.html')
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
ipcMain.on('print-file', async (event, { filePath } = {}) => {
  if (!mainWindow) {
    event.reply('print-complete', { 
      success: false, 
      error: 'No window available for printing'
    })
    return
  }
  
  try {
    const printOptions = {
      silent: false,
      printBackground: true,
      color: true,
      margins: { marginType: 'none' },
      landscape: false,
      scaleFactor: 100,
    }
    
    if (filePath) {
      // Print file
      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      })
      
      try {
        await printWindow.loadFile(filePath)
        // Wait for the window to finish loading
        await new Promise(resolve => printWindow.webContents.on('did-finish-load', resolve))
        
        const success = await new Promise((resolve) => {
          printWindow.webContents.print(printOptions, (success) => resolve(success))
        })
        
        event.reply('print-complete', { success })
      } catch (printError) {
        console.error('Print file error:', printError)
        event.reply('print-complete', { 
          success: false, 
          error: printError.message || 'Failed to print file. Please check the file format and try again.'
        })
      } finally {
        printWindow.close()
      }
    } else {
      // Print current page
      const success = await new Promise((resolve) => {
        mainWindow.webContents.print(printOptions, (success) => resolve(success))
      })
      
      event.reply('print-complete', { success })
    }
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
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info)
  }
})

autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow) {
    mainWindow.webContents.send('download-progress', progressObj)
  }
})

autoUpdater.on('update-downloaded', (info) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info)
  }
})

// Update handling
ipcMain.on('download-update', () => {
  autoUpdater.downloadUpdate()
})

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall()
})
