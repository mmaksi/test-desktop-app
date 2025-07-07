const { app, BrowserWindow, ipcMain, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('path')
const fs = require('fs')

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
      contextIsolation: false,
      webSecurity: false // Allow loading local files
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
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        event.reply('print-complete', { 
          success: false, 
          error: 'File not found: ' + filePath
        })
        return
      }

      const fileExtension = path.extname(filePath).toLowerCase()
      
      // Handle different file types
      if (fileExtension === '.pdf') {
        // For PDF files, use the system's default PDF viewer to print
        try {
          await shell.openPath(filePath)
          event.reply('print-complete', { 
            success: true,
            message: 'PDF opened in default viewer. Please use the print option in the PDF viewer.'
          })
        } catch (error) {
          event.reply('print-complete', { 
            success: false, 
            error: 'Failed to open PDF file: ' + error.message
          })
        }
        return
      }
      
      // For text files, HTML files, and other web-compatible formats
      if (['.txt', '.html', '.htm', '.md'].includes(fileExtension)) {
        const printWindow = new BrowserWindow({
          show: false,
          webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
          }
        })
        
        try {
          if (fileExtension === '.txt' || fileExtension === '.md') {
            // For text files, create HTML wrapper
            const content = fs.readFileSync(filePath, 'utf8')
            const htmlContent = `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="UTF-8">
                  <title>Print Document</title>
                  <style>
                    body { 
                      font-family: monospace; 
                      white-space: pre-wrap; 
                      padding: 20px; 
                      line-height: 1.4;
                    }
                  </style>
                </head>
                <body>${content}</body>
              </html>
            `
            await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`)
          } else {
            // For HTML files, load directly
            await printWindow.loadFile(filePath)
          }
          
          // Wait for the window to finish loading
          await new Promise(resolve => {
            printWindow.webContents.once('did-finish-load', resolve)
          })
          
          const success = await new Promise((resolve) => {
            printWindow.webContents.print(printOptions, (success) => resolve(success))
          })
          
          event.reply('print-complete', { success })
        } catch (printError) {
          console.error('Print file error:', printError)
          event.reply('print-complete', { 
            success: false, 
            error: 'Failed to print file: ' + printError.message
          })
        } finally {
          printWindow.close()
        }
      } else {
        // For unsupported file types, try to open with system default app
        try {
          await shell.openPath(filePath)
          event.reply('print-complete', { 
            success: true,
            message: `File opened in default application. Please use the print option in the application.`
          })
        } catch (error) {
          event.reply('print-complete', { 
            success: false, 
            error: `Unsupported file type: ${fileExtension}. Cannot print this file directly.`
          })
        }
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
