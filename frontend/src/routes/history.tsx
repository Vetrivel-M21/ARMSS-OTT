import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Clock,
  Film,
  Filter,
  History,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Tv,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api, type HistoryItem } from "@/lib/api";
import { getTitle, type Title } from "@/lib/catalog";
import { useAether } from "@/lib/store";
import { cn, formatClock, formatRuntime } from "@/lib/utils";
import { PosterArt, BackdropArt } from "@/components/poster";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/history")({ component: HistoryPage });

type FilterType = "all" | "film" | "series" | "in-progress" | "completed";

export function HistoryPage() {
  const navigate = useNavigate();
  const user = useAether((s) => s.user);
  const profile = useAether((s) => s.activeProfile) ?? "arjun";
  const continueWatching = useAether((s) => s.continueWatching[profile] ?? []);
  const clearContinue = useAether((s) => s.clearContinue);
  const removeContinue = useAether((s) => s.removeContinue);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [clearing, setClearing] = useState(false);

  // Fetch watch history from backend
  const loadHistory = async () => {
    setLoading(true);
    try {
      const historyItems = await api.getHistory(profile);
      if (historyItems && historyItems.length > 0) {
        setItems(historyItems);
      } else {
        // Fallback to local store continueWatching if backend has no entries yet
        const localItems: HistoryItem[] = continueWatching
          .map((c) => {
            const t = getTitle(c.id);
            if (!t) return null;
            const runtimeSec = t.runtimeMin * 60;
            return {
              title_id: t.id,
              title: t.title,
              poster: t.poster,
              backdrop: t.backdrop,
              kind: t.kind,
              runtime_min: t.runtimeMin,
              episode_id: c.episodeId,
              progress_percent: Math.round(c.progress * 1000) / 10,
              time_seconds: Math.round(c.progress * runtimeSec),
              updated_at: new Date(c.updatedAt).toISOString(),
            } as HistoryItem;
          })
          .filter((x): x is HistoryItem => Boolean(x));
        setItems(localItems);
      }
    } catch {
      // Fallback to local
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, [profile, user]);

  // Remove single title
  const handleRemoveItem = async (titleId: string, titleName: string) => {
    const prev = items;
    setItems((curr) => curr.filter((i) => i.title_id !== titleId));
    removeContinue(titleId);
    toast.success(`Removed "${titleName}" from viewing history`);

    if (user) {
      const ok = await api.deleteHistoryItem(titleId);
      if (!ok) {
        // Revert on failure
        setItems(prev);
        toast.error("Failed to remove from cloud history");
      }
    }
  };

  // Clear all history
  const handleClearAll = async () => {
    if (items.length === 0) return;
    if (!confirm("Are you sure you want to clear your entire viewing history? This cannot be undone.")) {
      return;
    }

    setClearing(true);
    const prev = items;
    setItems([]);
    clearContinue();

    if (user) {
      const ok = await api.clearHistory();
      if (ok) {
        toast.success("Watch history cleared successfully.");
      } else {
        setItems(prev);
        toast.error("Failed to clear cloud history.");
      }
    } else {
      toast.success("Watch history cleared.");
    }
    setClearing(false);
  };

  // Filtered & searched items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesKind = item.kind.toLowerCase().includes(q);
        if (!matchesTitle && !matchesKind) return false;
      }

      // Filter category
      if (filter === "film") return item.kind === "film";
      if (filter === "series") return item.kind === "series";
      if (filter === "completed") return item.progress_percent >= 90;
      if (filter === "in-progress") return item.progress_percent < 90;
      return true;
    });
  }, [items, search, filter]);

  // Total watch metrics
  const totalWatchSeconds = useMemo(() => {
    return items.reduce((acc, i) => acc + (i.time_seconds || 0), 0);
  }, [items]);

  const totalWatchHours = Math.round((totalWatchSeconds / 3600) * 10) / 10;
  const completedCount = useMemo(() => {
    return items.filter((i) => i.progress_percent >= 90).length;
  }, [items]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-8 sm:pt-36">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent uppercase tracking-wider mb-2">
            <History className="size-3.5" />
            Personal Viewing History
          </div>
          <h1 className="font-display italic text-4xl font-bold tracking-tight text-fg sm:text-5xl">
            Watch History
          </h1>
          <p className="mt-2 text-sm text-muted">
            Track and manage movies, web series, and episodes you have streamed on ARMSS OTT.
          </p>
        </div>

        {/* Aggregate Stats Badges & Clear Button */}
        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-surface border border-border px-3.5 py-2 text-xs">
              <Clock className="size-3.5 text-amber-400" />
              <span className="text-muted">Total Streamed:</span>
              <strong className="text-fg font-semibold">{totalWatchHours} hrs</strong>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-surface border border-border px-3.5 py-2 text-xs">
              <Film className="size-3.5 text-accent" />
              <span className="text-muted">Titles:</span>
              <strong className="text-fg font-semibold">{items.length}</strong>
              <span className="text-muted/60">({completedCount} completed)</span>
            </div>

            <button
              type="button"
              disabled={clearing}
              onClick={handleClearAll}
              className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
            >
              <Trash2 className="size-3.5" />
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* ── Search & Filter Bar ── */}
      {items.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
            <input
              type="text"
              placeholder="Search your viewing history..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl bg-surface pl-10 pr-9 py-2 text-sm text-fg border border-border focus:outline-none focus:border-accent"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {([
              { id: "all", label: "All Titles" },
              { id: "in-progress", label: "In Progress" },
              { id: "completed", label: "Completed" },
              { id: "film", label: "Films" },
              { id: "series", label: "Series" },
            ] as { id: FilterType; label: string }[]).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={cn(
                  "rounded-full px-3.5 py-1 text-xs font-medium transition-all border",
                  filter === tab.id
                    ? "border-accent bg-accent text-accent-fg font-semibold shadow-sm"
                    : "border-border bg-surface text-muted hover:text-fg hover:border-fg/20",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Main Content Area ── */}
      {loading ? (
        <div className="mt-16 flex flex-col items-center justify-center py-12">
          <RotateCcw className="size-8 animate-spin text-accent mb-3" />
          <p className="text-sm text-muted">Loading your watch history...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="mt-16 max-w-md mx-auto text-center rounded-2xl border border-border bg-surface/60 p-8">
          <History className="size-12 text-muted/60 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-fg">
            {items.length === 0 ? "No watch history yet" : "No matching titles"}
          </h3>
          <p className="mt-2 text-xs text-muted leading-relaxed">
            {items.length === 0
              ? "Start streaming any film, web series, or live TV channel on ARMSS OTT and your playback progress will automatically appear here."
              : `No titles found matching "${search || filter}". Try selecting a different filter.`}
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-accent-fg shadow-md hover:opacity-90 transition-opacity"
            >
              <Play className="size-3.5 fill-current" />
              Explore Catalog
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredItems.map((item) => {
            const isFinished = item.progress_percent >= 90;
            const progressPct = Math.min(100, Math.max(0, item.progress_percent));
            const watchedMins = Math.round(item.time_seconds / 60);

            return (
              <div
                key={item.title_id}
                className="group relative flex flex-col rounded-2xl overflow-hidden bg-surface border border-border hover:border-accent/50 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                {/* Poster / Backdrop Header with Play Overlay */}
                <div className="relative aspect-video w-full overflow-hidden bg-surface-elevated">
                  {item.backdrop || item.poster ? (
                    <img
                      src={item.backdrop || item.poster}
                      alt={item.title}
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="size-full flex items-center justify-center bg-surface-elevated text-muted">
                      <Film className="size-8 opacity-40" />
                    </div>
                  )}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent opacity-80" />

                  {/* Play button hover overlay */}
                  <Link
                    to="/watch/$id"
                    params={{ id: item.title_id }}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    title={`Resume watching ${item.title}`}
                  >
                    <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg transition-transform group-hover:scale-110">
                      <Play className="size-5 fill-current ml-0.5" />
                    </span>
                  </Link>

                  {/* Kind badge */}
                  <span className="absolute top-2.5 left-2.5 rounded-md bg-black/70 backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fg border border-white/10">
                    {item.kind === "series" ? "Web Series" : "Movie"}
                  </span>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleRemoveItem(item.title_id, item.title);
                    }}
                    className="absolute top-2.5 right-2.5 size-7 rounded-full bg-black/70 backdrop-blur-md border border-white/10 flex items-center justify-center text-muted hover:text-red-400 hover:border-red-400/50 transition-colors"
                    title="Remove from history"
                  >
                    <X className="size-3.5" />
                  </button>

                  {/* Progress Bar At Bottom of Card */}
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                    <div
                      className={cn(
                        "h-full transition-all duration-300",
                        isFinished ? "bg-emerald-500" : "bg-accent",
                      )}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Card Body */}
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to="/title/$id"
                      params={{ id: item.title_id }}
                      className="font-semibold text-fg text-sm hover:text-accent transition-colors line-clamp-1"
                    >
                      {item.title}
                    </Link>
                  </div>

                  {/* Status & Timestamp */}
                  <div className="mt-2 flex items-center justify-between text-xs text-muted">
                    <span className="flex items-center gap-1 font-medium">
                      {isFinished ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-emerald-400 inline-block" />
                          Watched
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1">
                          <Clock className="size-3" />
                          {watchedMins}m streamed ({Math.round(progressPct)}%)
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-muted/70">
                      {item.runtime_min > 0 && `${item.runtime_min}m total`}
                    </span>
                  </div>

                  {/* Resume Action Button */}
                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                    <Link
                      to="/watch/$id"
                      params={{ id: item.title_id }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
                    >
                      <Play className="size-3 fill-current" />
                      {isFinished ? "Watch Again" : "Resume Playback"}
                    </Link>

                    <Link
                      to="/title/$id"
                      params={{ id: item.title_id }}
                      className="text-[11px] text-muted hover:text-fg transition-colors"
                    >
                      Details &gt;
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
