"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useTheme } from "../context/ThemeContext";

type ParticleType = "star" | "circle" | "sparkle";

type Particle = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  hue: number;
  type: ParticleType;
};

function reducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

export function UnicornBackground() {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const emojis = useMemo(() => ["🦄", "✨", "🌈", "💖", "⭐", "🎉", "💫", "🔮"], []);

  useEffect(() => {
    if (theme !== "unicorn") return;
    if (reducedMotion()) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas;

    const ctx = c.getContext("2d")!;

    let w = 0;
    let h = 0;

    function resize() {
      w = c.clientWidth;
      h = c.clientHeight;
      c.width = Math.floor(w * devicePixelRatio);
      c.height = Math.floor(h * devicePixelRatio);
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);

    const N = 80;
    const particles: Particle[] = Array.from({ length: N }).map(() => {
      const t: ParticleType = Math.random() < 0.34 ? "star" : Math.random() < 0.5 ? "sparkle" : "circle";
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: 2 + Math.random() * 4,
        vx: (-0.5 + Math.random()) * 0.6,
        vy: (-0.5 + Math.random()) * 0.6,
        hue: Math.random() * 360,
        type: t,
      };
    });

    function drawStar(x: number, y: number, r: number, hue: number) {
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      const spikes = 5;
      const outerRadius = r;
      const innerRadius = r * 0.45;
      let rot = (Math.PI / 2) * 3;
      let step = Math.PI / spikes;
      ctx.moveTo(0, -outerRadius);
      for (let i = 0; i < spikes; i++) {
        ctx.lineTo(Math.cos(rot) * outerRadius, Math.sin(rot) * outerRadius);
        rot += step;
        ctx.lineTo(Math.cos(rot) * innerRadius, Math.sin(rot) * innerRadius);
        rot += step;
      }
      ctx.lineTo(0, -outerRadius);
      ctx.closePath();
      ctx.fillStyle = `hsla(${hue}, 95%, 70%, 0.85)`;
      ctx.shadowColor = `hsla(${hue}, 95%, 70%, 0.7)`;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.restore();
    }

    function drawSparkle(x: number, y: number, r: number, hue: number) {
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = `hsla(${hue}, 95%, 70%, 0.9)`;
      ctx.lineWidth = 2;
      ctx.shadowColor = `hsla(${hue}, 95%, 70%, 0.6)`;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      ctx.moveTo(0, -r);
      ctx.lineTo(0, r);
      ctx.stroke();
      ctx.restore();
    }

    function drawCircle(x: number, y: number, r: number, hue: number) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      g.addColorStop(0, `hsla(${hue}, 95%, 70%, 0.55)`);
      g.addColorStop(1, `hsla(${hue}, 95%, 70%, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    function tick() {
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.hue = (p.hue + 0.6) % 360;

        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;

        if (p.type === "star") drawStar(p.x, p.y, p.r, p.hue);
        else if (p.type === "sparkle") drawSparkle(p.x, p.y, p.r, p.hue);
        else drawCircle(p.x, p.y, p.r, p.hue);
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [theme]);

  if (theme !== "unicorn") return null;

  // Base gradient layer handled by CSS. This component adds particles + floating emojis.
  return (
    <div className="unicorn_layer" aria-hidden>
      <canvas ref={canvasRef} className="unicorn_canvas" />

      {!reducedMotion() ? (
        <div className="unicorn_emojis">
          {Array.from({ length: 8 }).map((_, i) => {
            const emoji = emojis[i % emojis.length];
            const duration = 10 + Math.random() * 10;
            const delay = i * 0.9;
            const left = Math.random() * 100;
            const size = 22 + Math.random() * 22;

            return (
              <motion.div
                key={i}
                className="unicorn_emoji"
                style={{ left: `${left}%`, fontSize: `${size}px` }}
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: "-110vh", opacity: [0, 1, 1, 0], rotate: 360 }}
                transition={{ duration, delay, repeat: Infinity, ease: "linear" }}
              >
                {emoji}
              </motion.div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
