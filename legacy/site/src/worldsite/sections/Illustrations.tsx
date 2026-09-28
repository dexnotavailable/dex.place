import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { ArrowLeft, ArrowRight, Maximize, Minimize, Minus, Plus } from 'lucide-react';
import { illustrations } from '../content';
import './section-enhancements.css';

// Page-session navigation state, deliberately neither localStorage nor tracking.
const gallerySession = { scrollTop: 0, selectedId: '', hasIndex: false, restoreFocus: false };
const plainActivation = (event: MouseEvent) => !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0;
function routeSelection(path: string) {
  try {
    const parts = new URL(path, location.origin).pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (parts[0] !== 'illustrations' || parts.length > 2) return { id: '', invalid: true, item: true };
    return { id: parts[1] || '', invalid: false, item: parts.length === 2 };
  } catch { return { id: '', invalid: true, item: true }; }
}

export function Illustrations({ path, navigate, onCloseInspection }: { path: string; navigate: (url: string) => void; onCloseInspection?:()=>void }) {
  const selection = useMemo(() => routeSelection(path), [path]);
  const art = !selection.invalid ? illustrations.find(item => item.id === selection.id) : undefined;
  const index = art ? illustrations.indexOf(art) : -1;
  const [zoom, setZoom] = useState(1);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [imageError, setImageError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [viewerStatus, setViewerStatus] = useState('');
  const [fit, setFit] = useState({ width: 0, height: 0 });
  const view = useRef<HTMLDivElement>(null), display = useRef<HTMLDivElement>(null), grid = useRef<HTMLDivElement>(null), unavailable = useRef<HTMLDivElement>(null);
  const previousItem = useRef<string | null>(null);
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const restoreAfterLoad = useRef(false);
  const navigateRef = useRef(navigate); navigateRef.current = navigate;
  const toIndex = () => {
    gallerySession.restoreFocus = true;
    if (document.fullscreenElement) void document.exitFullscreen().then(() => navigateRef.current('/illustrations')).catch(() => setViewerStatus('Exit fullscreen to return to illustrations.'));
    else navigateRef.current('/illustrations');
  };
  const toIndexRef = useRef(toIndex); toIndexRef.current = toIndex;
  const closeInspectionRef=useRef(onCloseInspection);closeInspectionRef.current=onCloseInspection;
  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === view.current);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  // The modal heading is outside this component; Escape ownership includes it.
  useEffect(() => {
    if (!selection.item) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || document.fullscreenElement) return;
      event.preventDefault(); event.stopPropagation(); if(closeInspectionRef.current)closeInspectionRef.current();else toIndexRef.current();
    };
    document.addEventListener('keydown', escape, true);
    return () => document.removeEventListener('keydown', escape, true);
  }, [selection.item]);
  useLayoutEffect(() => {
    const previous = previousItem.current;
    previousItem.current = selection.item ? selection.id || 'unavailable' : null;
    if (selection.item) {
      if (art) gallerySession.selectedId = art.id;
      setZoom(1); setImageError(false); setLoadState('loading'); setAttempt(0); setViewerStatus(''); pan.current = null;
      if (display.current) { display.current.scrollTop = 0; display.current.scrollLeft = 0; }
      const body = (view.current || unavailable.current)?.closest<HTMLElement>('.panel-body'); if (body) body.scrollTop = 0;
      (display.current || unavailable.current)?.focus({ preventScroll: true });
      return;
    }
    const body = grid.current?.closest<HTMLElement>('.panel-body'); if (!body) return;
    const hadIndex = gallerySession.hasIndex; body.scrollTop = gallerySession.scrollTop; gallerySession.hasIndex = true;
    const restore = gallerySession.restoreFocus || previous !== null; gallerySession.restoreFocus = false;
    if (restore) {
      const tiles = [...grid.current!.querySelectorAll<HTMLAnchorElement>('[data-art-id]')];
      const tile = tiles.find(item => item.dataset.artId === gallerySession.selectedId) || tiles[0];
      tile?.focus({ preventScroll: true });
      if (tile) {
        const box = tile.getBoundingClientRect(), viewport = body.getBoundingClientRect();
        if (!hadIndex || box.top < viewport.top || box.bottom > viewport.bottom) tile.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      } else grid.current?.focus({ preventScroll: true });
    }
    const save = () => { gallerySession.scrollTop = body.scrollTop; };
    body.addEventListener('scroll', save, { passive: true }); return () => body.removeEventListener('scroll', save);
  }, [selection.id, selection.item, selection.invalid]);
  useEffect(() => {
    const element = display.current; if (!element || !art) return;
    const measure = () => {
      const style = getComputedStyle(element);
      const width = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height = element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      if (width <= 0 || height <= 0) return;
      const scale = Math.min(width / art.width, height / art.height); setFit({ width: art.width * scale, height: art.height * scale });
    };
    const observer = new ResizeObserver(measure); observer.observe(element); measure(); return () => observer.disconnect();
  }, [art]);
  const openItem = (id: string) => { gallerySession.selectedId = id; navigate('/illustrations/' + encodeURIComponent(id)); };
  const toggleFullscreen = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (view.current?.requestFullscreen) await view.current.requestFullscreen(); else setViewerStatus('Fullscreen is unavailable.'); }
    catch { setViewerStatus('Fullscreen could not open. The image is still available here.'); }
  };
  const fitImage = () => { setZoom(1); if (display.current) { display.current.scrollTop = 0; display.current.scrollLeft = 0; } };
  const loaded = () => { setLoadState('ready'); setImageError(false); if (restoreAfterLoad.current) { restoreAfterLoad.current = false; display.current?.focus({ preventScroll: true }); } };
  const retry = () => { restoreAfterLoad.current = true; setLoadState('loading'); setAttempt(value => value + 1); };
  const imageReady = loadState === 'ready' && !imageError;
  const imageSrc = art ? art.src + (attempt ? (art.src.includes('?') ? '&' : '?') + 'retry=' + attempt : '') : '';
  if (selection.item && !art) return <div ref={unavailable} tabIndex={-1} className="art-unavailable"><p role="status">Illustration not found.</p><button onClick={toIndex}>Back to illustrations</button></div>;
  if (!art) return <div ref={grid} tabIndex={-1} className="art-grid">
    {!illustrations.length && <p>No illustrations published yet.</p>}
    {illustrations.map(item => <a href={'/illustrations/' + encodeURIComponent(item.id)} data-art-id={item.id} key={item.id} onClick={event => {
      if (!plainActivation(event)) return; event.preventDefault(); gallerySession.scrollTop = grid.current?.closest<HTMLElement>('.panel-body')?.scrollTop || 0; openItem(item.id);
    }}><div><img src={item.thumbnailSrc} alt={item.alt} loading="lazy" width={item.width} height={item.height} /></div><span>{item.title}</span></a>)}
  </div>;
  return <div ref={view} className="art-viewer">
    <div className="art-toolbar"><button className="text-button" onClick={toIndex}><ArrowLeft size={15} />Back to illustrations</button><div>
      <button className="icon-button" aria-label="Zoom out" disabled={!imageReady || zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - .25))}><Minus size={17} /></button>
      <output className="zoom-value" aria-label="Zoom">{Math.round(zoom * 100)}%</output><button className="text-button" disabled={!imageReady} onClick={fitImage}>Fit</button>
      <button className="icon-button" aria-label="Zoom in" disabled={!imageReady || zoom >= 4} onClick={() => setZoom(value => Math.min(4, value + .25))}><Plus size={17} /></button>
      <button className="icon-button" disabled={!imageReady && !fullscreen} aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={toggleFullscreen}>{fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}</button>
    </div></div>
    <p id="art-viewer-help" className="sr-only">At Fit, Left and Right change illustrations. When zoomed, arrow keys move within the image.</p>
    <div className={'art-display ' + (zoom > 1 ? 'zoomed' : '')} ref={display} tabIndex={0} role="region" aria-label="Artwork viewer" aria-describedby="art-viewer-help art-title" aria-busy={loadState === 'loading'} style={{ position: 'relative' }}
      onKeyDown={event => {
        if (event.target !== event.currentTarget || event.ctrlKey || event.metaKey || event.altKey || !imageReady) return;
        if (zoom === 1 && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
          event.preventDefault(); event.stopPropagation(); const next = index + (event.key === 'ArrowLeft' ? -1 : 1); if (illustrations[next]) openItem(illustrations[next].id);
        } else if (zoom > 1 && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
          event.preventDefault(); event.stopPropagation(); event.currentTarget.scrollLeft += event.key === 'ArrowLeft' ? -48 : event.key === 'ArrowRight' ? 48 : 0; event.currentTarget.scrollTop += event.key === 'ArrowUp' ? -48 : event.key === 'ArrowDown' ? 48 : 0;
        }
      }}
      onPointerDown={event => {
        if (!imageReady || zoom <= 1 || event.pointerType === 'touch') return;
        event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId); pan.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
      }}
      onPointerMove={event => { if (pan.current) { event.currentTarget.scrollLeft = pan.current.left - (event.clientX - pan.current.x); event.currentTarget.scrollTop = pan.current.top - (event.clientY - pan.current.y); } }}
      onPointerUp={() => pan.current = null} onPointerCancel={() => pan.current = null} onLostPointerCapture={() => pan.current = null}>
      <img key={art.id + ':' + attempt} src={imageSrc} alt={art.alt} draggable={false} onLoad={loaded} onError={() => { setImageError(true); setLoadState('failed'); }} style={{ ...(fit.width ? { width: fit.width * zoom, height: fit.height * zoom, maxWidth: 'none', maxHeight: 'none' } : {}), visibility: imageReady ? 'visible' : 'hidden' }} />
      {!imageReady && <div style={{ position: 'absolute', inset: 0, display: 'grid', alignContent: 'center', justifyItems: 'center', padding: 24, background: '#d5decf' }}>
        <p role={imageError ? 'alert' : 'status'}>{imageError ? 'Image could not load.' : 'Loading image…'}</p>{imageError && <button disabled={loadState === 'loading'} onClick={retry}>{loadState === 'loading' ? 'Retrying image…' : 'Retry image'}</button>}
      </div>}
    </div>
    <div className="art-caption"><div><h2 id="art-title">{art.title}</h2><p>{art.alt}</p></div><div className="art-next">
      <button aria-label="Previous illustration" disabled={index <= 0} onClick={() => openItem(illustrations[index - 1].id)}><ArrowLeft size={17} /></button><span aria-live="polite">{index + 1} / {illustrations.length}</span>
      <button aria-label="Next illustration" disabled={index >= illustrations.length - 1} onClick={() => openItem(illustrations[index + 1].id)}><ArrowRight size={17} /></button>
    </div></div>{viewerStatus && <p role="status">{viewerStatus}</p>}
  </div>;
}
