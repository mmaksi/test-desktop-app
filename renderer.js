const { ipcRenderer } = require('electron')

// Print functionality
document.getElementById('printCurrentPage').addEventListener('click', async () => {
  const statusDiv = document.getElementById('printStatus')
  statusDiv.className = 'info'
  statusDiv.textContent = 'Opening print dialog...'
  
  ipcRenderer.send('print-file', {})
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
      statusDiv.textContent = 'Opening print dialog...'
      
      ipcRenderer.send('print-file', { filePath: file.path })
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