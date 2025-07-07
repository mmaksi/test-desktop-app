const { ipcRenderer } = require('electron')

// DOM Elements
const printStatus = document.getElementById('printStatus')
const updateStatus = document.getElementById('updateStatus')
const downloadProgress = document.getElementById('downloadProgress')
const downloadBtn = document.getElementById('downloadUpdate')
const installBtn = document.getElementById('installUpdate')

// Print functionality
document.getElementById('printCurrentPage').addEventListener('click', () => {
  printStatus.textContent = ''
  printStatus.className = ''
  ipcRenderer.send('print-file', {})
})

document.getElementById('printFile').addEventListener('click', () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.pdf,.txt,.doc,.docx,.html,.htm,.md'
  
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (file) {
      printStatus.textContent = ''
      printStatus.className = ''
      ipcRenderer.send('print-file', { filePath: file.path })
    }
  }
  
  input.click()
})

ipcRenderer.on('print-complete', (event, result) => {
  if (result.success) {
    printStatus.className = 'success'
    if (result.message) {
      printStatus.textContent = result.message
    } else {
      printStatus.textContent = 'Print job sent successfully!'
    }
  } else {
    printStatus.className = 'error'
    printStatus.textContent = result.error || 'Failed to print. Please make sure a printer is properly connected.'
  }
})

// Update functionality
document.getElementById('checkUpdates').addEventListener('click', () => {
  updateStatus.className = 'info'
  updateStatus.textContent = 'Checking for updates...'
  downloadBtn.disabled = true
  installBtn.disabled = true
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

// Update event handlers
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