const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs = require('fs')

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
ipcMain.on('print-file', async (event) => {
  try {
    // Open file dialog
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Documents', extensions: ['pdf', 'txt', 'doc', 'docx'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return
    }

    const filePath = result.filePaths[0]

    // Verify file exists
    if (!fs.existsSync(filePath)) {
      throw new Error('Selected file does not exist')
    }

    // Create a new window to load and print the file
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    })

    try {
      // For PDF files, use loadURL with file protocol
      if (filePath.toLowerCase().endsWith('.pdf')) {
        await printWindow.loadURL(`file://${filePath}`)
      } else {
        // For other files, we'll create a simple HTML wrapper
        const fileContent = fs.readFileSync(filePath, 'utf-8')
        const htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body {
                  font-family: monospace;
                  white-space: pre-wrap;
                  padding: 20px;
                }
              </style>
            </head>
            <body>${fileContent}</body>
          </html>
        `
        await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`)
      }

      // Wait for the window to finish loading
      await new Promise(resolve => printWindow.webContents.on('did-finish-load', resolve))

      // Show the print dialog
      printWindow.webContents.executeJavaScript('window.print()', true)
        .then(() => {
          event.reply('print-complete', { success: true })
        })
        .catch((error) => {
          console.error('Print error:', error)
          event.reply('print-complete', { 
            success: false, 
            error: error.message || 'Failed to print file' 
          })
        })
        .finally(() => {
          if (!printWindow.isDestroyed()) {
            printWindow.close()
          }
        })

    } catch (error) {
      console.error('Print file error:', error)
      event.reply('print-complete', { 
        success: false, 
        error: error.message || 'Failed to print file' 
      })
      if (!printWindow.isDestroyed()) {
        printWindow.close()
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

// Handle current page printing
ipcMain.on('print-current-page', async (event) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    event.reply('print-complete', { 
      success: false, 
      error: 'No active window found' 
    })
    return
  }

  try {
    mainWindow.webContents.executeJavaScript('window.print()', true)
      .then(() => {
        event.reply('print-complete', { success: true })
      })
      .catch((error) => {
        console.error('Print error:', error)
        event.reply('print-complete', { 
          success: false, 
          error: error.message || 'Failed to print current page' 
        })
      })
  } catch (error) {
    console.error('Print current page error:', error)
    event.reply('print-complete', { 
      success: false, 
      error: error.message || 'Failed to print current page' 
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
