'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import styles from './page.module.css';

/* ══════════════════════════════════════════════════
   TYPES & CONSTANTS
══════════════════════════════════════════════════ */
const PETALS_SRC = ['🌸', '🌺', '🌹', '✨', '💫', '🌸', '💕'] as const;
const WORDS      = ['I', 'Love', 'You', 'Baby', '❤️'] as const;

interface PetalItem {
  id: number; emoji: string;
  left: string; fontSize: string;
  duration: number; delay: number;
}
interface BGParticle {
  x: number; y: number; vx: number; vy: number;
  size: number; alpha: number; type: 'heart' | 'star';
  rot: number; rotV: number; hue: number; sat: number; lit: number;
}
interface TrailHeart {
  x: number; y: number; vx: number; vy: number;
  alpha: number; size: number; hue: number;
}
interface Rocket {
  x: number; y: number; tx: number; ty: number;
  vx: number; vy: number; hue: number;
  trail: { x: number; y: number }[];
  done: boolean;
}
interface Spark {
  x: number; y: number; vx: number; vy: number;
  alpha: number; hue: number; size: number;
  gravity: number; type: 'heart' | 'circle';
}

let _pid = 0;
function rand(a: number, b: number) { return a + Math.random() * (b - a); }

function makeBGParticle(w: number, h: number, init = false): BGParticle {
  return {
    x: rand(0, w),
    // weight spawn toward bottom half for scattered-from-below look
    y: init ? rand(0, h) : h + rand(5, 20),
    vx: rand(-0.18, 0.18),
    vy: rand(-0.45, -0.05),   // slow upward drift only
    size: rand(6, 16),
    alpha: rand(0.22, 0.68),
    type: Math.random() < 0.55 ? 'heart' : 'star',
    rot: rand(0, Math.PI * 2),
    rotV: rand(-0.01, 0.01),
    hue: rand(288, 345),      // purple → pink range to match reference
    sat: rand(45, 75),
    lit: rand(52, 72),
  };
}

function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.35);
  ctx.bezierCurveTo(x, y - r * 0.3, x - r, y - r * 0.3, x - r, y + r * 0.15);
  ctx.bezierCurveTo(x - r, y + r * 0.6, x, y + r, x, y + r);
  ctx.bezierCurveTo(x, y + r, x + r, y + r * 0.6, x + r, y + r * 0.15);
  ctx.bezierCurveTo(x + r, y - r * 0.3, x, y - r * 0.3, x, y + r * 0.35);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r1: number, r2: number, pts: number, color: string) {
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const angle = (i * Math.PI) / pts - Math.PI / 2;
    const r = i % 2 === 0 ? r2 : r1;
    if (i === 0) ctx.moveTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
    else ctx.lineTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/* ══════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════ */
export default function LoveYouPage() {
  const cursorRef   = useRef<HTMLDivElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const fwCanvasRef = useRef<HTMLCanvasElement>(null);

  const mxRef     = useRef(typeof window !== 'undefined' ? window.innerWidth / 2 : 400);
  const myRef     = useRef(typeof window !== 'undefined' ? window.innerHeight / 2 : 400);
  const lastMxRef = useRef(0);
  const lastMyRef = useRef(0);
  const WRef = useRef(0);
  const HRef = useRef(0);

  const bgParticlesRef = useRef<BGParticle[]>([]);
  const bgTrailsRef    = useRef<TrailHeart[]>([]);
  const bgAnimRef      = useRef(0);

  const rocketsRef   = useRef<Rocket[]>([]);
  const sparksRef    = useRef<Spark[]>([]);
  const fwRunningRef = useRef(false);
  const fwAnimRef    = useRef(0);
  const fwTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [giftOpened,     setGiftOpened]     = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [petals,         setPetals]         = useState<PetalItem[]>([]);
  const [wordsShown,     setWordsShown]     = useState(0);
  const [msgStage,       setMsgStage]       = useState(0);

  /* ── Resize both canvases ── */
  useEffect(() => {
    const resize = () => {
      WRef.current = window.innerWidth;
      HRef.current = window.innerHeight;
      if (bgCanvasRef.current) { bgCanvasRef.current.width = WRef.current; bgCanvasRef.current.height = HRef.current; }
      if (fwCanvasRef.current) { fwCanvasRef.current.width = WRef.current; fwCanvasRef.current.height = HRef.current; }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  /* ── Background particle system ── */
  useEffect(() => {
    bgParticlesRef.current = Array.from({ length: 100 }, () =>
      makeBGParticle(window.innerWidth, window.innerHeight, true)
    );

    const loop = () => {
      const canvas = bgCanvasRef.current;
      if (!canvas) { bgAnimRef.current = requestAnimationFrame(loop); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx)   { bgAnimRef.current = requestAnimationFrame(loop); return; }

      const w = canvas.width, h = canvas.height;
      const mx = mxRef.current, my = myRef.current;

      ctx.clearRect(0, 0, w, h);

      // Subtle ambient glow near cursor
      const grd = ctx.createRadialGradient(mx, my, 0, mx, my, 180);
      grd.addColorStop(0, 'rgba(200,60,180,.05)');
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      // Update & draw particles
      const next: BGParticle[] = [];
      for (const p of bgParticlesRef.current) {
        const dx = mx - p.x, dy = my - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        let { vx, vy } = p;
        if (dist < 200) { vx += (dx / dist) * 0.014; vy += (dy / dist) * 0.014; }
        const nx = p.x + vx, ny = p.y + vy;
        const alpha = p.alpha - 0.0008;
        if (alpha <= 0 || ny < -30) { next.push(makeBGParticle(w, h, false)); continue; }
        const np: BGParticle = { ...p, x: nx, y: ny, vx, vy, rot: p.rot + p.rotV, alpha };
        next.push(np);
        ctx.save();
        ctx.globalAlpha = Math.max(0, np.alpha);
        ctx.translate(np.x, np.y);
        ctx.rotate(np.rot);
        if (np.type === 'heart') drawHeart(ctx, 0, 0, np.size, `hsl(${np.hue},${np.sat}%,${np.lit}%)`);
        else drawStar(ctx, 0, 0, np.size * 0.45, np.size, 5, `hsl(${np.hue},${np.sat}%,${np.lit}%)`);
        ctx.restore();
      }
      bgParticlesRef.current = next;

      // Trail hearts from mouse move
      const nextT: TrailHeart[] = [];
      for (const t of bgTrailsRef.current) {
        const nt: TrailHeart = { ...t, x: t.x + t.vx, y: t.y + t.vy, alpha: t.alpha - 0.028 };
        if (nt.alpha <= 0) continue;
        nextT.push(nt);
        ctx.save();
        ctx.globalAlpha = Math.max(0, nt.alpha);
        drawHeart(ctx, nt.x, nt.y, nt.size, `hsl(${nt.hue},82%,66%)`);
        ctx.restore();
      }
      bgTrailsRef.current = nextT;

      bgAnimRef.current = requestAnimationFrame(loop);
    };
    bgAnimRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(bgAnimRef.current);
  }, []);

  /* ── Mouse: move cursor + spawn trail hearts ── */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mxRef.current = e.clientX; myRef.current = e.clientY;
      if (cursorRef.current) {
        cursorRef.current.style.left = e.clientX + 'px';
        cursorRef.current.style.top  = e.clientY + 'px';
      }
      if (Math.abs(e.clientX - lastMxRef.current) + Math.abs(e.clientY - lastMyRef.current) > 8) {
        bgTrailsRef.current.push({
          x: e.clientX, y: e.clientY,
          vx: rand(-0.5, 0.5), vy: rand(-1.6, -0.6),
          alpha: 1, size: rand(5, 13), hue: rand(305, 345),
        });
        lastMxRef.current = e.clientX; lastMyRef.current = e.clientY;
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  /* ── Click sparkle ── */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element;
      if (document.getElementById('gift-box')?.contains(t)) return;
      if (document.getElementById('close-btn')?.contains(t)) return;
      for (let i = 0; i < 10; i++) {
        const el = document.createElement('div');
        el.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;font-size:${rand(12,20)}px;pointer-events:none;z-index:9998;transform:translate(-50%,-50%);`;
        el.textContent = ['💖','✨','💫','🌸','♥'][Math.floor(Math.random() * 5)];
        document.body.appendChild(el);
        const angle = rand(0, Math.PI * 2), dist = rand(30, 80);
        el.animate([
          { transform:`translate(-50%,-50%) translate(0,0) scale(1)`, opacity:'1' },
          { transform:`translate(-50%,-50%) translate(${Math.cos(angle)*dist}px,${Math.sin(angle)*dist}px) scale(0)`, opacity:'0' },
        ], { duration: rand(500, 900), easing: 'ease-out', fill: 'forwards' }).onfinish = () => el.remove();
      }
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  /* ── Floating petals ── */
  useEffect(() => {
    const spawn = () => {
      const id = _pid++, dur = rand(6, 14);
      setPetals(p => [...p, {
        id, emoji: PETALS_SRC[Math.floor(Math.random() * PETALS_SRC.length)],
        left: rand(0, 100) + 'vw', fontSize: rand(0.7, 1.5) + 'rem',
        duration: dur, delay: rand(0, dur),
      }]);
      setTimeout(() => setPetals(p => p.filter(x => x.id !== id)), (dur + 3) * 1000);
    };
    for (let i = 0; i < 18; i++) spawn();
    const iv = setInterval(spawn, 2400);
    return () => clearInterval(iv);
  }, []);

  /* ── Fireworks ── */
  const stopFireworks = useCallback(() => {
    fwRunningRef.current = false;
    if (fwTimerRef.current) clearTimeout(fwTimerRef.current);
    setTimeout(() => {
      const c = fwCanvasRef.current;
      if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    }, 1200);
  }, []);

  const startFireworks = useCallback(() => {
    if (fwRunningRef.current) return;
    fwRunningRef.current = true;

    const launchRocket = () => {
      const w = WRef.current, h = HRef.current;
      const x = rand(w * 0.2, w * 0.8), y = h + 10;
      const tx = rand(w * 0.15, w * 0.85), ty = rand(h * 0.1, h * 0.45);
      const dx = tx - x, dy = ty - y, len = Math.hypot(dx, dy);
      const spd = rand(9, 15);
      rocketsRef.current.push({ x, y, tx, ty, vx: dx/len*spd, vy: dy/len*spd, hue: rand(0,360), trail:[], done:false });
    };

    const fwLoop = () => {
      const canvas = fwCanvasRef.current; if (!canvas) return;
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.fillStyle = 'rgba(22,0,32,.18)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = rocketsRef.current.length - 1; i >= 0; i--) {
        const r = rocketsRef.current[i];
        r.trail.push({ x: r.x, y: r.y });
        if (r.trail.length > 8) r.trail.shift();
        r.x += r.vx; r.y += r.vy;
        if (Math.abs(r.x - r.tx) < 14 && Math.abs(r.y - r.ty) < 14) {
          const n = (rand(80, 130)) | 0;
          for (let j = 0; j < n; j++) {
            const a = (j/n)*Math.PI*2, spd = rand(2, 9);
            sparksRef.current.push({ x:r.x, y:r.y, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd,
              alpha:1, hue:r.hue+rand(-30,30), size:rand(2,5), gravity:rand(.08,.18), type:Math.random()<.3?'heart':'circle' });
          }
          for (let j = 0; j < 12; j++) {
            const a = (j/12)*Math.PI*2, spd = rand(4, 7);
            sparksRef.current.push({ x:r.x, y:r.y, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd,
              alpha:1, hue:rand(30,55), size:rand(8,16), gravity:.1, type:'heart' });
          }
          r.done = true;
        }
        r.trail.forEach((pt, idx) => {
          ctx.save(); ctx.globalAlpha = (idx/r.trail.length)*0.7;
          ctx.fillStyle = `hsl(${r.hue},90%,75%)`;
          ctx.beginPath(); ctx.arc(pt.x,pt.y,2.5,0,Math.PI*2); ctx.fill(); ctx.restore();
        });
        ctx.save(); ctx.fillStyle=`hsl(${r.hue},90%,90%)`; ctx.shadowColor=`hsl(${r.hue},90%,75%)`; ctx.shadowBlur=10;
        ctx.beginPath(); ctx.arc(r.x,r.y,3.5,0,Math.PI*2); ctx.fill(); ctx.restore();
        if (r.done) rocketsRef.current.splice(i, 1);
      }

      for (let i = sparksRef.current.length - 1; i >= 0; i--) {
        const s = sparksRef.current[i];
        s.x+=s.vx; s.y+=s.vy; s.vy+=s.gravity; s.vx*=.97; s.vy*=.97; s.alpha-=.016;
        ctx.save(); ctx.globalAlpha = Math.max(0, s.alpha);
        if (s.type==='heart') drawHeart(ctx,s.x,s.y,s.size,`hsl(${s.hue},90%,70%)`);
        else {
          ctx.fillStyle=`hsl(${s.hue},90%,70%)`; ctx.shadowColor=`hsl(${s.hue},90%,65%)`; ctx.shadowBlur=8;
          ctx.beginPath(); ctx.arc(s.x,s.y,s.size/2,0,Math.PI*2); ctx.fill();
        }
        ctx.restore();
        if (s.alpha <= 0) sparksRef.current.splice(i, 1);
      }
      if (fwRunningRef.current) fwAnimRef.current = requestAnimationFrame(fwLoop);
    };
    fwAnimRef.current = requestAnimationFrame(fwLoop);

    let count = 0;
    const burst = () => {
      const n = Math.random() < 0.4 ? 3 : 1;
      for (let i = 0; i < n; i++) setTimeout(launchRocket, i * 120);
      count++;
      if (count < 22) fwTimerRef.current = setTimeout(burst, rand(200, 550));
      else setTimeout(stopFireworks, 3000);
    };
    burst();
  }, [stopFireworks]);

  /* ── Gift open / close ── */
  const openGift = useCallback(() => {
    setGiftOpened(true);
    setTimeout(() => {
      startFireworks();
      setTimeout(() => {
        setOverlayVisible(true);
        setWordsShown(0);
        setMsgStage(1);
        WORDS.forEach((_, i) => setTimeout(() => setWordsShown(i + 1), 200 + i * 390));
        setTimeout(() => setMsgStage(2), 2300);
        setTimeout(() => setMsgStage(3), 3100);
      }, 600);
    }, 400);
  }, [startFireworks]);

  const closeGift = useCallback(() => {
    setOverlayVisible(false);
    setWordsShown(0);
    setMsgStage(0);
    stopFireworks();
    setTimeout(() => setGiftOpened(false), 500);
  }, [stopFireworks]);

  /* ── Escape to close ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && overlayVisible) closeGift(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlayVisible, closeGift]);

  useEffect(() => () => {
    cancelAnimationFrame(bgAnimRef.current);
    cancelAnimationFrame(fwAnimRef.current);
    if (fwTimerRef.current) clearTimeout(fwTimerRef.current);
  }, []);

  /* ══════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════ */
  return (
    <main className={styles.main}>

      {/* Custom heart cursor */}
      <div ref={cursorRef} className={styles.cursor} aria-hidden="true">♥</div>

      {/* Background canvas — scattered particles + mouse trail */}
      <canvas ref={bgCanvasRef} className={styles.bgCanvas} aria-hidden="true" />

      {/* Fireworks canvas */}
      <canvas ref={fwCanvasRef} className={styles.fwCanvas} aria-hidden="true" />

      {/* Floating petals */}
      {petals.map(p => (
        <div key={p.id} className={styles.petal} aria-hidden="true"
          style={{ left:p.left, fontSize:p.fontSize, animationDuration:`${p.duration}s`, animationDelay:`${p.delay}s` }}>
          {p.emoji}
        </div>
      ))}

      {/* ── Pre-reveal scene ── */}
      <div className={styles.scene}>
        <div className={styles.headerArea}>
          <p className={styles.eyebrow}>A SURPRISE JUST FOR YOU</p>
          <h1 className={styles.title}>My Dearest One</h1>
          <p className={styles.subtitle}>Move your mouse &amp; feel the magic ✨</p>
        </div>

        {/* CSS gift box */}
        <div
          id="gift-box"
          role="button"
          tabIndex={0}
          aria-label="Click to open your gift"
          className={`${styles.giftWrapper} ${giftOpened ? styles.giftBoxOpened : ''}`}
          onClick={openGift}
          onKeyDown={e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); openGift(); } }}
        >
          {/* Bow */}
          <div className={styles.giftBow} aria-hidden="true">
            <div className={styles.giftBowLeft} />
            <div className={styles.giftBowRight} />
            <div className={styles.giftBowKnot} />
          </div>
          {/* Lid */}
          <div className={styles.giftLid}>
            <div className={styles.giftLidRibbon} />
          </div>
          {/* Body */}
          <div className={styles.giftBody}>
            <div className={styles.giftRibbonV} />
            <div className={styles.giftRibbonH} />
          </div>
          {/* Pulse rings */}
          <div className={styles.pulseRing} />
          <div className={styles.pulseRing2} />
          <div className={styles.pulseRing3} />
        </div>

        <p className={`${styles.giftHint} ${giftOpened ? styles.giftHintHidden : ''}`}>
          ✦ Click the gift box ✦
        </p>
      </div>

      {/* ── Love message overlay ── */}
      <div
        id="love-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Love message"
        aria-hidden={!overlayVisible}
        className={`${styles.loveOverlay} ${overlayVisible ? styles.loveOverlayVisible : ''}`}
      >
        <button id="close-btn" className={styles.closeBtn} onClick={closeGift} aria-label="Close message">×</button>

        <div className={styles.heartBig} aria-hidden="true">💖</div>

        <div className={styles.wordsContainer} role="heading" aria-level={2} aria-label="I Love You Baby">
          {WORDS.map((word, i) => (
            <span key={i} className={`${styles.word} ${wordsShown > i ? styles.wordVisible : ''}`}>
              {word}
            </span>
          ))}
        </div>

        <p className={`${styles.subMessage} ${msgStage >= 2 ? styles.fadeInUp : ''}`}>
          Every moment with you is a treasure I hold close to my heart. 💕<br />
          You are my sunshine, my everything, my forever. 🌹
        </p>

        <div className={`${styles.emojiRow} ${msgStage >= 2 ? styles.fadeInUp : ''}`} aria-hidden="true">
          {['💕','🌹','💫','✨','💖','🌸','💝','⭐','🦋','🌺'].map((e, i) => (
            <span key={i} className={styles.floatEmoji} style={{ animationDelay:`${i * 0.15}s` }}>{e}</span>
          ))}
        </div>

        <p className={`${styles.signature} ${msgStage >= 3 ? styles.fadeInUp : ''}`}>
          — Yours forever, with all my love 💌
        </p>
      </div>

    </main>
  );
}
