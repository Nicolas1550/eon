'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BookmarkPlus, Building2,
  Check, ChevronDown, ChevronLeft, ChevronRight, CloudFog, CloudRain, CloudSun,
  Compass, Database, Eye, Gauge, Globe2, HelpCircle, Layers3, Leaf, LockKeyhole,
  LogIn, LogOut, Menu, Moon, Pause, Play, Plus, RotateCcw, Save, Settings2,
  ShieldCheck, SlidersHorizontal, Sparkles, Sun, Trash2, UserRound, Wind, X, Camera, Map, Navigation, Film, Maximize2, Minimize2,
} from 'lucide-react';
import { Building, CameraMode, formatNumber, generateCity, GENERATOR_VERSION, PREVIOUS_VERSION, V4_VERSION, V3_VERSION, V2_VERSION, LEGACY_VERSION, Quality, Weather } from '@/lib/city';
import { generateCity as generateCityV1 } from '@/lib/city-v1';
import { generateCity as generateCityV2 } from '@/lib/city-v2';
import { generateCity as generateCityV3 } from '@/lib/city-v3';
import { generateCity as generateCityV4 } from '@/lib/city-v4';
import { generateCity as generateCityV5 } from '@/lib/city-v5';
import type { SceneProps } from './CityScene';

const CityScene = dynamic<SceneProps>(() => import('./CityScene'), {
  ssr: false,
  loading: () => <div className="scene-loading"><span className="loading-orbit"/><span>INITIALIZING WORLD ENGINE</span></div>,
});

type User = { id: string; email: string; display_name: string };
type SavedCity = { id: string; name: string; seed: number | string; grid_width: number; grid_height: number; config: { time?: number; weather?: Weather }; generator_version?: string; updated_at: string };
type Modal = 'auth' | 'vault' | 'help' | null;

function IconButton({ children, onClick, title, className = '' }: { children: ReactNode; onClick: () => void; title: string; className?: string }) {
  return <button type="button" className={`icon-button ${className}`} title={title} aria-label={title} onClick={onClick}>{children}</button>;
}

function Stat({ icon, label, value, unit, change }: { icon: React.ReactNode; label: string; value: string; unit?: string; change?: string }) {
  return <div className="stat-row">
    <div className="stat-icon">{icon}</div>
    <div className="stat-name">{label}</div>
    <div className="stat-value">{value} <span>{unit}</span></div>
    {change && <div className="stat-change">{change}</div>}
  </div>;
}

export default function EonApp() {
  const [seed, setSeed] = useState(18024);
  const [seedInput, setSeedInput] = useState('18024');
  const [grid, setGrid] = useState(20);
  const [cityName, setCityName] = useState('NEW AVALON');
  const [time, setTime] = useState(10.8);
  const [weather, setWeather] = useState<Weather>('clear');
  const [quality, setQuality] = useState<Quality>('cinematic');
  const [traffic, setTraffic] = useState(true);
  const [generatorVersion, setGeneratorVersion] = useState<string>(GENERATOR_VERSION);
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit');
  const [resetCamera, setResetCamera] = useState(0);
  const [photoMode, setPhotoMode] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState<Building | null>(null);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cities, setCities] = useState<SavedCity[]>([]);
  const [toast, setToast] = useState('');
  const [controlsOpen, setControlsOpen] = useState(false);
  const [activeCityId, setActiveCityId] = useState<string | null>(null);
  const [awakenedKey, setAwakenedKey] = useState<string | null>(null);
  const [coreFocus, setCoreFocus] = useState(0);
  const [fps, setFps] = useState<number | null>(null);

  const city = useMemo(() => {
    if (generatorVersion === LEGACY_VERSION) return generateCityV1(seed, grid);
    if (generatorVersion === V2_VERSION) return generateCityV2(seed, grid);
    if (generatorVersion === V3_VERSION) return generateCityV3(seed, grid);
    if (generatorVersion === V4_VERSION) return generateCityV4(seed, grid);
    if (generatorVersion === PREVIOUS_VERSION) return generateCityV5(seed, grid);
    return generateCity(seed, grid);
  }, [seed, grid, generatorVersion]);
  // Awakening is local to this browser and seed. EON's Neon database is untouched.
  const awakeningKey = `genesis.awakening.${generatorVersion}.${seed}.${grid}`;
  const awakened = awakenedKey === awakeningKey;
  useEffect(() => {
    try { setAwakenedKey(window.localStorage.getItem(awakeningKey) === '1' ? awakeningKey : null); }
    catch { setAwakenedKey(null); }
  }, [awakeningKey]);
  const toggleAwakening = () => {
    const next = !awakened;
    setAwakenedKey(next ? awakeningKey : null);
    try {
      if (next) window.localStorage.setItem(awakeningKey, '1');
      else window.localStorage.removeItem(awakeningKey);
    } catch { /* Private browsing can prevent local storage. The in-memory effect still works. */ }
    if (next) setCoreFocus((count) => count + 1);
    setToast(next ? 'GENESIS CORE ACTIVADO · El ecosistema está despertando.' : 'Ecosistema restaurado a su estado original.');
  };
  const onFps = useCallback((sample: number) => setFps(sample), []);
  const timeLabel = `${String(Math.floor(time)).padStart(2, '0')}:${String(Math.round((time % 1) * 60) % 60).padStart(2, '0')}`;
  const period = time >= 7 && time < 17 ? 'DAYLIGHT' : time >= 17 && time < 20 ? 'GOLDEN HOUR' : 'NIGHTFALL';

  useEffect(() => {
    if (window.innerWidth < 820) setQuality('balanced');
    fetch('/api/auth/me', { cache: 'no-store' }).then((r) => r.json()).then((d) => setUser(d.user ?? null)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setTime((t) => (t + 0.12) % 24), 160);
    return () => window.clearInterval(id);
  }, [playing]);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 4200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const onReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable="true"]')) return;
      if (e.key.toLowerCase() === 'p' && !modal) setPhotoMode(x => !x);
      if (e.key.toLowerCase() === 'f' && !modal) setFocusMode(x => !x);
      if (e.key === 'Escape') setPhotoMode(false);
      if (e.key.toLowerCase() === 'r' && !modal) setResetCamera(x => x + 1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [modal]);
  const generate = useCallback(() => {
    const number = Number(seedInput);
    if (!Number.isInteger(number) || number < 0 || number > 2147483647) {
      setToast('Ingresá una semilla entre 0 y 2147483647.');
      return;
    }
    if (number !== seed || generatorVersion !== GENERATOR_VERSION) setReady(false);
    setGeneratorVersion(GENERATOR_VERSION);
    setSeed(number);
    setActiveCityId(null);
    setSelected(null);
    setToast(`Ciudad generada · Seed ${number}`);
  }, [seedInput, seed, generatorVersion]);
  const randomize = () => {
    const bytes = new Uint32Array(1);
    window.crypto.getRandomValues(bytes);
    const next = bytes[0] % 2147483647;
    setSeedInput(String(next));
    setGeneratorVersion(GENERATOR_VERSION);
    setSeed(next);
    setSelected(null);
    setActiveCityId(null);
    setReady(false);
    setCityName(`CITY ${String(next).slice(0, 5)}`);
    setToast('Nueva ciudad procedural generada.');
  };
  const fetchCities = async () => {
    try {
      const response = await fetch('/api/cities', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'No se pudieron cargar las ciudades.');
      setCities(result.cities);
    } catch (error) { setToast(error instanceof Error ? error.message : 'Error de conexión.'); }
  };
  const openVault = () => {
    if (!user) { setAuthMode('login'); setModal('auth'); return; }
    setModal('vault');
    void fetchCities();
  };
  const saveCity = async () => {
    if (!user) { setAuthMode('register'); setModal('auth'); setToast('Creá una cuenta o iniciá sesión para guardar ciudades.'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/cities', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cityName.trim(), seed, gridWidth: grid, gridHeight: grid, generatorVersion, config: { time, weather } }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'No se pudo guardar.');
      setActiveCityId(result.city.id);
      setToast('Ciudad guardada en Neon PostgreSQL.');
    } catch (error) { setToast(error instanceof Error ? error.message : 'Error al guardar.'); }
    finally { setBusy(false); }
  };
  const loadCity = (item: SavedCity) => {
    setGeneratorVersion(item.generator_version ?? LEGACY_VERSION);
    setSeed(Number(item.seed));
    setSeedInput(String(item.seed));
    setGrid(item.grid_width);
    setCityName(item.name);
    setTime(item.config?.time ?? 17.7);
    setWeather(item.config?.weather ?? 'clear');
    setSelected(null);
    if (Number(item.seed) !== seed || item.grid_width !== grid || (item.generator_version ?? LEGACY_VERSION) !== generatorVersion) setReady(false);
    setActiveCityId(item.id);
    setModal(null);
    setToast(`Ciudad «${item.name}» restaurada.`);
  };
  const deleteCity = async (item: SavedCity) => {
    if (!window.confirm(`¿Eliminar «${item.name}»? Esta acción no se puede deshacer.`)) return;
    try {
      const response = await fetch(`/api/cities/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'No se pudo eliminar.');
      setCities((prev) => prev.filter((x) => x.id !== item.id));
      if (activeCityId === item.id) setActiveCityId(null);
      setToast('Ciudad eliminada de Neon.');
    } catch (error) { setToast(error instanceof Error ? error.message : 'Error al eliminar.'); }
  };
  const submitAuth = async (e: FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    try {
      const response = await fetch(`/api/auth/${authMode}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword, ...(authMode === 'register' ? { displayName: authName } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'No se pudo iniciar sesión.');
      setUser(result.user);
      setAuthPassword('');
      setModal(null);
      setToast(`Bienvenido a GENESIS, ${result.user.display_name}.`);
    } catch (error) { setToast(error instanceof Error ? error.message : 'Error de autenticación.'); }
    finally { setAuthBusy(false); }
  };
  const logout = async () => {
    try {
      const r = await fetch('/api/auth/logout', { method: 'POST' });
      if (!r.ok) throw new Error();
      setUser(null);
      setCities([]);
      setActiveCityId(null);
      setToast('Sesión cerrada.');
    } catch { setToast('No se pudo cerrar sesión.'); }
  };

  return <div className={`eon-app ${photoMode ? 'photo-mode' : ''} ${focusMode ? 'focus-mode' : ''} ${cameraMode === 'street' ? 'street-mode' : ''}`} >
    <div className="world-stage" aria-label="Ciudad 3D interactiva">
      <CityScene city={city} seed={seed} time={time} weather={weather} quality={quality} traffic={traffic} cameraMode={cameraMode} resetCamera={resetCamera} selected={selected} onSelect={setSelected} onReady={onReady} awakened={awakened} coreFocus={coreFocus} onFps={onFps}/>
      <div className="stage-vignette" aria-hidden="true"/>
      <div className="stage-grain" aria-hidden="true"/>
      {!ready && <div className="boot-screen"><div className="boot-logo">GENESIS<span>®</span></div><div className="boot-line"/><p>GENERATING YOUR WORLD</p></div>}
    </div>

    <header className="topbar">
      <div className="brand" aria-label="GENESIS The Living World"><span className="brand-symbol"><i/><i/><i/></span><span className="brand-word">GENESIS<span className="brand-registered">®</span></span><span className="brand-divider"/><span className="brand-tag">THE LIVING WORLD</span></div>
      <div className="topbar-center"><span className="topbar-index">WORLD ENGINE / AWAKENING 01</span><span className="topbar-center-dot"/><span>EVOLVING ENVIRONMENTS</span></div>
      <div className="topbar-actions">
        <span className="live-pill"><span/> SYSTEM ONLINE</span>
        <IconButton onClick={() => setModal('help')} title="Ayuda y controles"><HelpCircle size={17}/></IconButton>
        <button className="user-button" onClick={() => user ? void logout() : (setAuthMode('register'), setModal('auth'))}>
          {user ? <><UserRound size={16}/><span>{user.display_name.split(' ')[0]}</span><LogOut size={14}/></> : <><UserRound size={16}/><span>MY ACCOUNT</span><ArrowUpRight size={14}/></>}
        </button>
        <IconButton className="mobile-menu" onClick={() => setControlsOpen((v) => !v)} title="Abrir controles"><Menu size={20}/></IconButton>
      </div>
    </header>

    <div className="top-left-ambient"><span className="ambient-index">01 / THE AWAKENING</span><div className="hero-kicker"><span/> A WORLD THAT AWAKENS</div><h1>GENESIS<span className="hero-dot">.</span></h1><p>One world.<br/><em>Infinite possibilities.</em></p></div>

    <div className="genesis-command glass-panel" aria-live="polite">
      <div className="genesis-command-title"><Sparkles size={14}/><span>GENESIS CORE</span><span className={awakened ? 'genesis-live' : 'genesis-dormant'}>{awakened ? 'ACTIVE' : 'DORMANT'}</span></div>
      <p>{awakened ? 'La energía ha despertado la vegetación del entorno.' : 'Activá el núcleo para devolver la vida al mundo.'}</p>
      <div className="genesis-command-actions">
        <button className="genesis-awaken-button" onClick={toggleAwakening}>{awakened ? <RotateCcw size={15}/> : <Sparkles size={15}/>} {awakened ? 'REINICIAR' : 'AWAKEN WORLD'}</button>
        <button className="genesis-focus-button" title="Acercar cámara al núcleo" aria-label="Enfocar núcleo Genesis" onClick={() => { setCameraMode('orbit'); setCoreFocus((v) => v + 1); }}><Compass size={16}/></button>
      </div>
    </div>

    <aside className="metrics-panel glass-panel">
      <div className="panel-heading"><span>WORLD TELEMETRY</span><Activity size={15}/></div>
      <div className="city-title-row"><div><span className="micro-label">ACTIVE ENVIRONMENT</span><h2>{cityName}</h2></div><div className="city-status"><span/> LIVE</div></div>
      <div className="metrics-divider"/>
      <Stat icon={<Building2 size={16}/>} label="Structures" value={formatNumber(city.buildings.length)}/>
      <Stat icon={<Globe2 size={16}/>} label="Estimated population" value={formatNumber(city.population)}/>
      <Stat icon={<Gauge size={16}/>} label="Modeled energy" value={formatNumber(city.energy)} unit="MW"/>
      <Stat icon={<Leaf size={16}/>} label="Park coverage" value={String(city.greenSpace)} unit="%"/>
      <div className="genesis-telemetry"><span><Activity size={13}/> LIVE FPS</span><strong>{fps === null ? '—' : fps}</strong><span>{quality.toUpperCase()}</span></div>
      <div className="metrics-foot"><span>MODEL · {`CITYGEN ${generatorVersion.replace('citygen-', '')}`}</span><span>SEED {seed}</span></div>
    </aside>

    <aside className={`control-panel glass-panel ${controlsOpen ? 'is-open' : ''}`}>
      <div className="panel-heading"><span>ENVIRONMENT CONTROL</span><SlidersHorizontal size={15}/></div>
      <div className="control-block"><div className="control-label"><span>WORLD GENERATOR</span><span className="tiny-accent">01</span></div>
        <label className="field-caption" htmlFor="city-name">CITY NAME</label>
        <input id="city-name" className="control-input" value={cityName} onChange={(e) => setCityName(e.target.value.slice(0, 100))} maxLength={100}/>
        <label className="field-caption" htmlFor="city-seed">PROCEDURAL SEED</label>
        <div className="seed-row"><input id="city-seed" className="control-input mono" type="number" min="0" max="2147483647" value={seedInput} onChange={(e) => setSeedInput(e.target.value)}/><IconButton onClick={randomize} title="Generar semilla aleatoria"><RotateCcw size={16}/></IconButton></div>
        <div className="grid-size"><span>City scale</span><div className="segmented">{[16,20,24].map((n) => <button key={n} className={grid === n ? 'active' : ''} onClick={() => { setGrid(n); setGeneratorVersion(GENERATOR_VERSION); setReady(false); setSelected(null); setActiveCityId(null); }}>{n}</button>)}</div></div>
        <button className="primary-button" onClick={generate}><Sparkles size={15}/> REGENERATE WORLD <ArrowRight size={16}/></button>
      </div>
      <div className="control-block"><div className="control-label"><span>ATMOSPHERE</span><span className="tiny-accent">02</span></div>
        <div className="weather-grid">
          {([{ value:'clear',label:'Clear',icon:<CloudSun size={18}/> },{ value:'haze',label:'Haze',icon:<CloudFog size={18}/> },{ value:'rain',label:'Rain',icon:<CloudRain size={18}/> }] as const).map((item) =>
            <button key={item.value} className={`weather-option ${weather === item.value ? 'selected' : ''}`} onClick={() => setWeather(item.value)}>{item.icon}<span>{item.label}</span></button>)}
        </div>
      </div>
      <div className="control-block"><div className="control-label"><span>RENDERING</span><span className="tiny-accent">03</span></div>
        <div className="setting-row"><div><span className="setting-name">Traffic simulation</span><span className="setting-description">Animated road network</span></div><button role="switch" aria-checked={traffic} className={`switch ${traffic ? 'on' : ''}`} onClick={() => setTraffic((x) => !x)}><span/></button></div>
        <span className="field-caption">GRAPHICS PROFILE</span>
        <div className="genesis-quality-row" role="group" aria-label="Calidad gráfica">
          {(['balanced', 'cinematic', 'ultra'] as const).map((profile) => <button key={profile} type="button" onClick={() => setQuality(profile)} aria-pressed={quality === profile} className={quality === profile ? 'active' : ''}>{profile === 'balanced' ? 'ECO' : profile === 'cinematic' ? 'HIGH' : 'ULTRA'}</button>)}
        </div>
        <div className="setting-description genesis-render-note">ULTRA: 2× DPR y sombras 4K. Más carga gráfica; no implica CUDA ni ray tracing.</div>
      </div>
      <div className="control-footer"><button className="secondary-button" onClick={openVault}><Database size={15}/> CITY VAULT</button><button className="save-button" onClick={() => void saveCity()} disabled={busy}><Save size={15}/>{busy ? 'SAVING...' : 'SAVE CITY'}</button></div>
    </aside>

    {selected && <div className="inspector glass-panel"><div className="panel-heading"><span>STRUCTURE INSPECTOR</span><IconButton onClick={() => setSelected(null)} title="Cerrar inspector"><X size={15}/></IconButton></div><div className="inspector-head"><span className="inspector-icon"><Building2 size={25}/></span><div><span className="micro-label">BUILDING #{String(selected.id).padStart(4, '0')}</span><h3>{selected.district}</h3></div></div><div className="inspector-grid"><div><span>HEIGHT</span><strong>{Math.round(selected.height)} m</strong></div><div><span>FLOORS</span><strong>{selected.floors}</strong></div><div><span>OCCUPANTS*</span><strong>{formatNumber(selected.occupancy)}</strong></div><div><span>ENERGY*</span><strong>{selected.energy} MW</strong></div></div><p>* Procedural model estimates, not real-world data.</p></div>}

    <div className="compass-marker"><Compass size={22}/><span>N</span></div>
    <div className="view-switch glass-panel" role="group" aria-label="Modo de cámara">
      <button className={cameraMode === 'orbit' ? 'active' : ''} onClick={() => setCameraMode('orbit')} title="Vista aérea"><Map size={15}/> ORBIT</button>
      <button className={cameraMode === 'street' ? 'active' : ''} onClick={() => setCameraMode('street')} title="Recorrer a nivel de calle"><Navigation size={15}/> STREET</button>
      <button className={cameraMode === 'cinema' ? 'active' : ''} onClick={() => setCameraMode('cinema')} title="Recorrido cinematográfico automático"><Film size={15}/> CINEMA</button>
      <button onClick={() => setResetCamera(v => v + 1)} title="Reiniciar cámara" aria-label="Reiniciar cámara"><RotateCcw size={16}/></button>
      <button className={focusMode ? 'focus-active' : ''} onClick={() => setFocusMode(v => !v)} title="Alternar modo inmersivo (F)" aria-label="Alternar modo inmersivo">{focusMode ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}</button>
      <button onClick={() => setPhotoMode(v => !v)} title="Modo fotografía" aria-label="Modo fotografía"><Camera size={16}/></button>
    </div>
    {photoMode && <button className="photo-exit" onClick={() => setPhotoMode(false)}><X size={16}/> EXIT PHOTO MODE · P</button>}
    <div className="camera-hint"><Eye size={15}/><span>{cameraMode === 'street' ? 'WASD TO WALK · SHIFT TO SPRINT' : cameraMode === 'cinema' ? 'AUTOMATIC CINEMATIC FLYOVER' : 'DRAG TO ORBIT'}</span><i/><span>SCROLL TO EXPLORE</span><i/><span>F FOCUS · P PHOTO</span></div>

    <div className="timeline glass-panel">
      <div className="timeline-top"><div className="timeline-name"><span className="timeline-accent"/><span>SIMULATION TIME</span><span className="timeline-status">{period}</span></div><div className="timeline-clock"><span>{timeLabel}</span><span>LOCAL / SIMULATED</span></div></div>
      <div className="timeline-controls"><IconButton onClick={() => setPlaying((x) => !x)} title={playing ? 'Pausar tiempo' : 'Reproducir tiempo'}>{playing ? <Pause size={18}/> : <Play size={18}/>}</IconButton><Sun className="time-sun" size={17}/><input aria-label="Hora de simulación" type="range" min="0" max="23.99" step="0.01" value={time} onChange={(e) => { setPlaying(false); setTime(Number(e.target.value)); }}/><Moon className="time-moon" size={16}/><div className="time-presets"><button onClick={() => { setTime(10); setPlaying(false); }}>DAY</button><button onClick={() => { setTime(18.2); setPlaying(false); }}>DUSK</button><button onClick={() => { setTime(23); setPlaying(false); }}>NIGHT</button></div></div>
      <div className="timeline-labels"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
    </div>

    <footer className="app-footer"><span>© GENESIS LAB — AWAKENING BUILD 01</span><span>ILLUSTRATIVE URBAN MODEL · NOT A REAL-WORLD FORECAST</span><span>BUILT FOR THE WEB <ArrowUpRight size={13}/></span></footer>

    {toast && <div role="status" className="toast"><span className="toast-indicator"/>{toast}<IconButton onClick={() => setToast('')} title="Cerrar aviso"><X size={14}/></IconButton></div>}

    {modal && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}><div className="modal glass-panel" role="dialog" aria-modal="true" aria-label={modal === 'auth' ? 'Cuenta GENESIS' : modal === 'vault' ? 'Ciudades guardadas' : 'Ayuda'}>
      <div className="modal-top"><div className="modal-logo"><span className="brand-symbol small"><i/><i/><i/></span> GENESIS<span> / {modal === 'auth' ? 'ACCOUNT' : modal === 'vault' ? 'CITY VAULT' : 'CONTROLS'}</span></div><IconButton onClick={() => setModal(null)} title="Cerrar"><X size={19}/></IconButton></div>
      {modal === 'auth' && <><h2>{authMode === 'register' ? 'Create your world.' : 'Welcome back.'}</h2><p className="modal-description">{authMode === 'register' ? 'Guardá ciudades reales en tu propia cuenta de GENESIS, respaldada por Neon PostgreSQL.' : 'Accedé a tus ciudades y continuá explorando.'}</p><form onSubmit={(e) => void submitAuth(e)} className="auth-form">{authMode === 'register' && <label>DISPLAY NAME<input required minLength={2} maxLength={80} value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="Tu nombre" autoComplete="name"/></label>}<label>EMAIL ADDRESS<input required type="email" maxLength={254} value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="nombre@correo.com" autoComplete="email"/></label><label>PASSWORD<input required type="password" minLength={authMode === 'register' ? 10 : 1} maxLength={128} value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="••••••••••" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}/></label><button className="primary-button" disabled={authBusy} type="submit"><LockKeyhole size={16}/>{authBusy ? 'PROCESSING...' : authMode === 'register' ? 'CREATE ACCOUNT' : 'SIGN IN'}<ArrowRight size={16}/></button></form><button className="modal-switch" onClick={() => setAuthMode((x) => x === 'login' ? 'register' : 'login')}>{authMode === 'register' ? 'Already have an account? Sign in' : 'New to GENESIS? Create an account'} <ArrowRight size={14}/></button><div className="security-note"><ShieldCheck size={16}/> Sesiones privadas con cookies HttpOnly. No guardamos contraseñas en texto plano.</div></>}
      {modal === 'vault' && <><h2>Your cities.</h2><p className="modal-description">Tus mundos guardados en Neon PostgreSQL. Elegí uno para reconstruirlo con la misma semilla.</p><div className="vault-list">{cities.length === 0 ? <div className="empty-vault"><Database size={28}/><h3>No saved cities yet.</h3><p>Volvé a la ciudad y presioná «Save City».</p></div> : cities.map((item) => <div key={item.id} className="vault-item"><div className="vault-item-icon"><Building2 size={20}/></div><div className="vault-item-main"><strong>{item.name}</strong><span>SEED {item.seed} · {item.grid_width} × {item.grid_height} · {new Date(item.updated_at).toLocaleDateString('es-AR')}</span></div><IconButton onClick={() => loadCity(item)} title="Cargar ciudad"><ArrowRight size={18}/></IconButton><IconButton onClick={() => void deleteCity(item)} title="Eliminar ciudad"><Trash2 size={17}/></IconButton></div>)}</div><button className="secondary-button wide" onClick={() => void fetchCities()}><RotateCcw size={15}/> REFRESH VAULT</button></>}
      {modal === 'help' && <><h2>Explore a living world.</h2><p className="modal-description">GENESIS Awakening parte del motor urbano EON y añade un núcleo de energía que transforma las zonas verdes. Todas las métricas son ilustrativas.</p><div className="help-list"><div><Compass size={20}/><span><strong>Orbit the city</strong>Arrastrá con el botón izquierdo del mouse.</span></div><div><Eye size={20}/><span><strong>Zoom and pan</strong>Usá la rueda o el botón derecho del mouse.</span></div><div><Building2 size={20}/><span><strong>Inspect structures</strong>Hacé clic en un edificio para ver sus atributos. Modo STREET: WASD para caminar, Shift para acelerar. Modo CINEMA: recorrido automático. R reinicia cámara, F activa el modo inmersivo y P activa fotografía.</span></div><div><Sun size={20}/><span><strong>Change time</strong>Usá la línea de tiempo para cambiar la luz del mundo.</span></div><div><Sparkles size={20}/><span><strong>Awaken the world</strong>Presioná AWAKEN WORLD y acercate al núcleo con el botón de brújula. El despertar se recuerda en este navegador para cada semilla.</span></div><div><Database size={20}/><span><strong>Persist your world</strong>Registrate y guardá ciudades en Neon PostgreSQL.</span></div></div><button className="primary-button" onClick={() => setModal(null)}>START EXPLORING <ArrowRight size={16}/></button></>}
    </div></div>}
  </div>;
}
