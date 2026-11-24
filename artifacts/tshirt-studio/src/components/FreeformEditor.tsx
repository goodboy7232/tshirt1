import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Canvas, Circle, FabricImage, IText, PencilBrush, Rect, type FabricObject } from 'fabric';
import { ArrowDown, ArrowUp, Copy, Eraser, Eye, EyeOff, ImagePlus, Lock, Pencil, Plus, Redo2, RotateCcw, Square, Trash2, Type, Undo2, Unlock, X } from 'lucide-react';

type Side = 'front' | 'back' | 'left' | 'right';
type DocumentChange = { side: Side; artwork: string | null; document: string };

type FreeformEditorProps = {
  documents: Record<Side, string | null>;
  artwork: Record<Side, string | null>;
  text: Record<Side, string>;
  side: Side;
  overlayHost: HTMLElement | null;
  onSideChange: (side: Side) => void;
  onChange: (change: DocumentChange & { textContent: string }) => void;
  onNotice: (message: string) => void;
};

const imageMimeTypes = ['image/png', 'image/jpeg', 'image/webp'];

const safeAreas: Record<Side, { left: number; top: number; width: number; height: number }> = {
  front: { left: 160, top: 190, width: 180, height: 215 },
  back: { left: 158, top: 145, width: 184, height: 260 },
  left: { left: 92, top: 174, width: 76, height: 68 },
  right: { left: 332, top: 174, width: 76, height: 68 },
};

function renderPrintArtwork(canvas: Canvas, side: Side) {
  const zoom = canvas.getZoom();
  canvas.setZoom(1);
  const bounds = safeAreas[side];
  const artwork = canvas.getObjects().length ? canvas.toDataURL({ format: 'png', multiplier: 4, enableRetinaScaling: false, ...bounds }) : null;
  canvas.setZoom(zoom);
  canvas.requestRenderAll();
  return artwork;
}

function layerName(object: FabricObject, index: number) {
  if (object instanceof IText) return `Text · ${object.text?.slice(0, 18) || 'New layer'}`;
  if (object instanceof FabricImage) return 'Image layer';
  if (object instanceof Circle) return 'Circle';
  if (object instanceof Rect) return 'Rectangle';
  return `${object.type} ${index + 1}`;
}

export function FreeformEditor({ documents, artwork: initialArtwork, text: initialText, side: activeSide, overlayHost, onSideChange, onChange, onNotice }: FreeformEditorProps) {
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const sideRef = useRef<Side>(activeSide);
  const documentsRef = useRef<Record<Side, string | null>>({ ...documents });
  const legacyArtworkRef = useRef<Record<Side, string | null>>({ ...initialArtwork });
  const legacyTextRef = useRef<Record<Side, string>>({ ...initialText });
  const onChangeRef = useRef(onChange);
  const noticeRef = useRef(onNotice);
  const debounceRef = useRef<number | undefined>(undefined);
  const restoringRef = useRef(false);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const [side, setSide] = useState<Side>(activeSide);
  const sideChangeRef = useRef(onSideChange);
  const [objects, setObjects] = useState<FabricObject[]>([]);
  const [selected, setSelected] = useState<FabricObject | null>(null);
  const [ink, setInk] = useState('#252a35');
  const [fontSize, setFontSize] = useState(34);
  const [zoom, setZoom] = useState(100);
  const [drawing, setDrawing] = useState(false);
  const [backgroundTolerance, setBackgroundTolerance] = useState(42);
  const [removingBackground, setRemovingBackground] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  onChangeRef.current = onChange;
  noticeRef.current = onNotice;
  sideChangeRef.current = onSideChange;

  const syncLayers = (canvas: Canvas) => {
    setObjects([...canvas.getObjects()]);
    setSelected(canvas.getActiveObject() ?? null);
  };

  const persistCurrent = (canvas: Canvas) => {
    if (restoringRef.current) return;
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const currentSide = sideRef.current;
      try {
        const document = JSON.stringify(canvas.toJSON());
        const artwork = renderPrintArtwork(canvas, currentSide);
        documentsRef.current[currentSide] = document;
        onChangeRef.current({ side: currentSide, artwork, document, textContent: canvas.getObjects().filter((object) => object instanceof IText).map((object) => (object as IText).text ?? '').join(' ').trim() });
        syncLayers(canvas);
      } catch {
        noticeRef.current('Could not render the print preview. Try removing a large image.');
      }
    }, 220);
  };

  const pushHistory = (canvas: Canvas) => {
    const snapshot = JSON.stringify(canvas.toJSON());
    const history = historyRef.current.slice(0, historyIndexRef.current + 1);
    if (history.at(-1) !== snapshot) history.push(snapshot);
    historyRef.current = history;
    historyIndexRef.current = history.length - 1;
  };

  useEffect(() => {
    if (!overlayHost || !canvasHostRef.current) return;
    const element = document.createElement('canvas');
    canvasHostRef.current.appendChild(element);
    const canvas = new Canvas(element, {
      width: 500,
      height: 540,
      preserveObjectStacking: true,
      selection: true,
      controlsAboveOverlay: true,
    });
    canvasRef.current = canvas;
    const onSelection = () => syncLayers(canvas);
    const onModified = () => { pushHistory(canvas); persistCurrent(canvas); };
    const onAdded = () => { if (!restoringRef.current) { pushHistory(canvas); persistCurrent(canvas); } };
    const onRemoved = () => { if (!restoringRef.current) { pushHistory(canvas); persistCurrent(canvas); } };
    canvas.on('selection:created', onSelection);
    canvas.on('selection:updated', onSelection);
    canvas.on('selection:cleared', onSelection);
    canvas.on('object:modified', onModified);
    canvas.on('object:added', onAdded);
    canvas.on('object:removed', onRemoved);
    canvas.on('text:changed', onModified);
    setCanvasReady(true);
    pushHistory(canvas);
    const initial = documentsRef.current[sideRef.current];
    if (initial) {
      restoringRef.current = true;
      void canvas.loadFromJSON(initial).then(() => {
        canvas.requestRenderAll();
        syncLayers(canvas);
        restoringRef.current = false;
        pushHistory(canvas);
      }).catch(() => { restoringRef.current = false; noticeRef.current('The saved print layers could not be opened.'); });
    } else {
      void (async () => {
        const artwork = legacyArtworkRef.current[sideRef.current];
        if (artwork) {
          try { const image = await FabricImage.fromURL(artwork); const box = safeAreas[sideRef.current]; const scale = Math.min(box.width / (image.width || 1), box.height / (image.height || 1), 1); image.set({ left: box.left + (box.width - (image.width || 1) * scale) / 2, top: box.top + (box.height - (image.height || 1) * scale) / 2, scaleX: scale, scaleY: scale, cornerColor: '#e84b35', transparentCorners: false }); canvas.add(image); }
          catch { noticeRef.current('Could not restore the previous uploaded print.'); }
        }
        if (legacyTextRef.current[sideRef.current]) canvas.add(new IText(legacyTextRef.current[sideRef.current], { left: safeAreas[sideRef.current].left + 8, top: safeAreas[sideRef.current].top + safeAreas[sideRef.current].height - 44, width: safeAreas[sideRef.current].width - 16, fontSize: 24, fill: '#252a35', textAlign: 'center', fontWeight: 'bold' }));
        canvas.requestRenderAll();
        syncLayers(canvas);
        pushHistory(canvas);
      })();
    }
    return () => {
      window.clearTimeout(debounceRef.current);
      void canvas.dispose();
      canvasRef.current = null;
    };
  }, [overlayHost]);

  const switchSide = useCallback(async (nextSide: Side, notifyParent = true) => {
    const canvas = canvasRef.current;
    if (!canvas || nextSide === sideRef.current) return;
    window.clearTimeout(debounceRef.current);
    const oldSide = sideRef.current;
    documentsRef.current[oldSide] = JSON.stringify(canvas.toJSON());
    restoringRef.current = true;
    canvas.discardActiveObject();
    canvas.clear();
    sideRef.current = nextSide;
    setSide(nextSide);
    historyRef.current = [];
    historyIndexRef.current = -1;
    const document = documentsRef.current[nextSide];
    if (document) {
      try { await canvas.loadFromJSON(document); } catch { noticeRef.current('Could not load the saved layers for this side.'); }
    } else {
      const artwork = legacyArtworkRef.current[nextSide];
      if (artwork) {
        try { const image = await FabricImage.fromURL(artwork); const box = safeAreas[nextSide]; const scale = Math.min(box.width / (image.width || 1), box.height / (image.height || 1), 1); image.set({ left: box.left + (box.width - (image.width || 1) * scale) / 2, top: box.top + (box.height - (image.height || 1) * scale) / 2, scaleX: scale, scaleY: scale, cornerColor: '#e84b35', transparentCorners: false }); canvas.add(image); }
        catch { noticeRef.current('Could not restore the previous uploaded print.'); }
      }
      if (legacyTextRef.current[nextSide]) canvas.add(new IText(legacyTextRef.current[nextSide], { left: safeAreas[nextSide].left + 8, top: safeAreas[nextSide].top + safeAreas[nextSide].height - 44, width: safeAreas[nextSide].width - 16, fontSize: 24, fill: '#252a35', textAlign: 'center', fontWeight: 'bold' }));
    }
    canvas.requestRenderAll();
    syncLayers(canvas);
    restoringRef.current = false;
    pushHistory(canvas);
    const artwork = renderPrintArtwork(canvas, nextSide);
    onChangeRef.current({ side: nextSide, artwork, document: JSON.stringify(canvas.toJSON()), textContent: canvas.getObjects().filter((object) => object instanceof IText).map((object) => (object as IText).text ?? '').join(' ').trim() });
    if (notifyParent) sideChangeRef.current(nextSide);
  }, []);

  useEffect(() => {
    if (activeSide !== sideRef.current) void switchSide(activeSide, false);
  }, [activeSide, switchSide]);

  const addText = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const box = safeAreas[sideRef.current];
    const text = new IText('Your text', { left: box.left + 8, top: box.top + Math.max(12, box.height / 2 - fontSize / 2), width: box.width - 16, fontSize, fill: ink, fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center', editable: true, cornerColor: '#e84b35', transparentCorners: false, borderColor: '#e84b35' });
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.requestRenderAll();
    syncLayers(canvas);
  };

  const addShape = (shape: 'rect' | 'circle') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const object = shape === 'rect'
      ? new Rect({ left: safeAreas[sideRef.current].left + 10, top: safeAreas[sideRef.current].top + 20, width: safeAreas[sideRef.current].width - 20, height: Math.max(35, safeAreas[sideRef.current].height / 2), fill: ink, rx: 8, ry: 8, cornerColor: '#e84b35', transparentCorners: false })
      : new Circle({ left: safeAreas[sideRef.current].left + safeAreas[sideRef.current].width / 2 - 45, top: safeAreas[sideRef.current].top + 20, radius: 45, fill: ink, cornerColor: '#e84b35', transparentCorners: false });
    canvas.add(object);
    canvas.setActiveObject(object);
    canvas.requestRenderAll();
    syncLayers(canvas);
  };

  const toggleDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const next = !canvas.isDrawingMode;
    if (next) {
      const brush = new PencilBrush(canvas);
      brush.width = 8;
      brush.color = ink;
      canvas.freeDrawingBrush = brush;
    }
    canvas.isDrawingMode = next;
    canvas.selection = !next;
    setDrawing(next);
  };

  const setActiveColor = (value: string) => {
    setInk(value);
    const canvas = canvasRef.current;
    if (canvas?.freeDrawingBrush instanceof PencilBrush) canvas.freeDrawingBrush.color = value;
    const active = canvas?.getActiveObject();
    if (active) {
      active.set('fill', value);
      canvas?.requestRenderAll();
      if (canvas) persistCurrent(canvas);
    }
  };

  const addImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    if (!imageMimeTypes.includes(file.type) || file.size > 4 * 1024 * 1024) {
      noticeRef.current('Choose a PNG, JPG or WebP under 4 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        const image = await FabricImage.fromURL(String(reader.result));
        const box = safeAreas[sideRef.current];
        const scale = Math.min(box.width / (image.width || 1), box.height / (image.height || 1), 1);
        image.set({ left: box.left + (box.width - (image.width || 1) * scale) / 2, top: box.top + (box.height - (image.height || 1) * scale) / 2, scaleX: scale, scaleY: scale, cornerColor: '#e84b35', transparentCorners: false });
        canvas.add(image);
        canvas.setActiveObject(image);
        canvas.requestRenderAll();
        syncLayers(canvas);
      } catch { noticeRef.current('This image could not be opened.'); }
    };
    reader.readAsDataURL(file);
  };

  const removePlainBackground = async () => {
    const canvas = canvasRef.current;
    const source = selected instanceof FabricImage ? selected : null;
    if (!canvas || !source) return;
    setRemovingBackground(true);
    try {
      const sourceElement = source.getElement() as HTMLImageElement;
      const scale = Math.min(1, 1800 / Math.max(sourceElement.naturalWidth || sourceElement.width, sourceElement.naturalHeight || sourceElement.height));
      const width = Math.max(1, Math.round((sourceElement.naturalWidth || sourceElement.width) * scale));
      const height = Math.max(1, Math.round((sourceElement.naturalHeight || sourceElement.height) * scale));
      const work = document.createElement('canvas');
      work.width = width;
      work.height = height;
      const context = work.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas image processing is unavailable.');
      context.drawImage(sourceElement, 0, 0, width, height);
      const imageData = context.getImageData(0, 0, width, height);
      const pixels = imageData.data;
      const visited = new Uint8Array(width * height);
      const queue = new Int32Array(width * height);
      let head = 0;
      let tail = 0;
      const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
      const background = [0, 1, 2].map((channel) => Math.round(corners.reduce((sum, [x, y]) => sum + pixels[(y * width + x) * 4 + channel], 0) / corners.length));
      const tolerance = backgroundTolerance * backgroundTolerance * 3;
      const matches = (index: number) => {
        const offset = index * 4;
        if (pixels[offset + 3] === 0) return true;
        const distance = (pixels[offset] - background[0]) ** 2 + (pixels[offset + 1] - background[1]) ** 2 + (pixels[offset + 2] - background[2]) ** 2;
        return distance <= tolerance;
      };
      const enqueue = (index: number) => {
        if (index < 0 || index >= width * height || visited[index] || !matches(index)) return;
        visited[index] = 1;
        queue[tail++] = index;
      };
      for (let x = 0; x < width; x += 1) { enqueue(x); enqueue((height - 1) * width + x); }
      for (let y = 0; y < height; y += 1) { enqueue(y * width); enqueue(y * width + width - 1); }
      while (head < tail) {
        const index = queue[head++];
        pixels[index * 4 + 3] = 0;
        const x = index % width;
        if (x > 0) enqueue(index - 1);
        if (x + 1 < width) enqueue(index + 1);
        if (index >= width) enqueue(index - width);
        if (index + width < width * height) enqueue(index + width);
      }
      context.putImageData(imageData, 0, 0);
      const replacement = await FabricImage.fromURL(work.toDataURL('image/png'));
      replacement.set({ left: source.left, top: source.top, scaleX: source.scaleX, scaleY: source.scaleY, angle: source.angle, flipX: source.flipX, flipY: source.flipY, opacity: source.opacity, cornerColor: '#e84b35', transparentCorners: false });
      canvas.remove(source);
      canvas.add(replacement);
      canvas.setActiveObject(replacement);
      canvas.requestRenderAll();
      pushHistory(canvas);
      persistCurrent(canvas);
      syncLayers(canvas);
      noticeRef.current(tail ? 'Plain background removed. Inspect the edges and undo if needed.' : 'No plain background pixels were detected at the image edges.');
    } catch (error) {
      noticeRef.current(error instanceof Error ? error.message : 'Background removal failed.');
    } finally {
      setRemovingBackground(false);
    }
  };

  const selectedText = selected instanceof IText ? selected : null;
  const selectedImage = selected instanceof FabricImage ? selected : null;
  const changeSelectedText = (property: 'fill' | 'fontSize' | 'fontFamily' | 'fontWeight', value: string | number) => {
    if (!selectedText) return;
    selectedText.set(property, value);
    if (property === 'fill') setInk(String(value));
    if (property === 'fontSize') setFontSize(Number(value));
    canvasRef.current?.requestRenderAll();
    if (canvasRef.current) persistCurrent(canvasRef.current);
  };
  const deleteSelected = () => {
    const canvas = canvasRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !active) return;
    canvas.remove(active);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    syncLayers(canvas);
  };
  const duplicateSelected = async () => {
    const canvas = canvasRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !active) return;
    const clone = await active.clone();
    clone.set({ left: (active.left ?? 0) + 22, top: (active.top ?? 0) + 22 });
    canvas.add(clone);
    canvas.setActiveObject(clone);
    canvas.requestRenderAll();
    syncLayers(canvas);
  };
  const moveLayer = (object: FabricObject, direction: 'up' | 'down') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (direction === 'up') canvas.bringObjectForward(object);
    else canvas.sendObjectBackwards(object);
    canvas.requestRenderAll();
    pushHistory(canvas);
    persistCurrent(canvas);
    syncLayers(canvas);
  };
  const changeObject = (property: 'angle' | 'opacity', value: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !selected) return;
    selected.set(property, value);
    pushHistory(canvas);
    selected.setCoords();
    canvas.requestRenderAll();
    persistCurrent(canvas);
    syncLayers(canvas);
  };
  const toggleVisibility = (object: FabricObject) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    object.set('visible', !object.visible);
    canvas.requestRenderAll();
    pushHistory(canvas);
    persistCurrent(canvas);
    syncLayers(canvas);
  };
  const changeZoom = (value: number) => {
    setZoom(value);
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setZoom(value / 100);
    canvas.requestRenderAll();
  };
  const toggleLock = () => {
    const canvas = canvasRef.current;
    const active = canvas?.getActiveObject();
    if (!canvas || !active) return;
    const locked = !active.lockMovementX;
    active.set({ lockMovementX: locked, lockMovementY: locked, lockScalingX: locked, lockScalingY: locked, lockRotation: locked, hasControls: !locked, selectable: true, evented: true });
    canvas.requestRenderAll();
    syncLayers(canvas);
    persistCurrent(canvas);
  };
  const restoreHistory = async (direction: -1 | 1) => {
    const canvas = canvasRef.current;
    const next = historyIndexRef.current + direction;
    const snapshot = historyRef.current[next];
    if (!canvas || !snapshot || next < 0 || next >= historyRef.current.length) return;
    historyIndexRef.current = next;
    restoringRef.current = true;
    await canvas.loadFromJSON(snapshot);
    canvas.requestRenderAll();
    syncLayers(canvas);
    restoringRef.current = false;
    persistCurrent(canvas);
  };

  return <section className={`freeform-editor ${overlayHost ? 'freeform-inline-controls' : ''}`} aria-label="Freeform print designer">
    {overlayHost && createPortal(<><div ref={canvasHostRef} /><div className={`garment-safe-guide guide-${side}`} style={{ left: `${safeAreas[side].left / 500 * 100}%`, top: `${safeAreas[side].top / 540 * 100}%`, width: `${safeAreas[side].width / 500 * 100}%`, height: `${safeAreas[side].height / 540 * 100}%` }} /></>, overlayHost)}
    <header className="freeform-heading"><div><span className="eyebrow">FREEFORM STUDIO · {side === 'left' ? 'LEFT SLEEVE' : side === 'right' ? 'RIGHT SLEEVE' : side.toUpperCase()}</span><strong>Edit directly on the T-shirt.</strong></div><div className="freeform-side-tabs">{(['front', 'back', 'left', 'right'] as Side[]).map((item) => <button key={item} className={side === item ? 'active' : ''} onClick={() => void switchSide(item)}>{item === 'left' ? 'Left sleeve' : item === 'right' ? 'Right sleeve' : item}</button>)}</div></header>
    <div className="freeform-toolbar"><button onClick={addText}><Type size={15} /> Add text</button><button onClick={() => imageInputRef.current?.click()}><ImagePlus size={15} /> Add image</button><input ref={imageInputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={addImage} /><button className={drawing ? 'active' : ''} onClick={toggleDrawing}><Pencil size={15} /> {drawing ? 'Stop drawing' : 'Draw'}</button><button onClick={() => addShape('rect')}><Square size={15} /> Rectangle</button><button onClick={() => addShape('circle')}><Plus size={15} /> Circle</button><label className="freeform-color-picker">Color<input type="color" value={ink} onChange={(event) => setActiveColor(event.target.value)} /></label><label className="freeform-zoom">Zoom {zoom}%<input aria-label="Canvas zoom" type="range" min="50" max="200" step="10" value={zoom} onChange={(event) => changeZoom(Number(event.target.value))} /></label><span className="freeform-spacer" /><button aria-label="Undo" disabled={!canvasReady || historyIndexRef.current <= 0} onClick={() => void restoreHistory(-1)}><Undo2 size={15} /></button><button aria-label="Redo" disabled={!canvasReady || historyIndexRef.current >= historyRef.current.length - 1} onClick={() => void restoreHistory(1)}><Redo2 size={15} /></button></div>
    <div className="freeform-workspace">{!overlayHost && <div className="freeform-canvas-wrap"><div className="print-safe-area"><span>PRINT SAFE AREA</span><div ref={canvasHostRef} /></div><small>Drag layers to position · use corner handles to resize · rotate with the top handle</small></div>}
      <aside className="freeform-properties"><div className="freeform-property-title"><strong>{selected ? layerName(selected, objects.indexOf(selected)) : 'No layer selected'}</strong><div>{selected && <><button aria-label="Duplicate layer" onClick={() => void duplicateSelected()}><Copy size={14} /></button><button aria-label="Lock or unlock layer" onClick={toggleLock}>{selected.lockMovementX ? <Lock size={14} /> : <Unlock size={14} />}</button><button aria-label="Delete layer" onClick={deleteSelected}><Trash2 size={14} /></button></>}</div></div>{selectedText && <><label>Text color<input type="color" value={String(selectedText.fill ?? ink)} onChange={(event) => changeSelectedText('fill', event.target.value)} /></label><label>Font size<input type="range" min="12" max="120" value={Number(selectedText.fontSize ?? fontSize)} onChange={(event) => changeSelectedText('fontSize', Number(event.target.value))} /><span>{Number(selectedText.fontSize ?? fontSize)} px</span></label><label>Typeface<select value={String(selectedText.fontFamily ?? 'Arial')} onChange={(event) => changeSelectedText('fontFamily', event.target.value)}><option>Arial</option><option>Georgia</option><option>Impact</option><option>Courier New</option><option>Trebuchet MS</option></select></label></>}{selected && <><label>Layer color<input type="color" value={String(selected.fill ?? ink)} onChange={(event) => { setInk(event.target.value); selected.set('fill', event.target.value); canvasRef.current?.requestRenderAll(); if (canvasRef.current) persistCurrent(canvasRef.current); }} /></label><label>Rotation<input type="range" min="-180" max="180" value={Math.round(selected.angle ?? 0)} onChange={(event) => changeObject('angle', Number(event.target.value))} /><span>{Math.round(selected.angle ?? 0)}°</span></label><label>Opacity<input type="range" min="0.1" max="1" step="0.05" value={selected.opacity ?? 1} onChange={(event) => changeObject('opacity', Number(event.target.value))} /><span>{Math.round((selected.opacity ?? 1) * 100)}%</span></label><div className="layer-order-buttons"><button onClick={() => moveLayer(selected, 'up')}><ArrowUp size={13} /> Bring forward</button><button onClick={() => moveLayer(selected, 'down')}><ArrowDown size={13} /> Send backward</button></div></>}
      <div className="layer-list-heading"><strong>Layers</strong><span>{objects.length}</span></div><div className="freeform-layer-list">{objects.map((object, index) => <div key={`${index}-${object.type}`} className={`freeform-layer-row ${selected === object ? 'active' : ''}`}><button className="freeform-layer-select" onClick={() => { canvasRef.current?.setActiveObject(object); canvasRef.current?.requestRenderAll(); syncLayers(canvasRef.current!); }}><span>{layerName(object, index)}</span></button><button className="freeform-layer-visibility" aria-label={`${object.visible ? 'Hide' : 'Show'} ${layerName(object, index)}`} onClick={() => toggleVisibility(object)}>{object.visible ? <Eye size={13} /> : <EyeOff size={13} />}</button>{object.lockMovementX && <Lock size={12} />}</div>)}</div><button className="clear-selection" onClick={() => { canvasRef.current?.discardActiveObject(); canvasRef.current?.requestRenderAll(); if (canvasRef.current) syncLayers(canvasRef.current); }}><X size={13} /> Deselect</button></aside>
    </div>
    {selectedImage && <div className="background-removal"><div><strong>Remove plain background</strong><small>Runs on this device. Best for solid-color backgrounds; inspect cutout and undo if needed.</small></div><label>Tolerance<input type="range" min="10" max="100" value={backgroundTolerance} onChange={(event) => setBackgroundTolerance(Number(event.target.value))} /></label><button disabled={removingBackground} onClick={() => void removePlainBackground()}><Eraser size={14} /> {removingBackground ? 'Removing…' : 'Remove background'}</button></div>}
    <p className="freeform-note"><RotateCcw size={13} /> Drag and edit directly on the shirt. Switch front or back to add independent print layers. Use Choose ELOW for side detail. The dashed outline marks the printable area.</p>
  </section>;
}
