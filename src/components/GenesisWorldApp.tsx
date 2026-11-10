'use client';

import dynamic from 'next/dynamic';
import { Component, useCallback, useEffect, useState, type ReactNode, type CSSProperties } from 'react';
import { Activity, ArrowLeft, ArrowRight, Camera, Check, Compass, Eye, Film, Globe2, Layers3, Maximize2, Minimize2, Moon, Mountain, Play, RotateCcw, Settings2, Sun, Wind, X } from 'lucide-react';
import { GENESIS_BIOMES, biomeAsset, type GenesisBiome, type GenesisCamera, type GenesisQuality } from '@/lib/genesis-biomes';
import { BiomeLoadProgress } from './GenesisBiomeScene';

const BiomeScene = dynamic(() => import('./GenesisBiomeScene'), { ssr: false });

class WorldErrorBoundary extends Component<{ children: ReactNode; onError?: () => void }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch(error: Error) { console.error('GENESIS world load failed:', error); this.props.onError?.(); }
  render() { return this.state.error ? <div className="gb-error"><strong>NO SE PUDO CARGAR EL MODELO 3D</strong><span>Comprobá que scene.glb exista y que tengas memoria suficiente. Elegí otro bioma o recargá la página.</span></div> : this.props.children; }
}

export default function GenesisWorldApp() {
  const [index, setIndex] = useState(0);
  const [entered, setEntered] = useState(false);
  const [quality, setQuality] = useState<GenesisQuality>('high');
  const [cameraMode, setCameraMode] = useState<GenesisCamera>('orbit');
  const [reset, setReset] = useState(0);
  const [time, setTime] = useState(16.8);
  const [playingTime, setPlayingTime] = useState(false);
  const [photoMode, setPhotoMode] = useState(false);
  const [fps, setFps] = useState<number | null>(null);
  const [infoOpen, setInfoOpen] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const biome = GENESIS_BIOMES[index];
  const selectBiome = useCallback((value: number) => {
    setEntered(false); setLoadError(false); setFps(null); setPhotoMode(false); setCameraMode('orbit');
    setIndex(Math.max(0, Math.min(GENESIS_BIOMES.length-1, value)));
  }, []);
  useEffect(() => {
    if (window.innerWidth < 800) setQuality('eco');
  }, []);
  useEffect(() => {
    if (!playingTime) return;
    const interval = window.setInterval(() => setTime((v) => (v+.05) % 24), 220);
    return () => window.clearInterval(interval);
  }, [playingTime]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input,textarea,button,[contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      if (key === 'p') setPhotoMode((v) => !v);
      if (key === 'r') setReset((v) => v+1);
      if (event.key === 'Escape') setPhotoMode(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const begin = () => { setLoadError(false); setCameraMode('orbit'); setEntered(true); };
  const clock = `${String(Math.floor(time)).padStart(2,'0')}:${String(Math.round((time%1)*60)%60).padStart(2,'0')}`;
  const memoryWarning = biome.sizeMB >= 100;

  return <main className={`genesis-universe ${photoMode ? 'gb-photo' : ''}`} style={{ '--gb-accent': biome.accent, '--gb-backdrop': biome.backdrop } as CSSProperties}>
    <div className="gb-stage" aria-label={`Explorador 3D ${biome.name}`}>
      {!entered ? <div className="gb-stage-preview" style={{ backgroundImage: `url('${biomeAsset(biome.id, 'preview.webp')}')` }} /> :
        <WorldErrorBoundary key={biome.id} onError={() => setLoadError(true)}>
          <BiomeScene biome={biome} quality={quality} cameraMode={cameraMode} reset={reset} time={time} onFps={setFps} />
        </WorldErrorBoundary>}
      <div className="gb-stage-vignette" />
      {entered && !loadError && <BiomeLoadProgress />}
      <div className="gb-stage-caption">GENESIS ENGINE <span> / </span> {biome.number} {biome.name}</div>
    </div>

    <header className="gb-topbar">
      <a className="gb-logo" href="/" aria-label="GENESIS inicio"><span className="gb-logo-mark">///</span><strong>GENESIS</strong><small>THE LIVING WORLD</small></a>
      <div className="gb-top-center"><span className="gb-live-dot"/> FIVE AUTHORED ENVIRONMENTS <span className="gb-top-split">/</span> BLENDER × WEBGL</div>
      <div className="gb-top-actions"><a className="gb-city-link" href="/city"><Layers3 size={14}/> EON CITY LAB</a><button onClick={() => setInfoOpen((v)=>!v)} className="gb-icon-button" aria-label="Mostrar u ocultar panel"><Settings2 size={19}/></button></div>
    </header>

    <aside className="gb-hero" aria-live="polite">
      <div className="gb-eyebrow"><span className="gb-eyebrow-line"/> WORLD {biome.number} / 05 — {biome.climate}</div>
      <h1>{biome.name.split(' ')[0]}<br/><span>{biome.name.split(' ').slice(1).join(' ')}</span></h1>
      <p className="gb-subtitle">{biome.subtitle}</p>
      <p className="gb-description">{biome.caption}</p>
      {!entered && <div className="gb-enter-wrap"><button className="gb-enter" onClick={begin}><Play size={16} fill="currentColor"/> EXPLORAR MUNDO <ArrowRight size={17}/></button><span>Renderizado en tu navegador · La GPU del visitante procesa la escena</span>{memoryWarning && <span className="gb-download-warning">Escenario exigente · archivo 3D de aprox. {Math.round(biome.sizeMB)} MB</span>}</div>}
      {entered && <div className="gb-enter-wrap"><button className="gb-back-preview" onClick={() => setEntered(false)}><ArrowLeft size={15}/> Volver a la vista previa</button></div>}
    </aside>

    <aside className={`gb-panel ${infoOpen ? '' : 'gb-panel-hidden'}`} aria-label="Selector de mundos">
      <div className="gb-panel-heading"><div><span>WORLD ATLAS</span><strong>SELECT YOUR ENVIRONMENT</strong></div><Globe2 size={20}/></div>
      <div className="gb-world-list">{GENESIS_BIOMES.map((item, n) => <button key={item.id} onClick={()=>selectBiome(n)} className={`gb-world-item ${index===n?'gb-selected':''}`} aria-pressed={index===n}>
        <img src={biomeAsset(item.id,'preview.webp')} alt="" loading={n>1?'lazy':'eager'}/>
        <span className="gb-world-copy"><span className="gb-world-number">{item.number} / {item.climate}</span><strong>{item.name}</strong><span>{item.feature}</span></span>
        {index===n ? <Check size={15} className="gb-world-check"/> : <ArrowRight size={14} className="gb-world-arrow"/>}
      </button>)}</div>
      <div className="gb-panel-data"><div><span>ACTIVE BIOME</span><strong>{biome.name}</strong></div><div><span>MODEL FILE</span><strong>GLB · {Math.round(biome.sizeMB)} MB</strong></div><div><span>WEB RENDER</span><strong>{entered ? (fps ? `${fps} FPS` : 'LOADING') : 'READY TO LOAD'}</strong></div></div>
      <div className="gb-panel-controls"><span>GRAPHICS PROFILE</span><div className="gb-quality-options">{(['eco','high','ultra'] as const).map((q)=><button key={q} onClick={()=>setQuality(q)} className={quality===q?'gb-active':''}>{q.toUpperCase()}</button>)}</div></div>
    </aside>

    <div className="gb-camera-bar" role="group" aria-label="Modo de cámara">
      {([{id:'orbit',label:'ORBIT',icon:<Compass size={15}/>},{id:'walk',label:'EXPLORE',icon:<Mountain size={15}/>},{id:'cinema',label:'CINEMA',icon:<Film size={15}/>} ] as const).map(({id,label,icon})=><button key={id} disabled={!entered} onClick={()=>setCameraMode(id)} className={entered && cameraMode===id?'gb-active':''}>{icon}{label}</button>)}
      <span className="gb-camera-separator"/>
      <button disabled={!entered} onClick={()=>setReset((v)=>v+1)} title="Reiniciar cámara"><RotateCcw size={16}/></button>
      <button onClick={()=>setPhotoMode((v)=>!v)} title="Modo fotografía (P)">{photoMode?<Minimize2 size={16}/>:<Maximize2 size={16}/>}</button>
    </div>
    <div className="gb-timebar"><div className="gb-time-meta"><div><Sun size={15}/><strong>ENVIRONMENT LIGHT</strong><span>DAY / NIGHT</span></div><div><strong className="gb-clock">{clock}</strong><span>SIMULATED</span></div></div><div className="gb-time-controls"><button onClick={()=>setPlayingTime((v)=>!v)} aria-label={playingTime?'Detener hora':'Animar hora'}>{playingTime?'Ⅱ':<Play size={14}/>}</button><input type="range" min="0" max="23.95" step=".05" value={time} onChange={(e)=>{setPlayingTime(false);setTime(Number(e.target.value));}} aria-label="Hora del día"/><Moon size={15}/></div></div>

    <div className="gb-bottom-hint"><Eye size={14}/><span>{!entered?'ELEGÍ UN MUNDO · EXPLORAR MUNDO PARA CARGAR EL 3D':cameraMode==='walk'?'WASD PARA MOVERTE · MOUSE PARA MIRAR · SHIFT PARA ACELERAR':cameraMode==='cinema'?'RECORRIDO AUTOMÁTICO · CAMBIÁ A ORBIT PARA CONTROL MANUAL':'ARRASTRÁ PARA ORBITAR · RUEDA PARA ZOOM'}</span></div>
    <footer className="gb-footer"><span>© GENESIS LAB / FIVE WORLDS</span><span>REAL ASSETS · REAL-TIME 3D · WEBGL</span><span>FOTO P · RESET R</span></footer>
  </main>;
}
