import React, { useCallback, useEffect, useRef, useState } from "react";
import Hls, { type HlsConfig, type Level } from "hls.js";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  FastForward,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  Volume2,
  VolumeX,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAether } from "@/lib/store";
import { cn, formatClock } from "@/lib/utils";

export interface VideoPlayerProps {
  videoId: string;
  title?: string;
  subtitle?: string;
  fallbackUrl?: string;
  onBack?: () => void;
  className?: string;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * Checks whether the browser hardware and software support decoding 4K (2160p) H.264
 * via the standard W3C MediaCapabilities API.
 */
async function check4KDecodeSupport(): Promise<boolean> {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaCapabilities?.decodingInfo
  ) {
    return true; // assume supported if API absent
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

export function VideoPlayer({
  videoId,
  title,
  subtitle,
  fallbackUrl,
  onBack,
  className,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const deviceIdRef = useRef<string>(
    typeof window !== "undefined"
      ? localStorage.getItem("armss_device_id") || "dev-" + crypto.randomUUID().slice(0, 8)
      : "dev-web",
  );

  const user = useAether((s) => s.user);

  // Playback state
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ABR & Quality state
  const [levels, setLevels] = useState<Level[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1); // -1 = Auto
  const [autoLevelResolution, setAutoLevelResolution] = useState<string>("");
  const [supports4K, setSupports4K] = useState(true);

  // Loading & Error state
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Controls UI visibility
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<number | null>(null);
  const [activeMenu, setActiveMenu] = useState<"quality" | "speed" | null>(null);

  // Store device ID locally
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("armss_device_id", deviceIdRef.current);
    }
  }, []);

  // 1. Probing 4K MediaCapabilities
  useEffect(() => {
    let active = true;
    check4KDecodeSupport().then((supported) => {
      if (active) {
        setSupports4K(supported);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Auto-hide controls helper
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (playing && !activeMenu) {
        setShowControls(false);
      }
    }, 3000);
  }, [playing, activeMenu]);

  // 2. Playback Session Initialization & Hls.js Setup
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    async function initPlayback() {
      try {
        let manifestUrl = "";
        let initialSeek = 0;

        try {
          const ticket = await api.getPlayback(videoId, "web", deviceIdRef.current);
          manifestUrl = ticket.manifestUrl;
          initialSeek = ticket.resumePositionSec || 0;
        } catch (ticketErr) {
          console.warn("[VideoPlayer] Ticket request failed, falling back to direct stream:", ticketErr);
          if (fallbackUrl) {
            manifestUrl = fallbackUrl;
          } else {
            throw ticketErr;
          }
        }

        if (isCancelled) return;
        const video = videoRef.current;
        if (!video) return;

        // Ensure full manifest URL (prepending origin if relative)
        if (manifestUrl.startsWith("/")) {
          const apiHost = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8081/api").replace(/\/api\/?$/, "");
          manifestUrl = `${apiHost}${manifestUrl}`;
        }

        // Cleanup existing instance before reattaching
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }

        const isHls = manifestUrl.includes(".m3u8");

        // Direct MP4 / HTML5 stream branch
        if (!isHls) {
          video.src = manifestUrl;
          video.onloadedmetadata = () => {
            if (isCancelled) return;
            setIsLoading(false);
            if (initialSeek > 0) {
              video.currentTime = initialSeek;
            }
            video.play().catch(() => setPlaying(false));
          };
          video.onerror = () => {
            if (isCancelled) return;
            if (fallbackUrl && manifestUrl !== fallbackUrl) {
              let fbUrl = fallbackUrl;
              if (fbUrl.startsWith("/")) {
                const apiHost = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8081/api").replace(/\/api\/?$/, "");
                fbUrl = `${apiHost}${fbUrl}`;
              }
              video.src = fbUrl;
              return;
            }
            setIsLoading(false);
            setErrorMessage("Failed to play video stream. Please check video file URL.");
          };
          return;
        }

        // Hls.js supported path
        if (Hls.isSupported()) {
          const hlsConfig: Partial<HlsConfig> = {
            capLevelToPlayerSize: true, // Cap rung to player display size
            startLevel: -1, // Start on optimal ABR level
            maxBufferLength: 30, // 30s forward buffer
            maxMaxBufferLength: 60, // 60s max forward buffer
            maxBufferSize: 60 * 1000 * 1000, // 60MB max buffer
            backBufferLength: 30, // 30s rewind buffer
            enableWorker: true,
            lowLatencyMode: false,
            xhrSetup: (xhr) => {
              xhr.withCredentials = false;
            },
          };

          const hls = new Hls(hlsConfig);
          hlsRef.current = hls;

          hls.loadSource(manifestUrl);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
            if (isCancelled) return;
            setLevels(data.levels);
            setIsLoading(false);

            // Start mid-level if multiple levels are available
            if (data.levels.length > 2 && hls.startLevel === -1) {
              const mid = Math.floor(data.levels.length / 2);
              hls.nextLevel = mid;
            }

            // Resume playback position
            if (initialSeek > 0) {
              video.currentTime = initialSeek;
            }

            video.play().catch(() => {
              setPlaying(false);
            });
          });

          hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
            if (isCancelled) return;
            const lvl = hls.levels[data.level];
            if (lvl) {
              setAutoLevelResolution(`${lvl.height}p`);
            }
          });

          // Handle Error & Retry Policies
          hls.on(Hls.Events.ERROR, (_, errData) => {
            if (isCancelled) return;

            // Handle 401 or token expiration by re-fetching ticket
            if (errData.response?.code === 401 || errData.response?.code === 403) {
              console.warn("[VideoPlayer] Playback token expired. Refreshing ticket...");
              const resumeAt = video.currentTime;
              api.getPlayback(videoId, "web", deviceIdRef.current)
                .then((freshTicket) => {
                  let freshUrl = freshTicket.manifestUrl;
                  if (freshUrl.startsWith("/")) {
                    const apiHost = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8081/api").replace(/\/api\/?$/, "");
                    freshUrl = `${apiHost}${freshUrl}`;
                  }
                  hls.loadSource(freshUrl);
                  hls.startLoad(resumeAt);
                })
                .catch(() => {
                  setErrorMessage("Your streaming session has expired. Please sign in again.");
                });
              return;
            }

            if (errData.fatal) {
              switch (errData.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  console.warn("[VideoPlayer] Fatal network error. Attempting recovery...");
                  hls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  console.warn("[VideoPlayer] Fatal media error. Attempting recovery...");
                  hls.recoverMediaError();
                  break;
                default:
                  console.error("[VideoPlayer] Unrecoverable HLS error:", errData);
                  hls.destroy();
                  setErrorMessage("Failed to play this video. Please check your network connection.");
                  break;
              }
            }
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          // Native Safari / iOS HLS
          video.src = manifestUrl;
          video.addEventListener("loadedmetadata", () => {
            if (isCancelled) return;
            setIsLoading(false);
            if (initialSeek > 0) {
              video.currentTime = initialSeek;
            }
            video.play().catch(() => setPlaying(false));
          });
        } else {
          setErrorMessage("HLS streaming is not supported on this browser.");
          setIsLoading(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setIsLoading(false);
          setErrorMessage(err.message || "Failed to initialize video playback.");
        }
      }
    }

    void initPlayback();

    return () => {
      isCancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [videoId, retryCount]);

  // 3. Periodic Progress Synchronization (Every 15s) & Concurrency Heartbeat (Every 20s)
  useEffect(() => {
    if (!playing || isLoading || errorMessage) return;

    // Watch progress sync
    const progressInterval = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.duration <= 0) return;
      const progressPercent = (video.currentTime / video.duration) * 100;
      void api.saveWatchProgress(
        videoId,
        video.currentTime,
        progressPercent,
        "default",
        deviceIdRef.current,
      );
    }, 15000);

    // Concurrency heartbeat
    const heartbeatInterval = window.setInterval(() => {
      void api.sendStreamHeartbeat(
        videoId,
        sessionIdRef.current,
        deviceIdRef.current,
      );
    }, 20000);

    return () => {
      window.clearInterval(progressInterval);
      window.clearInterval(heartbeatInterval);
    };
  }, [playing, isLoading, errorMessage, videoId]);

  // 4. Video Events Wiring
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      // Update buffered range
      if (video.buffered.length > 0) {
        for (let i = video.buffered.length - 1; i >= 0; i--) {
          if (video.buffered.start(i) <= video.currentTime) {
            setBufferedTime(video.buffered.end(i));
            break;
          }
        }
      }
    };
    const onDurationChange = () => setDuration(video.duration || 0);
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
    };
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl?.tagName === "INPUT" || activeEl?.tagName === "TEXTAREA") {
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "arrowleft":
        case "j":
          e.preventDefault();
          seekBy(-10);
          break;
        case "arrowright":
        case "l":
          e.preventDefault();
          seekBy(10);
          break;
        case "arrowup":
          e.preventDefault();
          adjustVolume(0.1);
          break;
        case "arrowdown":
          e.preventDefault();
          adjustVolume(-0.1);
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
      }
      resetControlsTimer();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [resetControlsTimer]);

  // Controls Handlers
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    resetControlsTimer();
  };

  const seekBy = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
    resetControlsTimer();
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const target = (parseFloat(e.target.value) / 100) * duration;
    video.currentTime = target;
    setCurrentTime(target);
    resetControlsTimer();
  };

  const adjustVolume = (delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    const newVol = Math.max(0, Math.min(1, volume + delta));
    video.volume = newVol;
    setVolume(newVol);
    setMuted(newVol === 0);
    resetControlsTimer();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !muted;
    video.muted = nextMuted;
    setMuted(nextMuted);
    resetControlsTimer();
  };

  const handleSpeedSelect = (s: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = s;
    setSpeed(s);
    setActiveMenu(null);
    resetControlsTimer();
  };

  const handleQualitySelect = (levelIndex: number) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = levelIndex;
    setCurrentLevel(levelIndex);
    setActiveMenu(null);
    resetControlsTimer();
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleRetry = () => {
    setErrorMessage(null);
    setRetryCount((c) => c + 1);
  };

  // Filter levels: skip 4K (2160p) if mediaCapabilities reported lack of decode support
  const filteredLevels = levels.filter((lvl) => {
    if (lvl.height >= 2160 && !supports4K) {
      return false;
    }
    return true;
  });

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
      className={cn(
        "relative w-full h-full bg-black select-none overflow-hidden group font-sans flex items-center justify-center",
        className,
      )}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        playsInline
        onClick={togglePlay}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Buffering & Initial Loading Spinner */}
      {(isLoading || isBuffering) && !errorMessage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/40 backdrop-blur-[2px] transition-opacity">
          <Loader2 className="w-12 h-12 text-red-600 animate-spin" />
          <span className="text-white text-xs mt-3 tracking-wider uppercase font-medium">
            {isLoading ? "Loading HD Stream..." : "Buffering..."}
          </span>
        </div>
      )}

      {/* Error State Banner */}
      {errorMessage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-6 text-center z-50">
          <AlertCircle className="w-14 h-14 text-red-500 mb-4" />
          <h3 className="text-white text-lg font-bold mb-2">Playback Unavailable</h3>
          <p className="text-zinc-400 text-sm max-w-md mb-6">{errorMessage}</p>
          <div className="flex gap-4">
            <button
              onClick={handleRetry}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium text-sm rounded-lg transition-colors cursor-pointer"
            >
              Try Again
            </button>
            {onBack && (
              <button
                onClick={onBack}
                className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-sm rounded-lg transition-colors cursor-pointer"
              >
                Go Back
              </button>
            )}
          </div>
        </div>
      )}

      {/* Overlay Header: Back button & Title */}
      <div
        className={cn(
          "absolute top-0 inset-x-0 p-6 flex items-center gap-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent transition-opacity duration-300 z-30",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all cursor-pointer"
            title="Go Back"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        <div>
          {title && <h2 className="text-white font-bold text-lg leading-tight">{title}</h2>}
          {subtitle && <p className="text-zinc-400 text-xs font-medium">{subtitle}</p>}
        </div>
      </div>

      {/* Center Tap Play/Pause Button */}
      <button
        onClick={togglePlay}
        className={cn(
          "absolute p-5 rounded-full bg-black/50 text-white backdrop-blur-md transition-all duration-300 transform cursor-pointer hover:scale-110",
          !playing || !showControls ? "opacity-100" : "opacity-0 pointer-events-none scale-90",
        )}
      >
        {playing ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10 ml-1" />}
      </button>

      {/* Bottom Controls Bar */}
      <div
        className={cn(
          "absolute bottom-0 inset-x-0 px-6 pb-6 pt-12 flex flex-col gap-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 z-30",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        {/* Progress & Seek Bar */}
        <div className="relative group/bar flex items-center h-4 cursor-pointer">
          {/* Track background */}
          <div className="absolute inset-x-0 h-1 group-hover/bar:h-2 bg-white/20 rounded-full overflow-hidden transition-all">
            {/* Buffered progress */}
            <div
              className="h-full bg-white/30 transition-all duration-150"
              style={{ width: `${bufferedPercent}%` }}
            />
          </div>
          {/* Played progress */}
          <div
            className="absolute left-0 h-1 group-hover/bar:h-2 bg-red-600 rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
          {/* Range Slider for Interaction */}
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={progressPercent || 0}
            onChange={handleSeekChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Action Controls Row */}
        <div className="flex items-center justify-between text-white text-sm">
          {/* Left Controls: Play, -10s, +10s, Volume, Clock */}
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlay}
              className="hover:text-red-500 transition-colors cursor-pointer"
              title={playing ? "Pause (Space)" : "Play (Space)"}
            >
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>

            <button
              onClick={() => seekBy(-10)}
              className="hover:text-red-500 transition-colors cursor-pointer"
              title="Rewind 10s (Left Arrow)"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              onClick={() => seekBy(10)}
              className="hover:text-red-500 transition-colors cursor-pointer"
              title="Forward 10s (Right Arrow)"
            >
              <RotateCw className="w-5 h-5" />
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-2 group/vol">
              <button
                onClick={toggleMute}
                className="hover:text-red-500 transition-colors cursor-pointer"
                title={muted ? "Unmute (M)" : "Mute (M)"}
              >
                {muted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  setMuted(val === 0);
                  if (videoRef.current) {
                    videoRef.current.volume = val;
                    videoRef.current.muted = val === 0;
                  }
                }}
                className="w-16 h-1 bg-white/20 accent-red-600 rounded-lg cursor-pointer transition-all"
              />
            </div>

            {/* Timestamps */}
            <span className="text-zinc-300 text-xs font-mono">
              {formatClock(currentTime)} / {formatClock(duration)}
            </span>
          </div>

          {/* Right Controls: Quality, Speed, Fullscreen */}
          <div className="flex items-center gap-4">
            {/* Quality Selector */}
            <div className="relative">
              <button
                onClick={() => setActiveMenu(activeMenu === "quality" ? null : "quality")}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors cursor-pointer"
                title="Quality"
              >
                <span>
                  {currentLevel === -1
                    ? `Auto ${autoLevelResolution ? `(${autoLevelResolution})` : ""}`
                    : `${levels[currentLevel]?.height || 1080}p`}
                </span>
              </button>

              {activeMenu === "quality" && (
                <div className="absolute bottom-full right-0 mb-3 w-40 bg-zinc-900/95 border border-white/10 rounded-lg shadow-xl backdrop-blur-md p-1.5 z-50 text-xs">
                  <div className="px-2 py-1 text-zinc-400 font-semibold uppercase text-[10px] tracking-wider border-b border-white/5 mb-1">
                    Quality
                  </div>
                  <button
                    onClick={() => handleQualitySelect(-1)}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-white/10 text-left cursor-pointer transition-colors",
                      currentLevel === -1 && "text-red-500 font-semibold",
                    )}
                  >
                    <span>Auto {autoLevelResolution ? `(${autoLevelResolution})` : ""}</span>
                    {currentLevel === -1 && <Check className="w-3.5 h-3.5" />}
                  </button>

                  {filteredLevels.map((lvl, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQualitySelect(idx)}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-white/10 text-left cursor-pointer transition-colors",
                        currentLevel === idx && "text-red-500 font-semibold",
                      )}
                    >
                      <span>
                        {lvl.height}p {lvl.height >= 2160 ? "4K" : lvl.height >= 1080 ? "FHD" : "HD"}
                      </span>
                      {currentLevel === idx && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Speed Selector */}
            <div className="relative">
              <button
                onClick={() => setActiveMenu(activeMenu === "speed" ? null : "speed")}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors cursor-pointer"
                title="Playback Speed"
              >
                <span>{speed === 1 ? "1.0x" : `${speed}x`}</span>
              </button>

              {activeMenu === "speed" && (
                <div className="absolute bottom-full right-0 mb-3 w-32 bg-zinc-900/95 border border-white/10 rounded-lg shadow-xl backdrop-blur-md p-1.5 z-50 text-xs">
                  <div className="px-2 py-1 text-zinc-400 font-semibold uppercase text-[10px] tracking-wider border-b border-white/5 mb-1">
                    Speed
                  </div>
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSpeedSelect(s)}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-white/10 text-left cursor-pointer transition-colors",
                        speed === s && "text-red-500 font-semibold",
                      )}
                    >
                      <span>{s === 1 ? "Normal (1.0x)" : `${s}x`}</span>
                      {speed === s && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="hover:text-red-500 transition-colors cursor-pointer"
              title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
