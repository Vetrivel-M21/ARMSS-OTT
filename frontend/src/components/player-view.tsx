import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import Hls, { type Level } from "hls.js";
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

/**
 * Checks whether the browser hardware and software support decoding 4K (2160p) H.264
 * via the standard W3C MediaCapabilities API.
 */
async function check4KDecodeSupport(): Promise<boolean> {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaCapabilities?.decodingInfo
  ) {
    return true;
  }
  try {
    const info = await navigator.mediaCapabilities.decodingInfo({
      type: "media-source",
      video: {
        contentType: 'video/mp4; codecs="avc1.640033"',
        width: 3840,
        height: 2160,
        bitrate: 16000000,
        framerate: 24,
      },
    });
    return Boolean(info.supported);
  } catch {
    return true;
  }
}

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

  // If episode has a video URL, use it; otherwise check title videoUrl or trailer; fallback to sample
  const [backupStream, setBackupStream] = useState<string | null>(null);
  const [ticketStream, setTicketStream] = useState<string | null>(null);
  const videoSrc =
    backupStream ||
    ticketStream ||
    episode?.video_url ||
    episode?.videoUrl ||
    title.videoUrl ||
    (title as any).video_url ||
    title.trailer ||
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4";

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
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
    const targetVideoId = episode?.id || title.id;
    api
      .checkPlaybackTicket(targetVideoId)
      .then((ticket) => {
        if (!isMounted) return;

        if (ticket && ticket.allowed === false) {
          setPlaybackAllowed(false);
          setPlaying(false);
          setTicketMessage(ticket.message || "Upgrade your subscription to watch this exclusive title in full quality.");
          setUpgradeModalOpen(true, title.title);
        } else {
          setPlaybackAllowed(true);
          // Fetch stream ticket (/videos/:id/playback) to get signed HLS master manifest
          api
            .getPlayback(targetVideoId)
            .then((streamTicket) => {
              if (!isMounted) return;
              if (streamTicket.manifestUrl) {
                setTicketStream(streamTicket.manifestUrl);
                if (streamTicket.resumePositionSec > 0 && !saved?.progress) {
                  setTime(streamTicket.resumePositionSec);
                }
              }
            })
            .catch(() => {
              if (ticket.manifest_url) {
                setTicketStream(ticket.manifest_url);
              }
            });
        }
      })
      .catch(() => {
        // Allow fallback on network errors
      });

    return () => {
      isMounted = false;
    };
  }, [title.id, title.title, episode?.id, user?.subscription_tier, user, setUpgradeModalOpen]);

  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [fs, setFs] = useState(false);
  const [showUi, setShowUi] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [quality, setQuality] = useState<(typeof QUALITIES)[number]>("Auto");
  const [subs, setSubs] = useState(false);
  const [audioTrack, setAudioTrack] = useState("Tamil (Original · 5.1 Atmos)");
  const [subTrack, setSubTrack] = useState<string>("Off");
  const [audioTracksList, setAudioTracksList] = useState<{ id: number; name: string; lang?: string }[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<number>(0);
  const [subTracksList, setSubTracksList] = useState<{ id: number; name: string; lang?: string }[]>([]);
  const [selectedSubId, setSelectedSubId] = useState<number>(-1);
  const [menus, setMenus] = useState<"speed" | "quality" | "audio" | "subs" | null>(null);
  const [episodesOpen, setEpisodesOpen] = useState(false);

  const handleAudioSelect = (id: number, name: string) => {
    setSelectedAudioId(id);
    setAudioTrack(name);
    if (hlsRef.current && hlsRef.current.audioTracks.length > 0) {
      hlsRef.current.audioTrack = id;
    }
    setMenus(null);
    toast.success(`Audio: ${name}`);
  };

  const handleSubSelect = (id: number, name: string) => {
    setSelectedSubId(id);
    setSubTrack(id === -1 ? "Off" : name);
    setSubs(id !== -1);
    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = id;
      hlsRef.current.subtitleDisplay = id !== -1;
    }
    if (videoRef.current && videoRef.current.textTracks) {
      for (let i = 0; i < videoRef.current.textTracks.length; i++) {
        videoRef.current.textTracks[i].mode = (i === id) ? "showing" : "disabled";
      }
    }
    setMenus(null);
    if (id === -1) {
      toast("Subtitles turned off");
    } else {
      toast.success(`Subtitles: ${name}`);
    }
  };

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

  // Hls.js Lifecycle & Stream Setup
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !playbackAllowed || !videoSrc) return;

    let isCancelled = false;

    // Destroy any existing HLS instance before attaching a new one
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Resolve absolute URL if relative
    let resolvedUrl = videoSrc;
    if (resolvedUrl.startsWith("/")) {
      const customApi = import.meta.env.VITE_API_BASE_URL;
      if (customApi && !customApi.startsWith("/")) {
        const apiHost = customApi.replace(/\/api\/?$/, "");
        resolvedUrl = `${apiHost}${resolvedUrl}`;
      } else if (typeof window !== "undefined") {
        resolvedUrl = `${window.location.origin}${resolvedUrl}`;
      }
    }

    const isHlsStream = resolvedUrl.includes(".m3u8");

    if (isHlsStream && Hls.isSupported()) {
      const hls = new Hls({
        capLevelToPlayerSize: true, // Cap rung to player display size
        startLevel: 0, // Fast start: download lowest rung for instant first frame
        maxBufferLength: 25,
        maxMaxBufferLength: 50,
        maxBufferSize: 30 * 1000 * 1000,
        backBufferLength: 15,
        enableWorker: true,
        progressive: true,
        lowLatencyMode: false,
        xhrSetup: (xhr) => {
          xhr.withCredentials = false;
        },
      });
      hlsRef.current = hls;

      hls.loadSource(resolvedUrl);
      hls.attachMedia(v);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        if (isCancelled) return;
        setLevels(data.levels);
        hls.currentLevel = -1; // Auto ABR

        // Parse and populate audio tracks if available
        if (hls.audioTracks && hls.audioTracks.length > 0) {
          const parsed = hls.audioTracks.map((t, idx) => ({
            id: idx,
            name: t.name || t.lang || `Track ${idx + 1}`,
            lang: t.lang,
          }));
          setAudioTracksList(parsed);
          const activeIndex = hls.audioTrack >= 0 ? hls.audioTrack : 0;
          setSelectedAudioId(activeIndex);
          if (parsed[activeIndex]) {
            setAudioTrack(parsed[activeIndex].name);
          }
        }

        // Parse and populate subtitle tracks if available
        if (hls.subtitleTracks && hls.subtitleTracks.length > 0) {
          const parsedSubs = hls.subtitleTracks.map((t, idx) => ({
            id: idx,
            name: t.name || t.lang || `Subtitle ${idx + 1}`,
            lang: t.lang,
          }));
          setSubTracksList(parsedSubs);
          setSelectedSubId(hls.subtitleTrack);
          if (hls.subtitleTrack >= 0 && parsedSubs[hls.subtitleTrack]) {
            setSubTrack(parsedSubs[hls.subtitleTrack].name);
            setSubs(true);
          }
        }

        if (time > 0 && v.duration) {
          try {
            v.currentTime = time;
          } catch {}
        }

        if (playing) {
          v.play().catch(() => setPlaying(false));
        }
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
        if (isCancelled) return;
        if (data.audioTracks && data.audioTracks.length > 0) {
          const parsed = data.audioTracks.map((t, idx) => ({
            id: idx,
            name: t.name || t.lang || `Track ${idx + 1}`,
            lang: t.lang,
          }));
          setAudioTracksList(parsed);
          const activeIndex = hls.audioTrack >= 0 ? hls.audioTrack : 0;
          if (parsed[activeIndex]) {
            setSelectedAudioId(activeIndex);
            setAudioTrack(parsed[activeIndex].name);
          }
        }
      });

      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
        if (isCancelled) return;
        if (data.subtitleTracks && data.subtitleTracks.length > 0) {
          const parsedSubs = data.subtitleTracks.map((t, idx) => ({
            id: idx,
            name: t.name || t.lang || `Subtitle ${idx + 1}`,
            lang: t.lang,
          }));
          setSubTracksList(parsedSubs);
          setSelectedSubId(hls.subtitleTrack);
          if (hls.subtitleTrack >= 0 && parsedSubs[hls.subtitleTrack]) {
            setSubTrack(parsedSubs[hls.subtitleTrack].name);
            setSubs(true);
          }
        }
      });

      hls.on(Hls.Events.ERROR, (_, errData) => {
        if (isCancelled) return;

        // Handle token expiration by re-fetching ticket
        if (errData.response?.code === 401 || errData.response?.code === 403) {
          console.warn("[PlayerView] Playback token expired. Refreshing ticket...");
          const resumeAt = v.currentTime;
          const targetVideoId = episode?.id || title.id;
          api.getPlayback(targetVideoId)
            .then((freshTicket) => {
              let freshUrl = freshTicket.manifestUrl;
              if (freshUrl.startsWith("/")) {
                const customApi = import.meta.env.VITE_API_BASE_URL;
                if (customApi && !customApi.startsWith("/")) {
                  const apiHost = customApi.replace(/\/api\/?$/, "");
                  freshUrl = `${apiHost}${freshUrl}`;
                } else if (typeof window !== "undefined") {
                  freshUrl = `${window.location.origin}${freshUrl}`;
                }
              }
              setTicketStream(freshUrl);
              hls.loadSource(freshUrl);
              hls.startLoad(resumeAt);
            })
            .catch(() => {
              toast.error("Your streaming session has expired. Please sign in again.");
            });
          return;
        }

        if (errData.fatal) {
          switch (errData.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn("[PlayerView] Fatal network error. Attempting recovery...");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn("[PlayerView] Fatal media error. Attempting recovery...");
              hls.recoverMediaError();
              break;
            default:
              console.warn("[PlayerView] Unrecoverable HLS error:", errData);
              hls.destroy();
              if (!backupStream && videoSrc !== "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4") {
                setBackupStream("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4");
                toast.info("Switching to backup HD stream...");
              } else {
                toast.error("Video stream unavailable. Showing cinematic backdrop.");
              }
              break;
          }
        }
      });
    } else if (isHlsStream && v.canPlayType("application/vnd.apple.mpegurl")) {
      // Native Safari HLS
      v.src = resolvedUrl;
      if (playing) {
        v.play().catch(() => setPlaying(false));
      }
    } else {
      // Direct MP4 or static asset fallback
      v.src = resolvedUrl;
      if (playing) {
        v.play().catch(() => setPlaying(false));
      }
    }

    return () => {
      isCancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [videoSrc, playbackAllowed]);

  // Sync video element playback properties
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
  }, [playing, muted, volume, speed, playbackAllowed]);

  // Handle Quality Selection (ABR vs Fixed Resolution)
  const handleQualitySelect = async (q: (typeof QUALITIES)[number]) => {
    if (q === "4K") {
      if (!isPremiumVIP) {
        setMenus(null);
        setUpgradeModalOpen(true, "4K Ultra HD Streaming");
        return;
      }
      const canDecode = await check4KDecodeSupport();
      if (!canDecode) {
        toast.warning("Hardware 4K decoding might experience frame drops on this display.");
      }
    }

    setQuality(q);
    setMenus(null);

    const hls = hlsRef.current;
    if (!hls || levels.length === 0) {
      toast(`Streaming quality: ${q}`);
      return;
    }

    if (q === "Auto") {
      hls.currentLevel = -1;
      toast.success("Streaming quality: Auto (Adaptive Bitrate)");
      return;
    }

    const targetHeight = q === "4K" ? 2160 : q === "1080p" ? 1080 : 720;
    let bestIdx = -1;
    let bestDiff = 999999;
    levels.forEach((lvl, idx) => {
      const diff = Math.abs(lvl.height - targetHeight);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = idx;
      }
    });

    if (bestIdx !== -1) {
      hls.currentLevel = bestIdx;
      toast.success(`Locked resolution: ${levels[bestIdx].height}p (${q})`);
    } else {
      toast(`Streaming quality: ${q}`);
    }
  };

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
              style={{
                background: isLive
                  ? "#e50914"
                  : `linear-gradient(to right, #e50914 ${clamp(progress * 100, 0, 100)}%, rgba(255, 255, 255, 0.25) ${clamp(progress * 100, 0, 100)}%)`,
              }}
              className="player-range h-1.5 w-full cursor-pointer rounded-full disabled:opacity-50 transition-all hover:h-2.5"
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
                <VolumeX className="size-5 text-[#e50914]" />
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
              style={{
                background: `linear-gradient(to right, #e50914 ${(muted ? 0 : volume) * 100}%, rgba(255, 255, 255, 0.25) ${(muted ? 0 : volume) * 100}%)`,
              }}
              className="player-range hidden h-1.5 w-24 cursor-pointer rounded-full sm:block transition-all hover:h-2"
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
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-left text-xs rounded-sm transition-colors",
                      !subs || subTrack === "Off"
                        ? "bg-accent/15 text-accent font-semibold"
                        : "text-muted hover:text-fg hover:bg-white/5",
                    )}
                    onClick={() => handleSubSelect(-1, "Off")}
                  >
                    <span>Off</span>
                    {(!subs || subTrack === "Off") && (
                      <Check className="size-3.5 text-accent shrink-0" />
                    )}
                  </button>
                  {subTracksList.length > 0
                    ? subTracksList.map((st) => (
                        <button
                          key={`sub-${st.id}`}
                          type="button"
                          className={cn(
                            "flex w-full items-center justify-between px-3 py-2 text-left text-xs rounded-sm transition-colors",
                            subs && selectedSubId === st.id
                              ? "bg-accent/15 text-accent font-semibold"
                              : "text-muted hover:text-fg hover:bg-white/5",
                          )}
                          onClick={() => handleSubSelect(st.id, st.name)}
                        >
                          <span className="truncate">{st.name}</span>
                          {subs && selectedSubId === st.id && (
                            <Check className="size-3.5 text-accent shrink-0 ml-2" />
                          )}
                        </button>
                      ))
                    : SUB_TRACKS.filter((s) => s !== "Off").map((st, idx) => (
                        <button
                          key={st}
                          type="button"
                          className={cn(
                            "flex w-full items-center justify-between px-3 py-2 text-left text-xs rounded-sm transition-colors",
                            subs && subTrack === st
                              ? "bg-accent/15 text-accent font-semibold"
                              : "text-muted hover:text-fg hover:bg-white/5",
                          )}
                          onClick={() => handleSubSelect(idx, st)}
                        >
                          <span>{st}</span>
                          {subs && subTrack === st && (
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
                  {audioTracksList.length > 0
                    ? audioTracksList.map((track) => (
                        <button
                          key={`audio-${track.id}`}
                          type="button"
                          className={cn(
                            "flex w-full items-center justify-between px-3 py-2 text-left text-xs rounded-sm transition-colors",
                            selectedAudioId === track.id
                              ? "bg-accent/15 text-accent font-semibold"
                              : "text-muted hover:text-fg hover:bg-white/5",
                          )}
                          onClick={() => handleAudioSelect(track.id, track.name)}
                        >
                          <span className="truncate">{track.name}</span>
                          {selectedAudioId === track.id && (
                            <Check className="size-3.5 text-accent shrink-0 ml-2" />
                          )}
                        </button>
                      ))
                    : AUDIO_TRACKS.map((track, idx) => (
                        <button
                          key={track}
                          type="button"
                          className={cn(
                            "flex w-full items-center justify-between px-3 py-2 text-left text-xs rounded-sm transition-colors",
                            track === audioTrack
                              ? "bg-accent/15 text-accent font-semibold"
                              : "text-muted hover:text-fg hover:bg-white/5",
                          )}
                          onClick={() => handleAudioSelect(idx, track)}
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
                      onClick={() => void handleQualitySelect(q)}
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
