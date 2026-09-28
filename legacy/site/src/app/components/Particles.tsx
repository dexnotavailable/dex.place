import { useEffect, useRef } from "react";
import { useSeason } from "./season";

interface Props {
  density?: number;
  className?: string;
  intensity?: number;
}

export function Particles({ density = 90, className = "", intensity = 1 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { season } = useSeason();
  const seasonRef = useRef(season);
  seasonRef.current = season;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: 0, y: 0, active: false };

    const parent = canvas.parentElement!;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = parent.clientWidth;
      h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    type P = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      s: number;
      life: number;
      max: number;
      phase: number;
      spin: number;
    };
    const parts: P[] = [];
    const spawn = (): P => {
      const max = 220 + Math.random() * 320;
      return {
        x: Math.random() * w - 50,
        y: Math.random() * h,
        vx: 0.6 + Math.random() * 1.8,
        vy: (Math.random() - 0.5) * 0.4,
        s: 0.4 + Math.random() * 1.8,
        life: Math.random() * max,
        max,
        phase: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.04,
      };
    };
    for (let i = 0; i < density; i++) parts.push(spawn());

    const onPointerMove = (event: PointerEvent) => {
      const rect = parent.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = pointer.x >= 0 && pointer.x <= rect.width && pointer.y >= 0 && pointer.y <= rect.height;
    };
    const onPointerLeave = () => {
      pointer.active = false;
    };
    parent.addEventListener("pointermove", onPointerMove);
    parent.addEventListener("pointerleave", onPointerLeave);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const s = seasonRef.current;
      const isWinter = s.key === "winter26";
      const isSpring = s.key === "spring27";
      const isAutumn = s.key === "autumn26";

      for (const p of parts) {
        p.life++;
        p.x += p.vx * intensity;
        p.y += p.vy * intensity + (isSpring ? 0.18 : isWinter ? 0.1 : 0);
        p.phase += p.spin;
        p.vy += Math.sin(p.phase) * 0.003;

        if (pointer.active && !reduceMotion) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 0 && distance < 125) {
            const force = (125 - distance) / 125;
            p.vx += (dx / distance) * force * 0.055;
            p.vy += (dy / distance) * force * 0.075;
          }
        }

        p.vx += (1.15 - p.vx) * 0.005;
        p.vy *= 0.995;

        if (p.x > w + 20 || p.y > h + 20 || p.y < -20 || p.life > p.max) {
          Object.assign(p, spawn(), { x: -10 });
        }

        const alpha = Math.min(1, p.life / 30) * Math.min(1, (p.max - p.life) / 50);
        ctx.globalAlpha = alpha * 0.84;

        if (isWinter) {
          ctx.fillStyle = s.particle;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.s * 0.8, 0, Math.PI * 2);
          ctx.fill();
        } else if (isSpring) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.phase);
          ctx.fillStyle = s.particle;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.s * 1.5, p.s * 0.75, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (isAutumn) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.phase * 0.45);
          ctx.strokeStyle = s.particle;
          ctx.lineWidth = Math.max(0.5, p.s * 0.45);
          ctx.beginPath();
          ctx.moveTo(-p.s * 2.6, 0);
          ctx.lineTo(p.s * 2.6, 0);
          ctx.stroke();
          ctx.restore();
        } else {
          ctx.strokeStyle = s.particle;
          ctx.lineWidth = p.s * 0.6;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 6, p.y - p.vy * 6);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      if (!reduceMotion) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      parent.removeEventListener("pointermove", onPointerMove);
      parent.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [density, intensity]);

  return (
    <canvas
      ref={canvasRef}
      className={"pointer-events-none absolute inset-0 " + className}
    />
  );
}
