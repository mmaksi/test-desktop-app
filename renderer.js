const { ipcRenderer } = require('electron')

// Create printer selection dialog
async function showPrinterDialog() {
  const result = await ipcRenderer.invoke('get-printers')
  if (!result.success) {
    return { cancelled: true, error: result.error }
  }

  const printers = result.printers
  if (printers.length === 0) {
    return { 
      cancelled: true, 
      error: 'No printers found. Please connect a printer to your computer and try again.' 
    }
  }

  // Create and show the printer selection dialog
  const dialog = document.createElement('div')
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    z-index: 1000;
  `

  dialog.innerHTML = `
    <h3 style="margin-top: 0;">Select Printer</h3>
    <select id="printerSelect" style="width: 100%; padding: 8px; margin: 10px 0;">
      ${printers.map(printer => 
        `<option value="${printer.name}">${printer.displayName || printer.name}</option>`
      ).join('')}
    </select>
    <div style="text-align: right; margin-top: 15px;">
      <button id="cancelPrint" style="margin-right: 10px;">Cancel</button>
      <button id="confirmPrint" style="background: #4CAF50; color: white; border: none; padding: 8px 15px; border-radius: 4px;">Print</button>
    </div>
  `

  // Add overlay
  const overlay = document.createElement('div')
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
  `

  document.body.appendChild(overlay)
  document.body.appendChild(dialog)

  return new Promise((resolve) => {
    document.getElementById('cancelPrint').onclick = () => {
      document.body.removeChild(dialog)
      document.body.removeChild(overlay)
      resolve({ cancelled: true })
    }

    document.getElementById('confirmPrint').onclick = () => {
      const select = document.getElementById('printerSelect')
      const selectedPrinter = select.value
      document.body.removeChild(dialog)
      document.body.removeChild(overlay)
      resolve({ cancelled: false, printerName: selectedPrinter })
    }
  })
}

// Print functionality
document.getElementById('printCurrentPage').addEventListener('click', async () => {
  const statusDiv = document.getElementById('printStatus')
  statusDiv.className = 'info'
  statusDiv.textContent = 'Getting available printers...'
  
  const printerSelection = await showPrinterDialog()
  
  if (printerSelection.cancelled) {
    if (printerSelection.error) {
      statusDiv.className = 'error'
      if (printerSelection.error.includes('No printers found')) {
        statusDiv.innerHTML = `
          <strong>No printers detected</strong><br>
          To print, please:
          <ol>
            <li>Connect a printer to your computer</li>
            <li>Make sure it's properly installed</li>
            <li>Try printing again</li>
          </ol>
        `
      } else {
        statusDiv.textContent = printerSelection.error
      }
    } else {
      statusDiv.className = 'info'
      statusDiv.textContent = 'Printing cancelled'
    }
    return
  }

  statusDiv.textContent = 'Sending to printer...'
  ipcRenderer.send('print-file', { printerName: printerSelection.printerName })
})

document.getElementById('printFile').addEventListener('click', async () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.pdf,.txt,.doc,.docx'
  
  input.onchange = async (e) => {
    const file = e.target.files[0]
    if (file) {
      const statusDiv = document.getElementById('printStatus')
      statusDiv.className = 'info'
      statusDiv.textContent = 'Getting available printers...'
      
      const printerSelection = await showPrinterDialog()
      
      if (printerSelection.cancelled) {
        if (printerSelection.error) {
          statusDiv.className = 'error'
          if (printerSelection.error.includes('No printers found')) {
            statusDiv.innerHTML = `
              <strong>No printers detected</strong><br>
              To print, please:
              <ol>
                <li>Connect a printer to your computer</li>
                <li>Make sure it's properly installed</li>
                <li>Try printing again</li>
              </ol>
            `
          } else {
            statusDiv.textContent = printerSelection.error
          }
        } else {
          statusDiv.className = 'info'
          statusDiv.textContent = 'Printing cancelled'
        }
        return
      }

      statusDiv.textContent = 'Sending to printer...'
      ipcRenderer.send('print-file', { 
        filePath: file.path,
        printerName: printerSelection.printerName 
      })
    }
  }
  
  input.click()
})

ipcRenderer.on('print-complete', (event, result) => {
  const statusDiv = document.getElementById('printStatus')
  if (result.success) {
    statusDiv.className = 'success'
    statusDiv.textContent = 'Print job sent successfully!'
  } else {
    statusDiv.className = 'error'
    statusDiv.textContent = result.error || 'Failed to print. Please make sure a printer is properly connected.'
  }
})

// Auto-update functionality
const updateStatus = document.getElementById('updateStatus')
const downloadProgress = document.getElementById('downloadProgress')
const downloadBtn = document.getElementById('downloadUpdate')
const installBtn = document.getElementById('installUpdate')
const checkUpdatesBtn = document.getElementById('checkUpdates')

checkUpdatesBtn.addEventListener('click', () => {
  updateStatus.className = 'info'
  updateStatus.textContent = 'Checking for updates...'
  ipcRenderer.send('check-for-updates')
})

downloadBtn.addEventListener('click', () => {
  downloadBtn.disabled = true
  updateStatus.className = 'info'
  updateStatus.textContent = 'Downloading update...'
  downloadProgress.style.display = 'block'
  ipcRenderer.send('download-update')
})

installBtn.addEventListener('click', () => {
  ipcRenderer.send('install-update')
})

// Update events
ipcRenderer.on('update-available', (event, info) => {
  updateStatus.className = 'info'
  updateStatus.textContent = `Update available! Version ${info.version} can be downloaded.`
  downloadBtn.disabled = false
})

ipcRenderer.on('download-progress', (event, progressObj) => {
  downloadProgress.value = progressObj.percent || 0
  updateStatus.textContent = `Downloading: ${Math.floor(progressObj.percent)}%`
})

ipcRenderer.on('update-downloaded', (event, info) => {
  downloadProgress.style.display = 'none'
  updateStatus.className = 'success'
  updateStatus.textContent = 'Update downloaded! Click to install and restart.'
  installBtn.disabled = false
}) 