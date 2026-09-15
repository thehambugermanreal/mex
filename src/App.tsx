import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import type { Id } from '../convex/_generated/dataModel'
import data from '@emoji-mart/data'
import { Picker } from 'emoji-mart'
import { ArrowLeft, ArrowRight, ArrowUpRight, Bot, Film, Gamepad2, Globe2, House, LayoutGrid, LoaderCircle, MessageCircle, Music2, Pencil, Play, Reply, RotateCw, Search, Send, Settings, ShieldCheck, Smile, Sparkles, Trash2, X } from 'lucide-react'

type View = 'home' | 'games' | 'ai' | 'music' | 'movie' | 'proxy' | 'chat' | 'apps' | 'settings'
type ProxyStage = 'idle' | 'testing' | 'loading'

type ScramjetFrame = {
  element: HTMLIFrameElement
  prefix: string
  go: (url: string) => void
  back: () => void
  forward: () => void
  reload: () => void
}

type ScramjetController = {
  prefix: string
  wait: () => Promise<void>
  createFrame: (element?: HTMLIFrameElement, options?: { plugins?: unknown[] }) => ScramjetFrame
}

type ScramjetControllerApi = {
  Controller: new (config: {
    serviceworker: ServiceWorker
    transport: EpoxyTransport
    scramjetConfig?: {
      flags: {
        sourcemaps?: boolean
        debugSourceURL?: boolean
        debugTrampolines?: boolean
        captureErrors?: boolean
      }
    }
    config?: {
      prefix: string
      scramjetPath: string
      injectPath: string
      wasmPath: string
      virtualWasmPath: string
      codec: { encode: (url: string) => string; decode: (url: string) => string }
    }
  }) => ScramjetController
}

type EpoxyTransport = {
  init: () => Promise<void>
  request: (...args: any[]) => Promise<unknown>
  connect: (...args: any[]) => unknown
}
type Game = {
  id: string
  name: string
  image_token?: string
  image?: string
}

type GamesResponse = {
  games: Game[]
  total: number
  page: number
  pages: number
}

type ChatReaction = {
  emoji: string
  count: number
  mine: boolean
}

type ChatReply = {
  name: string
  text: string
  deleted: boolean
} | null

type Accent = 'mint' | 'aqua' | 'lilac' | 'amber'
type FontChoice = 'manrope' | 'system' | 'mono'
type ThemeChoice = 'green' | 'pitch'
type Density = 'comfortable' | 'compact'
type SearchEngine = 'duckduckgo' | 'google' | 'bing' | 'brave'

type Settings = {
  accent: Accent
  theme: ThemeChoice
  font: FontChoice
  density: Density
  grid: boolean
  ambient: boolean
  reduceMotion: boolean
  customCursor: boolean
  gamesLimit: number
  showGameNumbers: boolean
  showTimestamps: boolean
  showNames: boolean
  compactChat: boolean
  messageSound: boolean
  autoScroll: boolean
  homepage: string
  searchEngine: SearchEngine
}

const defaultSettings: Settings = {
  accent: 'mint',
  theme: 'green',
  font: 'manrope',
  density: 'comfortable',
  grid: true,
  ambient: true,
  reduceMotion: false,
  customCursor: true,
  gamesLimit: 20,
  showGameNumbers: true,
  showTimestamps: true,
  showNames: true,
  compactChat: false,
  messageSound: false,
  autoScroll: true,
  homepage: 'https://example.com',
  searchEngine: 'duckduckgo',
}

const accentHex: Record<Accent, string> = {
  mint: '#b9fa8e',
  aqua: '#8ef4fa',
  lilac: '#d3a6ff',
  amber: '#ffd98a',
}

const fontStacks: Record<FontChoice, string> = {
  manrope: "'Manrope', sans-serif",
  system: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'DM Mono', monospace",
}

const searchEngines: Record<SearchEngine, { label: string; url: string }> = {
  duckduckgo: { label: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  google: { label: 'Google', url: 'https://www.google.com/search?q=' },
  bing: { label: 'Bing', url: 'https://www.bing.com/search?q=' },
  brave: { label: 'Brave', url: 'https://search.brave.com/search?q=' },
}

function beep() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 660
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    osc.start()
    osc.stop(ctx.currentTime + 0.12)
    void ctx.resume()
  } catch {
    /* audio unavailable */
  }
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="setting-row">
      <span>{label}</span>
      <button className={value ? 'toggle on' : 'toggle'} role="switch" aria-checked={value} onClick={() => onChange(!value)} aria-label={label}>
        <span className="toggle-knob" />
      </button>
    </div>
  )
}

type ChatMessage = {
  _id: string
  _creationTime: number
  name: string
  text: string
  editedAt?: number
  deleted?: boolean
  reactions: ChatReaction[]
  reply: ChatReply
}

function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const selectRef = useRef(onSelect)
  selectRef.current = onSelect

  useEffect(() => {
    if (!host.current) return
    const picker = new Picker({
      parent: host.current,
      data,
      theme: 'dark',
      previewPosition: 'none',
      skinTonePosition: 'none',
      onEmojiSelect: (emoji: { native?: string }) => selectRef.current(emoji.native ?? ''),
    })
    void picker
    return () => {
      host.current?.replaceChildren()
    }
  }, [])

  return <div ref={host} className="emoji-picker-host" />
}

type WispConnection = {
  onopen: () => void
  onerror: () => void
  onclose: () => void
  connecting?: boolean
  close: () => void
}

type WispClient = {
  ClientConnection: new (url: string) => WispConnection
}

type LuminApi = {
  init: (config: { headless: boolean }) => Promise<void>
  getGames: (options: { page: number; limit: number; q?: string }) => Promise<GamesResponse>
  getImageUrl: (token: string) => Promise<string>
  loadGame: (id: string) => Promise<void>
  destroy: () => void
}

declare global {
  interface Window {
    Lumin?: LuminApi
    wisp_client?: { client: WispClient }
    $scramjet?: unknown
    $scramjetController?: ScramjetControllerApi
    EpoxyTransport?: { default: new (options: { wisp: string }) => EpoxyTransport }
  }
}

const fallbackGames: Game[] = [
  { id: 'neon-drift', name: 'Neon Drift', image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=900&q=80' },
  { id: 'orbit-runner', name: 'Orbit Runner', image: 'https://images.unsplash.com/photo-1614728263952-84ea256f9679?auto=format&fit=crop&w=900&q=80' },
  { id: 'pixel-garden', name: 'Pixel Garden', image: 'https://images.unsplash.com/photo-1614294148960-9aa740632a87?auto=format&fit=crop&w=900&q=80' },
  { id: 'cosmic-cards', name: 'Cosmic Cards', image: 'https://images.unsplash.com/photo-1605870445919-838d190e8e1b?auto=format&fit=crop&w=900&q=80' },
]

type AppEntry = {
  id: string
  name: string
  url: string
  icon?: string
}

const apps: AppEntry[] = [
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com', icon: '/apps/chatgpt.png' },
  { id: 'discord', name: 'Discord', url: 'https://discord.com/app', icon: '/apps/discord.png' },
  { id: 'geforce-now', name: 'GeForce Now', url: 'https://play.geforcenow.com', icon: '/apps/geforce-now.png' },
  { id: 'newgrounds', name: 'Newgrounds', url: 'https://www.newgrounds.com' },
  { id: 'snapchat', name: 'Snapchat', url: 'https://web.snapchat.com', icon: '/apps/snapchat.jpg' },
  { id: 'tiktok', name: 'TikTok', url: 'https://www.tiktok.com', icon: '/apps/tiktok.webp' },
  { id: 'twitch', name: 'Twitch', url: 'https://www.twitch.tv', icon: '/apps/twitch.png' },
  { id: 'vscode', name: 'VS Code', url: 'https://vscode.dev', icon: '/apps/vscode.webp' },
  { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com', icon: '/apps/youtube.png' },
  { id: 'soundcloud', name: 'SoundCloud', url: 'https://soundcloud.com', icon: '/apps/soundcloud.webp' },
]

const scramjetServiceWorkerUrl = '/sw.js?v=18'
const scramjetServiceWorkerScope = '/'
function storedWispUrl() {
  try {
    return localStorage.getItem('mex-wisp') || undefined
  } catch {
    return undefined
  }
}
const wispUrl = import.meta.env.NEXT_PUBLIC_WISP_URL || import.meta.env.VITE_WISP_URL || storedWispUrl() || 'wss://mex-ubg-wisp.onrender.com/wisp/'
const movieEmbedUrl = `/embed.html?url=${encodeURIComponent('https://cinemaos.tech')}`
const musicEmbedUrl = `/embed.html?url=${encodeURIComponent('https://listenfree.in/')}`
const aiEmbedUrl = `/embed.html?url=${encodeURIComponent('https://duck.ai')}`

function connectToWisp(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (!window.wisp_client?.client) {
      reject(new Error('The Wisp client is unavailable.'))
      return
    }

    let settled = false
    let connection: WispConnection | undefined
    const timeout = window.setTimeout(() => finish(new Error('Wisp server did not respond in time.')), 10000)

    const cleanup = () => {
      window.clearTimeout(timeout)
      signal.removeEventListener('abort', abort)
      if (!connection) return
      connection.onopen = () => {}
      connection.onerror = () => {}
      connection.onclose = () => {}
      if (connection.close && connection.connecting !== true) connection.close()
    }

    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      cleanup()
      error ? reject(error) : resolve()
    }

    const abort = () => finish(new Error('Wisp connection was cancelled.'))
    signal.addEventListener('abort', abort, { once: true })

    try {
      connection = new window.wisp_client.client.ClientConnection(wispUrl)
      connection.onopen = () => finish()
      connection.onerror = () => finish(new Error('Could not connect to the Wisp server.'))
      connection.onclose = () => finish(new Error('Wisp server closed the connection.'))
    } catch (error) {
      finish(error instanceof Error ? error : new Error('Could not connect to the Wisp server.'))
    }
  })
}

async function waitForWisp(signal: AbortSignal) {
  while (!signal.aborted) {
    try {
      await connectToWisp(signal)
      return
    } catch (error) {
      if (signal.aborted) throw error
      await new Promise<void>((resolve) => {
        const retry = window.setTimeout(resolve, 2000)
        signal.addEventListener('abort', () => {
          window.clearTimeout(retry)
          resolve()
        }, { once: true })
      })
    }
  }

  throw new Error('Wisp connection was cancelled.')
}

async function loadScramjetBundle(signal: AbortSignal) {
  const scripts = [
    { src: '/scramjet-runtime.js', ready: () => Boolean(window.$scramjet) },
    { src: '/controller/controller.api.js', ready: () => Boolean(window.$scramjetController) },
    { src: '/epoxy/index.js', ready: () => Boolean(window.EpoxyTransport) },
  ]

  for (const { src, ready } of scripts) {
    if (ready()) continue

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      const timeout = window.setTimeout(() => finish(new Error('Scramjet runtime did not load.')), 15000)
      let settled = false

      const cleanup = () => {
        window.clearTimeout(timeout)
        signal.removeEventListener('abort', abort)
        script.removeEventListener('load', onLoad)
        script.removeEventListener('error', onError)
      }

      const finish = (error?: Error) => {
        if (settled) return
        settled = true
        cleanup()
        error ? reject(error) : resolve()
      }

      const abort = () => finish(new Error('Scramjet startup was cancelled.'))
      const onLoad = () => ready()
        ? finish()
        : finish(new Error(`Runtime script loaded without its API: ${src}`))
      const onError = () => finish(new Error(`Could not load the runtime script: ${src}`))

      signal.addEventListener('abort', abort, { once: true })
      script.async = false
      script.src = src
      script.addEventListener('load', onLoad)
      script.addEventListener('error', onError)
      document.head.appendChild(script)
    })
  }
}

function waitForWorkerActivation(worker: ServiceWorker) {
  if (worker.state === 'activated') return Promise.resolve()

  return new Promise<void>((resolve, reject) => {
    const check = () => {
      if (worker.state === 'activated') {
        cleanup()
        resolve()
      } else if (worker.state === 'redundant') {
        cleanup()
        reject(new Error('The Scramjet service worker update was discarded. Refresh the page and try again.'))
      }
    }

    const cleanup = () => worker.removeEventListener('statechange', check)
    worker.addEventListener('statechange', check)
    check()
  })
}

async function waitForScramjetWorker(registration: ServiceWorkerRegistration) {
  const pendingWorker = registration.installing ?? registration.waiting
  if (pendingWorker) {
    await waitForWorkerActivation(pendingWorker)
    return
  }

  if (registration.active?.state === 'activated') return

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('The Scramjet service worker did not become active. Refresh the page and try again.'))
    }, 10000)

    const check = () => {
      const worker = registration.active
      if (worker?.state === 'activated') {
        cleanup()
        resolve()
      }
    }

    const cleanup = () => {
      window.clearTimeout(timeout)
      registration.removeEventListener('updatefound', check)
    }

    registration.addEventListener('updatefound', check)
    check()
  })
}

async function waitForScramjetController(registration: ServiceWorkerRegistration) {
  const expectedUrl = new URL(scramjetServiceWorkerUrl, window.location.href).href
  const isController = () => navigator.serviceWorker.controller?.scriptURL === expectedUrl

  if (isController()) return

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('The Scramjet service worker did not take control. Refresh the page and try again.'))
    }, 10000)

    const check = () => {
      if (!isController()) return
      cleanup()
      resolve()
    }

    const cleanup = () => {
      window.clearTimeout(timeout)
      navigator.serviceWorker.removeEventListener('controllerchange', check)
      registration.removeEventListener('updatefound', check)
    }

    navigator.serviceWorker.addEventListener('controllerchange', check)
    registration.addEventListener('updatefound', check)
    check()
  })
}

function cleanConvexError(error: unknown) {
  const raw = error instanceof Error ? error.message : 'Auth failed.'
  const parts = raw.split('Uncaught Error:')
  const tail = (parts.length > 1 ? parts[parts.length - 1] : raw).replace(/Called by client\.?/gi, '')
  const cleaned = tail.split('\n').map((line) => line.trim()).filter(Boolean).join(' ')
  return cleaned || 'Auth failed.'
}

function App() {
  const [serverReady, setServerReady] = useState(false)
  const [view, setView] = useState<View>('home')
  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  }, [view])
  const [games, setGames] = useState<Game[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [sdkReady, setSdkReady] = useState(false)
  const [notice, setNotice] = useState('')
  const [activeApp, setActiveApp] = useState<AppEntry | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem('mex-session')
    } catch {
      return null
    }
  })
  const me = useQuery(api.auth.me, sessionToken ? { token: sessionToken } : 'skip')
  const doSignup = useMutation(api.auth.signup)
  const doSignin = useMutation(api.auth.signin)
  const doSignout = useMutation(api.auth.signout)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [authUser, setAuthUser] = useState('')
  const [authPass, setAuthPass] = useState('')
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      return { ...defaultSettings, ...(JSON.parse(localStorage.getItem('mex-settings') ?? '{}') as Partial<Settings>) }
    } catch {
      return defaultSettings
    }
  })
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwOk, setPwOk] = useState(false)
  const [pwBusy, setPwBusy] = useState(false)
  const doChangePassword = useMutation(api.auth.changePassword)
  const [nameInput, setNameInput] = useState('')
  const [nameMsg, setNameMsg] = useState('')
  const [nameOk, setNameOk] = useState(false)
  const [nameBusy, setNameBusy] = useState(false)
  const doChangeUsername = useMutation(api.auth.changeUsername)
  const [delPass, setDelPass] = useState('')
  const [delArmed, setDelArmed] = useState(false)
  const [delBusy, setDelBusy] = useState(false)
  const [delMsg, setDelMsg] = useState('')
  const doDeleteAccount = useMutation(api.auth.deleteAccount)
  const [wispInput, setWispInput] = useState(() => {
    try {
      return localStorage.getItem('mex-wisp') ?? ''
    } catch {
      return ''
    }
  })
  const chatMessagesRef = useRef<HTMLDivElement>(null)
  const chatSeen = useRef(false)

  const updateSettings = (patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch }
      try {
        localStorage.setItem('mex-settings', JSON.stringify(next))
      } catch {
        /* storage unavailable */
      }
      return next
    })
  }

  useEffect(() => {
    document.documentElement.style.setProperty('--mint', accentHex[settings.accent])
    document.documentElement.style.setProperty('--app-font', fontStacks[settings.font])
    document.body.classList.toggle('sys-cursor', !settings.customCursor)
    document.body.classList.toggle('reduce-motion', settings.reduceMotion)
    document.body.classList.toggle('pitch-black', settings.theme === 'pitch')
    document.body.classList.toggle('compact', settings.density === 'compact')
  }, [settings])
  const liveMessages = useQuery(api.messages.list, sessionToken ? { token: sessionToken } : 'skip')
  const sendMessage = useMutation(api.messages.send)
  const editChatMessage = useMutation(api.messages.editMessage)
  const deleteChatMessage = useMutation(api.messages.deleteMessage)
  const toggleChatReaction = useMutation(api.messages.toggleReaction)
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const visibleMessages = [...(liveMessages ?? chatMessages)].reverse()
  const replyTarget = visibleMessages.find((message) => message._id === replyToId) ?? null

  useEffect(() => {
    if (!liveMessages) return
    const first = !chatSeen.current
    chatSeen.current = true
    if (settings.autoScroll) {
      const el = chatMessagesRef.current
      if (el) el.scrollTo({ top: el.scrollHeight })
    }
    if (!first && settings.messageSound && liveMessages.length > 0) {
      const newest = liveMessages[0]
      if (newest && newest.name !== (me?.username ?? 'Guest')) beep()
    }
  }, [liveMessages, settings.autoScroll, settings.messageSound, me])
  const [proxyInput, setProxyInput] = useState(() => settings.homepage)
  const [proxyUrl, setProxyUrl] = useState(() => settings.homepage)
  const [proxyLoading, setProxyLoading] = useState(false)
  const [proxyStage, setProxyStage] = useState<ProxyStage>('idle')
  const [proxyError, setProxyError] = useState('')
  const proxyContainer = useRef<HTMLDivElement>(null)
  const proxyFrame = useRef<ScramjetFrame | null>(null)
  const proxyStarted = useRef(false)
  const proxyTarget = useRef(settings.homepage)
  const proxyStageTimer = useRef<number | undefined>(undefined)
  const proxyNavigation = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    setServerReady(false)
    void waitForWisp(controller.signal)
      .then(() => setServerReady(true))
      .catch(() => undefined)
    return () => controller.abort()
  }, [])

  const fetchGames = useCallback(async (search = '') => {
    setLoading(true)
    setNotice('')
    try {
      if (!window.Lumin) throw new Error('The game catalog is still loading.')
      if (!sdkReady) {
        await window.Lumin.init({ headless: true })
        setSdkReady(true)
      }
      const result = await window.Lumin.getGames({ page: 1, limit: settings.gamesLimit, q: search })
      const withImages = await Promise.all(result.games.map(async (game) => {
        if (!game.image_token) return game
        try {
          return { ...game, image: await window.Lumin!.getImageUrl(game.image_token) }
        } catch {
          return game
        }
      }))
      setGames(withImages)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not reach the game catalog.'
      setNotice(message)
      const filtered = fallbackGames.filter((game) => game.name.toLowerCase().includes(search.toLowerCase()))
      setGames(filtered)
    } finally {
      setLoading(false)
    }
  }, [sdkReady, settings.gamesLimit])

  useEffect(() => {
    if (view !== 'games') return
    void fetchGames(query)
  }, [view]) // Search is submitted explicitly to avoid firing requests on every keystroke.

  useEffect(() => () => {
    if (window.Lumin) window.Lumin.destroy()
  }, [])

  useEffect(() => {
    if (view !== 'proxy') return
    if (proxyStarted.current) {
      if (proxyContainer.current && proxyFrame.current && !proxyContainer.current.contains(proxyFrame.current.element)) {
        proxyContainer.current.replaceChildren(proxyFrame.current.element)
      }
      return
    }
    let cancelled = false

    const initializeProxy = async () => {
      setProxyLoading(true)
      setProxyError('')
      try {
        if (!('serviceWorker' in navigator)) throw new Error('This browser does not support service workers.')
        const registration = await navigator.serviceWorker.register(scramjetServiceWorkerUrl, {
          scope: scramjetServiceWorkerScope,
          updateViaCache: 'none',
        })
        await registration.update()
        await waitForScramjetWorker(registration)
        await waitForScramjetController(registration)
        if (cancelled) return

        if (!window.$scramjet || !window.$scramjetController || !window.EpoxyTransport) {
          throw new Error('The Scramjet runtime is unavailable. Refresh the page and try again.')
        }

        const serviceWorker = navigator.serviceWorker.controller
        if (!serviceWorker) throw new Error('The Scramjet service worker is not controlling this page.')

        const { Controller } = window.$scramjetController!
        const transport = new window.EpoxyTransport!.default({ wisp: wispUrl })
        await transport.init()
        const controller = new Controller({
          serviceworker: serviceWorker,
          transport,
          scramjetConfig: {
            flags: {
              sourcemaps: false,
              debugSourceURL: false,
              debugTrampolines: false,
              captureErrors: false,
            },
          },
          config: {
            prefix: '/scramjet/',
            scramjetPath: '/scramjet-runtime.js',
            injectPath: '/controller/controller.inject.js',
            wasmPath: '/scramjet.wasm',
            virtualWasmPath: 'scramjet.wasm.js',
            codec: {
              encode: (url) => url ? encodeURIComponent(url) : url,
              decode: (url) => url ? decodeURIComponent(url) : url,
            },
          },
        })
        await controller.wait()
        if (cancelled || !proxyContainer.current) return

        const frame = controller.createFrame()
        frame.element.allow = 'autoplay; fullscreen; encrypted-media; gamepad; picture-in-picture'
        frame.element.className = 'proxy-frame'
        frame.element.title = 'Mex proxy browser'
        proxyContainer.current.replaceChildren(frame.element)
        proxyFrame.current = frame
        if (cancelled) return
        proxyStarted.current = true
        queueProxyNavigation(proxyTarget.current)
      } catch (error) {
        if (!cancelled) setProxyError(error instanceof Error ? error.message : 'Could not start the proxy.')
      } finally {
        if (!cancelled) setProxyLoading(false)
      }
    }

    void initializeProxy()
    return () => {
      cancelled = true
      if (proxyStageTimer.current !== undefined) {
        window.clearTimeout(proxyStageTimer.current)
        proxyStageTimer.current = undefined
      }
      setProxyStage('idle')
    }
  }, [view])

  const queueProxyNavigation = (target: string) => {
    const navigation = ++proxyNavigation.current
    if (proxyStageTimer.current !== undefined) window.clearTimeout(proxyStageTimer.current)
    setProxyStage('testing')
    proxyStageTimer.current = window.setTimeout(() => {
      if (navigation !== proxyNavigation.current) return
      setProxyStage('loading')
      proxyStageTimer.current = window.setTimeout(() => {
        if (navigation !== proxyNavigation.current) return
        proxyStageTimer.current = undefined
        setProxyStage('idle')
        proxyFrame.current?.go(target)
      }, 650)
    }, 650)
  }

  const navigateProxy = () => {
    try {
      const raw = proxyInput.trim()
      if (!raw) throw new Error('Enter a web address or search.')
      let href: string
      if (raw.includes('://')) {
        href = raw
      } else if (raw.includes(' ') || !raw.includes('.')) {
        href = searchEngines[settings.searchEngine].url + encodeURIComponent(raw)
      } else {
        href = `https://${raw}`
      }
      const target = new URL(href)
      if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Only HTTP and HTTPS destinations are supported.')
      setProxyInput(target.href)
      setProxyUrl(target.href)
      proxyTarget.current = target.href
      setProxyError('')
      queueProxyNavigation(target.href)
    } catch (error) {
      setProxyError(error instanceof Error ? error.message : 'Enter a valid web address.')
    }
  }

  const openProxy = () => setView('proxy')

  const openGames = () => setView('games')

  const sendChat = () => {
    const text = chatInput.trim()
    if (!text || !sessionToken) return
    setChatInput('')
    void sendMessage({
      token: sessionToken,
      text,
      ...(replyToId ? { replyTo: replyToId as Id<'messages'> } : {}),
    }).then(() => setReplyToId(null)).catch(() => {
      setChatMessages((messages) => [...messages, {
        _id: `local-${Date.now()}`,
        _creationTime: Date.now(),
        name: me?.username ?? 'Guest',
        text,
        reactions: [],
        reply: null,
      }])
    })
  }

  const saveEdit = () => {
    const text = editText.trim()
    if (!text || !editingId || !sessionToken) return
    void editChatMessage({ token: sessionToken, messageId: editingId as Id<'messages'>, text })
      .then(() => {
        setEditingId(null)
        setEditText('')
      })
      .catch(() => undefined)
  }

  const reactToMessage = (messageId: string, emoji: string) => {
    if (!sessionToken || !emoji) return
    void toggleChatReaction({ token: sessionToken, messageId: messageId as Id<'messages'>, emoji })
      .catch(() => undefined)
  }

  const removeMessage = (messageId: string) => {
    if (!sessionToken) return
    void deleteChatMessage({ token: sessionToken, messageId: messageId as Id<'messages'> })
      .catch(() => undefined)
  }

  const submitAuth = () => {
    setAuthError('')
    setAuthBusy(true)
    const action = authMode === 'signup' ? doSignup : doSignin
    void action({ username: authUser, password: authPass })
      .then(({ token }) => {
        try {
          localStorage.setItem('mex-session', token)
        } catch {
          /* storage unavailable */
        }
        setSessionToken(token)
        setAuthPass('')
      })
      .catch((error) => setAuthError(cleanConvexError(error)))
      .finally(() => setAuthBusy(false))
  }

  const signOut = () => {
    if (sessionToken) void doSignout({ token: sessionToken }).catch(() => undefined)
    try {
      localStorage.removeItem('mex-session')
    } catch {
      /* storage unavailable */
    }
    setSessionToken(null)
    setView('home')
  }

  const changePassword = () => {
    if (!sessionToken) return
    setPwMsg('')
    setPwOk(false)
    setPwBusy(true)
    void doChangePassword({ token: sessionToken, currentPassword: pwCurrent, newPassword: pwNew })
      .then(() => {
        setPwOk(true)
        setPwMsg('Password updated.')
        setPwCurrent('')
        setPwNew('')
      })
      .catch((error) => {
        setPwOk(false)
        setPwMsg(cleanConvexError(error))
      })
      .finally(() => setPwBusy(false))
  }

  const changeUsername = () => {
    if (!sessionToken || !nameInput.trim()) return
    setNameMsg('')
    setNameOk(false)
    setNameBusy(true)
    void doChangeUsername({ token: sessionToken, username: nameInput })
      .then(() => {
        setNameOk(true)
        setNameMsg('Username updated.')
        setNameInput('')
      })
      .catch((error) => {
        setNameOk(false)
        setNameMsg(cleanConvexError(error))
      })
      .finally(() => setNameBusy(false))
  }

  const deleteAccount = () => {
    if (!sessionToken) return
    if (!delArmed) {
      setDelArmed(true)
      setDelMsg('Click again to permanently delete your account, messages, and reactions.')
      return
    }
    setDelBusy(true)
    setDelMsg('')
    void doDeleteAccount({ token: sessionToken, password: delPass })
      .then(() => {
        try {
          localStorage.removeItem('mex-session')
        } catch {
          /* storage unavailable */
        }
        setSessionToken(null)
        setDelArmed(false)
        setDelPass('')
        setView('home')
      })
      .catch((error) => {
        setDelMsg(cleanConvexError(error))
        setDelArmed(false)
      })
      .finally(() => setDelBusy(false))
  }

  const saveWispUrl = () => {
    try {
      const value = wispInput.trim()
      if (value) localStorage.setItem('mex-wisp', value)
      else localStorage.removeItem('mex-wisp')
    } catch {
      /* storage unavailable */
    }
  }

  const resetSettings = () => {
    try {
      localStorage.removeItem('mex-settings')
    } catch {
      /* storage unavailable */
    }
    setSettings(defaultSettings)
  }

  const playGame = async (game: Game) => {
    if (!window.Lumin) return
    try {
      if (!sdkReady) {
        await window.Lumin.init({ headless: true })
        setSdkReady(true)
      }
      await window.Lumin.loadGame(game.id)
    } catch {
      setNotice(`Unable to open ${game.name} right now.`)
    }
  }

  if (!serverReady) {
    return (
      <main className="server-gate">
        <div className="server-gate-mark"><img src="/favicon.svg" alt="mex logo" className="saturn-logo" /></div>
        <div className="eyebrow"><span className="eyebrow-line" /> MEX / LINK</div>
        <h1>Connecting to server...</h1>
        <LoaderCircle size={22} className="spin" />
      </main>
    )
  }

  return (
    <main className={`app-shell${settings.grid ? '' : ' no-grid'}${settings.ambient ? '' : ' no-ambient'}`}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="site-header">
        <button className="brand" onClick={() => setView('home')} aria-label="Go to Mex home">
          <img src="/favicon.svg" alt="mex logo" className="saturn-logo" />
          <span>mex</span>
        </button>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={view === 'home' ? 'nav-link active' : 'nav-link'} onClick={() => setView('home')}>
            <House size={16} strokeWidth={1.8} />
            Home
          </button>
          <button className={view === 'games' ? 'nav-link active' : 'nav-link'} onClick={openGames}>
            <Gamepad2 size={16} strokeWidth={1.8} />
            Games
          </button>
          <button className={view === 'apps' ? 'nav-link active' : 'nav-link'} onClick={() => setView('apps')}>
            <LayoutGrid size={16} strokeWidth={1.8} />
            Apps
          </button>
          <button className={view === 'ai' ? 'nav-link active' : 'nav-link'} onClick={() => setView('ai')}>
            <Bot size={16} strokeWidth={1.8} />
            AI
          </button>
          <button className={view === 'music' ? 'nav-link active' : 'nav-link'} onClick={() => setView('music')}>
            <Music2 size={16} strokeWidth={1.8} />
            Music
          </button>
          <button className={view === 'movie' ? 'nav-link active' : 'nav-link'} onClick={() => setView('movie')}>
            <Film size={16} strokeWidth={1.8} />
            Movie
          </button>
          <button className={view === 'chat' ? 'nav-link active' : 'nav-link'} onClick={() => setView('chat')}>
            <MessageCircle size={16} strokeWidth={1.8} />
            Chat
          </button>
          <button className={view === 'proxy' ? 'nav-link active' : 'nav-link'} onClick={openProxy}>
            <Globe2 size={16} strokeWidth={1.8} />
            Proxy
          </button>
          <button className={view === 'settings' ? 'nav-link active' : 'nav-link'} onClick={() => setView('settings')}>
            <Settings size={16} strokeWidth={1.8} />
            Settings
          </button>
        </nav>
        {me ? (
          <div className="header-user">
            <div className="header-status"><span className="status-dot" />{me.username}</div>
            <button className="signout-btn" onClick={signOut}>Sign out</button>
          </div>
        ) : (
          <div className="header-status"><span className="status-dot" />Online space</div>
        )}
      </header>

      {view === 'home' ? (
        <section className="home-view">
          <div className="home-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> MEX / 001</div>
            <h1>A quiet place<br /><em>to play.</em></h1>
            <p className="hero-description">A curated orbit of little worlds, bright ideas,<br />and games worth getting lost in.</p>
            <button className="primary-action" onClick={openGames}>
              <span>Explore games</span>
              <ArrowUpRight size={18} strokeWidth={1.8} />
            </button>
          </div>
          <div className="orbit-stage" aria-hidden="true">
            <img src="/orbit.svg" alt="" className="orbit-art" />
            <div className="orbit-label label-top">PLAY / 24</div>
            <div className="orbit-label label-bottom">GOOD ENERGY ONLY</div>
          </div>
          <div className="home-foot">
            <span>SCROLL TO DISCOVER</span>
            <span className="foot-rule" />
            <span>EST. 2026</span>
          </div>
        </section>
      ) : view === 'games' ? (
        <section className={settings.showGameNumbers ? 'games-view' : 'games-view hide-numbers'}>
          <div className="games-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> MEX / 002</div>
              <h1>Find your<br /><em>next world.</em></h1>
            </div>
            <p>Fresh from the Lumin catalog.<br />Pick a portal and jump in.</p>
          </div>
          <div className="games-toolbar">
            <form className="search-box" onSubmit={(event) => { event.preventDefault(); void fetchGames(query) }}>
              <Search size={17} strokeWidth={1.7} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search games" aria-label="Search games" />
              <button type="submit" aria-label="Submit game search"><ArrowUpRight size={16} /></button>
            </form>
          </div>
          {notice && <div className="catalog-notice"><Sparkles size={14} /> {notice} Showing available featured worlds.</div>}
          <div className="catalog-meta"><span>{loading ? 'Syncing catalog' : `${games.length || 0} worlds available`}</span><span className="meta-line" /><span>01 / 04</span></div>
          {loading ? (
            <div className="loading-state"><LoaderCircle size={24} className="spin" /> Connecting to the game orbit...</div>
          ) : (
            <div className="game-grid">
              {games.map((game, index) => (
                <article className="game-card" key={game.id}>
                  <div className="game-image-wrap">
                    {game.image ? <img src={game.image} alt="" className="game-image" /> : <div className={`image-placeholder placeholder-${index % 4}`}><Gamepad2 size={38} /></div>}
                    <button className="play-button" onClick={() => void playGame(game)} aria-label={`Play ${game.name}`}><Play size={17} fill="currentColor" /></button>
                    <span className="game-number">0{index + 1}</span>
                  </div>
                  <div className="game-info"><h2>{game.name}</h2><ArrowUpRight size={17} /></div>
                </article>
              ))}
            </div>
          )}
          {!loading && !games.length && <div className="empty-state">No worlds found. Try a different signal.</div>}
        </section>
      ) : view === 'ai' ? (
        <section className="movie-view">
          <div className="movie-window">
            <iframe className="movie-frame" src={aiEmbedUrl} title="Duck.ai" allow="autoplay; fullscreen; encrypted-media" />
          </div>
        </section>
      ) : view === 'music' ? (
        <section className="movie-view">
          <div className="movie-window">
            <iframe className="movie-frame" src={musicEmbedUrl} title="ListenFree music" allow="autoplay; fullscreen; encrypted-media" />
          </div>
        </section>
      ) : view === 'movie' ? (
        <section className="movie-view">
          <div className="movie-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> MEX / 003</div>
              <h1>Settle in<br /><em>for a movie.</em></h1>
            </div>
            <div className="movie-badge"><Film size={15} /> CinemaOS</div>
          </div>
          <div className="movie-window">
            <iframe className="movie-frame" src={movieEmbedUrl} title="CinemaOS movies" allow="autoplay; fullscreen; encrypted-media" />
          </div>
        </section>
      ) : view === 'chat' ? (
        <section className={`chat-view${settings.showTimestamps ? '' : ' hide-times'}${settings.showNames ? '' : ' hide-names'}${settings.compactChat ? ' compact-chat' : ''}`}>
          <div className="chat-layout">
            {!sessionToken || me === null ? (
              <div className="chat-auth">
                <div className="eyebrow"><span className="eyebrow-line" /> MEX / CHAT</div>
                <div className="auth-card chat-auth-card">
                  <div className="auth-tabs">
                    <button className={authMode === 'signin' ? 'auth-tab active' : 'auth-tab'} onClick={() => { setAuthMode('signin'); setAuthError('') }}>Sign in</button>
                    <button className={authMode === 'signup' ? 'auth-tab active' : 'auth-tab'} onClick={() => { setAuthMode('signup'); setAuthError('') }}>Sign up</button>
                  </div>
                  <form onSubmit={(event) => { event.preventDefault(); submitAuth() }}>
                    <input value={authUser} onChange={(event) => setAuthUser(event.target.value)} placeholder="Username" aria-label="Username" autoComplete="username" spellCheck={false} />
                    <input type="password" value={authPass} onChange={(event) => setAuthPass(event.target.value)} placeholder="Password" aria-label="Password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} />
                    {authError && <div className="auth-error">{authError}</div>}
                    <button className="primary-action auth-submit" type="submit" disabled={authBusy}>
                      <span>{authBusy ? 'One sec...' : authMode === 'signup' ? 'Create account' : 'Sign in'}</span>
                      <ArrowUpRight size={18} strokeWidth={1.8} />
                    </button>
                  </form>
                  <p className="auth-hint">Sign in to join global chat. No email, no verification.</p>
                </div>
              </div>
            ) : (
            <div className="chat-thread">
              <div className="chat-thread-head">
                <span className="chat-avatar">G</span>
                <div className="chat-title"><strong>Global chat</strong><span><span className="status-dot" /> live via Convex</span></div>
              </div>
              <div className="chat-messages" ref={chatMessagesRef}>
                {liveMessages === undefined && (
                  <div className="loading-state"><LoaderCircle size={24} className="spin" /> Connecting to chat...</div>
                )}
                {liveMessages !== undefined && visibleMessages.map((message) => {
                  const mine = message.name === (me?.username ?? 'Guest')
                  return (
                    <div key={message._id} className={mine ? 'chat-row me' : 'chat-row them'}>
                      <div className="chat-msg-col">
                        {message.deleted ? (
                          <div className="chat-bubble deleted"><em>Message deleted</em></div>
                        ) : editingId === message._id ? (
                          <div className="edit-box">
                            <input
                              value={editText}
                              onChange={(event) => setEditText(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') saveEdit()
                                if (event.key === 'Escape') { setEditingId(null); setEditText('') }
                              }}
                              aria-label="Edit message"
                              autoFocus
                            />
                            <button onClick={saveEdit}>Save</button>
                            <button onClick={() => { setEditingId(null); setEditText('') }}>Cancel</button>
                          </div>
                        ) : (
                          <>
                            <div className={mine ? 'chat-bubble me' : 'chat-bubble them'}>
                              {!mine && <span className="chat-name">{message.name}</span>}
                              {message.reply && (
                                <span className="chat-quote">
                                  {message.reply.deleted
                                    ? 'Original message deleted'
                                    : (<><strong>{message.reply.name}</strong>{message.reply.text}</>)}
                                </span>
                              )}
                              <p>{message.text}</p>
                              <span className="chat-time">
                                {new Date(message._creationTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {message.editedAt ? ' · edited' : ''}
                              </span>
                            </div>
                            {message.reactions.length > 0 && (
                              <div className="reaction-row">
                                {message.reactions.map((reaction) => (
                                  <button
                                    key={reaction.emoji}
                                    className={reaction.mine ? 'reaction-chip mine' : 'reaction-chip'}
                                    onClick={() => reactToMessage(message._id, reaction.emoji)}
                                    aria-label={`React ${reaction.emoji}`}
                                  >
                                    {reaction.emoji} {reaction.count}
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      {!message.deleted && editingId !== message._id && (
                        <div className="msg-actions">
                          <button
                            onClick={() => setPickerFor(pickerFor === message._id ? null : message._id)}
                            aria-label="Add reaction"
                          >
                            <Smile size={14} />
                          </button>
                          <button
                            onClick={() => { setReplyToId(message._id); setPickerFor(null) }}
                            aria-label="Reply"
                          >
                            <Reply size={14} />
                          </button>
                          {mine && (
                            <button
                              onClick={() => { setEditingId(message._id); setEditText(message.text); setPickerFor(null) }}
                              aria-label="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          {mine && (
                            <button
                              className="danger"
                              onClick={() => removeMessage(message._id)}
                              aria-label="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )}
                      {pickerFor === message._id && (
                        <>
                          <div className="emoji-backdrop" onClick={() => setPickerFor(null)} />
                          <div className="emoji-pop">
                            <EmojiPicker onSelect={(emoji) => { reactToMessage(message._id, emoji); setPickerFor(null) }} />
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
                {liveMessages !== undefined && !visibleMessages.length && <div className="empty-state">No messages yet. Say hi.</div>}
              </div>
              {replyTarget && (
                <div className="reply-banner">
                  <span>Replying to <strong>{replyTarget.name}</strong>: {replyTarget.deleted ? 'deleted message' : replyTarget.text}</span>
                  <button onClick={() => setReplyToId(null)} aria-label="Cancel reply"><X size={14} /></button>
                </div>
              )}
              <form className="chat-input" onSubmit={(event) => { event.preventDefault(); sendChat() }}>
                <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Message global chat" aria-label="Type a message" />
                <button type="submit" aria-label="Send message"><Send size={15} /></button>
              </form>
            </div>
            )}
          </div>
        </section>
      ) : view === 'apps' ? (
        activeApp ? (
          <section className="movie-view app-player">
            <div className="app-player-bar">
              <button onClick={() => setActiveApp(null)} aria-label="Back to apps">
                <ArrowLeft size={16} />
                <span>{activeApp.name}</span>
              </button>
            </div>
            <div className="movie-window">
              <iframe
                key={activeApp.id}
                className="movie-frame"
                src={`/embed.html?url=${encodeURIComponent(activeApp.url)}`}
                title={activeApp.name}
                allow="autoplay; fullscreen; encrypted-media"
                allowFullScreen
              />
            </div>
          </section>
        ) : (
          <section className="games-view">
            <div className="games-heading">
              <div>
                <div className="eyebrow"><span className="eyebrow-line" /> MEX / 005</div>
                <h1>Every app,<br /><em>one orbit.</em></h1>
              </div>
              <p>Your favorite apps.<br />Pick one and jump in.</p>
            </div>
            <div className="catalog-meta"><span>{apps.length} apps available</span><span className="meta-line" /><span>01 / 02</span></div>
            <div className="game-grid">
              {apps.map((app, index) => (
                <article className="game-card" key={app.id}>
                  <div className="game-image-wrap">
                    {app.icon ? <img src={app.icon} alt="" className="game-image" /> : <div className={`image-placeholder placeholder-${index % 4}`}><Gamepad2 size={38} /></div>}
                    <button className="play-button" onClick={() => setActiveApp(app)} aria-label={`Open ${app.name}`}><ArrowUpRight size={17} /></button>
                    <span className="game-number">0{index + 1}</span>
                  </div>
                  <div className="game-info"><h2>{app.name}</h2><ArrowUpRight size={17} /></div>
                </article>
              ))}
            </div>
          </section>
        )
      ) : view === 'settings' ? (
        <section className="settings-view">
          <div className="games-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> MEX / 006</div>
              <h1>Tune<br /><em>your space.</em></h1>
            </div>
            <p>Saved on this device.<br />Account lives in the cloud.</p>
          </div>
          <div className="settings-grid">
            <div className="settings-card">
              <h2>Account</h2>
              {me ? (
                <>
                  <div className="setting-row"><span>Signed in as</span><strong>{me.username}</strong></div>
                  <div className="setting-row column">
                    <span>Change password</span>
                    <input
                      type="password"
                      value={pwCurrent}
                      onChange={(event) => setPwCurrent(event.target.value)}
                      placeholder="Current password"
                      aria-label="Current password"
                      autoComplete="current-password"
                    />
                    <input
                      type="password"
                      value={pwNew}
                      onChange={(event) => setPwNew(event.target.value)}
                      placeholder="New password"
                      aria-label="New password"
                      autoComplete="new-password"
                    />
                    {pwMsg && <div className={pwOk ? 'settings-ok' : 'auth-error'}>{pwMsg}</div>}
                    <button className="settings-btn" onClick={changePassword} disabled={pwBusy}>
                      {pwBusy ? 'Saving...' : 'Save password'}
                    </button>
                  </div>
                  <div className="setting-row"><span>Session</span><button className="signout-btn" onClick={signOut}>Sign out</button></div>
                  <div className="setting-row column">
                    <span>Change username</span>
                    <input
                      value={nameInput}
                      onChange={(event) => setNameInput(event.target.value)}
                      placeholder="New username"
                      aria-label="New username"
                      spellCheck={false}
                    />
                    {nameMsg && <div className={nameOk ? 'settings-ok' : 'auth-error'}>{nameMsg}</div>}
                    <button className="settings-btn" onClick={changeUsername} disabled={nameBusy}>
                      {nameBusy ? 'Saving...' : 'Save username'}
                    </button>
                  </div>
                  <div className="setting-row column danger-zone">
                    <span>Danger zone</span>
                    <input
                      type="password"
                      value={delPass}
                      onChange={(event) => setDelPass(event.target.value)}
                      placeholder="Password to confirm"
                      aria-label="Password to confirm delete"
                      autoComplete="current-password"
                    />
                    {delMsg && <div className="auth-error">{delMsg}</div>}
                    <button className="danger-btn" onClick={deleteAccount} disabled={delBusy}>
                      {delBusy ? 'Deleting...' : delArmed ? 'Click again to confirm delete' : 'Delete account'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="settings-note">You&apos;re browsing as a guest. Sign in to chat and sync.</p>
                  <button className="settings-btn" onClick={() => setView('chat')}>Go to Chat to sign in</button>
                </>
              )}
            </div>
            <div className="settings-card">
              <h2>Appearance</h2>
              <div className="setting-row">
                <span>Accent</span>
                <span className="accent-dots">
                  {(Object.keys(accentHex) as Accent[]).map((accent) => (
                    <button
                      key={accent}
                      className={settings.accent === accent ? 'accent-dot active' : 'accent-dot'}
                      style={{ background: accentHex[accent] }}
                      onClick={() => updateSettings({ accent })}
                      aria-label={`${accent} accent`}
                    />
                  ))}
                </span>
              </div>
              <ToggleRow label="Background grid" value={settings.grid} onChange={(value) => updateSettings({ grid: value })} />
              <div className="setting-row">
                <span>Theme</span>
                <select value={settings.theme} onChange={(event) => updateSettings({ theme: event.target.value as ThemeChoice })} aria-label="Theme">
                  <option value="green">Green dark</option>
                  <option value="pitch">Pitch black</option>
                </select>
              </div>
              <div className="setting-row">
                <span>Font</span>
                <select value={settings.font} onChange={(event) => updateSettings({ font: event.target.value as FontChoice })} aria-label="Font">
                  <option value="manrope">Manrope</option>
                  <option value="system">System</option>
                  <option value="mono">Mono</option>
                </select>
              </div>
              <div className="setting-row">
                <span>Density</span>
                <select value={settings.density} onChange={(event) => updateSettings({ density: event.target.value as Density })} aria-label="Density">
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </div>
              <ToggleRow label="Ambient orbs" value={settings.ambient} onChange={(value) => updateSettings({ ambient: value })} />
              <ToggleRow label="Custom cursor" value={settings.customCursor} onChange={(value) => updateSettings({ customCursor: value })} />
              <ToggleRow label="Reduce motion" value={settings.reduceMotion} onChange={(value) => updateSettings({ reduceMotion: value })} />
            </div>
            <div className="settings-card">
              <h2>Chat</h2>
              <ToggleRow label="Message timestamps" value={settings.showTimestamps} onChange={(value) => updateSettings({ showTimestamps: value })} />
              <ToggleRow label="Sender names" value={settings.showNames} onChange={(value) => updateSettings({ showNames: value })} />
              <ToggleRow label="Compact bubbles" value={settings.compactChat} onChange={(value) => updateSettings({ compactChat: value })} />
              <ToggleRow label="Message sound" value={settings.messageSound} onChange={(value) => updateSettings({ messageSound: value })} />
              <ToggleRow label="Auto-scroll" value={settings.autoScroll} onChange={(value) => updateSettings({ autoScroll: value })} />
            </div>
            <div className="settings-card">
              <h2>Games</h2>
              <ToggleRow label="Card numbers" value={settings.showGameNumbers} onChange={(value) => updateSettings({ showGameNumbers: value })} />
              <div className="setting-row">
                <span>Games per page</span>
                <select
                  value={settings.gamesLimit}
                  onChange={(event) => {
                    const gamesLimit = Number(event.target.value)
                    updateSettings({ gamesLimit })
                    if (viewRef.current === 'games') void fetchGames(query)
                  }}
                  aria-label="Games per page"
                >
                  {[12, 20, 30, 48].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="settings-card">
              <h2>Proxy</h2>
              <div className="setting-row column">
                <span>Homepage</span>
                <input
                  value={settings.homepage}
                  onChange={(event) => {
                    const homepage = event.target.value
                    updateSettings({ homepage })
                    if (!proxyStarted.current) {
                      proxyTarget.current = homepage
                      setProxyInput(homepage)
                      setProxyUrl(homepage)
                    }
                  }}
                  placeholder="https://example.com"
                  aria-label="Proxy homepage"
                  spellCheck={false}
                />
              </div>
              <div className="setting-row">
                <span>Search engine</span>
                <select value={settings.searchEngine} onChange={(event) => updateSettings({ searchEngine: event.target.value as SearchEngine })} aria-label="Search engine">
                  {(Object.keys(searchEngines) as SearchEngine[]).map((engine) => (
                    <option key={engine} value={engine}>{searchEngines[engine].label}</option>
                  ))}
                </select>
              </div>
              <div className="setting-row column">
                <span>Custom Wisp server</span>
                <input
                  value={wispInput}
                  onChange={(event) => setWispInput(event.target.value)}
                  placeholder="wss://…/wisp/"
                  aria-label="Custom Wisp server"
                  spellCheck={false}
                />
                <button className="settings-btn" onClick={saveWispUrl}>Save (refresh to apply)</button>
              </div>
            </div>
            <div className="settings-card">
              <h2>General</h2>
              <p className="settings-note">Wipe every local preference on this device back to defaults. Your account is untouched.</p>
              <button className="settings-btn" onClick={resetSettings}>Reset all settings</button>
            </div>
          </div>
        </section>
      ) : (
        <section className="proxy-view">
          <div className="proxy-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> MEX / 003</div>
              <h1>Open the<br /><em>wide web.</em></h1>
            </div>
            <div className="proxy-badge"><ShieldCheck size={15} /> Scramjet secure session</div>
          </div>
          <div className="browser-window">
            <div className="browser-toolbar">
              <div className="browser-controls">
                <button onClick={() => proxyFrame.current?.back()} aria-label="Go back"><ArrowLeft size={16} /></button>
                <button onClick={() => proxyFrame.current?.forward()} aria-label="Go forward"><ArrowRight size={16} /></button>
                <button onClick={() => proxyFrame.current?.reload()} aria-label="Reload page"><RotateCw size={15} /></button>
              </div>
              <form className="address-bar" onSubmit={(event) => { event.preventDefault(); navigateProxy() }}>
                <Globe2 size={14} />
                <input value={proxyInput} onChange={(event) => setProxyInput(event.target.value)} aria-label="Web address" spellCheck={false} />
                <button type="submit" aria-label="Open web address"><ArrowUpRight size={15} /></button>
              </form>
              <span className="browser-lock"><ShieldCheck size={14} /></span>
            </div>
            <div className="proxy-stage">
              <div className="proxy-frame-host" ref={proxyContainer} />
              {proxyStage !== 'idle' ? (
                <div className="proxy-status"><LoaderCircle size={22} className="spin" /> {proxyStage === 'testing' ? 'Testing server...' : 'Loading Site...'}</div>
              ) : proxyLoading ? (
                <div className="proxy-status"><LoaderCircle size={22} className="spin" /> Starting secure browser...</div>
              ) : null}
              {proxyError && <div className="proxy-status proxy-error"><Globe2 size={20} /><span>{proxyError}<small>Check that the Scramjet assets loaded and the Wisp service is online.</small></span></div>}
            </div>
            <div className="browser-footer"><span>SCRAMJET / EPOXY TLS</span><span className="meta-line" /><span>{proxyUrl.replace(/^https?:\/\//, '')}</span></div>
          </div>
        </section>
      )}
    </main>
  )
}

export default App
