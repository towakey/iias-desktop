import './styles.css'

const API_BASE_URL = 'http://localhost:8000/api'
const TOKEN_KEY = 'iias_token'

let token: string | null = localStorage.getItem(TOKEN_KEY)
let user: { id: number; name: string; email: string } | null = null
let archives: any[] = []
let shoppingItems: any[] = []
let settings: Record<string, any> = {}
let page: 'timeline' | 'shopping' | 'stats' | 'settings' = 'timeline'
let viewMode: string = 'dashboard'
let message = ''
let searchTimer: any = undefined
let selectedImageFile: File | null = null
let shoppingTab: 'active' | 'purchased' = 'active'
let shoppingStats: any = null

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      'X-Service': 'iias-desktop',
      Authorization: token ? `Bearer ${token}` : '',
    },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Service': 'iias-desktop',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('image', file)
  const res = await fetch(`${API_BASE_URL}/images`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'X-Service': 'iias-desktop',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: formData,
  })
  if (!res.ok) throw new Error(await res.text())
  const data: { url: string } = await res.json()
  return data.url
}

async function login(email: string, password: string) {
  console.log('login called', email)
  try {
    const data = await apiPost<{ user: typeof user; token: string }>('/login', { email, password })
    console.log('login success', data)
    token = data.token
    user = data.user
    localStorage.setItem(TOKEN_KEY, token)
    message = ''
    await loadData()
    render()
  } catch (e) {
    console.error('login error', e)
    throw e
  }
}

async function logout() {
  try {
    await apiPost('/logout')
  } catch {}
  token = null
  user = null
  localStorage.removeItem(TOKEN_KEY)
  page = 'timeline'
  render()
}

async function loadUser() {
  if (!token) return
  try {
    user = await apiGet('/user')
    await loadData()
  } catch {
    token = null
    user = null
    localStorage.removeItem(TOKEN_KEY)
  }
}

async function loadData() {
  if (!user) return
  await Promise.all([loadArchives(), loadShopping(), loadSettings()])
}

async function loadArchives(search = '') {
  archives = (await apiGet<{ data: any[] }>(`/archives${search ? `?search=${encodeURIComponent(search)}` : ''}`)).data
  viewMode = settings.view_mode || 'dashboard'
}

async function loadShopping(status = shoppingTab) {
  shoppingItems = await apiGet<any[]>(`/shopping-items?status=${status}`)
  shoppingTab = status as 'active' | 'purchased'
}

async function loadSettings() {
  settings = await apiGet<Record<string, any>>('/settings')
  viewMode = settings.view_mode || 'dashboard'
}

async function purchaseItem(id: number) {
  await apiPost(`/shopping-items/${id}`, { status: 'purchased', _method: 'PUT' })
  await loadShopping('active')
  render()
}

async function restoreItem(id: number) {
  await apiPost(`/shopping-items/${id}/restore`)
  await loadShopping('purchased')
  render()
}

function setShoppingTab(tab: 'active' | 'purchased') {
  shoppingTab = tab
  loadShopping(tab).then(() => render())
}

async function saveSettings(viewModeValue: string, syncInterval: string) {
  await apiPost('/settings', {
    settings: [
      { key: 'view_mode', value: viewModeValue, type: 'string' },
      { key: 'sync_interval', value: syncInterval, type: 'string' },
    ],
  })
  await loadSettings()
  message = '設定を保存しました'
  render()
}

function formatDate(value: string) {
  if (!value) return ''
  return new Date(value).toLocaleString('ja-JP')
}

function groupKey(date: string) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function archiveItem(item: any) {
  const tags = Array.isArray(item.tags) && item.tags.length
    ? `<p class="iias-card-meta">タグ: ${item.tags.map((t: any) => t.name).join(', ')}</p>`
    : ''
  return `
    <div class="iias-card">
      <h3 class="iias-card-title">${item.title || '(タイトルなし)'}</h3>
      ${item.url ? `<p class="iias-card-meta">${item.url}</p>` : ''}
      ${item.memo ? `<p class="iias-card-meta">${item.memo}</p>` : ''}
      ${tags}
      <p class="iias-card-meta">${formatDate(item.recorded_at)}</p>
    </div>
  `
}

function render() {
  const app = document.getElementById('app')!
  if (!user) {
    app.innerHTML = renderLogin()
    bindLogin()
    return
  }

  app.innerHTML = `
    <aside class="iias-sidebar">
      <h1 class="iias-logo">IIAS</h1>
      <nav class="iias-nav">
        <a class="iias-nav-link ${page === 'timeline' ? 'active' : ''}" onclick="setPage('timeline')">タイムライン</a>
        <a class="iias-nav-link ${page === 'shopping' ? 'active' : ''}" onclick="setPage('shopping')">購買リスト</a>
        <a class="iias-nav-link ${page === 'stats' ? 'active' : ''}" onclick="setPage('stats')">統計</a>
        <a class="iias-nav-link ${page === 'settings' ? 'active' : ''}" onclick="setPage('settings')">設定</a>
      </nav>
      <div style="margin-top: auto; padding-top: 1rem; border-top: 1px solid #ff8a1c;">
        <p style="font-size: 0.8rem; margin: 0 0 0.5rem;">${user.name}</p>
        <button class="iias-btn" style="width: 100%;" onclick="logout()">ログアウト</button>
      </div>
    </aside>
    <main class="iias-main">
      ${page === 'timeline' ? renderTimeline() : ''}
      ${page === 'shopping' ? renderShopping() : ''}
      ${page === 'stats' ? renderStats() : ''}
      ${page === 'settings' ? renderSettings() : ''}
    </main>
  `

  if (page === 'timeline') bindTimeline()
  if (page === 'shopping') bindShopping()
  if (page === 'stats') bindStats()
  if (page === 'settings') bindSettings()
}

function renderLogin() {
  return `
    <main class="iias-main" style="display: flex; align-items: center; justify-content: center;">
      <div class="iias-card iias-form">
        <h2 class="iias-title" style="margin-bottom: 1rem;">IIAS 認証</h2>
        <label class="iias-label">メールアドレス</label>
        <input class="iias-input" type="email" id="email" value="test2@example.com" />
        <label class="iias-label">パスワード</label>
        <input class="iias-input" type="password" id="password" value="password" />
        <button class="iias-btn" style="width: 100%;" id="login" onclick="hlogin()">ログイン</button>
        ${message ? `<p class="iias-message">${message}</p>` : ''}
      </div>
    </main>
  `
}

function bindLogin() {
  // onclick handler is used instead
}

function renderTimeline() {
  const searchInput = `<input class="iias-search" type="search" id="search" placeholder="アーカイブを検索..." oninput="searchArchives(this.value)" />`
  if (viewMode === 'hierarchy') {
    const groups = new Map<string, any[]>()
    for (const item of archives) {
      const key = groupKey(item.recorded_at)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(item)
    }
    const groupHtml = Array.from(groups.entries())
      .map(([key, items]) => `
        <div class="iias-card">
          <button class="iias-btn" style="width: 100%; text-align: left;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">${key} (${items.length})</button>
          <div style="display: none; margin-top: 0.5rem;">
            ${items.map(archiveItem).join('')}
          </div>
        </div>
      `)
      .join('')
    return `
      <header class="iias-header">
        <h2 class="iias-title">階層メニュー / 検索</h2>
        ${searchInput}
      </header>
      ${groupHtml || '<div class="iias-card" style="opacity: 0.7;">アーカイブがありません。</div>'}
    `
  }
  return `
    <header class="iias-header">
      <h2 class="iias-title">タイムライン / 検索</h2>
      ${searchInput}
    </header>
    <div class="iias-timeline">
      ${archives.map(archiveItem).join('') || '<div class="iias-card" style="opacity: 0.7;">アーカイブがありません。</div>'}
    </div>
  `
}

function bindTimeline() {
  // oninput handler is used instead
}

function renderShopping() {
  return `
    <header class="iias-header">
      <h2 class="iias-title">購買リスト</h2>
    </header>
    <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
      <button class="iias-btn" style="flex: 1; ${shoppingTab === 'active' ? 'background: rgba(255,138,28,0.2);' : ''}" onclick="setShoppingTab('active')">購入前</button>
      <button class="iias-btn" style="flex: 1; ${shoppingTab === 'purchased' ? 'background: rgba(255,138,28,0.2);' : ''}" onclick="setShoppingTab('purchased')">購入済み</button>
    </div>

    ${shoppingTab === 'active' ? `
    <div class="iias-card iias-form" style="margin-bottom: 1rem;">
      <h3 class="iias-card-title">アイテム追加</h3>
      <label class="iias-label">商品名</label>
      <input class="iias-input" type="text" id="item-name" placeholder="例：牛乳 1L" />
      <label class="iias-label">価格（円）</label>
      <input class="iias-input" type="number" id="item-price" placeholder="例：200" />
      <label class="iias-label">画像</label>
      <input class="iias-input" type="file" id="item-image" accept="image/*" onchange="handleImageSelect(event)" />
      <img id="image-preview" alt="" style="display: none; max-width: 120px; max-height: 80px; margin-top: 0.5rem; border: 1px solid #ff8a1c;" />
      <label class="iias-label">メモ</label>
      <input class="iias-input" type="text" id="item-memo" placeholder="確認用メモ" />
      <button class="iias-btn" style="width: 100%;" onclick="addShoppingItem()">追加</button>
    </div>` : ''}
    <div class="iias-shopping-list">
      ${shoppingItems.length === 0 ? '<div class="iias-card" style="opacity: 0.7;">アイテムがありません。</div>' : ''}
      ${shoppingItems.map((item) => `
        <div class="iias-card" style="display: flex; align-items: center; gap: 1rem; ${item.status === 'purchased' ? 'opacity: 0.35;' : ''}">
          <div style="flex: 1;">
            <h3 class="iias-card-title">${item.name}</h3>
            ${item.price ? `<p class="iias-card-meta">${item.price} 円</p>` : ''}
            ${item.memo ? `<p class="iias-card-meta">${item.memo}</p>` : ''}
            ${item.image_path ? `<img src="${item.image_path}" alt="" style="max-width: 120px; max-height: 80px; margin-top: 0.5rem; border: 1px solid #ff8a1c;" />` : ''}
          </div>
          ${item.status === 'purchased'
            ? `<button class="iias-btn" onclick="restoreItem(${item.id})">再アクティブ化</button>`
            : `<button class="iias-btn" onclick="purchaseItem(${item.id})">購入</button>`}
        </div>
      `).join('')}
    </div>
  `
}

function bindShopping() {
  // onclick handlers are used instead
}

function renderStats() {
  const alert = shoppingStats?.budget_alert ? '<p style="color: #ff4444;">予算超過アラート</p>' : ''
  const byNameEntries = shoppingStats?.by_name ? Object.entries(shoppingStats.by_name) : []
  const byNameHtml = byNameEntries.map(([name, s]: [string, any]) => `
    <div class="iias-card">
      <h3 class="iias-card-title">${name}</h3>
      <p class="iias-card-meta">購入回数: ${s.count}</p>
      <p class="iias-card-meta">最終購入: ${s.last_purchased_at ? formatDate(s.last_purchased_at) : '-'}</p>
      <p class="iias-card-meta">平均間隔: ${s.avg_interval_days != null ? `${s.avg_interval_days} 日` : '-'}</p>
    </div>
  `).join('')

  return `
    <header class="iias-header">
      <h2 class="iias-title">購買統計</h2>
    </header>
    <div class="iias-card" style="margin-bottom: 1rem;">
      <h3 class="iias-card-title">今月の状況</h3>
      <p class="iias-card-meta">今月合計: ${shoppingStats?.total_this_month ?? 0} 円</p>
      <p class="iias-card-meta">予算: ${shoppingStats?.monthly_budget ?? 0} 円</p>
      ${alert}
    </div>
    <div class="iias-card iias-form" style="margin-bottom: 1rem;">
      <h3 class="iias-card-title">月次予算設定</h3>
      <label class="iias-label">予算（円）</label>
      <input class="iias-input" type="number" id="budget-input" value="${shoppingStats?.monthly_budget ?? 0}" />
      <button class="iias-btn" style="width: 100%;" onclick="saveBudgetFromForm()">保存</button>
      ${message ? `<p class="iias-message">${message}</p>` : ''}
    </div>
    <h3 class="iias-card-title" style="margin-bottom: 0.5rem;">商品別統計</h3>
    ${byNameHtml || '<div class="iias-card" style="opacity: 0.7;">購入済みアイテムがありません。</div>'}
  `
}

function bindStats() {
  // onclick handlers are used instead
}

function renderSettings() {
  return `
    <header class="iias-header">
      <h2 class="iias-title">設定</h2>
    </header>
    <div class="iias-card" style="max-width: 400px;">
      <label class="iias-label">トップ画面の表示モード</label>
      <select class="iias-input" id="view_mode">
        <option value="dashboard" ${settings.view_mode === 'dashboard' ? 'selected' : ''}>ダッシュボード</option>
        <option value="hierarchy" ${settings.view_mode === 'hierarchy' ? 'selected' : ''}>階層メニュー</option>
      </select>
      <label class="iias-label">ブラウザ履歴の取得間隔</label>
      <select class="iias-input" id="sync_interval">
        <option value="30" ${settings.sync_interval == '30' ? 'selected' : ''}>30秒</option>
        <option value="60" ${settings.sync_interval == '60' ? 'selected' : ''}>1分</option>
        <option value="300" ${settings.sync_interval == '300' ? 'selected' : ''}>5分</option>
        <option value="900" ${settings.sync_interval == '900' ? 'selected' : ''}>15分</option>
        <option value="1800" ${settings.sync_interval == '1800' ? 'selected' : ''}>30分</option>
      </select>
      <button class="iias-btn" style="width: 100%;" onclick="saveSettingsFromForm()">保存</button>
      ${message ? `<p class="iias-message">${message}</p>` : ''}
    </div>
  `
}

function bindSettings() {
  // onclick handler is used instead
}

async function handleLogin() {
  const email = (document.getElementById('email') as HTMLInputElement).value
  const password = (document.getElementById('password') as HTMLInputElement).value
  try {
    const data = await apiPost<{ user: typeof user; token: string }>('/login', { email, password })
    token = data.token
    user = data.user
    localStorage.setItem(TOKEN_KEY, token)
    message = ''
    await loadData()
    render()
  } catch (e: any) {
    message = 'ログインに失敗しました'
    render()
  }
}

async function loadShoppingStats() {
  try {
    shoppingStats = await apiGet('/shopping-items/stats')
  } catch (e) {
    shoppingStats = null
  }
}

function setPage(p: typeof page) {
  page = p
  if (page === 'stats') {
    loadShoppingStats().then(() => render())
  }
  render()
}

function searchArchives(value: string) {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    await loadArchives(value)
    render()
  }, 250)
}

async function saveSettingsFromForm() {
  const viewMode = (document.getElementById('view_mode') as HTMLSelectElement).value
  const syncInterval = (document.getElementById('sync_interval') as HTMLSelectElement).value
  try {
    await saveSettings(viewMode, syncInterval)
  } catch (e: any) {
    message = '設定の保存に失敗しました'
    render()
  }
}

function handleImageSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  selectedImageFile = file
  const preview = document.getElementById('image-preview') as HTMLImageElement | null
  if (preview) {
    if (file) {
      preview.src = URL.createObjectURL(file)
      preview.style.display = 'block'
    } else {
      preview.src = ''
      preview.style.display = 'none'
    }
  }
}

async function addShoppingItem() {
  const name = (document.getElementById('item-name') as HTMLInputElement).value
  const price = (document.getElementById('item-price') as HTMLInputElement).value
  const memo = (document.getElementById('item-memo') as HTMLInputElement).value
  if (!name) return
  try {
    let imagePath: string | undefined
    if (selectedImageFile) {
      imagePath = await uploadImage(selectedImageFile)
      selectedImageFile = null
    }
    await apiPost('/shopping-items', {
      name,
      price: price ? parseInt(price, 10) : undefined,
      image_path: imagePath,
      memo: memo || undefined,
      status: 'active',
    })
    message = ''
    await loadShopping('active')
    shoppingTab = 'active'
    render()
  } catch (e: any) {
    message = '追加に失敗しました'
    render()
  }
}

async function saveBudgetFromForm() {
  const budget = (document.getElementById('budget-input') as HTMLInputElement).value
  try {
    await apiPost('/settings', {
      settings: [
        { key: 'monthly_budget_amount', value: parseInt(budget, 10) || 0, type: 'integer' },
      ],
    })
    message = '保存しました'
    await loadShoppingStats()
    render()
  } catch (e: any) {
    message = '保存に失敗しました'
    render()
  }
}

Object.assign(window, { hlogin: handleLogin, setPage, searchArchives, purchaseItem, restoreItem, setShoppingTab, logout, saveSettingsFromForm, saveBudgetFromForm, addShoppingItem, handleImageSelect })

async function init() {
  await loadUser()
  render()
}

init()
