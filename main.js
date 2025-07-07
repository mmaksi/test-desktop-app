const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
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

// File dialog handler
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'All Supported Files', extensions: ['pdf', 'txt', 'html', 'htm', 'md', 'doc', 'docx'] },
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'Text Files', extensions: ['txt', 'md'] },
      { name: 'HTML Files', extensions: ['html', 'htm'] },
      { name: 'Word Documents', extensions: ['doc', 'docx'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

// Print handling
ipcMain.on('print-file', async (event, { filePath } = {}) => {
  console.log('Print request received:', { filePath })
  
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
      console.log('Processing file:', filePath)
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log('File not found:', filePath)
        event.reply('print-complete', { 
          success: false, 
          error: 'File not found: ' + filePath
        })
        return
      }

      const fileExtension = path.extname(filePath).toLowerCase()
      console.log('File extension:', fileExtension)
      
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
        console.log('Creating print window for file:', filePath)
        
        const printWindow = new BrowserWindow({
          show: true, // Make window visible for debugging
          width: 800,
          height: 600,
          webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
          }
        })
        
        try {
          let loadPromise
          
          if (fileExtension === '.txt' || fileExtension === '.md') {
            console.log('Processing text file')
            // For text files, create HTML wrapper and save as temp file
            const content = fs.readFileSync(filePath, 'utf8')
            const htmlContent = `
              <!DOCTYPE html>
              <html>
                <head>
                  <meta charset="UTF-8">
                  <title>Print Document - ${path.basename(filePath)}</title>
                  <style>
                    body { 
                      font-family: monospace; 
                      white-space: pre-wrap; 
                      padding: 20px; 
                      line-height: 1.4;
                    }
                  </style>
                </head>
                <body>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body>
              </html>
            `
            // Create temporary HTML file
            const tempPath = path.join(__dirname, 'temp_print.html')
            fs.writeFileSync(tempPath, htmlContent, 'utf8')
            loadPromise = printWindow.loadFile(tempPath)
          } else {
            console.log('Processing HTML file')
            // For HTML files, load directly
            loadPromise = printWindow.loadFile(filePath)
          }
          
          console.log('Waiting for window to load...')
          
          // Wait for the window to finish loading with timeout
          await Promise.race([
            loadPromise,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Load timeout')), 10000)
            )
          ])
          
          // Add a small delay to ensure content is ready
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          console.log('Window loaded successfully, starting print job...')
          
          // Print the file content directly - this will show the native print dialog
          const success = await new Promise((resolve) => {
            printWindow.webContents.print(printOptions, (success) => {
              console.log('Print callback received:', success)
              resolve(success)
            })
          })
          
          console.log('File print result:', success)
          event.reply('print-complete', { success })
        } catch (printError) {
          console.error('Print file error:', printError)
          event.reply('print-complete', { 
            success: false, 
            error: 'Failed to print file: ' + printError.message
          })
        } finally {
          // Clean up temporary file if it was created
          const tempPath = path.join(__dirname, 'temp_print.html')
          if (fs.existsSync(tempPath)) {
            try {
              fs.unlinkSync(tempPath)
              console.log('Temporary file cleaned up')
            } catch (err) {
              console.log('Could not clean up temporary file:', err.message)
            }
          }
          
          // Close the window after a short delay to allow user to see what happened
          setTimeout(() => {
            if (printWindow && !printWindow.isDestroyed()) {
              printWindow.close()
            }
          }, 2000)
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
      console.log('Printing current page...')
      // Print current page - this will show the native print dialog
      const success = await new Promise((resolve) => {
        mainWindow.webContents.print(printOptions, (success) => resolve(success))
      })
      
      console.log('Current page print result:', success)
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
