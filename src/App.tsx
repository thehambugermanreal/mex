'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, Gamepad2, Globe2, House, LoaderCircle, Play, RotateCw, Search, ShieldCheck, Sparkles } from 'lucide-react'

type View = 'home' | 'games' | 'proxy'

type ScramjetFrame = {
  frame: HTMLIFrameElement
  go: (url: string) => void
  back: () => void
  forward: () => void
  reload: () => void
}

type ScramjetController = {
  init: () => Promise<void>
  createFrame: (element?: HTMLIFrameElement) => ScramjetFrame
}

type ScramjetControllerFactory = {
  ScramjetController: new (config: {
    wisp: string
    prefix: string
    files: { wasm: string; all: string; sync: string }
    flags: { captureErrors: boolean; strictRewrites: boolean }
  }) => ScramjetController
}
type Game = {
  id: string
  name: string
  category?: string
  image_token?: string
  image?: string
}

type GamesResponse = {
  games: Game[]
  total: number
  page: number
  pages: number
}

type LuminApi = {
  init: (config: { headless: boolean }) => Promise<void>
  getGames: (options: { page: number; limit: number; q?: string }) => Promise<GamesResponse>
  getCategories: () => Promise<{ categories: string[] }>
  getImageUrl: (token: string) => Promise<string>
  loadGame: (id: string) => Promise<void>
  destroy: () => void
}

declare global {
  interface Window {
    Lumin?: LuminApi
    $scramjetLoadController?: () => ScramjetControllerFactory
  }
}

const fallbackGames: Game[] = [
  { id: 'neon-drift', name: 'Neon Drift', category: 'Arcade', image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=900&q=80' },
  { id: 'orbit-runner', name: 'Orbit Runner', category: 'Action', image: 'https://images.unsplash.com/photo-1614728263952-84ea256f9679?auto=format&fit=crop&w=900&q=80' },
  { id: 'pixel-garden', name: 'Pixel Garden', category: 'Puzzle', image: 'https://images.unsplash.com/photo-1614294148960-9aa740632a87?auto=format&fit=crop&w=900&q=80' },
  { id: 'cosmic-cards', name: 'Cosmic Cards', category: 'Strategy', image: 'https://images.unsplash.com/photo-1605870445919-838d190e8e1b?auto=format&fit=crop&w=900&q=80' },
]

const defaultCategories = ['All games', 'Arcade', 'Action', 'Puzzle', 'Racing', 'Strategy']

function SaturnLogo() {
  return (
    <svg className="saturn-logo" viewBox="0 0 64 64" aria-label="Mex Saturn logo" role="img">
      <defs>
        <linearGradient id="saturnGreen" x1="10" x2="54" y1="8" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d3ff8f" />
          <stop offset="0.45" stopColor="#71e35d" />
          <stop offset="1" stopColor="#19a85d" />
        </linearGradient>
        <filter id="saturnGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <ellipse cx="32" cy="34" rx="25" ry="8.5" fill="none" stroke="#65dd68" strokeWidth="4" transform="rotate(-18 32 34)" opacity=".65" />
      <circle cx="32" cy="29" r="15" fill="url(#saturnGreen)" filter="url(#saturnGlow)" />
      <ellipse cx="32" cy="34" rx="26" ry="8.5" fill="none" stroke="#a5f77a" strokeWidth="3.5" transform="rotate(-18 32 34)" />
      <path d="M17 32c3.6-3 8.7-4.7 15-4.7 6.2 0 11.3 1.7 15 4.7" fill="none" stroke="#0f7d4d" strokeWidth="2" opacity=".55" />
    </svg>
  )
}

function App() {
  const [view, setView] = useState<View>('home')
  const [games, setGames] = useState<Game[]>([])
  const [categories, setCategories] = useState<string[]>(defaultCategories)
  const [activeCategory, setActiveCategory] = useState('All games')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [sdkReady, setSdkReady] = useState(false)
  const [notice, setNotice] = useState('')
  const [proxyInput, setProxyInput] = useState('https://example.com')
  const [proxyUrl, setProxyUrl] = useState('https://example.com')
  const [proxyLoading, setProxyLoading] = useState(false)
  const [proxyError, setProxyError] = useState('')
  const proxyContainer = useRef<HTMLDivElement>(null)
  const proxyFrame = useRef<ScramjetFrame | null>(null)
  const proxyStarted = useRef(false)

  const fetchGames = useCallback(async (search = '') => {
    setLoading(true)
    setNotice('')
    try {
      if (!window.Lumin) throw new Error('The game catalog is still loading.')
      if (!sdkReady) {
        await window.Lumin.init({ headless: true })
        setSdkReady(true)
      }
      const result = await window.Lumin.getGames({ page: 1, limit: 20, q: search })
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
  }, [sdkReady])

  useEffect(() => {
    if (view !== 'games') return
    void fetchGames(query)
  }, [view]) // Search is submitted explicitly to avoid firing requests on every keystroke.

  useEffect(() => () => {
    if (window.Lumin) window.Lumin.destroy()
  }, [])

  useEffect(() => {
    if (view !== 'games' || !window.Lumin || !sdkReady) return
    window.Lumin.getCategories().then(({ categories: fetched }) => {
      if (fetched.length) setCategories(['All games', ...fetched])
    }).catch(() => undefined)
  }, [view, sdkReady])

  useEffect(() => {
    if (view !== 'proxy') return
    if (proxyStarted.current) {
      if (proxyContainer.current && proxyFrame.current && !proxyContainer.current.contains(proxyFrame.current.frame)) {
        proxyContainer.current.replaceChildren(proxyFrame.current.frame)
      }
      return
    }
    let cancelled = false

    const initializeProxy = async () => {
      setProxyLoading(true)
      setProxyError('')
      try {
        if (!window.$scramjetLoadController) throw new Error('Scramjet runtime is unavailable.')
        if (!('serviceWorker' in navigator)) throw new Error('This browser does not support service workers.')

        await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        await navigator.serviceWorker.ready
        if (cancelled) return

        const { ScramjetController } = window.$scramjetLoadController()
        const controller = new ScramjetController({
          wisp: process.env.NEXT_PUBLIC_WISP_URL || '/wisp/',
          prefix: '/scramjet/',
          files: {
            wasm: '/scramjet/scramjet.wasm.wasm',
            all: '/scramjet/scramjet.all.js',
            sync: '/scramjet/scramjet.sync.js',
          },
          flags: { captureErrors: true, strictRewrites: true },
        })
        await controller.init()
        if (cancelled || !proxyContainer.current) return

        const frame = controller.createFrame()
        frame.frame.className = 'proxy-frame'
        frame.frame.title = 'Mex proxy browser'
        proxyContainer.current.replaceChildren(frame.frame)
        proxyFrame.current = frame
        proxyStarted.current = true
        frame.go(proxyUrl)
      } catch (error) {
        if (!cancelled) setProxyError(error instanceof Error ? error.message : 'Could not start the proxy.')
      } finally {
        if (!cancelled) setProxyLoading(false)
      }
    }

    void initializeProxy()
    return () => { cancelled = true }
  }, [view])

  const navigateProxy = () => {
    try {
      const target = new URL(proxyInput.includes('://') ? proxyInput : `https://${proxyInput}`)
      if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Only HTTP and HTTPS destinations are supported.')
      setProxyInput(target.href)
      setProxyUrl(target.href)
      proxyFrame.current?.go(target.href)
    } catch (error) {
      setProxyError(error instanceof Error ? error.message : 'Enter a valid web address.')
    }
  }

  const openProxy = () => setView('proxy')

  const visibleGames = useMemo(() => activeCategory === 'All games'
    ? games
    : games.filter((game) => game.category?.toLowerCase() === activeCategory.toLowerCase()), [activeCategory, games])

  const openGames = () => setView('games')

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

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="site-header">
        <button className="brand" onClick={() => setView('home')} aria-label="Go to Mex home">
          <SaturnLogo />
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
          <button className={view === 'proxy' ? 'nav-link active' : 'nav-link'} onClick={openProxy}>
            <Globe2 size={16} strokeWidth={1.8} />
            Proxy
          </button>
        </nav>
        <div className="header-status"><span className="status-dot" />Online space</div>
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
            <div className="orbit orbit-large" />
            <div className="orbit orbit-small" />
            <div className="planet"><span /></div>
            <div className="orbit-label label-top">PLAY / 24</div>
            <div className="orbit-label label-bottom">GOOD ENERGY ONLY</div>
          </div>
          <div className="home-foot">
            <span>SCROLL TO DISCOVER</span>
            <span className="foot-rule" />
            <span>EST. 2024</span>
          </div>
        </section>
      ) : view === 'games' ? (
        <section className="games-view">
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
            <div className="category-list" role="tablist" aria-label="Game categories">
              {categories.slice(0, 7).map((category) => (
                <button key={category} className={activeCategory === category ? 'category active' : 'category'} onClick={() => setActiveCategory(category)} role="tab" aria-selected={activeCategory === category}>{category}</button>
              ))}
            </div>
          </div>
          {notice && <div className="catalog-notice"><Sparkles size={14} /> {notice} Showing available featured worlds.</div>}
          <div className="catalog-meta"><span>{loading ? 'Syncing catalog' : `${visibleGames.length || 0} worlds available`}</span><span className="meta-line" /><span>01 / 04</span></div>
          {loading ? (
            <div className="loading-state"><LoaderCircle size={24} className="spin" /> Connecting to the game orbit...</div>
          ) : (
            <div className="game-grid">
              {visibleGames.map((game, index) => (
                <article className="game-card" key={game.id}>
                  <div className="game-image-wrap">
                    {game.image ? <img src={game.image} alt="" className="game-image" /> : <div className={`image-placeholder placeholder-${index % 4}`}><Gamepad2 size={38} /></div>}
                    <button className="play-button" onClick={() => void playGame(game)} aria-label={`Play ${game.name}`}><Play size={17} fill="currentColor" /></button>
                    <span className="game-number">0{index + 1}</span>
                  </div>
                  <div className="game-info"><div><h2>{game.name}</h2><span>{game.category || 'Featured'}</span></div><ArrowUpRight size={17} /></div>
                </article>
              ))}
            </div>
          )}
          {!loading && !visibleGames.length && <div className="empty-state">No worlds found. Try a different signal.</div>}
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
            <div className="proxy-stage" ref={proxyContainer}>
              {proxyLoading && <div className="proxy-status"><LoaderCircle size={22} className="spin" /> Starting secure browser...</div>}
              {proxyError && <div className="proxy-status proxy-error"><Globe2 size={20} /><span>{proxyError}<small>Set <code>NEXT_PUBLIC_WISP_URL</code> to your Render Wisp service URL.</small></span></div>}
            </div>
            <div className="browser-footer"><span>SCRAMJET / EPOXY TLS</span><span className="meta-line" /><span>{proxyUrl.replace(/^https?:\/\//, '')}</span></div>
          </div>
        </section>
      )}
    </main>
  )
}

export default App
