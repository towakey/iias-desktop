const DEFAULT_API_BASE = 'http://localhost:8000/api'

async function getSettings() {
  const data = await chrome.storage.local.get(['api_base', 'token'])
  return {
    apiBase: data.api_base || DEFAULT_API_BASE,
    token: data.token || '',
  }
}

async function sendArchive(item) {
  const { apiBase, token } = await getSettings()
  if (!token) return

  try {
    await fetch(`${apiBase}/archives`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Service': 'iias-chrome',
      },
      body: JSON.stringify({
        archive_type: 'web',
        title: item.title || '',
        url: item.url,
        recorded_at: item.lastVisitTime
          ? new Date(item.lastVisitTime).toISOString()
          : new Date().toISOString(),
      }),
    })
  } catch (e) {
    console.error('[IIAS] failed to send archive', e)
  }
}

chrome.history.onVisited.addListener((item) => {
  if (!item.url || item.url.startsWith('chrome://') || item.url.startsWith('chrome-extension://')) return
  sendArchive(item)
})
