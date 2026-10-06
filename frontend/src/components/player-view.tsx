import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Check,
  ChevronLeft,
  Crown,
  Film,
  ListVideo,
  Loader2,
  Lock,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  SkipForward,
  Subtitles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Episode, Title } from "@/lib/catalog";
import { getTitle } from "@/lib/catalog";
import { useAether } from "@/lib/store";
import { api } from "@/lib/api";
import { clamp, cn, formatClock } from "@/lib/utils";
import { BackdropArt } from "./poster";
import { Button } from "./ui/button";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const QUALITIES = ["Auto", "4K", "1080p", "720p"] as const;
const AUDIO_TRACKS = [
  "Tamil (Original · 5.1 Atmos)",
  "Telugu (Dubbed)",
  "Hindi (Dubbed)",
  "English",
];
const SUB_TRACKS = ["Off", "Tamil", "English", "Hindi"] as const;

/** Duration in ms to show the seek flash overlay */
const SEEK_FLASH_MS = 500;
/** Duration in ms to keep the loading spinner visible after a seek */
const SEEK_SPINNER_MS = 600;

export function PlayerView({
  title,
  episode,
}: {
  title: Title;
  episode?: Episode;
}) {
  const navigate = useNavigate();
  const setProgress = useAether((s) => s.setProgress);
  const saved = useAether((s) => s.progressFor(title.id));
  const fallbackDuration = (episode?.runtime ?? title.runtimeMin) * 60;
  const isLive = title.kind === "live";

  // If title has a trailer or videoUrl, use it; otherwise provide a default sample MP4 stream
  const [backupStream, setBackupStream] = useState<string | null>(null);
  const videoSrc = backupStream || title.videoUrl || title.trailer || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4";

  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const seekSpinnerTimer = useRef<number | null>(null);
  const seekFlashTimer = useRef<number | null>(null);

  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const effectiveDuration = mediaDuration && mediaDuration > 0 ? mediaDuration : fallbackDuration;

  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState(() => {
    if (isLive) return (Date.now() / 1000) % effectiveDuration;
    if (saved?.progress) return saved.progress * effectiveDuration * 0.99;
    return 0;
  });

  const user = useAether((s) => s.user);
  const setUpgradeModalOpen = useAether((s) => s.setUpgradeModalOpen);
  const isPremiumVIP = user?.subscription_tier === "premium";

  // Unauthenticated user guard: redirect to /login immediately
  useEffect(() => {
    if (!user) {
      toast.info("Please sign in to watch videos on ARMSS OTT.");
      void navigate({ to: "/login", search: { redirect: `/watch/${title.id}` } as any });
    }
  }, [user, navigate, title.id]);

  const [playbackAllowed, setPlaybackAllowed] = useState(true);
  const [ticketMessage, setTicketMessage] = useState<string | null>(null);

  // Check entitlement ticket from Go backend (and whenever user tier upgrades)
  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    api
      .checkPlaybackTicket(title.id)
      .then((ticket) => {
        if (!isMounted) return;
        if (ticket.allowed === false || ticket.error === "tier_upgrade_required") {
          setPlaybackAllowed(false);
          setPlaying(false);
          setTicketMessage(ticket.message || "Upgrade your subscription to watch this exclusive title in full quality.");
          setUpgradeModalOpen(true, title.title);
        } else {
          setPlaybackAllowed(true);
        }
      })
      .catch(() => {
        // Allow fallback on network errors
      });

    return () => {
      isMounted = false;
    };
  }, [title.id, title.title, user?.subscription_tier, user, setUpgradeModalOpen]);

  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [fs, setFs] = useState(false);
  const [showUi, setShowUi] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [quality, setQuality] = useState<(typeof QUALITIES)[number]>("Auto");
  const [subs, setSubs] = useState(false);
  const [audioTrack, setAudioTrack] = useState("Tamil (Original · 5.1 Atmos)");
  const [subTrack, setSubTrack] = useState<(typeof SUB_TRACKS)[number]>("Off");
  const [menus, setMenus] = useState<"speed" | "quality" | "audio" | "subs" | null>(null);
  const [episodesOpen, setEpisodesOpen] = useState(false);

  /** True for SEEK_SPINNER_MS after a manual seek */
  const [seekingSpinner, setSeekingSpinner] = useState(false);
  /** Which tap zone triggered the seek flash, or null */
  const [seekFlash, setSeekFlash] = useState<"left" | "right" | null>(null);
  /** Whether PiP is available in this browser */
  const [pipEnabled] = useState(
    () => typeof document !== "undefined" && document.pictureInPictureEnabled,
  );

  const progress = effectiveDuration > 0 ? clamp(time / effectiveDuration) : 0;
  const showSkip = !isLive && progress > 0.02 && progress < 0.1;
  const nextEp = nextEpisode(title, episode);
  const showNext = !isLive && Boolean(nextEp) && progress > 0.9;

  // Send cloud progress heartbeat to Go backend every 5 seconds
  useEffect(() => {
    if (!playing || isLive || !playbackAllowed) return;
    const interval = window.setInterval(() => {
      api.sendProgressHeartbeat(title.id, progress, time, episode?.id);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [playing, isLive, playbackAllowed, title.id, progress, time, episode?.id]);

  /** Show loading spinner when playing from the start (buffering) or after a seek */
  const showSpinner = (playing && !isLive && progress < 0.01) || seekingSpinner;

  const persist = useCallback(
    (t: number) => {
      if (isLive) return;
      setProgress(title.id, clamp(t / effectiveDuration), episode?.id);
    },
    [effectiveDuration, episode?.id, isLive, setProgress, title.id],
  );

  // Fallback RAF-based clock when no real video stream is active
  useEffect(() => {
    if (!playing || Boolean(videoSrc) || !playbackAllowed) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = ((now - last) / 1000) * speed;
      last = now;
      setTime((t) => {
        if (isLive) return (Date.now() / 1000) % effectiveDuration;
        const n = Math.min(effectiveDuration, t + dt);
        if (n >= effectiveDuration) setPlaying(false);
        return n;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, isLive, effectiveDuration, videoSrc, playbackAllowed]);

  const timeRef = useRef(time);
  timeRef.current = time;

  // Persist progress on a 4-second interval
  useEffect(() => {
    if (!playbackAllowed) return;
    const id = window.setInterval(() => persist(timeRef.current), 4000);
    return () => window.clearInterval(id);
  }, [persist, playbackAllowed]);

  // Sync video element properties
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !playbackAllowed) return;
    v.muted = muted;
    v.volume = volume;
    v.playbackRate = speed;
    if (playing) {
      void v.play().catch(() => setPlaying(false));
    } else {
      v.pause();
    }
  }, [playing, muted, volume, speed, videoSrc, playbackAllowed]);

  // Auto-hide UI after inactivity
  const bumpUi = useCallback(() => {
    setShowUi(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (playing && !episodesOpen && !menus) setShowUi(false);
    }, 3200);
  }, [playing, episodesOpen, menus]);

  useEffect(() => {
    bumpUi();
  }, [bumpUi]);

  const toggleFs = () => {
    const el = shellRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      void el.requestFullscreen?.();
      setFs(true);
    } else {
      void document.exitFullscreen?.();
      setFs(false);
    }
  };

  /** Trigger seeking-spinner for SEEK_SPINNER_MS after any manual seek */
  const triggerSeekSpinner = () => {
    setSeekingSpinner(true);
    if (seekSpinnerTimer.current) window.clearTimeout(seekSpinnerTimer.current);
    seekSpinnerTimer.current = window.setTimeout(() => {
      setSeekingSpinner(false);
    }, SEEK_SPINNER_MS);
  };

  /** Show a flash label on the given side for SEEK_FLASH_MS */
  const triggerFlash = (side: "left" | "right") => {
    setSeekFlash(side);
    if (seekFlashTimer.current) window.clearTimeout(seekFlashTimer.current);
    seekFlashTimer.current = window.setTimeout(() => {
      setSeekFlash(null);
    }, SEEK_FLASH_MS);
  };

  const seekRel = useCallback((delta: number) => {
    if (isLive) return;
    const v = videoRef.current;
    const current = v && !isNaN(v.currentTime) ? v.currentTime : time;
    const next = clamp(current + delta, 0, effectiveDuration);
    if (v) {
      try {
        v.currentTime = next;
      } catch {
        // Ignore seek error if video not ready
      }
    }
    setTime(next);
    persist(next);
    triggerSeekSpinner();
    triggerFlash(delta < 0 ? "left" : "right");
  }, [effectiveDuration, isLive, persist, time]);

  const onSeek = (value: number) => {
    if (isLive) return;
    const v = videoRef.current;
    const target = clamp(value, 0, effectiveDuration);
    if (v) {
      try {
        v.currentTime = target;
      } catch {
        // Ignore seek error if video not ready
      }
    }
    setTime(target);
    persist(target);
    triggerSeekSpinner();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === "Space" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "ArrowRight" || e.key === "l" || e.key === "L") {
        e.preventDefault();
        seekRel(10);
      } else if (e.key === "ArrowLeft" || e.key === "j" || e.key === "J") {
        e.preventDefault();
        seekRel(-10);
      } else if (e.key === "m" || e.key === "M") {
        setMuted((m) => !m);
      } else if (e.key === "f" || e.key === "F") {
        toggleFs();
      } else if (e.key === "Escape") {
        if (episodesOpen) {
          setEpisodesOpen(false);
          return;
        }
        persist(timeRef.current);
        void navigate({ to: "/title/$id", params: { id: title.id } });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [persist, navigate, title.id, seekRel, episodesOpen]);

  const handlePip = async () => {
    const v = videoRef.current;
    if (!v) {
      toast("PiP not supported in this browser");
      return;
    }
    try {
      await v.requestPictureInPicture();
    } catch {
      toast("PiP not supported in this browser");
    }
  };

  const subtitle = subs && subTrack !== "Off" ? subtitleAt(title, time, subTrack) : null;

  if (!user) {
    return (
      <div className="grid min-h-svh place-items-center bg-bg text-fg select-none">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-accent border-solid mx-auto" />
          <p className="text-sm text-muted">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={shellRef}
      className="relative h-svh w-full overflow-hidden bg-bg select-none"
      onMouseMove={bumpUi}
      onTouchStart={bumpUi}
    >
      {/* ── Video or backdrop or Paywall Screen ── */}
      {!playbackAllowed ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-bg/95 p-6 text-center select-none">
          <BackdropArt title={title} kenburns={false} className="absolute inset-0 opacity-20 filter blur-md pointer-events-none" />
          <div className="relative z-10 max-w-md space-y-4 rounded-2xl bg-surface/90 border border-white/10 p-8 shadow-2xl backdrop-blur-md">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 mx-auto shadow-lg shadow-amber-500/10">
              <Crown className="size-7" />
            </div>
            <h2 className="font-display italic text-2xl font-bold text-fg sm:text-3xl">
              Subscription Upgrade Required
            </h2>
            <p className="text-sm text-muted leading-relaxed">
              {ticketMessage || `"${title.title}" is an exclusive title available on VIP tiers. Upgrade your account to enjoy 4K Ultra HD streaming.`}
            </p>
            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="play"
                onClick={() => setUpgradeModalOpen(true, title.title)}
                className="w-full sm:w-auto font-semibold"
              >
                Upgrade Plan
              </Button>
              <Button
                variant="line"
                onClick={() => navigate({ to: "/title/$id", params: { id: title.id } })}
                className="w-full sm:w-auto"
              >
                Go Back
              </Button>
            </div>
          </div>
        </div>
      ) : videoSrc ? (
        <video
          ref={videoRef}
          key={videoSrc}
          src={videoSrc}
          className="absolute inset-0 h-full w-full object-cover"
          loop={isLive}
          playsInline
          poster={title.backdrop || title.poster}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.duration && !isNaN(v.duration) && v.duration > 0 && !isLive) {
              setMediaDuration(v.duration);
              if (saved?.progress) {
                try {
                  v.currentTime = saved.progress * v.duration;
                } catch {
                  // Ignore initial seek error
                }
              }
            }
          }}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            if (!isLive) {
              setTime(v.currentTime);
            }
          }}
          onEnded={() => {
            setPlaying(false);
            if (nextEp) {
              toast(`Finished episode. Next up: ${nextEp.title}`, {
                action: {
                  label: "Play Next",
                  onClick: () => {
                    void navigate({
                      to: "/watch/$id",
                      params: { id: title.id },
                      search: { e: nextEp.id },
                    });
                  },
                },
              });
            } else {
              toast.info("Playback ended.");
            }
          }}
          onWaiting={() => setSeekingSpinner(true)}
          onPlaying={() => setSeekingSpinner(false)}
          onCanPlay={() => setSeekingSpinner(false)}
          onError={() => {
            console.warn("Stream failed, attempting fallback...");
            if (!backupStream && videoSrc !== "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4") {
              setBackupStream("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4");
              toast.info("Switching to backup HD stream...");
            } else {
              toast.error("Video stream unavailable. Showing cinematic backdrop.");
            }
          }}
        />
      ) : (
        <div className="absolute inset-0">
          <BackdropArt title={title} kenburns={playing} className="h-full" />
        </div>
      )}
      <div className="absolute inset-0 bg-bg/20 pointer-events-none" />

      {/* ── Loading / seeking spinner ── */}
      {showSpinner ? (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
          <Loader2 className="size-12 animate-spin text-fg/80" />
        </div>
      ) : null}

      {/* ── Mobile double-tap seek zones ── */}
      {/* Left third — seek -10s */}
      <button
        type="button"
        aria-label="Seek back 10 seconds"
        className="absolute inset-y-0 left-0 z-20 w-1/3"
        onDoubleClick={() => seekRel(-10)}
      />
      {/* Right third — seek +10s */}
      <button
        type="button"
        aria-label="Seek forward 10 seconds"
        className="absolute inset-y-0 right-0 z-20 w-1/3"
        onDoubleClick={() => seekRel(10)}
      />

      {/* ── Seek flash labels ── */}
      {seekFlash ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 z-30 flex items-center",
            seekFlash === "left" ? "left-0 w-1/3 justify-center" : "right-0 w-1/3 justify-center",
          )}
        >
          <span className="rounded-full bg-bg/80 border border-white/10 px-5 py-2.5 text-sm font-bold text-fg backdrop-blur-md shadow-2xl">
            {seekFlash === "left" ? "−10s" : "+10s"}
          </span>
        </div>
      ) : null}

      {/* ── Subtitle line ── */}
      {subtitle ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-28 z-20 mx-auto flex justify-center px-6 text-center">
          <p className="max-w-3xl rounded-md bg-black/80 px-4 py-1.5 text-lg font-medium text-white shadow-xl backdrop-blur-sm sm:text-xl border border-white/10">
            {subtitle}
          </p>
        </div>
      ) : null}

      {/* ── UI overlay ── */}
      <div
        className={cn(
          "absolute inset-0 z-30 flex flex-col justify-between transition-opacity duration-300",
          showUi ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        {/* ── Top bar ── */}
        <div className="relative z-10 flex items-center justify-between bg-gradient-to-b from-bg/90 via-bg/40 to-transparent px-4 pb-16 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="quiet"
              size="icon"
              aria-label="Back"
              onClick={() => {
                persist(time);
                void navigate({ to: "/title/$id", params: { id: title.id } });
              }}
            >
              <ChevronLeft className="size-6" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate font-display italic text-xl sm:text-2xl leading-tight">
                  {title.title}
                </p>
                {/* LIVE badge */}
                {isLive ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xs bg-live px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fg">
                    <span className="live-dot size-1.5 rounded-full bg-fg" />
                    LIVE
                  </span>
                ) : null}
              </div>
              {episode ? (
                <p className="truncate text-xs sm:text-sm text-muted">
                  S{episode.season} E{episode.number} · {episode.title}
                </p>
              ) : isLive ? (
                <p className="inline-flex items-center gap-2 text-xs sm:text-sm text-muted">
                  <span className="live-dot size-1.5 rounded-full bg-live" />
                  {title.live?.channel} · Streaming Live
                </p>
              ) : null}
            </div>
          </div>

          {/* Top Right Series Episodes trigger */}
          {title.episodes && title.episodes.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEpisodesOpen(true)}
              className="gap-2 shrink-0 border border-white/10"
            >
              <ListVideo className="size-4 text-accent" />
              <span>Episodes ({title.episodes.length})</span>
            </Button>
          )}
        </div>

        {/* ── Centre tap-to-pause ── */}
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-default"
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => setPlaying((p) => !p)}
        />

        {/* ── Bottom controls ── */}
        <div className="relative z-10 bg-gradient-to-t from-bg/95 via-bg/60 to-transparent px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-20 sm:px-8">
          {showSkip ? (
            <div className="mb-3 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSeek(effectiveDuration * 0.1)}
                className="border border-white/20 bg-black/60 shadow-lg hover:bg-black/90 backdrop-blur-md"
              >
                Skip intro
              </Button>
            </div>
          ) : null}

          {showNext && nextEp ? (
            <div className="mb-3 flex justify-end">
              <Button
                variant="play"
                size="sm"
                onClick={() => {
                  persist(0.02);
                  void navigate({
                    to: "/watch/$id",
                    params: { id: title.id },
                    search: { e: nextEp.id },
                  });
                }}
                className="gap-2 shadow-xl"
              >
                <span>Next episode ({nextEp.title})</span>
                <SkipForward className="size-4" />
              </Button>
            </div>
          ) : null}

          {/* Seek bar */}
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={effectiveDuration}
              step={1}
              value={Math.min(time, effectiveDuration)}
              aria-label="Seek"
              disabled={isLive}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-accent disabled:opacity-50 transition-all hover:h-2"
            />
            <span className="w-28 shrink-0 text-right text-xs tabular-nums text-muted font-medium">
              {isLive
                ? "Live"
                : `${formatClock(time)} / ${formatClock(effectiveDuration)}`}
            </span>
          </div>

          {/* Control row */}
          <div className="mt-3 flex items-center gap-1 sm:gap-2">
            {/* Rewind 10s */}
            <Button
              variant="quiet"
              size="icon"
              aria-label="Rewind 10 seconds"
              onClick={() => seekRel(-10)}
              disabled={isLive}
            >
              <RotateCcw className="size-5" />
            </Button>

            {/* Play / Pause */}
            <Button
              variant="quiet"
              size="icon"
              aria-label={playing ? "Pause" : "Play"}
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? (
                <Pause className="size-6 fill-current" />
              ) : (
                <Play className="size-6 fill-current ml-0.5" />
              )}
            </Button>

            {/* Forward 10s */}
            <Button
              variant="quiet"
              size="icon"
              aria-label="Forward 10 seconds"
              onClick={() => seekRel(10)}
              disabled={isLive}
            >
              <RotateCw className="size-5" />
            </Button>

            {/* Mute */}
            <Button
              variant="quiet"
              size="icon"
              aria-label={muted ? "Unmute" : "Mute"}
              onClick={() => setMuted((m) => !m)}
            >
              {muted || volume === 0 ? (
                <VolumeX className="size-5 text-accent" />
              ) : (
                <Volume2 className="size-5" />
              )}
            </Button>

            {/* Volume slider (desktop) */}
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              aria-label="Volume"
              className="hidden h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-white/20 accent-accent sm:block"
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                setMuted(v === 0);
              }}
            />

            {/* Right-side controls */}
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              {/* Episodes Drawer toggle (for series) */}
              {title.episodes && title.episodes.length > 0 && (
                <Button
                  variant="quiet"
                  size="icon"
                  aria-label="Episodes"
                  onClick={() => setEpisodesOpen(true)}
                  className="sm:hidden text-fg"
                >
                  <ListVideo className="size-5" />
                </Button>
              )}

              {/* Subtitles Menu */}
              <Menu
                open={menus === "subs"}
                onToggle={() =>
                  setMenus((m) => (m === "subs" ? null : "subs"))
                }
                label={
                  <div className="flex items-center gap-1">
                    <Subtitles className={cn("size-4", subs && subTrack !== "Off" ? "text-accent" : "text-muted")} />
                    <span className="hidden sm:inline text-xs">{subs && subTrack !== "Off" ? subTrack : "CC"}</span>
                  </div>
                }
              >
                <div className="p-1 min-w-36">
                  <p className="px-3 py-1.5 text-[11px] font-semibold uppercase text-muted tracking-wider">Subtitles</p>
                  {SUB_TRACKS.map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-2 text-left text-xs rounded-sm transition-colors",
                        (st === "Off" && (!subs || subTrack === "Off")) || (subs && st === subTrack)
                          ? "bg-accent/15 text-accent font-semibold"
                          : "text-muted hover:text-fg hover:bg-white/5",
                      )}
                      onClick={() => {
                        if (st === "Off") {
                          setSubs(false);
                          setSubTrack("Off");
                        } else {
                          setSubs(true);
                          setSubTrack(st);
                        }
                        setMenus(null);
                        toast(`Subtitles set to: ${st}`);
                      }}
                    >
                      <span>{st}</span>
                      {((st === "Off" && (!subs || subTrack === "Off")) || (subs && st === subTrack)) && (
                        <Check className="size-3.5 text-accent shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </Menu>

              {/* Audio Menu */}
              <Menu
                open={menus === "audio"}
                onToggle={() =>
                  setMenus((m) => (m === "audio" ? null : "audio"))
                }
                label="Audio"
              >
                <div className="p-1 min-w-56">
                  <p className="px-3 py-1.5 text-[11px] font-semibold uppercase text-muted tracking-wider">Audio Tracks</p>
                  {AUDIO_TRACKS.map((track) => (
                    <button
                      key={track}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-2 text-left text-xs rounded-sm transition-colors",
                        track === audioTrack
                          ? "bg-accent/15 text-accent font-semibold"
                          : "text-muted hover:text-fg hover:bg-white/5",
                      )}
                      onClick={() => {
                        setAudioTrack(track);
                        setMenus(null);
                        toast.success(`Audio: ${track}`);
                      }}
                    >
                      <span className="truncate">{track}</span>
                      {track === audioTrack && (
                        <Check className="size-3.5 text-accent shrink-0 ml-2" />
                      )}
                    </button>
                  ))}
                </div>
              </Menu>

              {/* Speed Menu */}
              <Menu
                open={menus === "speed"}
                onToggle={() =>
                  setMenus((m) => (m === "speed" ? null : "speed"))
                }
                label={`${speed}x`}
              >
                <div className="p-1 min-w-28">
                  <p className="px-3 py-1.5 text-[11px] font-semibold uppercase text-muted tracking-wider">Playback Speed</p>
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-1.5 text-left text-xs rounded-sm transition-colors",
                        s === speed ? "bg-accent/15 text-accent font-semibold" : "text-muted hover:text-fg hover:bg-white/5",
                      )}
                      onClick={() => {
                        setSpeed(s);
                        setMenus(null);
                      }}
                    >
                      <span>{s}x</span>
                      {s === speed && <Check className="size-3.5 text-accent shrink-0" />}
                    </button>
                  ))}
                </div>
              </Menu>

              {/* Quality Menu */}
              <Menu
                open={menus === "quality"}
                onToggle={() =>
                  setMenus((m) => (m === "quality" ? null : "quality"))
                }
                label={quality}
              >
                <div className="p-1 min-w-36">
                  <p className="px-3 py-1.5 text-[11px] font-semibold uppercase text-muted tracking-wider">Resolution</p>
                  {QUALITIES.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-2 text-left text-xs rounded-sm transition-colors",
                        q === quality ? "bg-accent/15 text-accent font-semibold" : "text-muted hover:text-fg hover:bg-white/5",
                      )}
                      onClick={() => {
                        if (q === "4K" && !isPremiumVIP) {
                          setMenus(null);
                          setUpgradeModalOpen(true, "4K Ultra HD Streaming");
                          return;
                        }
                        setQuality(q);
                        setMenus(null);
                        toast(`Streaming quality: ${q}`);
                      }}
                    >
                      <span className="flex items-center gap-1.5">
                        {q}
                        {q === "4K" && !isPremiumVIP && (
                          <span className="text-[9px] uppercase font-bold text-amber-400 bg-amber-500/20 px-1 py-0.2 rounded">VIP</span>
                        )}
                      </span>
                      {q === quality && <Check className="size-3.5 text-accent shrink-0 ml-2" />}
                    </button>
                  ))}
                </div>
              </Menu>

              {/* Picture-in-Picture */}
              {pipEnabled ? (
                <Button
                  variant="quiet"
                  size="icon"
                  aria-label="Picture in picture"
                  onClick={() => void handlePip()}
                >
                  <PictureInPicture2 className="size-5" />
                </Button>
              ) : null}

              {/* Fullscreen */}
              <Button
                variant="quiet"
                size="icon"
                aria-label="Fullscreen"
                onClick={toggleFs}
              >
                {fs ? (
                  <Minimize className="size-5" />
                ) : (
                  <Maximize className="size-5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Series Episodes Drawer Overlay ── */}
      {episodesOpen && title.episodes && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-elevated border-l border-white/10 h-full flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Film className="size-5 text-accent" />
                <h3 className="font-display italic text-xl">All Episodes</h3>
              </div>
              <Button
                variant="quiet"
                size="icon-sm"
                onClick={() => setEpisodesOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-1">
              {title.episodes.map((ep) => {
                const isCurrent = (episode?.id ?? title.episodes?.[0]?.id) === ep.id;
                return (
                  <button
                    key={ep.id}
                    type="button"
                    onClick={() => {
                      setEpisodesOpen(false);
                      persist(0.01);
                      void navigate({
                        to: "/watch/$id",
                        params: { id: title.id },
                        search: { e: ep.id },
                      });
                    }}
                    className={cn(
                      "w-full text-left p-3.5 rounded-lg border transition-all flex flex-col gap-1.5",
                      isCurrent
                        ? "bg-accent/15 border-accent/40 shadow-md"
                        : "bg-white/5 border-white/5 hover:border-white/15 hover:bg-white/10",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-accent">
                        Episode {ep.number} · {ep.runtime} min
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] uppercase font-bold text-accent bg-accent/20 px-2 py-0.5 rounded-full">
                          Playing Now
                        </span>
                      )}
                    </div>
                    <h4 className="font-medium text-sm text-fg leading-tight">
                      {ep.title}
                    </h4>
                    {ep.synopsis && (
                      <p className="text-xs text-muted line-clamp-2 mt-0.5">
                        {ep.synopsis}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Menu({
  open,
  onToggle,
  label,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="h-10 min-w-10 rounded-md px-2.5 text-xs font-medium text-fg hover:bg-white/10 flex items-center justify-center transition-colors"
      >
        {label}
      </button>
      {open ? (
        <div className="absolute bottom-12 right-0 overflow-hidden rounded-md bg-elevated/95 border border-white/10 shadow-2xl backdrop-blur-md z-50">
          {children}
        </div>
      ) : null}
    </div>
  );
}

// ── Helper functions ──────────────────────────────────────────────────────────

function nextEpisode(title: Title, current?: Episode) {
  const eps = title.episodes;
  if (!eps?.length) return undefined;
  if (!current) return eps[1];
  const i = eps.findIndex((e) => e.id === current.id);
  return i >= 0 ? eps[i + 1] : undefined;
}

function subtitleAt(title: Title, time: number, subTrack: string) {
  if (subTrack === "Off") return null;

  if (subTrack === "Tamil") {
    const tamilLines = [
      [8, 20, `${title.title} — காட்சி தொடங்குகிறது.`],
      [21, 35, title.logline],
      [36, 50, title.cast[0] ? `${title.cast[0].name} திரையில் தோன்றுகிறார்.` : "திரைப்படம் தொடர்கிறது."],
    ] as const;
    const t = time % 52;
    const hit = tamilLines.find(([a, b]) => t >= a && t < b);
    return hit?.[2];
  }

  if (subTrack === "Hindi") {
    const hindiLines = [
      [8, 20, `${title.title} — दृश्य शुरू होता है।`],
      [21, 35, title.logline],
      [36, 50, title.cast[0] ? `${title.cast[0].name} स्क्रीन पर।` : "फिल्म जारी है।"],
    ] as const;
    const t = time % 52;
    const hit = hindiLines.find(([a, b]) => t >= a && t < b);
    return hit?.[2];
  }

  // English subtitles (without any promotional presentation captions)
  const lines = [
    [8, 20, `${title.title} — Scene continues`],
    [21, 35, title.logline],
    [36, 50, title.cast[0] ? `Starring ${title.cast[0].name}` : title.title],
  ] as const;
  const t = time % 54;
  const hit = lines.find(([a, b]) => t >= a && t < b);
  return hit?.[2];
}

export function episodeFromSearch(title: Title, e?: string) {
  if (!e || !title.episodes) return title.episodes?.[0];
  return title.episodes.find((ep) => ep.id === e) ?? title.episodes[0];
}

export function resolveTitle(id: string) {
  return getTitle(id);
}
