import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const DEFAULT_URL = 'https://example.com';
const DEFAULT_WISP_URL = 'wss://mex-wisp.onrender.com/';
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
    spark: <><path d="m12 3-1.2 5.8L5 10l5.8 1.2L12 17l1.2-5.8L19 10l-5.8-1.2L12 3Z" /><path d="m19 16-.5 2.5L16 19l2.5.5L19 22l.5-2.5L22 19l-2.5-.5L19 16Z" /></>,
    back: <><path d="m15 18-6-6 6-6" /></>,
    forward: <><path d="m9 18 6-6-6-6" /></>,
    refresh: <><path d="M20 11a8.1 8.1 0 0 0-14.8-3L3 11" /><path d="M3 5v6h6" /><path d="M4 13a8.1 8.1 0 0 0 14.8 3L21 13" /><path d="M21 19v-6h-6" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>,
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
  const configured = import.meta.env.VITE_WISP_URL || DEFAULT_WISP_URL;
  if (configured) return configured.endsWith('/') ? configured : `${configured}/`;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/`;
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
  const statusLabel = useMemo(() => {
    if (proxyState === 'ready') return 'Gateway ready';
    if (proxyState === 'error') return 'Gateway needs attention';
    return 'Warming the gateway';
  }, [proxyState]);

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
        const bareMuxUrl = '/baremux/index.mjs';
        const { BareMuxConnection } = await import(/* @vite-ignore */ bareMuxUrl);
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
            <p className="activation-title">Activating Wisp</p>
            <p className="activation-copy">Warming the Render gateway<span className="loading-dots">...</span></p>
            <span className="activation-endpoint">mex-wisp.onrender.com</span>
          </div>
        </div>
      )}
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <button className="brand" onClick={goHome} aria-label="Return to mex home">
          <LogoMark small />
          <span className="brand-copy"><strong>mex</strong><em>quietly browse</em></span>
        </button>
        <div className="topbar-actions">
          <span className={`status-pill status-${proxyState}`}><span className="status-dot" />{statusLabel}</span>
          <button className="round-button" onClick={() => openUrl(DEFAULT_URL)} aria-label="Open example.com"><Icon name="spark" /></button>
        </div>
      </header>

      {!hasBrowser ? (
        <section className="hero-shell">
          <div className="hero-content">
            <div className="eyebrow"><span className="eyebrow-line" /> A softer way to wander</div>
            <h1>Browse with a little<br /><span>more breathing room.</span></h1>
            <p className="hero-copy">A quiet, private-feeling web gateway with a glassy interface. Put a destination in the bar and let the rest fade away.</p>
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
          <div className="hero-art" aria-hidden="true">
            <div className="art-glow" />
            <div className="orbital orbital-a" /><div className="orbital orbital-b" />
            <div className="glass-orb"><LogoMark /><span className="orb-caption">open space<br /><b>for thought</b></span></div>
            <span className="star star-a">✦</span><span className="star star-b">✧</span><span className="star star-c">·</span>
          </div>
        </section>
      ) : (
        <section className="browser-shell">
          <div className="browser-toolbar">
            <div className="window-dots"><span /><span /><span /></div>
            <div className="browser-controls"><button onClick={goHome} aria-label="Home"><Icon name="home" /></button><button onClick={() => window.history.back()} aria-label="Back"><Icon name="back" /></button><button onClick={() => window.history.forward()} aria-label="Forward"><Icon name="forward" /></button><button onClick={() => document.querySelector('.proxy-frame')?.contentWindow.location.reload()} aria-label="Reload"><Icon name="refresh" /></button></div>
            <form className="address-bar" onSubmit={handleSubmit}><span className="address-lock"><Icon name="shield" /></span><input value={address} onChange={(event) => setAddress(event.target.value)} aria-label="Current web address" /><button type="submit" aria-label="Navigate"><Icon name="arrow" /></button></form>
            <span className="browser-badge">UV / epoxy</span>
          </div>
          <div className="proxy-viewport"><iframe className="proxy-frame" title="Proxied web content" src={frameUrl} /></div>
        </section>
      )}

      <footer className="footer"><span>mex / 01</span><span className="footer-center"><i /> encrypted transport · ultraviolet gateway</span><span>{history.length ? `${history.length} recent ${history.length === 1 ? 'place' : 'places'}` : 'made for unhurried browsing'}</span></footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
