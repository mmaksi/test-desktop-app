const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')

// Configure auto updater
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

let mainWindow = null

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

  // Check for updates when app starts
  autoUpdater.checkForUpdates()

  // Auto updater events
  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-available', info)
  })

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow.webContents.send('download-progress', progressObj)
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('update-downloaded', info)
  })
}

app.whenReady().then(() => {
  createWindow()
})

// Handle printing request
ipcMain.on('print-file', async (event, { filePath }) => {
  try {
    // Print settings
    const printOptions = {
      silent: false,
      printBackground: true,
      color: true,
      margins: {
        marginType: 'none'
      },
      landscape: false,
      scaleFactor: 100,
    }
    
    // If filePath is provided, print that file, otherwise print current window
    if (filePath) {
      // Create a new window to load and print the file
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
          printWindow.webContents.print(printOptions, (success, failureReason) => {
            resolve(success)
          })
        })
        
        event.reply('print-complete', { success })
      } catch (printError) {
        console.error('Print file error:', printError)
        event.reply('print-complete', { 
          success: false, 
          error: printError.message || 'Failed to print file' 
        })
      } finally {
        if (!printWindow.isDestroyed()) {
          printWindow.close()
        }
      }
    } else {
      // Print the current window
      if (!mainWindow || mainWindow.isDestroyed()) {
        throw new Error('No active window found')
      }

      try {
        const success = await new Promise((resolve) => {
          mainWindow.webContents.print(printOptions, (success, failureReason) => {
            resolve(success)
          })
        })
        
        event.reply('print-complete', { success })
      } catch (printError) {
        console.error('Print current page error:', printError)
        event.reply('print-complete', { 
          success: false, 
          error: printError.message || 'Failed to print current page' 
        })
      }
    }
  } catch (error) {
    console.error('General printing error:', error)
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
