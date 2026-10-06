import { memo, useEffect, useRef, useState } from "react";

type PosterItem = {
  id: string;
  title: string;
  src: string;
  badge: string;
};

const POSTERS: PosterItem[] = [
  { id: "velvet", title: "Velvet Protocol", src: "/posters/velvet-protocol.jpg", badge: "4K UHD" },
  { id: "ember", title: "Ember Hour", src: "/posters/ember-hour.jpg", badge: "Tamil" },
  { id: "crownless", title: "Crownless", src: "/posters/crownless.jpg", badge: "Series" },
  { id: "afterlight", title: "Afterlight", src: "/posters/afterlight.jpg", badge: "IMAX" },
  { id: "glass", title: "Glass Harbor", src: "/posters/glass-harbor.jpg", badge: "HDR" },
  { id: "hollow", title: "Hollow Choir", src: "/posters/hollow-choir.jpg", badge: "Original" },
  { id: "meridian", title: "Pale Meridian", src: "/posters/pale-meridian.jpg", badge: "Sci-Fi" },
  { id: "north", title: "North of Stillness", src: "/posters/north-of-stillness.jpg", badge: "Drama" },
  { id: "orbit", title: "Low Orbit", src: "/posters/low-orbit.jpg", badge: "Action" },
  { id: "frequency", title: "Last Frequency", src: "/posters/last-frequency.jpg", badge: "Live TV" },
];

const ROW_1 = [...POSTERS, ...POSTERS];
const ROW_2 = [...POSTERS.slice(4), ...POSTERS.slice(0, 4), ...POSTERS.slice(4), ...POSTERS.slice(0, 4)];
const ROW_3 = [...POSTERS.slice(7), ...POSTERS.slice(0, 7), ...POSTERS.slice(7), ...POSTERS.slice(0, 7)];
const ROW_4 = [...POSTERS.slice(2), ...POSTERS.slice(0, 2), ...POSTERS.slice(2), ...POSTERS.slice(0, 2)];

function PosterCard({ poster }: { poster: PosterItem }) {
  return (
    <div className="relative w-28 sm:w-36 md:w-44 aspect-[2/3] shrink-0 rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-surface/50 group">
      <img
        src={poster.src}
        alt={poster.title}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
      />
      {/* Specular gloss reflection line */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/15 opacity-60 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent pointer-events-none" />
      
      {/* Quality Badge */}
      <div className="absolute top-2 right-2">
        <span className="text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/65 backdrop-blur-md text-white/90 border border-white/15 shadow-sm">
          {poster.badge}
        </span>
      </div>
      
      {/* Title */}
      <div className="absolute bottom-2 left-2 right-2">
        <p className="text-[10px] sm:text-[11px] font-semibold text-white/95 truncate drop-shadow-md">
          {poster.title}
        </p>
      </div>
    </div>
  );
}

/**
 * Floating cinema dust motes and projector embers canvas
 */
function CinemaDustCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    // Particle definition
    const PARTICLE_COUNT = 40;
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 0.8,
      speedY: Math.random() * 0.35 + 0.15,
      speedX: (Math.random() - 0.5) * 0.25,
      opacity: Math.random() * 0.6 + 0.2,
      pulseSpeed: Math.random() * 0.02 + 0.01,
      angle: Math.random() * Math.PI * 2,
      color: Math.random() > 0.4 ? "255, 200, 110" : "220, 50, 50", // Golden ember vs ruby sparkle
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.y -= p.speedY;
        p.angle += p.pulseSpeed;
        p.x += Math.sin(p.angle) * 0.35 + p.speedX;

        // Wrap around
        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        const currentOpacity = p.opacity * (0.6 + Math.sin(p.angle) * 0.4);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${Math.max(0, currentOpacity)})`;
        ctx.shadowBlur = p.size * 4;
        ctx.shadowColor = `rgba(${p.color}, 0.8)`;
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none select-none z-10 opacity-70"
    />
  );
}

export const CinematicMovieWall = memo(function CinematicMovieWall() {
  // Smooth interactive mouse 3D parallax tracking
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const animFrameRef = useRef<number | null>(null);
  const targetTilt = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Normalized from -1 to 1 based on center of viewport
      const normX = (e.clientX / window.innerWidth) * 2 - 1;
      const normY = (e.clientY / window.innerHeight) * 2 - 1;
      targetTilt.current = { x: normX, y: normY };
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Smooth damping loop
    let lastTime = performance.now();
    const updateTilt = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      // Auto-sway oscillation when mouse is idle
      const idleSwayX = Math.sin(time * 0.0006) * 0.15;
      const idleSwayY = Math.cos(time * 0.0008) * 0.12;

      setTilt((prev) => ({
        x: prev.x + (targetTilt.current.x + idleSwayX - prev.x) * (dt * 3.5),
        y: prev.y + (targetTilt.current.y + idleSwayY - prev.y) * (dt * 3.5),
      }));

      animFrameRef.current = requestAnimationFrame(updateTilt);
    };

    animFrameRef.current = requestAnimationFrame(updateTilt);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Compute 3D transform strings based on parallax
  const wallRotateX = -5 - tilt.y * 5;
  const wallRotateY = tilt.x * 6;
  const wallTranslateX = tilt.x * -18;
  const wallTranslateY = tilt.y * -14;

  const projectorShiftX = tilt.x * 25;
  const projectorShiftY = tilt.y * 18;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0"
      style={{ perspective: "1200px" }}
    >
      {/* 3D Parallax Poster Wall */}
      <div
        className="absolute -inset-x-28 -inset-y-40 sm:-inset-x-36 sm:-inset-y-52 flex flex-col justify-center gap-3 sm:gap-4.5 animate-ken-burns-wall opacity-70 will-change-transform transition-transform duration-200 ease-out"
        style={{
          transform: `translate3d(${wallTranslateX}px, ${wallTranslateY}px, 0) rotateX(${wallRotateX}deg) rotateY(${wallRotateY}deg) scale(1.15)`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Row 1: Left */}
        <div className="flex gap-3 sm:gap-4.5 w-max animate-movie-wall-left-fast">
          {ROW_1.map((p, idx) => (
            <PosterCard key={`r1-${p.id}-${idx}`} poster={p} />
          ))}
        </div>

        {/* Row 2: Right */}
        <div className="flex gap-3 sm:gap-4.5 w-max animate-movie-wall-right-slow">
          {ROW_2.map((p, idx) => (
            <PosterCard key={`r2-${p.id}-${idx}`} poster={p} />
          ))}
        </div>

        {/* Row 3: Left */}
        <div className="flex gap-3 sm:gap-4.5 w-max animate-movie-wall-left-slow">
          {ROW_3.map((p, idx) => (
            <PosterCard key={`r3-${p.id}-${idx}`} poster={p} />
          ))}
        </div>

        {/* Row 4: Right */}
        <div className="flex gap-3 sm:gap-4.5 w-max animate-movie-wall-right-fast">
          {ROW_4.map((p, idx) => (
            <PosterCard key={`r4-${p.id}-${idx}`} poster={p} />
          ))}
        </div>
      </div>

      {/* ─── Cinema Projector Light Cone & Anamorphic Streak ─── */}
      <div
        className="absolute inset-0 pointer-events-none transition-transform duration-300 ease-out"
        style={{
          transform: `translate3d(${projectorShiftX}px, ${projectorShiftY}px, 0)`,
        }}
      >
        {/* Projector Origin Hotspot (Top-Left Cinema Booth) */}
        <div className="absolute -top-16 -left-16 w-80 h-80 bg-amber-300/25 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute -top-10 -left-10 w-44 h-44 bg-cyan-300/20 blur-[60px] rounded-full pointer-events-none" />

        {/* Sweeping Conical Projector Beam */}
        <div
          className="absolute -top-24 -left-20 w-[150vw] h-[150vh] animate-projector-beam pointer-events-none opacity-45 mix-blend-screen"
          style={{
            background:
              "conic-gradient(from 125deg at 8% 5%, rgba(255, 230, 160, 0.28) 0deg, rgba(220, 38, 38, 0.16) 18deg, rgba(56, 189, 248, 0.14) 34deg, transparent 58deg)",
          }}
        />

        {/* Anamorphic Blue / Cyan Horizontal Lens Flare Streak */}
        <div className="absolute top-[28%] -left-[10%] w-[120%] h-[3px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent blur-[1.5px] animate-anamorphic-streak mix-blend-screen" />
        <div className="absolute top-[48%] -left-[10%] w-[120%] h-[2px] bg-gradient-to-r from-transparent via-amber-400/40 to-transparent blur-[1px] animate-anamorphic-streak mix-blend-screen" />
      </div>

      {/* Floating Golden Cinema Embers / Dust Particles */}
      <CinemaDustCanvas />

      {/* Atmospheric Soft Blur & Color Scrim */}
      <div className="absolute inset-0 bg-bg/65 backdrop-blur-[1px]" />

      {/* Vertical Linear Gradient Scrim */}
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-bg/85" />

      {/* Radial Vignette Mask Focused on the Auth Card */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(10,12,16,0.48)_0%,rgba(10,12,16,0.88)_65%,rgba(10,12,16,0.98)_100%)]" />

      {/* Ambient Cinema Red Stage Light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] sm:w-[850px] h-[480px] bg-accent/25 blur-[140px] rounded-full pointer-events-none animate-pulse" />

      {/* Ambient Deep Blue/Indigo Accent Glow */}
      <div className="absolute -bottom-10 right-0 sm:right-10 w-[450px] sm:w-[600px] h-[350px] bg-blue-600/18 blur-[130px] rounded-full pointer-events-none" />

      {/* Film Grain Texture Overlay */}
      <div className="absolute inset-0 film-grain opacity-30" />
    </div>
  );
});
