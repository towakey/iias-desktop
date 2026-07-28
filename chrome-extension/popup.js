document.addEventListener('DOMContentLoaded', async () => {
  const data = await chrome.storage.local.get(['api_base', 'token'])
  document.getElementById('api-base').value = data.api_base || 'http://localhost:8000/api'
  document.getElementById('token').value = data.token || ''

  document.getElementById('save').addEventListener('click', async () => {
    const apiBase = document.getElementById('api-base').value.trim()
    const token = document.getElementById('token').value.trim()
    await chrome.storage.local.set({ api_base: apiBase, token })
    document.getElementById('status').textContent = '保存しました'
    setTimeout(() => { document.getElementById('status').textContent = '' }, 2000)
  })
})
