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

// Handle file selection and printing
ipcMain.on('select-and-print-file', async (event) => {
  if (!mainWindow) {
    event.reply('print-complete', { 
      success: false, 
      error: 'No active window found'
    })
    return
  }

  try {
    // Show file selection dialog
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

    // Create a new window for printing
    const printWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false
    })

    try {
      // Load the file
      if (filePath.toLowerCase().endsWith('.pdf')) {
        await printWindow.loadURL(`file://${filePath}`)
      } else {
        const content = fs.readFileSync(filePath, 'utf-8')
        await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
          <html>
            <body style="font-family: monospace; white-space: pre-wrap; padding: 20px;">
              ${content}
            </body>
          </html>
        `)}`)
      }

      // Wait for the page to load
      await new Promise(resolve => {
        printWindow.webContents.once('did-finish-load', resolve)
      })

      // Print with dialog
      printWindow.webContents.executeJavaScript(`
        window.print();
        true;  // Return value for executeJavaScript
      `)

      // Clean up after a delay to ensure print dialog is shown
      setTimeout(() => {
        if (!printWindow.isDestroyed()) {
          printWindow.close()
        }
      }, 1000)

      event.reply('print-complete', { success: true })
    } catch (error) {
      console.error('Print error:', error)
      if (!printWindow.isDestroyed()) {
        printWindow.close()
      }
      throw error
    }
  } catch (error) {
    console.error('General error:', error)
    event.reply('print-complete', { 
      success: false, 
      error: error.message || 'Failed to print file'
    })
  }
})

// Handle printing current page
ipcMain.on('print-current-page', async (event) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    event.reply('print-complete', { 
      success: false, 
      error: 'No active window found'
    })
    return
  }

  try {
    // Use JavaScript's print() function
    await mainWindow.webContents.executeJavaScript(`
      window.print();
      true;  // Return value for executeJavaScript
    `)
    
    event.reply('print-complete', { success: true })
  } catch (error) {
    console.error('Print error:', error)
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
