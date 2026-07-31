#!/usr/bin/env node
// Local viewer for the /streams playlists.
// Zero dependencies: only Node built-ins.
//
//   npm run viewer            -> http://127.0.0.1:4321
//   PORT=8080 npm run viewer

import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import url from 'node:url'
import { spawn } from 'node:child_process'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const STREAMS_DIR = path.join(ROOT, 'streams')
const DATA_DIR = path.join(ROOT, 'temp/data')
const PUBLIC_DIR = path.join(__dirname, 'public')

const PORT = Number(process.env.PORT) || 4321
const HOST = process.env.HOST || '127.0.0.1'

const UPDATE_COMMANDS = [
  ['npm', ['run', 'playlist:format']],
  ['npm', ['run', 'playlist:lint']],
  ['npm', ['run', 'playlist:validate']]
]

// ---------------------------------------------------------------- playlists

// `br.m3u` -> { code: 'br', suffix: null }, `us_pluto.m3u` -> { code: 'us', suffix: 'pluto' }
function parseFilename(filename) {
  const base = filename.replace(/\.m3u$/, '')
  const [code, ...rest] = base.split('_')

  return { code: code.toLowerCase(), suffix: rest.join('_') || null }
}

function parseExtinf(line) {
  const attrs = {}
  const attrsPart = line.slice(0, line.indexOf(',') === -1 ? line.length : line.indexOf(','))
  for (const match of attrsPart.matchAll(/([\w-]+)="([^"]*)"/g)) attrs[match[1]] = match[2]

  const name = line.indexOf(',') === -1 ? '' : line.slice(line.indexOf(',') + 1).trim()

  return { attrs, name }
}

// "AgroBrasil TV (720p) [Not 24/7]" -> title, quality, tags
function parseName(name) {
  const quality = (name.match(/\((\d+p|\d+[kK])\)/) || [])[1] || null
  const tags = [...name.matchAll(/\[([^\]]+)\]/g)].map(m => m[1])
  const title = name
    .replace(/\((\d+p|\d+[kK])\)/g, '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return { title: title || name, quality, tags }
}

function parsePlaylist(content, filename) {
  const lines = content.split(/\r?\n/)
  const channels = []
  let pending = null
  let tvgUrl = null

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    if (line.startsWith('#EXTM3U')) {
      tvgUrl = (line.match(/x-tvg-url="([^"]*)"/) || [])[1] || null
      continue
    }

    if (line.startsWith('#EXTINF')) {
      const { attrs, name } = parseExtinf(line)
      const { title, quality, tags } = parseName(name)
      const tvgId = attrs['tvg-id'] || ''
      pending = {
        name,
        title,
        quality,
        tags,
        tvgId,
        channelId: tvgId ? tvgId.split('@')[0] : null,
        feedId: tvgId.includes('@') ? tvgId.split('@')[1] : null,
        referrer: null,
        userAgent: null,
        file: filename
      }
      continue
    }

    if (line.startsWith('#EXTVLCOPT') && pending) {
      const [, key, value] = line.match(/^#EXTVLCOPT:([^=]+)=(.*)$/) || []
      if (key === 'http-referrer') pending.referrer = value
      if (key === 'http-user-agent') pending.userAgent = value
      continue
    }

    if (line.startsWith('#')) continue

    if (pending) {
      channels.push({ ...pending, url: line })
      pending = null
    }
  }

  return { channels, tvgUrl }
}

// ------------------------------------------------------------- external data

// temp/data/* is produced by `npm run api:load`; the viewer works without it.
async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, file), 'utf8'))
  } catch {
    return null
  }
}

function fallbackCountryName(code) {
  try {
    const region = code.toUpperCase() === 'UK' ? 'GB' : code.toUpperCase()
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(region) || code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

function codeToFlag(code) {
  const region = code.toUpperCase() === 'UK' ? 'GB' : code.toUpperCase()
  if (!/^[A-Z]{2}$/.test(region)) return '🏳️'

  return String.fromCodePoint(...[...region].map(c => 0x1f1e6 + c.charCodeAt(0) - 65))
}

async function loadReference() {
  const countries = new Map()
  for (const country of (await readJson('countries.json')) || []) {
    countries.set(country.code.toLowerCase(), { name: country.name, flag: country.flag })
  }

  const logos = new Map()
  for (const logo of (await readJson('logos.json')) || []) {
    if (!logo.url) continue
    const key = logo.feed ? `${logo.channel}@${logo.feed}` : logo.channel
    if (!logos.has(key)) logos.set(key, logo.url)
    if (!logos.has(logo.channel)) logos.set(logo.channel, logo.url)
  }

  const channels = new Map()
  for (const channel of (await readJson('channels.json')) || []) {
    channels.set(channel.id, {
      name: channel.name,
      categories: channel.categories || [],
      isNsfw: !!channel.is_nsfw,
      website: channel.website || null,
      closed: channel.closed || null
    })
  }

  const categories = new Map()
  for (const category of (await readJson('categories.json')) || []) {
    categories.set(category.id, category.name)
  }

  return { countries, logos, channels, categories }
}

// -------------------------------------------------------------- the library

let library = null
let building = null

async function buildLibrary() {
  const started = Date.now()
  const reference = await loadReference()
  const files = (await fs.readdir(STREAMS_DIR)).filter(f => f.endsWith('.m3u')).sort()

  const countries = new Map()
  const channels = []
  const playlists = []

  for (const filename of files) {
    const { code, suffix } = parseFilename(filename)
    const stat = await fs.stat(path.join(STREAMS_DIR, filename))
    const content = await fs.readFile(path.join(STREAMS_DIR, filename), 'utf8')
    const parsed = parsePlaylist(content, filename)

    if (!countries.has(code)) {
      const known = reference.countries.get(code)
      countries.set(code, {
        code,
        name: known?.name || fallbackCountryName(code),
        flag: known?.flag || codeToFlag(code),
        count: 0,
        files: []
      })
    }

    const country = countries.get(code)
    country.count += parsed.channels.length
    country.files.push(filename)

    playlists.push({
      file: filename,
      code,
      suffix,
      count: parsed.channels.length,
      tvgUrl: parsed.tvgUrl,
      modifiedAt: stat.mtime.toISOString()
    })

    for (const channel of parsed.channels) {
      const meta = channel.channelId ? reference.channels.get(channel.channelId) : null
      channels.push({
        ...channel,
        source: suffix,
        country: code,
        logo: channel.tvgId ? reference.logos.get(channel.tvgId) || reference.logos.get(channel.channelId) || null : null,
        categories: meta?.categories || [],
        isNsfw: meta?.isNsfw || false,
        website: meta?.website || null
      })
    }
  }

  const categories = new Map()
  for (const channel of channels) {
    for (const id of channel.categories) {
      categories.set(id, (categories.get(id) || 0) + 1)
    }
  }

  library = {
    generatedAt: new Date().toISOString(),
    buildMs: Date.now() - started,
    hasReferenceData: reference.countries.size > 0,
    countries: [...countries.values()].sort((a, b) => a.name.localeCompare(b.name)),
    categories: [...categories.entries()]
      .map(([id, count]) => ({ id, name: reference.categories.get(id) || id, count }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    playlists,
    channels
  }

  return library
}

function getLibrary() {
  if (library) return Promise.resolve(library)
  if (!building) building = buildLibrary().finally(() => (building = null))

  return building
}

// ------------------------------------------------------------ stream checker

async function checkStream(target, { referrer, userAgent } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  const started = Date.now()

  try {
    const headers = { 'user-agent': userAgent || 'VLC/3.0.20 LibVLC/3.0.20' }
    if (referrer) headers.referer = referrer

    const response = await fetch(target, { headers, signal: controller.signal, redirect: 'follow' })
    const ms = Date.now() - started
    // Only the headers matter; drop the body without downloading the stream.
    response.body?.cancel().catch(() => {})

    return { ok: response.ok, status: response.status, ms }
  } catch (error) {
    return { ok: false, status: 0, ms: Date.now() - started, error: error.name === 'AbortError' ? 'timeout' : error.message }
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------- update run

let updateRunning = false

function runCommand(command, args, onLine) {
  return new Promise(resolve => {
    const child = spawn(command, args, { cwd: ROOT, env: process.env, shell: process.platform === 'win32' })
    let buffer = ''

    const flush = chunk => {
      buffer += chunk.toString()
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() || ''
      for (const line of lines) onLine(line)
    }

    child.stdout.on('data', flush)
    child.stderr.on('data', flush)
    child.on('error', error => {
      onLine(`! failed to start: ${error.message}`)
      resolve(1)
    })
    child.on('close', code => {
      if (buffer) onLine(buffer)
      resolve(code ?? 1)
    })
  })
}

async function handleUpdate(res, only) {
  if (updateRunning) {
    res.writeHead(409, { 'content-type': 'application/json' })

    return res.end(JSON.stringify({ error: 'An update is already running' }))
  }

  updateRunning = true
  res.writeHead(200, {
    'content-type': 'application/x-ndjson; charset=utf-8',
    'cache-control': 'no-cache',
    'x-accel-buffering': 'no'
  })

  const send = event => res.write(`${JSON.stringify(event)}\n`)
  const commands = only?.length
    ? UPDATE_COMMANDS.filter(([, args]) => only.includes(args[1]))
    : UPDATE_COMMANDS

  let failed = null
  try {
    for (const [command, args] of commands) {
      const label = args.join(' ')
      send({ type: 'step', step: label })
      const code = await runCommand(command, args, line => send({ type: 'log', step: label, line }))
      send({ type: 'step-done', step: label, code })
      if (code !== 0) {
        failed = label
        break
      }
    }

    library = null
    const rebuilt = await getLibrary()
    send({ type: 'done', failed, channels: rebuilt.channels.length, generatedAt: rebuilt.generatedAt })
  } catch (error) {
    send({ type: 'done', failed: failed || 'unexpected error', error: String(error) })
  } finally {
    updateRunning = false
    res.end()
  }
}

// ------------------------------------------------------------------- serving

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8'
}

async function serveStatic(pathname, res) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const filePath = path.join(PUBLIC_DIR, relative)
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403).end('Forbidden')

    return
  }

  try {
    const content = await fs.readFile(filePath)
    res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] || 'application/octet-stream' })
    res.end(content)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found')
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => {
      data += chunk
      if (data.length > 1e6) reject(new Error('Body too large'))
    })
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function json(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

const server = http.createServer(async (req, res) => {
  const { pathname, searchParams } = new URL(req.url, `http://${req.headers.host}`)

  try {
    if (pathname === '/api/library' && req.method === 'GET') {
      if (searchParams.get('refresh') === '1') library = null

      return json(res, 200, await getLibrary())
    }

    if (pathname === '/api/raw' && req.method === 'GET') {
      const file = path.basename(searchParams.get('file') || '')
      if (!/^[\w-]+\.m3u$/.test(file)) return json(res, 400, { error: 'Invalid file' })

      const content = await fs.readFile(path.join(STREAMS_DIR, file), 'utf8')
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })

      return res.end(content)
    }

    if (pathname === '/api/check' && req.method === 'POST') {
      const body = await readBody(req)
      if (!/^https?:\/\//i.test(body.url || '')) return json(res, 400, { error: 'Invalid url' })

      return json(res, 200, await checkStream(body.url, body))
    }

    if (pathname === '/api/update' && req.method === 'POST') {
      const body = await readBody(req).catch(() => ({}))

      return handleUpdate(res, body.only)
    }

    if (pathname.startsWith('/api/')) return json(res, 404, { error: 'Unknown endpoint' })

    return serveStatic(pathname, res)
  } catch (error) {
    json(res, 500, { error: String(error && error.message ? error.message : error) })
  }
})

server.listen(PORT, HOST, async () => {
  console.log(`\n  IPTV viewer  →  http://${HOST}:${PORT}\n`)
  const built = await getLibrary()
  console.log(
    `  ${built.channels.length} channels from ${built.playlists.length} playlists in ${built.countries.length} countries (${built.buildMs}ms)`
  )
  if (!built.hasReferenceData) {
    console.log('  note: run `npm run api:load` to add country names, logos and categories')
  }
  console.log('')
})
