/* @prototype-ported */
const React = window.React;
const { BottomSheet, Btn, Chip, Icon, useEscapeClose } = window;

/* global React, Btn, Chip, Icon, BottomSheet, useEscapeClose */
// RealCloset — 바로 보기: 전신 사진에서 옷을 비우고, 카메라로 실제 옷에 겹쳐 본다.
// 설정은 바텀시트(서비스 안). 사진 없으면 프로필처럼 바로 앨범을 연다.

const { useState, useEffect, useLayoutEffect, useRef } = React;

function loadImage(src, cors = false) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // 저장소에서 온 전신 이미지는 다른 도메인이라, CORS 없이 캔버스에 그리면 캔버스가
    // 오염돼 toDataURL이 막힌다(구멍을 못 뚫는다). 로컬 data URL에는 영향이 없다.
    if (cors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('사진을 열지 못했어요'));
    img.src = src;
  });
}

function readBodyFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('사진을 읽지 못했어요'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('사진을 열지 못했어요'));
      img.onload = () => {
        const max = 1280;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function punchPreset(ctx, w, h, cut) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  if (cut === 'top') {
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.36, w * 0.28, h * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (cut === 'bottom') {
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.62, w * 0.24, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function lumaOf(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function sampleBackdrop(data, W, H, dx, dy, dw, dh) {
  // 생성본 배경은 #F2F1EE가 아닐 때가 많다. 모서리에서 실제 판색을 읽어 양옆을 맞춘다.
  const inset = Math.max(2, Math.round(Math.min(dw, dh) * 0.02));
  const pts = [
    [dx + inset, dy + inset],
    [dx + dw - inset - 1, dy + inset],
    [dx + inset, dy + dh - inset - 1],
    [dx + dw - inset - 1, dy + dh - inset - 1],
    [dx + inset, dy + Math.round(dh * 0.45)],
    [dx + dw - inset - 1, dy + Math.round(dh * 0.45)],
    [dx + Math.round(dw * 0.5), dy + inset],
  ];
  let r = 0, g = 0, b = 0, n = 0;
  for (let p = 0; p < pts.length; p += 1) {
    const x = pts[p][0];
    const y = pts[p][1];
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const i = (y * W + x) * 4;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n += 1;
  }
  if (!n) return { r: 242, g: 241, b: 238 };
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

function isPlatePixel(r, g, b, plate) {
  const dr = Math.abs(r - plate.r) + Math.abs(g - plate.g) + Math.abs(b - plate.b);
  if (dr < 46) return true;
  const L = lumaOf(r, g, b);
  return L > 198 && (Math.max(r, g, b) - Math.min(r, g, b)) < 28;
}

function isSkinPixel(r, g, b) {
  const L = lumaOf(r, g, b);
  return r > 88 && r > b + 8 && r >= g - 8 && L > 72 && L < 210;
}

function isGarmentPixel(r, g, b, plate) {
  if (isPlatePixel(r, g, b, plate) || isSkinPixel(r, g, b)) return false;
  const L = lumaOf(r, g, b);
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  if (L > 178 && chroma < 26) return false;
  return L < 205;
}

function garmentBand(mode) {
  // 소매·기장이 밴드 밖으로 나가면 구멍이 직선으로 잘린다. 밑단은 발끝까지.
  if (mode === 'top') return { y0: 0.16, y1: 0.58, x0: 0.06, x1: 0.94 };
  if (mode === 'bottom') return { y0: 0.44, y1: 0.995, x0: 0.08, x1: 0.92 };
  return { y0: 0.16, y1: 0.995, x0: 0.06, x1: 0.94 };
}

function punchGarmentMask(srcData, W, H, dx, dy, dw, dh, mode, plate) {
  const band = garmentBand(mode);
  const x0 = Math.max(0, Math.floor(dx + dw * band.x0));
  const x1 = Math.min(W, Math.ceil(dx + dw * band.x1));
  const y0 = Math.max(0, Math.floor(dy + dh * band.y0));
  const y1 = Math.min(H, Math.ceil(dy + dh * band.y1));
  const yBot = Math.min(H, dy + dh);
  const punch = new Uint8Array(W * H);
  const src = srcData.data;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * W + x) * 4;
      if (isGarmentPixel(src[i], src[i + 1], src[i + 2], plate)) punch[y * W + x] = 1;
    }
  }
  const dilate = 4;
  const grown = new Uint8Array(W * H);
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      if (!punch[y * W + x]) continue;
      for (let oy = -dilate; oy <= dilate; oy += 1) {
        for (let ox = -dilate; ox <= dilate; ox += 1) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          grown[ny * W + nx] = 1;
        }
      }
    }
  }
  // 하의·전체: 옷이 잡힌 맨 아래부터 발 아래까지 같은 폭으로 더 뚫어 밑단 잔여를 없앤다.
  if (mode === 'bottom' || mode === 'full') {
    let minX = x1;
    let maxX = x0;
    let maxY = y0;
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        if (!grown[y * W + x]) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (maxY > y0 && maxX > minX) {
      const padX = Math.max(4, Math.round((maxX - minX) * 0.05));
      const xL = Math.max(0, minX - padX);
      const xR = Math.min(W, maxX + padX + 1);
      for (let y = maxY; y < yBot; y += 1) {
        for (let x = xL; x < xR; x += 1) grown[y * W + x] = 1;
      }
    }
  }
  return grown;
}

async function punchBody(src, mode, stageW, stageH) {
  const img = await loadImage(src, !src.startsWith('data:'));
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const sw = Math.max(2, Math.round(stageW || iw));
  const sh = Math.max(2, Math.round(stageH || ih));
  const scale = Math.min(sw / iw, sh / ih);
  const dw = Math.max(1, Math.round(iw * scale));
  const dh = Math.max(1, Math.round(ih * scale));
  const dx = Math.round((sw - dw) / 2);
  const dy = Math.round((sh - dh) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, dx, dy, dw, dh);
  const sampled = ctx.getImageData(0, 0, sw, sh);
  const plate = sampleBackdrop(sampled.data, sw, sh, dx, dy, dw, dh);
  ctx.fillStyle = `rgb(${plate.r},${plate.g},${plate.b})`;
  ctx.fillRect(0, 0, sw, sh);
  ctx.drawImage(img, dx, dy, dw, dh);
  const filled = ctx.getImageData(0, 0, sw, sh);

  const punch = punchGarmentMask(filled, sw, sh, dx, dy, dw, dh, mode, plate);
  const out = ctx.createImageData(sw, sh);
  for (let i = 0; i < punch.length; i += 1) {
    if (!punch[i]) continue;
    const o = i * 4;
    out.data[o] = 255;
    out.data[o + 1] = 255;
    out.data[o + 2] = 255;
    out.data[o + 3] = 255;
  }
  const mask = document.createElement('canvas');
  mask.width = sw;
  mask.height = sh;
  mask.getContext('2d').putImageData(out, 0, 0);
  const soft = document.createElement('canvas');
  soft.width = sw;
  soft.height = sh;
  const sctx = soft.getContext('2d');
  sctx.filter = 'blur(1.8px)';
  sctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(soft, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  return canvas.toDataURL('image/png');
}

// 카메라에서 부위를 바꿀 때마다 새로 뚫는다. 캔버스 한 번이면 되니 전환이 즉시다.
const TRYON_MODES = [
  { id: 'top', label: '상의' },
  { id: 'bottom', label: '하의' },
  { id: 'full', label: '전체' },
];

function MobileOnlyNote() {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 10px', borderRadius: 'var(--r-pill)',
      background: 'var(--ivory)', color: 'var(--ink-2)',
      fontSize: 11.5, fontWeight: 700, letterSpacing: '0.01em',
      boxShadow: 'inset 0 0 0 1px var(--line)',
    }}>
      <Icon name="camera" size={13} stroke={2} />
      휴대폰 카메라 전용
    </div>
  );
}

/* ============================================================
   TryOnSetupOverlay — 바텀시트. 사진 고르기 → 비우기 → 저장
   ============================================================ */
function TryOnSetupOverlay({ open, onClose, initialBody, initialFrame, initialCut, seedBody, onSave, wide, making }) {
  const [phase, setPhase] = useState('idle'); // idle | cut
  const [bodySrc, setBodySrc] = useState('');
  const [cut, setCut] = useState('top');
  const [tool, setTool] = useState('erase');
  const [brush, setBrush] = useState(36);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [bootKey, setBootKey] = useState(0);
  const canvasRef = useRef(null);
  const baseRef = useRef(null);
  const drawing = useRef(false);
  const fileRef = useRef(null);
  const pendingPunch = useRef(null);
  const autoPicked = useRef(false);

  useEscapeClose(open && phase !== 'cut', onClose);

  useEffect(() => {
    if (!open) {
      autoPicked.current = false;
      return undefined;
    }
    setError('');
    setChecking(false);
    setTool('erase');
    if (making) {
      setPhase('idle');
      setBodySrc('');
      return undefined;
    }
    // 상의·하의를 체크무늬로 지우는 단계는 쓰지 않는다. 사진만 넘기고 카메라가 구멍을 뚫는다.
    if (seedBody) {
      onSave({ body: seedBody, frame: seedBody, cut: 'auto' });
      return undefined;
    }
    if (initialBody && initialFrame) {
      onSave({ body: initialBody, frame: initialFrame, cut: initialCut || 'auto' });
      return undefined;
    }
    setBodySrc('');
    setCut('top');
    setPhase('idle');
    baseRef.current = null;
    return undefined;
  }, [open, initialBody, initialFrame, initialCut, seedBody, making]);

  useEffect(() => {
    if (!open || phase !== 'cut' || !bodySrc) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const body = await loadImage(bodySrc);
        if (cancelled) return;
        baseRef.current = body;
        const c = canvasRef.current;
        if (!c) return;
        const w = body.naturalWidth || body.width;
        const h = body.naturalHeight || body.height;
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        if (initialFrame && !pendingPunch.current && bodySrc === initialBody) {
          const framed = await loadImage(initialFrame);
          if (cancelled) return;
          ctx.drawImage(framed, 0, 0, w, h);
        } else {
          ctx.drawImage(body, 0, 0);
          if (pendingPunch.current === 'top' || pendingPunch.current === 'bottom') {
            punchPreset(ctx, w, h, pendingPunch.current);
          }
          pendingPunch.current = null;
        }
      } catch (e) {
        if (!cancelled) setError('사진을 준비하지 못했어요.');
      }
    })();
    return () => { cancelled = true; };
  }, [open, phase, bodySrc, bootKey, initialFrame, initialBody]);

  const onPick = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) {
      // 앨범에서 취소했고 아직 사진이 없으면 시트도 닫아 프로필 업로드와 비슷한 감각
      if (!bodySrc && phase === 'idle') onClose();
      return;
    }
    setError('');
    setChecking(true);
    try {
      const dataUrl = await readBodyFile(file);
      const faces = window.countFacesInImage
        ? await window.countFacesInImage(dataUrl)
        : -1;
      if (faces === 0) {
        setError('얼굴이 잘 나온 사진으로 올려주세요.');
        setPhase('idle');
        return;
      }
      if (faces > 1) {
        setError('한 명만 나온 사진을 선택해주세요.');
        setPhase('idle');
        return;
      }
      onSave({ body: dataUrl, frame: dataUrl, cut: 'auto' });
    } catch (err) {
      setError(err.message || '사진을 확인하지 못했어요.');
      setPhase('idle');
    } finally {
      setChecking(false);
    }
  };

  const canvasPoint = (e) => {
    const c = canvasRef.current;
    if (!c) return null;
    const rect = c.getBoundingClientRect();
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
    const x = ((t.clientX - rect.left) / rect.width) * c.width;
    const y = ((t.clientY - rect.top) / rect.height) * c.height;
    return { x, y };
  };

  const strokeAt = (x, y) => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const r = brush * (c.width / Math.max(c.getBoundingClientRect().width, 1));
    if (tool === 'erase') {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (baseRef.current) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(baseRef.current, 0, 0);
      ctx.restore();
    }
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    drawing.current = true;
    try { e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    const p = canvasPoint(e);
    if (p) strokeAt(p.x, p.y);
  };
  const onPointerMove = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = canvasPoint(e);
    if (p) strokeAt(p.x, p.y);
  };
  const onPointerUp = () => { drawing.current = false; };

  const resetFromBase = () => {
    const c = canvasRef.current;
    const img = baseRef.current;
    if (!c || !img) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    if (cut === 'top' || cut === 'bottom') punchPreset(ctx, c.width, c.height, cut);
  };

  const applyCutMode = (mode) => {
    setCut(mode);
    const c = canvasRef.current;
    const img = baseRef.current;
    if (!c || !img) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    if (mode === 'top' || mode === 'bottom') punchPreset(ctx, c.width, c.height, mode);
  };

  const save = () => {
    const c = canvasRef.current;
    if (!c || !bodySrc) return;
    onSave({ body: bodySrc, frame: c.toDataURL('image/png'), cut });
  };

  return (
    <BottomSheet open={open} onClose={onClose} dismissOnScrim={phase !== 'cut' || !checking}>
      <div style={{ padding: '8px 24px 26px' }}>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{ display: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>바로 보기</div>
          <button type="button" onClick={onClose} aria-label="닫기" className="lb-iconbtn"
            style={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', marginRight: -8 }}>
            <Icon name="x" size={20} />
          </button>
        </div>

        {phase === 'idle' && (
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            {making ? (
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-2)' }}>바로 보기 이미지를 만들고 있어요…</div>
            ) : checking ? (
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-2)' }}>사진 확인 중…</div>
            ) : (
              <>
                <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5, wordBreak: 'keep-all' }}>
                  얼굴이 나온 사진 한 장이면, 옷 자리만 비워 매장에서 바로 볼 수 있어요.
                </p>
                {error && (
                  <div style={{
                    marginBottom: 14, padding: '10px 12px', borderRadius: 'var(--r-sm)', textAlign: 'left',
                    background: 'color-mix(in srgb, #B0573C 10%, transparent)', color: '#9D472F',
                    fontSize: 12.5, fontWeight: 600, lineHeight: 1.45,
                  }}>{error}</div>
                )}
                <Btn full size="lg" icon="camera" onClick={() => fileRef.current && fileRef.current.click()}>
                  프로필 사진 올리기
                </Btn>
                {wide && (
                  <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.45 }}>
                    카메라로 비추기는 휴대폰에서만 열려요.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {phase === 'cut' && (
          <div>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.45, wordBreak: 'keep-all' }}>
              비울 옷을 고르고, 필요하면 문질러 다듬어요.
            </p>
            {error && (
              <div style={{
                marginBottom: 12, padding: '10px 12px', borderRadius: 'var(--r-sm)',
                background: 'color-mix(in srgb, #B0573C 10%, transparent)', color: '#9D472F',
                fontSize: 12.5, fontWeight: 600, lineHeight: 1.45,
              }}>{error}</div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <Chip active={cut === 'top'} onClick={() => applyCutMode('top')}>상의</Chip>
              <Chip active={cut === 'bottom'} onClick={() => applyCutMode('bottom')}>하의</Chip>
              <Chip active={tool === 'erase'} onClick={() => setTool('erase')}>지우기</Chip>
              <Chip active={tool === 'restore'} onClick={() => setTool('restore')}>되돌리기</Chip>
            </div>
            <div style={{
              position: 'relative', width: '100%', maxHeight: 'min(52dvh, 420px)', overflow: 'auto',
              borderRadius: 'var(--r-lg)',
              background: 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 16px 16px',
              boxShadow: 'inset 0 0 0 1px var(--line)',
              touchAction: 'none',
            }}>
              <canvas
                ref={canvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onPointerLeave={onPointerUp}
                style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair', touchAction: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', flex: 'none' }}>붓</span>
              <input type="range" min={16} max={72} value={brush} onChange={(e) => setBrush(Number(e.target.value))} style={{ flex: 1 }} />
              <button type="button" onClick={resetFromBase} className="lb-btn"
                style={{ flex: 'none', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', background: 'transparent', padding: '6px 4px' }}>
                초기화
              </button>
            </div>
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Btn full size="lg" icon="check" onClick={save}>{wide ? '저장하기' : '저장하고 보기'}</Btn>
              <button type="button" onClick={() => fileRef.current && fileRef.current.click()} className="lb-btn"
                style={{ width: '100%', background: 'transparent', color: 'var(--ink-2)', fontSize: 13.5, fontWeight: 600, padding: 8 }}>
                다른 사진 고르기
              </button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

/* ============================================================
   TryOnCameraOverlay — 후면 카메라 + 투명 프레임 오버레이
   ============================================================ */
function TryOnCameraOverlay({ open, frameSrc, bodySrc, onClose, onEdit, wide }) {
  const videoRef = useRef(null);
  const stageRef = useRef(null);
  const streamRef = useRef(null);
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState('top');
  const [overlay, setOverlay] = useState('');
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const swipeX = useRef(null);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const el = stageRef.current;
    if (!el) return undefined;
    const measure = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    return () => { if (ro) ro.disconnect(); };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let dead = false;
    const src = bodySrc || frameSrc;
    if (!src) { setOverlay(''); return undefined; }
    if (!bodySrc) { setOverlay(frameSrc || ''); return undefined; }
    const w = stage.w || (typeof window !== 'undefined' ? window.innerWidth : 0);
    const h = stage.h || (typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.62) : 0);
    if (!w || !h) return undefined;
    punchBody(bodySrc, mode, w, h)
      .then((url) => { if (!dead) setOverlay(url); })
      .catch(() => { if (!dead) setOverlay(frameSrc || ''); });
    return () => { dead = true; };
  }, [open, bodySrc, frameSrc, mode, stage.w, stage.h]);

  const shiftMode = (dir) => {
    const i = TRYON_MODES.findIndex((m) => m.id === mode);
    const next = TRYON_MODES[(i + dir + TRYON_MODES.length) % TRYON_MODES.length];
    setMode(next.id);
  };

  useEscapeClose(open, onClose);

  const stop = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setReady(false);
  };

  const start = async () => {
    stop();
    setErr('');
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErr('이 브라우저에서는 카메라를 열 수 없어요.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 1920 },
        },
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play();
        setReady(true);
      }
    } catch (e) {
      setErr('카메라 권한이 필요해요. 설정에서 허용한 뒤 다시 시도해주세요.');
    }
  };

  useEffect(() => {
    if (!open) { stop(); return undefined; }
    if (wide) return undefined;
    start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, wide]);

  if (!open) return null;

  if (wide) {
    return (
      <div style={{
        position: 'absolute', inset: 0, zIndex: 100,
        background: 'rgba(28, 26, 22, 0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{
          width: '100%', maxWidth: 360, background: 'var(--surface)', borderRadius: 'var(--r-lg)',
          padding: '28px 24px', textAlign: 'center', boxShadow: 'var(--pop-shadow)',
        }}>
          <MobileOnlyNote />
          <div style={{ fontSize: 18, fontWeight: 800, margin: '16px 0 10px', lineHeight: 1.3 }}>
            매장에서는 휴대폰으로 열어주세요
          </div>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, wordBreak: 'keep-all' }}>
            카메라로 옷을 비춰 보는 기능은 모바일에서만 쓸 수 있어요.
          </p>
          <Btn full size="lg" onClick={onClose} style={{ marginTop: 22 }}>알겠어요</Btn>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="바로 보기 카메라"
      style={{
        position: 'absolute', inset: 0, zIndex: 100,
        background: '#111',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{
        flex: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 14px 10px',
        color: '#fff', zIndex: 2,
      }}>
        <button type="button" onClick={onClose} aria-label="닫기"
          style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.14)', color: '#fff' }}>
          <Icon name="x" size={22} />
        </button>
        <div style={{ fontSize: 14, fontWeight: 700 }}>
          {bodySrc ? `${(TRYON_MODES.find((m) => m.id === mode) || {}).label}에 맞춰 보세요` : '구멍을 옷에 맞춰 보세요'}
        </div>
        <button type="button" onClick={onEdit} aria-label="사진 수정"
          style={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.14)', color: '#fff' }}>
          <Icon name="pencil" size={18} />
        </button>
      </div>

      <div
        ref={stageRef}
        style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden', touchAction: 'pan-y', background: '#F2F1EE' }}
        onPointerDown={(e) => { swipeX.current = e.clientX; }}
        onPointerUp={(e) => {
          if (swipeX.current == null) return;
          const dx = e.clientX - swipeX.current;
          swipeX.current = null;
          if (Math.abs(dx) > 48) shiftMode(dx < 0 ? 1 : -1);
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover',
          }}
        />
        {overlay && (
          <img
            src={overlay}
            alt=""
            draggable={false}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'fill', pointerEvents: 'none',
            }}
          />
        )}
        {!ready && !err && (
          <div style={{
            position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
            color: 'rgba(255,255,255,0.8)', fontSize: 13.5, fontWeight: 600,
          }}>
            카메라 여는 중…
          </div>
        )}
        {err && (
          <div style={{
            position: 'absolute', left: 18, right: 18, top: '40%',
            padding: '14px 16px', borderRadius: 'var(--r-md)',
            background: 'rgba(0,0,0,0.72)', color: '#fff',
            fontSize: 13.5, lineHeight: 1.5, textAlign: 'center', fontWeight: 600,
          }}>{err}</div>
        )}
      </div>

      <div style={{
        flex: 'none',
        padding: '14px 18px max(env(safe-area-inset-bottom), 18px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.55))',
        color: 'rgba(255,255,255,0.9)',
      }}>
        {bodySrc ? (
          <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 999, background: 'rgba(255,255,255,0.12)' }}>
            {TRYON_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                aria-pressed={mode === m.id}
                style={{
                  padding: '8px 18px', borderRadius: 999, fontSize: 13.5, fontWeight: 700,
                  background: mode === m.id ? '#fff' : 'transparent',
                  color: mode === m.id ? '#1a1814' : 'rgba(255,255,255,0.85)',
                  transition: 'background var(--dur) var(--ease), color var(--dur) var(--ease)',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        ) : null}
        <p style={{ margin: 0, fontSize: 12.5, textAlign: 'center', lineHeight: 1.45, opacity: 0.85, wordBreak: 'keep-all' }}>
          {bodySrc ? '좌우로 넘기거나 눌러서 비출 부위를 바꿔요.' : '뚫린 부분에 옷을 맞추면 색 조합이 바로 보여요.'}
        </p>
        <button
            type="button"
            onClick={onEdit}
            style={{
              width: '100%', padding: '14px 12px', borderRadius: 'var(--r-pill)',
              background: '#fff', color: '#1a1814',
              fontSize: 14, fontWeight: 700,
            }}
          >
            사진 다시 고르기
          </button>
      </div>
    </div>
  );
}

function TryOnDesktopSheet({ open, onClose }) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div style={{ padding: '10px 24px 26px', textAlign: 'center' }}>
        <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'center' }}><MobileOnlyNote /></div>
        <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.3 }}>휴대폰으로 열어주세요</div>
        <p style={{ margin: '10px auto 0', maxWidth: 300, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, wordBreak: 'keep-all' }}>
          매장에서 옷을 비춰 보는 기능이라 휴대폰에서만 쓸 수 있어요.
        </p>
        <Btn full size="lg" onClick={onClose} style={{ marginTop: 22 }}>알겠어요</Btn>
      </div>
    </BottomSheet>
  );
}

Object.assign(window, { TryOnSetupOverlay, TryOnCameraOverlay, TryOnDesktopSheet, readBodyFile });
