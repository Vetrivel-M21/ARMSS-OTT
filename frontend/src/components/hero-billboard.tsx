import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check, Info, Play, Plus, Volume2, VolumeX } from "lucide-react";
import { kindLabel, type Title } from "@/lib/catalog";
import { useAether } from "@/lib/store";
import { cn, formatRuntime } from "@/lib/utils";
import { BackdropArt } from "./poster";
import { Button } from "./ui/button";

export function HeroBillboard({
  titles,
  height = "standard",
  alignment = "left",
}: {
  titles: Title[];
  height?: "full" | "standard" | "compact";
  alignment?: "left" | "center";
}) {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const user = useAether((s) => s.user);
  const muted = useAether((s) => s.heroMuted);
  const setMuted = useAether((s) => s.setHeroMuted);
  const inList = useAether((s) => s.inList);
  const toggleList = useAether((s) => s.toggleList);
  const [videoReady, setVideoReady] = useState(false);
  const featured = titles[index] ?? titles[0];

  useEffect(() => {
    setVideoReady(false);
  }, [featured?.id]);

  useEffect(() => {
    if (titles.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % titles.length);
    }, 12000);
    return () => window.clearInterval(id);
  }, [titles.length]);

  if (!featured) return null;
  const saved = inList(featured.id);

  const heightClass =
    height === "full"
      ? "min-h-[85vh] sm:min-h-[90vh]"
      : height === "compact"
        ? "min-h-[60vh] sm:min-h-[65vh]"
        : "h-hero";

  const isCenter = alignment === "center";

  return (
    <section className={cn("relative overflow-hidden bg-bg", heightClass)}>
      <div className="absolute inset-0 overflow-hidden">
        {/* Always render high-res backdrop art so background is NEVER black */}
        <BackdropArt key={featured.id + (featured.backdrop || "")} title={featured} kenburns className="h-full w-full" />

        {/* Video stream fades in on top when playing */}
        {featured.trailer ? (
          <video
            key={featured.id}
            src={featured.trailer}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
              videoReady ? "opacity-100" : "opacity-0",
            )}
            autoPlay
            loop
            muted={muted}
            playsInline
            onCanPlay={() => setVideoReady(true)}
            onPlaying={() => setVideoReady(true)}
            onError={() => setVideoReady(false)}
          />
        ) : null}
      </div>
      <div className="hero-scrim absolute inset-0" />
      <div className="hero-floor absolute inset-0" />
      <div
        className={cn(
          "relative z-10 flex h-full flex-col justify-end px-4 pb-16 pt-24 sm:px-8 sm:pb-20",
          isCenter
            ? "mx-auto max-w-3xl items-center text-center"
            : "lg:max-w-2xl",
        )}
      >
        <div key={featured.id} className="stagger-in flex flex-col items-start">
          <div className={cn("w-full", isCenter && "flex flex-col items-center")}>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted">
              {featured.original ? "ARMSS Original" : kindLabel(featured.kind)}
              {featured.kind === "live" ? " · Live now" : ""}
            </p>
            <h1 className="mt-3 font-display italic text-5xl leading-[0.95] tracking-tight text-fg sm:text-6xl lg:text-7xl">
              {featured.title}
            </h1>
            <div
              className={cn(
                "mt-4 flex flex-wrap items-center gap-2 text-sm text-muted",
                isCenter && "justify-center",
              )}
            >
              {featured.match > 0 ? (
                <span className="font-medium text-match tabular-nums">
                  {featured.match}% Match
                </span>
              ) : null}
              <span>{featured.year}</span>
              <MaturityPill value={featured.maturity} />
              <span>
                {featured.kind === "series"
                  ? `${featured.seasons ?? 1} season${(featured.seasons ?? 1) > 1 ? "s" : ""}`
                  : formatRuntime(featured.runtimeMin)}
              </span>
              {featured.badges.slice(0, 3).map((b) => (
                <span
                  key={b}
                  className="rounded-xs px-1.5 py-0.5 text-[10px] tracking-wide text-fg/80 shadow-[var(--shadow-border)]"
                >
                  {b}
                </span>
              ))}
            </div>
            <p
              className={cn(
                "mt-4 max-w-lg text-sm leading-relaxed text-fg/85 sm:text-base",
                isCenter && "mx-auto",
              )}
            >
              {featured.logline}
            </p>
            <div
              className={cn(
                "mt-6 flex flex-wrap items-center gap-2",
                isCenter && "justify-center",
              )}
            >
            <Button
              size="lg"
              className="min-w-28 cursor-pointer"
              onClick={() => {
                if (!user) {
                  void navigate({ to: "/login", search: { redirect: `/watch/${featured.id}` } as any });
                } else {
                  void navigate({ to: "/watch/$id", params: { id: featured.id } });
                }
              }}
            >
              <Play className="size-5 fill-current ml-0.5" />
              {featured.kind === "live" ? "Watch live" : "Play"}
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={() => toggleList(featured.id)}
            >
              {saved ? <Check className="size-5" /> : <Plus className="size-5" />}
              My List
            </Button>
            <Button asChild size="lg" variant="line">
              <Link to="/title/$id" params={{ id: featured.id }}>
                <Info className="size-5" />
                Details
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
      <div className="absolute bottom-6 right-4 z-10 flex items-center gap-2 sm:right-8">
        {featured.trailer ? (
          <button
            type="button"
            onClick={() => setMuted(!muted)}
            aria-label={muted ? "Unmute trailer" : "Mute trailer"}
            className="grid size-11 place-items-center rounded-full text-fg shadow-[var(--shadow-border)] hover:bg-fg/10"
          >
            {muted ? (
              <VolumeX className="size-5" />
            ) : (
              <Volume2 className="size-5" />
            )}
          </button>
        ) : null}
        <div className="hidden gap-1.5 sm:flex">
          {titles.map((t, i) => (
            <button
              key={t.id}
              type="button"
              aria-label={`Show ${t.title}`}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1 rounded-full transition-[width,background-color] duration-300",
                i === index ? "w-6 bg-fg" : "w-3 bg-fg/30 hover:bg-fg/60",
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function MaturityPill({ value }: { value: string }) {
  return (
    <span className="rounded-xs px-1.5 py-0.5 text-[11px] font-medium tracking-wide text-fg/80 shadow-[var(--shadow-border)]">
      {value}
    </span>
  );
}
