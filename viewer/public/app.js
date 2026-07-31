'use strict'

const PAGE_SIZE = 200

const state = {
  library: null,
  country: 'all', // 'all' | 'favorites' | country code
  search: '',
  source: '',
  category: '',
  quality: '',
  sort: 'name',
  liveOnly: false,
  hideGeo: false,
  hideNsfw: true,
  visible: PAGE_SIZE,
  favorites: new Set(JSON.parse(localStorage.getItem('iptv.favorites') || '[]')),
  health: new Map() // url -> { ok, status, ms }
}

const $ = id => document.getElementById(id)
const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props)
  for (const child of [].concat(children)) if (child) node.append(child)

  return node
}

const channelKey = channel => `${channel.file}|${channel.url}`

// ------------------------------------------------------------------- loading

async function loadLibrary({ refresh = false } = {}) {
  const response = await fetch(`/api/library${refresh ? '?refresh=1' : ''}`)
  if (!response.ok) throw new Error('Could not load the library')

  state.library = await response.json()
  renderStats()
  renderCountries()
  renderFilterOptions()
  render()
}

function renderStats() {
  const { channels, playlists, countries, hasReferenceData } = state.library
  $('library-stats').textContent =
    `${channels.length.toLocaleString()} channels · ${playlists.length} playlists · ${countries.length} countries` +
    (hasReferenceData ? '' : ' · run `npm run api:load` for names & logos')
}

// ------------------------------------------------------------------ sidebar

function renderCountries() {
  const filter = $('country-filter').value.trim().toLowerCase()
  const list = $('country-list')
  list.replaceChildren()

  const entry = (id, flag, name, count) => {
    const button = el('button', { className: `country${state.country === id ? ' active' : ''}` }, [
      el('span', { textContent: flag }),
      el('span', { className: 'name', textContent: name }),
      el('span', { className: 'count', textContent: count.toLocaleString() })
    ])
    button.onclick = () => {
      state.country = id
      state.source = ''
      state.visible = PAGE_SIZE
      renderCountries()
      renderFilterOptions()
      render()
    }

    return button
  }

  if (!filter) {
    list.append(entry('all', '🌍', 'All countries', state.library.channels.length))
    list.append(entry('favorites', '⭐', 'Favorites', state.favorites.size))
    list.append(el('div', { className: 'sidebar-sep' }))
  }

  for (const country of state.library.countries) {
    if (filter && !`${country.name} ${country.code}`.toLowerCase().includes(filter)) continue
    list.append(entry(country.code, country.flag, country.name, country.count))
  }
}

// ------------------------------------------------------------------ filters

function renderFilterOptions() {
  const scoped = state.library.channels.filter(c => inCountry(c))

  const sources = [...new Set(scoped.map(c => c.file))].sort()
  fillSelect($('filter-source'), 'All playlists', sources.map(f => [f, f]), 'source')

  const counts = new Map()
  for (const channel of scoped) for (const id of channel.categories) counts.set(id, (counts.get(id) || 0) + 1)
  const names = new Map(state.library.categories.map(c => [c.id, c.name]))
  const categories = [...counts.entries()]
    .sort((a, b) => (names.get(a[0]) || a[0]).localeCompare(names.get(b[0]) || b[0]))
    .map(([id, count]) => [id, `${names.get(id) || id} (${count})`])
  fillSelect($('filter-category'), 'All categories', categories, 'category')

  const qualities = [...new Set(scoped.map(c => c.quality).filter(Boolean))].sort(
    (a, b) => parseInt(b) - parseInt(a)
  )
  fillSelect($('filter-quality'), 'Any quality', qualities.map(q => [q, q]), 'quality')
}

// Rebuilds the options and keeps the select in sync with state (dropping values
// that no longer exist in the current scope).
function fillSelect(select, placeholder, options, stateKey) {
  select.replaceChildren(el('option', { value: '', textContent: placeholder }))
  for (const [value, label] of options) select.append(el('option', { value, textContent: label }))
  if (!options.some(([value]) => value === state[stateKey])) state[stateKey] = ''
  select.value = state[stateKey]
}

function inCountry(channel) {
  if (state.country === 'all') return true
  if (state.country === 'favorites') return state.favorites.has(channelKey(channel))

  return channel.country === state.country
}

function matches(channel) {
  if (!inCountry(channel)) return false
  if (state.source && channel.file !== state.source) return false
  if (state.category && !channel.categories.includes(state.category)) return false
  if (state.quality && channel.quality !== state.quality) return false
  if (state.liveOnly && channel.tags.some(t => /not 24\/7/i.test(t))) return false
  if (state.hideGeo && channel.tags.some(t => /geo-blocked/i.test(t))) return false
  if (state.hideNsfw && channel.isNsfw) return false

  if (state.search) {
    const haystack = `${channel.name} ${channel.tvgId} ${channel.url} ${channel.file}`.toLowerCase()
    if (!state.search.split(/\s+/).every(term => haystack.includes(term))) return false
  }

  return true
}

function selection() {
  const list = state.library.channels.filter(matches)
  const byName = (a, b) => a.title.localeCompare(b.title)

  if (state.sort === 'quality') {
    list.sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0) || byName(a, b))
  } else if (state.sort === 'country') {
    list.sort((a, b) => a.country.localeCompare(b.country) || byName(a, b))
  } else {
    list.sort(byName)
  }

  return list
}

// ------------------------------------------------------------------ results

let currentSelection = []

function render() {
  currentSelection = selection()
  const results = $('results')
  results.replaceChildren()

  const country = state.library.countries.find(c => c.code === state.country)
  const label =
    state.country === 'all' ? '🌍 All countries' : state.country === 'favorites' ? '⭐ Favorites' : `${country.flag} ${country.name}`
  $('crumb').replaceChildren(
    el('span', { textContent: label }),
    el('span', { className: 'sub', textContent: `${currentSelection.length.toLocaleString()} channels` })
  )
  $('btn-raw').disabled = !state.source && !(country && country.files.length === 1)

  if (!currentSelection.length) {
    results.append(el('div', { className: 'empty', textContent: 'No channels match these filters.' }))

    return
  }

  appendRows(0, Math.min(state.visible, currentSelection.length))
}

function appendRows(from, to) {
  const fragment = document.createDocumentFragment()
  let lastGroup = null

  for (let i = from; i < to; i++) {
    const channel = currentSelection[i]
    if (state.country === 'all' || state.country === 'favorites' || state.sort === 'country') {
      const group = channel.country
      if (group !== lastGroup && state.sort === 'country') {
        const info = state.library.countries.find(c => c.code === group)
        fragment.append(el('div', { className: 'group-title', textContent: `${info.flag} ${info.name}` }))
      }
      lastGroup = group
    }
    fragment.append(renderRow(channel))
  }

  $('results').append(fragment)

  if (to < currentSelection.length) {
    const more = el('button', {
      className: 'btn load-more',
      textContent: `Show more (${(currentSelection.length - to).toLocaleString()} left)`
    })
    more.onclick = () => {
      more.remove()
      state.visible = to + PAGE_SIZE
      appendRows(to, Math.min(state.visible, currentSelection.length))
    }
    $('results').append(more)
  }
}

function renderRow(channel) {
  const key = channelKey(channel)
  const country = state.library.countries.find(c => c.code === channel.country)

  const logo = channel.logo
    ? el('img', { className: 'logo', src: channel.logo, loading: 'lazy', alt: '', referrerPolicy: 'no-referrer' })
    : el('div', { className: 'logo-fallback', textContent: country ? country.flag : '?' })
  if (channel.logo) {
    logo.onerror = () => logo.replaceWith(el('div', { className: 'logo-fallback', textContent: country ? country.flag : '?' }))
  }

  const badges = []
  if (channel.quality) badges.push(el('span', { className: 'badge quality', textContent: channel.quality }))
  for (const tag of channel.tags) badges.push(el('span', { className: 'badge warn', textContent: tag }))
  if (channel.isNsfw) badges.push(el('span', { className: 'badge nsfw', textContent: 'NSFW' }))
  for (const category of channel.categories.slice(0, 2)) {
    const name = (state.library.categories.find(c => c.id === category) || {}).name || category
    badges.push(el('span', { className: 'badge', textContent: name }))
  }

  const health = state.health.get(channel.url)
  const healthBadge = el('span', {
    className: `badge ${health ? (health.ok ? 'ok' : 'dead') : ''}`,
    textContent: health ? (health.ok ? `online ${health.ms}ms` : health.error || `HTTP ${health.status}`) : '',
    hidden: !health
  })
  badges.push(healthBadge)

  const star = el('button', {
    className: `star${state.favorites.has(key) ? ' on' : ''}`,
    textContent: state.favorites.has(key) ? '★' : '☆',
    title: 'Favorite'
  })
  star.onclick = () => {
    state.favorites.has(key) ? state.favorites.delete(key) : state.favorites.add(key)
    localStorage.setItem('iptv.favorites', JSON.stringify([...state.favorites]))
    star.className = `star${state.favorites.has(key) ? ' on' : ''}`
    star.textContent = state.favorites.has(key) ? '★' : '☆'
    renderCountries()
    if (state.country === 'favorites') render()
  }

  const open = el('button', { className: 'btn btn-sm', textContent: 'Open ↗', title: 'Open the stream URL in a new tab' })
  open.onclick = () => window.open(channel.url, '_blank', 'noopener')

  const copy = el('button', { className: 'btn btn-sm', textContent: 'Copy' })
  copy.onclick = async () => {
    await navigator.clipboard.writeText(channel.url)
    toast('Stream URL copied')
  }

  const check = el('button', { className: 'btn btn-sm', textContent: 'Check' })
  check.onclick = async () => {
    check.disabled = true
    check.textContent = '…'
    const result = await checkStream(channel)
    check.disabled = false
    check.textContent = 'Check'
    healthBadge.hidden = false
    healthBadge.className = `badge ${result.ok ? 'ok' : 'dead'}`
    healthBadge.textContent = result.ok ? `online ${result.ms}ms` : result.error || `HTTP ${result.status}`
  }

  return el('div', { className: 'row' }, [
    logo,
    el('div', {}, [
      el('div', { className: 'title-line' }, [el('span', { className: 'title', textContent: channel.title }), ...badges]),
      el('div', { className: 'sub-line' }, [
        el('span', { textContent: `${country ? country.flag : ''} ${channel.file}` }),
        channel.tvgId ? el('span', { textContent: channel.tvgId }) : null,
        el('span', { className: 'url', textContent: channel.url, title: channel.url })
      ])
    ]),
    el('div', { className: 'actions' }, [star, check, copy, open])
  ])
}

// ------------------------------------------------------------ stream checks

async function checkStream(channel) {
  try {
    const response = await fetch('/api/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: channel.url, referrer: channel.referrer, userAgent: channel.userAgent })
    })
    const result = await response.json()
    state.health.set(channel.url, result)

    return result
  } catch (error) {
    const result = { ok: false, status: 0, error: 'request failed' }
    state.health.set(channel.url, result)

    return result
  }
}

async function checkVisible() {
  const button = $('btn-check')
  const batch = currentSelection.slice(0, state.visible)
  if (!batch.length) return

  button.disabled = true
  let done = 0
  let online = 0
  const queue = [...batch]

  const worker = async () => {
    while (queue.length) {
      const channel = queue.shift()
      const result = await checkStream(channel)
      if (result.ok) online++
      done++
      button.textContent = `Checking ${done}/${batch.length}`
    }
  }

  await Promise.all(Array.from({ length: 8 }, worker))
  button.disabled = false
  button.textContent = 'Check streams'
  toast(`${online}/${batch.length} streams online`)
  render()
}

// ----------------------------------------------------------------- exporting

function exportM3u() {
  const lines = ['#EXTM3U']
  for (const channel of currentSelection) {
    lines.push(`#EXTINF:-1 tvg-id="${channel.tvgId}",${channel.name}`)
    if (channel.referrer) lines.push(`#EXTVLCOPT:http-referrer=${channel.referrer}`)
    if (channel.userAgent) lines.push(`#EXTVLCOPT:http-user-agent=${channel.userAgent}`)
    lines.push(channel.url)
  }

  const blob = new Blob([lines.join('\n') + '\n'], { type: 'audio/x-mpegurl' })
  const link = el('a', { href: URL.createObjectURL(blob), download: `${state.country}-selection.m3u` })
  link.click()
  URL.revokeObjectURL(link.href)
  toast(`Exported ${currentSelection.length} channels`)
}

function openRaw() {
  const country = state.library.countries.find(c => c.code === state.country)
  const file = state.source || (country && country.files.length === 1 ? country.files[0] : null)
  if (file) window.open(`/api/raw?file=${encodeURIComponent(file)}`, '_blank', 'noopener')
}

// -------------------------------------------------------------------- update

async function runUpdate() {
  const button = $('btn-update')
  button.disabled = true
  button.classList.add('running')
  $('modal').hidden = false
  $('modal-title').textContent = 'Updating playlists'
  $('modal-log').textContent = ''

  const steps = new Map()
  $('modal-steps').replaceChildren()
  for (const name of ['run playlist:format', 'run playlist:lint', 'run playlist:validate']) {
    const node = el('span', { className: 'step', textContent: name.replace('run ', '') })
    steps.set(name, node)
    $('modal-steps').append(node)
  }

  const write = line => {
    const log = $('modal-log')
    const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 30
    log.textContent += `${line}\n`
    if (atBottom) log.scrollTop = log.scrollHeight
  }

  try {
    const response = await fetch('/api/update', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    if (!response.ok) throw new Error((await response.json()).error || 'Update failed to start')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const chunks = buffer.split('\n')
      buffer = chunks.pop() || ''

      for (const chunk of chunks) {
        if (!chunk.trim()) continue
        const event = JSON.parse(chunk)

        if (event.type === 'step') {
          steps.get(event.step)?.classList.add('running')
          write(`\n$ npm ${event.step}`)
        } else if (event.type === 'log') {
          write(event.line)
        } else if (event.type === 'step-done') {
          const node = steps.get(event.step)
          node?.classList.remove('running')
          node?.classList.add(event.code === 0 ? 'ok' : 'fail')
        } else if (event.type === 'done') {
          $('modal-title').textContent = event.failed ? `Failed at ${event.failed}` : 'Update finished'
          write(event.failed ? `\n✗ stopped at "npm ${event.failed}"` : `\n✓ done — ${event.channels} channels`)
          await loadLibrary()
          toast(event.failed ? 'Update failed — see the log' : 'Playlists updated')
        }
      }
    }
  } catch (error) {
    write(`\n! ${error.message}`)
    $('modal-title').textContent = 'Update failed'
  } finally {
    button.disabled = false
    button.classList.remove('running')
  }
}

// --------------------------------------------------------------------- misc

let toastTimer
function toast(message) {
  const node = $('toast')
  node.textContent = message
  node.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (node.hidden = true), 2600)
}

function debounce(fn, ms) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

function bind() {
  $('search').addEventListener(
    'input',
    debounce(event => {
      state.search = event.target.value.trim().toLowerCase()
      state.visible = PAGE_SIZE
      render()
    }, 180)
  )

  $('country-filter').addEventListener('input', debounce(renderCountries, 120))

  for (const [id, key] of [
    ['filter-source', 'source'],
    ['filter-category', 'category'],
    ['filter-quality', 'quality'],
    ['sort', 'sort']
  ]) {
    $(id).addEventListener('change', event => {
      state[key] = event.target.value
      state.visible = PAGE_SIZE
      render()
    })
  }

  for (const [id, key] of [
    ['filter-live', 'liveOnly'],
    ['filter-geo', 'hideGeo'],
    ['filter-nsfw', 'hideNsfw']
  ]) {
    $(id).addEventListener('change', event => {
      state[key] = event.target.checked
      state.visible = PAGE_SIZE
      render()
    })
  }

  $('btn-update').onclick = runUpdate
  $('btn-check').onclick = checkVisible
  $('btn-export').onclick = exportM3u
  $('btn-raw').onclick = openRaw
  $('modal-close').onclick = () => ($('modal').hidden = true)
  $('modal').onclick = event => {
    if (event.target === $('modal')) $('modal').hidden = true
  }

  $('btn-theme').onclick = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    localStorage.setItem('iptv.theme', next)
  }

  document.addEventListener('keydown', event => {
    if (event.key === '/' && document.activeElement.tagName !== 'INPUT') {
      event.preventDefault()
      $('search').focus()
    }
    if (event.key === 'Escape') $('modal').hidden = true
  })
}

document.documentElement.dataset.theme = localStorage.getItem('iptv.theme') || 'dark'
bind()
loadLibrary().catch(error => {
  $('results').replaceChildren(el('div', { className: 'empty', textContent: error.message }))
})
