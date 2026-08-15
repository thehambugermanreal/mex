import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const WISP_URL = 'wss://mex-wisp.onrender.com/';
const suggestions = [
  { label: 'Example', url: 'https://example.com', note: 'A calm place to start' },
  { label: 'Wikipedia', url: 'https://www.wikipedia.org', note: 'Explore something new' },
  { label: 'MDN Web Docs', url: 'https://developer.mozilla.org', note: 'Learn the web' },
];

function LogoMark({ small = false }) {
  return (
    <span className={`logo-mark ${small ? 'logo-mark-small' : ''}`} aria-hidden="true">
      <span className="logo-orb" />
      <span className="logo-ring logo-ring-one" />
      <span className="logo-ring logo-ring-two" />
    </span>
  );
}

function Icon({ name }) {
  const paths = {
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    shield: <><path d="M12 3 5 6v5c0 4.4 2.9 8.2 7 9 4.1-.8 7-4.6 7-9V6l-7-3Z" /><path d="m9.5 12 1.7 1.7 3.5-3.7" /></>,
    back: <path d="m15 18-6-6 6-6" />,
    forward: <path d="m9 18 6-6-6-6" />,
    refresh: <><path d="M20 11a8.1 8.1 0 0 0-14.8-3L3 11" /><path d="M3 5v6h6" /><path d="M4 13a8.1 8.1 0 0 0 14.8 3L21 13" /><path d="M21 19v-6h-6" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    bookmark: <path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4V4Z" />,
    menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
  };
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function normalizeUrl(value) {
  const input = value.trim();
  if (!input) return null;
  if (/^(https?|http):\/\//i.test(input)) return input;
  return `https://${input}`;
}

function getWispUrl() {
  return WISP_URL;
}

function App() {
  const [address, setAddress] = useState('');
  const [frameUrl, setFrameUrl] = useState(null);
  const [proxyState, setProxyState] = useState('starting');
  const [proxyError, setProxyError] = useState('');
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mex-history') || '[]'); } catch { return []; }
  });

  const hasBrowser = Boolean(frameUrl);
  const statusLabel = proxyState === 'ready' ? 'Gateway ready' : proxyState === 'error' ? 'Gateway offline' : 'Starting gateway';

  useEffect(() => {
    let active = true;
    async function prepareProxy() {
      if (!('serviceWorker' in navigator)) {
        setProxyState('error');
        setProxyError('This browser does not support service workers.');
        return;
      }
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/service/' });
        const BareMuxConnection = window.BareMuxConnection;
        if (!BareMuxConnection) throw new Error('BareMux failed to load.');
        const connection = new BareMuxConnection('/baremux/worker.js');
        await connection.setTransport('/epoxy/index.mjs', [{ wisp: getWispUrl() }]);
        await navigator.serviceWorker.ready;
        if (active) setProxyState('ready');
      } catch (error) {
        console.error('Proxy setup failed', error);
        if (active) {
          setProxyState('error');
          setProxyError('The transport could not connect. Check the Wisp service URL.');
        }
      }
    }
    prepareProxy();
    return () => { active = false; };
  }, []);

  function openUrl(value) {
    const normalized = normalizeUrl(value);
    if (!normalized) return;
    if (proxyState !== 'ready') {
      setProxyError('The gateway is still starting. Try again in a moment.');
      return;
    }
    const encoded = window.__uv$config.encodeUrl(normalized);
    setAddress(normalized);
    setFrameUrl(`${window.__uv$config.prefix}${encoded}`);
    const nextHistory = [normalized, ...history.filter((item) => item !== normalized)].slice(0, 4);
    setHistory(nextHistory);
    localStorage.setItem('mex-history', JSON.stringify(nextHistory));
  }

  function handleSubmit(event) {
    event.preventDefault();
    openUrl(address);
  }

  function goHome() {
    setFrameUrl(null);
    setAddress('');
    setProxyError('');
  }

  return (
    <main className={`app ${hasBrowser ? 'app-browsing' : ''}`}>
      {proxyState === 'starting' && (
        <div className="activation-screen" role="status" aria-live="polite">
          <div className="activation-card">
            <div className="activation-logo"><LogoMark /></div>
            <div className="activation-spinner" />
            <p className="activation-title">Activating mex</p>
            <p className="activation-copy">Warming the gateway<span className="loading-dots">...</span></p>
          </div>
        </div>
      )}

      <div className="browser-window">
        <header className="tabs-bar">
          <button className="tab active-tab" onClick={goHome} aria-label="Return to mex new tab">
            <span className="tab-glyph"><LogoMark small /></span><span>New Tab</span><span className="tab-close">×</span>
          </button>
          <button className="new-tab-button" aria-label="Open a new tab">+</button>
        </header>
        <div className="browser-toolbar">
          <div className="browser-controls">
            <button onClick={() => window.history.back()} aria-label="Back"><Icon name="back" /></button>
            <button onClick={() => window.history.forward()} aria-label="Forward"><Icon name="forward" /></button>
            <button onClick={() => document.querySelector('.proxy-frame')?.contentWindow.location.reload()} aria-label="Reload"><Icon name="refresh" /></button>
            <button onClick={goHome} aria-label="Home"><Icon name="home" /></button>
          </div>
          <form className="address-bar" onSubmit={handleSubmit}>
            <span className="address-lock"><Icon name="lock" /></span>
            <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="mex://new" aria-label="Current web address" autoComplete="url" />
            <button className="address-action" type="submit" aria-label="Bookmark page"><Icon name="bookmark" /></button>
          </form>
          <button className="menu-button" aria-label="Browser menu"><Icon name="menu" /></button>
        </div>

        {!hasBrowser ? (
          <section className="home-page">
            <div className="home-content">
              <div className="eyebrow"><span className="eyebrow-line" /> A softer way to wander</div>
              <h1>Browse with a little<br /><span>more breathing room.</span></h1>
              <p className="home-copy">A quiet, private-feeling web gateway with a glassy interface. Put a destination in the bar and let the rest fade away.</p>
              <form className="search-card" onSubmit={handleSubmit}>
                <div className="search-icon"><Icon name="shield" /></div>
                <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Enter a web address..." aria-label="Web address" autoComplete="url" />
                <button className="go-button" type="submit"><span>Go there</span><Icon name="arrow" /></button>
              </form>
              {proxyError && <p className="error-text">{proxyError}</p>}
              <div className="suggestion-row">
                {suggestions.map((suggestion) => <button className="suggestion" key={suggestion.url} onClick={() => openUrl(suggestion.url)}><span className="suggestion-label">{suggestion.label}</span><span>{suggestion.note}</span></button>)}
              </div>
            </div>
            <div className="home-art" aria-hidden="true">
              <div className="art-glow" />
              <div className="orbital orbital-a" /><div className="orbital orbital-b" />
              <div className="glass-orb"><LogoMark /><span className="orb-caption">open space<br /><b>for thought</b></span></div>
              <span className="star star-a">✦</span><span className="star star-b">✧</span><span className="star star-c">·</span>
            </div>
          </section>
        ) : (
          <section className="proxy-viewport"><iframe className="proxy-frame" title="Proxied web content" src={frameUrl} /></section>
        )}
      </div>

      <div className="server-status"><span>Server:</span> <strong>{proxyState === 'ready' ? '116ms' : '—'}</strong><button aria-label="Refresh server status">↻</button></div>
      <footer className="footer"><span>v2.0.1</span><span>GitHub</span><span>Night Discord</span><span>Mex Discord</span><span className="footer-spacer" /><span>{statusLabel}</span></footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
