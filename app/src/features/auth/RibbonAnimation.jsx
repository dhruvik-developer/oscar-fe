import { useEffect, useRef } from 'react';

/**
 * RibbonAnimation — lightweight pseudo-3D sheer ribbon.
 * Canvas 2D only (no new deps). Animates ONLY the blue ribbon
 * portion from the login reference: flowing, twisting, translucent.
 */
export default function RibbonAnimation({ className = '' }) {
  const canvasRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      pointerRef.current.tx = px;
      pointerRef.current.ty = py;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const ribbon = (t, opts) => {
      const {
        yBase, amp1, amp2, speed, thickness, hue, alpha, phase, parallax,
      } = opts;
      const p = pointerRef.current;
      const N = 120;
      const top = [];
      const bottom = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const x = u * w;
        // main flow + secondary ripple = fabric wave
        const wave =
          Math.sin(u * 5.2 + t * speed + phase) * amp1 +
          Math.sin(u * 9.5 - t * speed * 1.6 + phase * 2) * amp2 +
          p.x * parallax * u * 30 +
          p.y * parallax * Math.sin(u * Math.PI) * 12;
        const y = yBase + wave * Math.sin(u * Math.PI * 0.9 + 0.2) + u * opts.slope;
        // twist: thickness pinches where ribbon turns edge-on (pseudo-3D)
        const twist = 0.35 + 0.65 * Math.abs(Math.sin(u * 4.2 + t * speed * 0.9 + phase));
        const th = thickness * twist;
        top.push([x, y - th / 2]);
        bottom.push([x, y + th / 2]);
      }

      // body
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, `rgba(219,234,254,${alpha})`);
      grad.addColorStop(0.35, `rgba(191,219,254,${alpha + 0.15})`);
      grad.addColorStop(0.6, `rgba(255,255,255,${Math.min(1, alpha + 0.25)})`);
      grad.addColorStop(0.8, `rgba(147,197,253,${alpha + 0.1})`);
      grad.addColorStop(1, `rgba(219,234,254,${alpha})`);

      ctx.beginPath();
      ctx.moveTo(top[0][0], top[0][1]);
      for (let i = 1; i <= N; i++) ctx.lineTo(top[i][0], top[i][1]);
      for (let i = N; i >= 0; i--) ctx.lineTo(bottom[i][0], bottom[i][1]);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.shadowColor = 'rgba(120,170,255,0.45)';
      ctx.shadowBlur = 22;
      ctx.fill();
      ctx.shadowBlur = 0;

      // sheer highlight streak (moves with time = shimmer)
      ctx.beginPath();
      ctx.moveTo(top[0][0], top[0][1] + thickness * 0.08);
      for (let i = 1; i <= N; i++) {
        const shimmer = Math.sin((i / N) * 12 - t * 2.2) * thickness * 0.06;
        ctx.lineTo(top[i][0], top[i][1] + thickness * 0.18 + shimmer);
      }
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * hue})`;
      ctx.lineWidth = Math.max(1, thickness * 0.12);
      ctx.lineCap = 'round';
      ctx.stroke();

      // fine weave lines = fabric texture
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const off = (k - 1) * thickness * 0.18;
        ctx.moveTo(top[0][0], top[0][1] + thickness * 0.5 + off);
        for (let i = 1; i <= N; i++) {
          const midY = (top[i][1] + bottom[i][1]) / 2 + off * 0.4;
          ctx.lineTo(top[i][0], midY);
        }
      }
      ctx.strokeStyle = 'rgba(147,197,253,0.28)';
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    const start = performance.now();
    const frame = (now) => {
      const t = (now - start) / 1000;
      // ease pointer for subtle 3D parallax
      const p = pointerRef.current;
      p.x += (p.tx - p.x) * 0.06;
      p.y += (p.ty - p.y) * 0.06;

      ctx.clearRect(0, 0, w, h);

      const yBase = h * 0.52;
      // back ribbon (deeper, fainter)
      ribbon(reduced ? 1.2 : t, {
        yBase: yBase - h * 0.08,
        amp1: h * 0.16,
        amp2: h * 0.05,
        speed: 0.9,
        thickness: h * 0.26,
        alpha: 0.5,
        hue: 0.7,
        phase: 1.4,
        slope: -h * 0.28,
        parallax: 0.6,
      });
      // front ribbon (main sheer blue from screenshot)
      ribbon(reduced ? 1.2 : t * 1.15, {
        yBase,
        amp1: h * 0.2,
        amp2: h * 0.06,
        speed: 1.15,
        thickness: h * 0.32,
        alpha: 0.62,
        hue: 1,
        phase: 0,
        slope: -h * 0.3,
        parallax: 1,
      });

      if (!reduced) raf = requestAnimationFrame(frame);
    };

    if (reduced) {
      frame(start + 1200); // single static frame
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
      aria-hidden="true"
    />
  );
}
