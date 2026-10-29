import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bell,
  Bookmark,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Crown,
  ExternalLink,
  Eye,
  EyeOff,
  Film,
  Filter,
  LayoutDashboard,
  LayoutTemplate,
  Pencil,
  Play,
  PlayCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldOff,
  Sliders,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TrendingUp,
  Tv,
  Upload,
  Users,
  Video,
  X,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import {
  api,
  type User,
  type SubscriptionTier,
  type AnalyticsOverview,
  type DailyActiveTrend,
  type TopWatchedTitle,
  type UserAnalyticsItem,
  type UserDetailResponse,
} from "@/lib/api";
import { useAether, DEFAULT_DISPLAY_SETTINGS, type SiteDisplaySettings } from "@/lib/store";
import { TITLES, type Title } from "@/lib/catalog";
import { BackdropArt } from "@/components/poster";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function hasBadgeInString(badges: string, name: string): boolean {
  return (badges || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .includes(name.toLowerCase());
}

function toggleBadgeInString(badges: string, name: string, add: boolean): string {
  const list = (badges || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.toLowerCase() !== name.toLowerCase());
  if (add) list.push(name);
  return list.join(", ");
}

function UploadButton({
  accept = "image/*",
  label = "Upload File",
  onUploaded,
}: {
  accept?: string;
  label?: string;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const toastId = toast.loading(`Uploading ${file.name}...`);
    try {
      const res = await api.admin.upload(file);
      if (res && res.success && res.url) {
        onUploaded(res.url);
        toast.success(`Uploaded ${file.name} successfully!`, { id: toastId });
      } else {
        toast.error("Upload failed.", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || "Upload failed.", { id: toastId });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border text-xs font-medium text-fg hover:border-accent/50 hover:text-accent transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
      >
        <Upload className="size-3.5 text-accent" />
        {uploading ? "Uploading..." : label}
      </button>
    </>
  );
}

export const Route = createFileRoute("/admin")({ component: AdminPage });

type Tab = "analytics" | "users" | "content" | "layout" | "broadcast" | "plans";

function AdminPage() {
  const user = useAether((s) => s.user);
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("analytics");

  // Redirect non-admins
  useEffect(() => {
    if (user === null) {
      void navigate({ to: "/" });
    } else if (user && !user.is_admin) {
      toast.error("Admin access required.");
      void navigate({ to: "/" });
    }
  }, [user, navigate]);

  if (!user?.is_admin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted text-sm">Checking permissions...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-24 sm:px-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="size-6 text-accent" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
            ARMSS OTT
          </p>
          <h1 className="font-display italic text-3xl tracking-tight sm:text-4xl text-fg">
            Admin Dashboard
          </h1>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">
        Logged in as <strong className="text-fg">{user.email}</strong> · Admin
      </p>

      {/* Tabs */}
      <div className="mt-8 flex gap-1 overflow-x-auto rounded-xl bg-surface p-1 border border-border">
        {([
          { id: "analytics", label: "Analytics", icon: BarChart3 },
          { id: "users", label: "Users", icon: Users },
          { id: "content", label: "Content", icon: Film },
          { id: "layout", label: "Layout & Visibility", icon: LayoutTemplate },
          { id: "broadcast", label: "Broadcast", icon: Bell },
          { id: "plans", label: "Plans & Access", icon: Crown },
        ] as { id: Tab; label: string; icon: React.ElementType }[]).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-accent text-accent-fg shadow-sm"
                : "text-muted hover:text-fg"
            }`}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-8">
        {tab === "analytics" && <AnalyticsTab />}
        {tab === "users" && <UsersTab />}
        {tab === "content" && <ContentTab />}
        {tab === "layout" && <DisplayLayoutTab />}
        {tab === "broadcast" && <BroadcastTab />}
        {tab === "plans" && <PlansAccessTab />}
      </div>
    </div>
  );
}

function formatSecondsGlobal(sec: number) {
  if (!sec || sec < 60) return `${Math.round(sec || 0)}s`;
  const hours = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

function formatRelativeGlobal(dateStr?: string) {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "Never";
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return "Yesterday";
  return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

/* ─── User Drilldown Analytics Modal ──────────────────────────────── */
function UserDetailModal({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<UserDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"history" | "timeline" | "saved">("history");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void api.admin.getUserDetails(userId).then((res) => {
      if (mounted) {
        setData(res);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border p-5 bg-surface-elevated/40">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-full bg-gradient-to-tr from-accent to-red-600 flex items-center justify-center text-base font-bold text-white uppercase shadow-md">
              {data?.user.name ? data.user.name.charAt(0) : "U"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-fg">
                  {loading ? "Loading User Profile..." : data?.user.name || "Viewer"}
                </h3>
                {data?.user.is_admin && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent/20 text-accent border border-accent/40">
                    ADMIN
                  </span>
                )}
                {data?.user.subscription_tier && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    {data.user.subscription_tier} Plan
                  </span>
                )}
              </div>
              <p className="text-xs text-muted mt-0.5">
                {data?.user.email} · Member since{" "}
                {data?.user.created_at
                  ? new Date(data.user.created_at).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-lg border border-border flex items-center justify-center text-muted hover:text-fg hover:bg-fg/5 transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center">
            <RotateCcw className="size-8 animate-spin text-accent mb-3" />
            <p className="text-sm text-muted">Retrieving user viewing intelligence...</p>
          </div>
        ) : !data ? (
          <div className="p-16 text-center text-sm text-muted">
            Failed to load user intelligence records.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-surface-elevated border border-border p-3.5">
                <div className="flex items-center justify-between text-muted text-xs mb-1">
                  <span>Total Watch Time</span>
                  <Clock className="size-3.5 text-amber-400" />
                </div>
                <p className="text-lg font-bold text-fg tabular-nums">
                  {formatSecondsGlobal(data.total_watch_seconds)}
                </p>
                <p className="text-[10px] text-muted mt-0.5">Across all sessions</p>
              </div>

              <div className="rounded-xl bg-surface-elevated border border-border p-3.5">
                <div className="flex items-center justify-between text-muted text-xs mb-1">
                  <span>Titles Streamed</span>
                  <Film className="size-3.5 text-accent" />
                </div>
                <p className="text-lg font-bold text-fg tabular-nums">
                  {data.titles_watched_count}
                </p>
                <p className="text-[10px] text-muted mt-0.5">Unique titles opened</p>
              </div>

              <div className="rounded-xl bg-surface-elevated border border-border p-3.5">
                <div className="flex items-center justify-between text-muted text-xs mb-1">
                  <span>Avg Completion</span>
                  <BarChart3 className="size-3.5 text-emerald-400" />
                </div>
                <p className="text-lg font-bold text-fg tabular-nums">
                  {data.completion_rate}%
                </p>
                <div className="mt-1 h-1 w-full bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${Math.min(100, data.completion_rate)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-surface-elevated border border-border p-3.5">
                <div className="flex items-center justify-between text-muted text-xs mb-1">
                  <span>Activity Logs</span>
                  <Activity className="size-3.5 text-purple-400" />
                </div>
                <p className="text-lg font-bold text-fg tabular-nums">
                  {data.activity_logs.length}
                </p>
                <p className="text-[10px] text-muted mt-0.5">Recorded user events</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-1 border-b border-border pb-1">
              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={cn(
                  "px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                  activeTab === "history"
                    ? "bg-accent text-accent-fg shadow-sm"
                    : "text-muted hover:text-fg hover:bg-fg/5"
                )}
              >
                Streaming History ({data.watched_titles.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("timeline")}
                className={cn(
                  "px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                  activeTab === "timeline"
                    ? "bg-accent text-accent-fg shadow-sm"
                    : "text-muted hover:text-fg hover:bg-fg/5"
                )}
              >
                Activity Timeline ({data.activity_logs.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("saved")}
                className={cn(
                  "px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                  activeTab === "saved"
                    ? "bg-accent text-accent-fg shadow-sm"
                    : "text-muted hover:text-fg hover:bg-fg/5"
                )}
              >
                Preferences & Watchlist ({data.watchlist_titles.length + data.ratings.length})
              </button>
            </div>

            {/* Tab 1: Streaming History */}
            {activeTab === "history" && (
              <div className="space-y-3">
                {data.watched_titles.length === 0 ? (
                  <p className="text-xs text-muted py-8 text-center">
                    This viewer has not watched any titles yet.
                  </p>
                ) : (
                  <div className="divide-y divide-border/60 rounded-xl border border-border overflow-hidden bg-surface-elevated/20">
                    {data.watched_titles.map((wt) => {
                      const isFinished = wt.progress_percent >= 90;
                      return (
                        <div key={wt.title_id} className="p-3.5 flex items-center justify-between gap-4 hover:bg-surface-elevated/40 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            {wt.poster ? (
                              <img
                                src={wt.poster}
                                alt={wt.title}
                                className="size-11 object-cover rounded-lg border border-border shrink-0"
                              />
                            ) : (
                              <div className="size-11 rounded-lg bg-surface-elevated border border-border flex items-center justify-center shrink-0">
                                <Film className="size-4 text-muted" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-fg text-xs truncate flex items-center gap-2">
                                {wt.title}
                                <span className="px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider font-semibold bg-fg/10 text-muted">
                                  {wt.kind}
                                </span>
                              </p>
                              <p className="text-[11px] text-muted mt-0.5">
                                Last watched: {formatRelativeGlobal(wt.updated_at)}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 text-right min-w-[150px]">
                            <div className="flex items-center justify-end gap-2 text-xs">
                              {isFinished ? (
                                <span className="text-emerald-400 font-semibold text-[11px]">Completed (100%)</span>
                              ) : (
                                <span className="text-amber-400 font-semibold text-[11px]">{wt.progress_percent}% watched</span>
                              )}
                              <span className="text-muted text-[10px]">({formatSecondsGlobal(wt.time_seconds)})</span>
                            </div>
                            <div className="mt-1 h-1.5 w-full bg-border rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", isFinished ? "bg-emerald-500" : "bg-accent")}
                                style={{ width: `${Math.min(100, wt.progress_percent)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Activity Timeline */}
            {activeTab === "timeline" && (
              <div className="space-y-2">
                {data.activity_logs.length === 0 ? (
                  <p className="text-xs text-muted py-8 text-center">
                    No activity logs recorded for this user.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {data.activity_logs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-surface-elevated/40 border border-border text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "size-2 rounded-full shrink-0",
                              log.action === "login"
                                ? "bg-purple-500"
                                : log.action === "watch"
                                ? "bg-emerald-500"
                                : "bg-accent"
                            )}
                          />
                          <span className="font-semibold uppercase tracking-wider text-[10px] text-fg">
                            {log.action}
                          </span>
                          <span className="text-muted truncate max-w-[320px]">{log.details || "Activity recorded"}</span>
                        </div>
                        <span className="text-muted text-[11px] whitespace-nowrap">
                          {formatRelativeGlobal(log.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Saved & Ratings */}
            {activeTab === "saved" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border p-4 bg-surface-elevated/20">
                  <h4 className="text-xs font-semibold text-fg flex items-center gap-2 mb-3">
                    <Bookmark className="size-3.5 text-accent" />
                    Watchlist Titles ({data.watchlist_titles.length})
                  </h4>
                  {data.watchlist_titles.length === 0 ? (
                    <p className="text-xs text-muted">No titles saved in watchlist.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {data.watchlist_titles.map((t) => (
                        <span
                          key={t}
                          className="px-2.5 py-1 rounded-lg bg-surface-elevated border border-border text-xs text-fg"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border p-4 bg-surface-elevated/20">
                  <h4 className="text-xs font-semibold text-fg flex items-center gap-2 mb-3">
                    <Sparkles className="size-3.5 text-amber-400" />
                    Content Feedback & Ratings ({data.ratings.length})
                  </h4>
                  {data.ratings.length === 0 ? (
                    <p className="text-xs text-muted">No ratings submitted yet.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                      {data.ratings.map((r) => (
                        <div
                          key={r.title_id}
                          className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-surface-elevated/60 border border-border/40"
                        >
                          <span className="font-medium text-fg truncate">{r.title_id}</span>
                          <span
                            className={cn(
                              "font-bold text-[11px] px-2 py-0.5 rounded shrink-0",
                              r.score > 0
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                : "bg-red-500/15 text-red-400 border border-red-500/30"
                            )}
                          >
                            {r.score > 0 ? "Thumbs Up 👍" : "Thumbs Down 👎"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Analytics Tab ─────────────────────────────────────────────── */
function AnalyticsTab() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [trends, setTrends] = useState<DailyActiveTrend[]>([]);
  const [topTitles, setTopTitles] = useState<TopWatchedTitle[]>([]);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalyticsItem[]>([]);
  const [userCount, setUserCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [trendDays, setTrendDays] = useState<7 | 14 | 30>(14);
  const [chartMetric, setChartMetric] = useState<"users" | "watch_time">("users");

  const [userSearch, setUserSearch] = useState("");
  const [userTierFilter, setUserTierFilter] = useState("all");
  const [inspectUserId, setInspectUserId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [ov, tr, tt, ua] = await Promise.all([
      api.admin.getAnalyticsOverview(),
      api.admin.getDailyTrends(trendDays),
      api.admin.getTopWatchedTitles(),
      api.admin.getUserAnalytics(
        userSearch || undefined,
        userTierFilter === "all" ? undefined : userTierFilter
      ),
    ]);

    if (ov) setOverview(ov);
    setTrends(tr);
    setTopTitles(tt);
    setUserAnalytics(ua.users);
    setUserCount(ua.count);
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, [trendDays, userTierFilter]);

  const handleUserSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void api.admin.getUserAnalytics(userSearch || undefined, userTierFilter === "all" ? undefined : userTierFilter).then((ua) => {
      setUserAnalytics(ua.users);
      setUserCount(ua.count);
    });
  };

  const formatSeconds = (sec: number) => {
    if (!sec || sec < 60) return `${Math.round(sec || 0)}s`;
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  };

  const formatRelative = (dateStr?: string) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Never";
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 172800) return "Yesterday";
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  };

  const isRecentlyActive = (dateStr?: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return Date.now() - date.getTime() < 24 * 3600 * 1000;
  };

  return (
    <div className="space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-fg flex items-center gap-2">
            <BarChart3 className="size-5 text-accent" />
            User & Watch-Time Intelligence
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Real-time daily active user telemetry, streaming consumption, and per-user behavior analysis.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs font-medium text-muted hover:text-fg hover:border-accent/40 transition-all cursor-pointer"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin text-accent" : ""}`} />
          Refresh Metrics
        </button>
      </div>

      {loading && !overview ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <RefreshCw className="size-6 animate-spin text-accent" />
          <p className="text-sm text-muted">Aggregating user telemetry and watch logs...</p>
        </div>
      ) : (
        <>
          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
            {/* DAU */}
            <div className="rounded-xl bg-surface border border-border p-4 relative overflow-hidden group hover:border-accent/50 transition-all">
              <div className="flex items-center justify-between text-muted text-xs font-medium">
                <span>Daily Active (DAU)</span>
                <span className="flex size-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-fg tabular-nums">
                {(overview?.dau_today ?? 0).toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] text-emerald-400/90 mt-1 flex items-center gap-0.5">
                <TrendingUp className="size-3" />
                Active today
              </p>
            </div>

            {/* WAU */}
            <div className="rounded-xl bg-surface border border-border p-4 group hover:border-accent/50 transition-all">
              <div className="flex items-center justify-between text-muted text-xs font-medium">
                <span>Weekly Active</span>
                <Users className="size-3.5 text-blue-400" />
              </div>
              <p className="mt-2 text-2xl font-bold text-blue-400 tabular-nums">
                {(overview?.wau_7d ?? 0).toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] text-muted mt-1">Last 7 days</p>
            </div>

            {/* MAU */}
            <div className="rounded-xl bg-surface border border-border p-4 group hover:border-accent/50 transition-all">
              <div className="flex items-center justify-between text-muted text-xs font-medium">
                <span>Monthly Active</span>
                <Users className="size-3.5 text-purple-400" />
              </div>
              <p className="mt-2 text-2xl font-bold text-purple-400 tabular-nums">
                {(overview?.mau_30d ?? 0).toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] text-muted mt-1">Last 30 days</p>
            </div>

            {/* Total Watch Hours */}
            <div className="rounded-xl bg-surface border border-border p-4 group hover:border-accent/50 transition-all">
              <div className="flex items-center justify-between text-muted text-xs font-medium">
                <span>Total Streamed</span>
                <Clock className="size-3.5 text-amber-400" />
              </div>
              <p className="mt-2 text-2xl font-bold text-amber-400 tabular-nums">
                {Math.round(overview?.total_watch_hours ?? 0).toLocaleString("en-IN")} <span className="text-xs font-normal text-muted">hrs</span>
              </p>
              <p className="text-[11px] text-muted mt-1">
                Avg: {Math.round(overview?.avg_session_minutes ?? 0)}m / session
              </p>
            </div>

            {/* Completion Rate */}
            <div className="rounded-xl bg-surface border border-border p-4 group hover:border-accent/50 transition-all">
              <div className="flex items-center justify-between text-muted text-xs font-medium">
                <span>Completion Rate</span>
                <CheckCircle2 className="size-3.5 text-match" />
              </div>
              <p className="mt-2 text-2xl font-bold text-match tabular-nums">
                {((overview?.completion_rate_percent ?? 0)).toFixed(1)}%
              </p>
              <p className="text-[11px] text-muted mt-1">Titles watched &gt; 90%</p>
            </div>

            {/* Monthly Revenue */}
            <div className="rounded-xl bg-surface border border-border p-4 group hover:border-accent/50 transition-all">
              <div className="flex items-center justify-between text-muted text-xs font-medium">
                <span>Est. Revenue</span>
                <Crown className="size-3.5 text-accent" />
              </div>
              <p className="mt-2 text-2xl font-bold text-accent tabular-nums">
                ₹{(overview?.revenue_estimate_inr ?? 0).toLocaleString("en-IN")}
              </p>
              <p className="text-[11px] text-muted mt-1">
                {(overview?.standard_count ?? 0) + (overview?.premium_count ?? 0)} paid subscribers
              </p>
            </div>
          </div>

          {/* SECTION 2: Interactive Trend Analytics Chart */}
          <div className="rounded-2xl bg-surface border border-border p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border/60">
              <div>
                <h3 className="text-base font-semibold text-fg flex items-center gap-2">
                  <Activity className="size-4 text-accent" />
                  {chartMetric === "users" ? "Daily Active Users & Logins" : "Watch Hours Streamed"}
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Tracking daily donor/member engagement across the ARMSS-OTT streaming network
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Metric Selector */}
                <div className="flex rounded-lg bg-surface-elevated p-1 border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => setChartMetric("users")}
                    className={`px-3 py-1 rounded-md font-medium transition-all ${
                      chartMetric === "users"
                        ? "bg-accent text-accent-fg shadow-sm"
                        : "text-muted hover:text-fg"
                    }`}
                  >
                    Users & Logins
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMetric("watch_time")}
                    className={`px-3 py-1 rounded-md font-medium transition-all ${
                      chartMetric === "watch_time"
                        ? "bg-accent text-accent-fg shadow-sm"
                        : "text-muted hover:text-fg"
                    }`}
                  >
                    Watch Hours
                  </button>
                </div>

                {/* Time Range Selector */}
                <div className="flex rounded-lg bg-surface-elevated p-1 border border-border text-xs">
                  {([7, 14, 30] as const).map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setTrendDays(days)}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                        trendDays === days
                          ? "bg-fg/15 text-fg font-semibold"
                          : "text-muted hover:text-fg"
                      }`}
                    >
                      {days}D
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Recharts Chart Container */}
            <div className="mt-6 h-[280px] w-full">
              {trends.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted">
                  No activity trend recorded yet for this time window.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {chartMetric === "users" ? (
                    <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="activeUsersGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="loginsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis
                        dataKey="label"
                        stroke="#88888880"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#88888880"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#18181b",
                          borderColor: "#ffffff20",
                          borderRadius: "12px",
                          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                        itemStyle={{ padding: "2px 0" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="active_users"
                        name="Active Users"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#activeUsersGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="logins"
                        name="User Logins"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        fillOpacity={1}
                        fill="url(#loginsGrad)"
                      />
                    </AreaChart>
                  ) : (
                    <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="watchHoursGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis
                        dataKey="label"
                        stroke="#88888880"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#88888880"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#18181b",
                          borderColor: "#ffffff20",
                          borderRadius: "12px",
                          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                        formatter={(val: any) => [`${val} hrs`, "Watch Hours"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="watch_hours"
                        name="Watch Hours"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#watchHoursGrad)"
                      />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>

            {/* Legend & Summary Info */}
            <div className="mt-4 pt-4 border-t border-border/40 flex flex-wrap items-center justify-between text-xs text-muted gap-4">
              <div className="flex items-center gap-6">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-emerald-500 inline-block" />
                  Daily Active Users (DAU)
                </span>
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-purple-500 inline-block" />
                  Account Logins
                </span>
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-amber-500 inline-block" />
                  Streaming Consumption (Hrs)
                </span>
              </div>
              <p className="text-[11px] text-muted/80">
                Data reflects viewer sessions authenticated across Web & Smart TV apps.
              </p>
            </div>
          </div>

          {/* SECTION 3: Top Watched Titles Leaderboard */}
          <div className="rounded-2xl bg-surface border border-border p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold text-fg flex items-center gap-2">
                  <PlayCircle className="size-4 text-accent" />
                  Top Streamed Titles & Completion
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Content driving highest retention, watch time, and finish rates
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {topTitles.slice(0, 4).map((t, idx) => (
                <div
                  key={t.title_id}
                  className="rounded-xl bg-surface-elevated border border-border/80 p-4 relative flex flex-col justify-between overflow-hidden group hover:border-accent/50 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <span className="font-display italic text-2xl font-black text-muted/40 group-hover:text-accent transition-colors">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-fg text-sm truncate" title={t.title}>
                        {t.title}
                      </p>
                      <p className="text-[11px] text-muted uppercase tracking-wider mt-0.5">
                        {t.kind} · {t.viewer_count ?? 0} viewers
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/40">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted flex items-center gap-1">
                        <Clock className="size-3 text-amber-400" />
                        Watch Time
                      </span>
                      <span className="font-semibold text-amber-400 tabular-nums">
                        {t.total_watch_hours} hrs
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted">Completion Rate</span>
                      <span className="font-semibold text-fg tabular-nums">{t.completion_rate}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-border/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-accent to-match rounded-full"
                        style={{ width: `${Math.min(100, t.completion_rate)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 4: User-Perspective Deep-Dive Analytics Table */}
          <div className="rounded-2xl bg-surface border border-border p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
              <div>
                <h3 className="text-base font-semibold text-fg flex items-center gap-2">
                  <Users className="size-4 text-accent" />
                  User-Perspective Activity & Consumption Table
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Individual viewer profiles, accumulated watch durations, and last active sessions ({userCount} users)
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search */}
                <form onSubmit={handleUserSearchSubmit} className="relative min-w-[200px]">
                  <Search className="size-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search name or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-xs text-fg placeholder:text-muted focus:outline-none focus:border-accent"
                  />
                </form>

                {/* Tier Filter */}
                <select
                  value={userTierFilter}
                  onChange={(e) => setUserTierFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border text-xs text-fg focus:outline-none focus:border-accent cursor-pointer"
                >
                  <option value="all">All Tiers</option>
                  <option value="free">Free</option>
                  <option value="standard">Standard HD</option>
                  <option value="premium">Premium 4K</option>
                  <option value="banned">Banned</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-elevated text-muted uppercase tracking-wider text-[11px] border-b border-border">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Subscription Plan</th>
                    <th className="py-3 px-4">Total Watch Time</th>
                    <th className="py-3 px-4">Titles Watched</th>
                    <th className="py-3 px-4">Completion Avg</th>
                    <th className="py-3 px-4">Last Login</th>
                    <th className="py-3 px-4">Last Active</th>
                    <th className="py-3 px-4 text-right">Drill-Down</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {userAnalytics.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted">
                        No user activity records match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    userAnalytics.map((u) => {
                      const activeRecent = isRecentlyActive(u.last_active_at || u.last_login_at);
                      return (
                        <tr key={u.id} className="hover:bg-surface-elevated/40 transition-colors">
                          {/* User info */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="size-7 rounded-full bg-gradient-to-tr from-accent/40 to-accent/10 border border-accent/30 flex items-center justify-center text-[11px] font-bold text-accent uppercase">
                                {u.name ? u.name.charAt(0) : u.email.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-fg flex items-center gap-1.5 truncate">
                                  {u.name || "Viewer"}
                                  {u.is_admin && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent/20 text-accent border border-accent/40">
                                      ADMIN
                                    </span>
                                  )}
                                </p>
                                <p className="text-muted text-[11px] truncate">{u.email}</p>
                              </div>
                            </div>
                          </td>

                          {/* Plan */}
                          <td className="py-3 px-4">
                            {u.subscription_tier === "premium" && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                <Crown className="size-3 text-amber-400" />
                                Premium 4K VIP
                              </span>
                            )}
                            {u.subscription_tier === "standard" && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
                                Standard HD
                              </span>
                            )}
                            {u.subscription_tier === "free" && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-fg/10 text-muted border border-border">
                                Free Plan
                              </span>
                            )}
                            {u.subscription_tier === "banned" && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/30">
                                Banned
                              </span>
                            )}
                          </td>

                          {/* Watch Time */}
                          <td className="py-3 px-4 font-semibold text-fg tabular-nums">
                            {u.total_watch_seconds > 0 ? (
                              <span className="text-amber-400 flex items-center gap-1">
                                <Clock className="size-3 text-amber-400/70" />
                                {formatSeconds(u.total_watch_seconds)}
                              </span>
                            ) : (
                              <span className="text-muted/60">—</span>
                            )}
                          </td>

                          {/* Titles count */}
                          <td className="py-3 px-4 tabular-nums">
                            {u.titles_watched_count > 0 ? (
                              <span className="px-2 py-0.5 rounded bg-surface-elevated border border-border text-fg font-medium">
                                {u.titles_watched_count} titles
                              </span>
                            ) : (
                              <span className="text-muted/60">0</span>
                            )}
                          </td>

                          {/* Completion Avg */}
                          <td className="py-3 px-4 min-w-[130px]">
                            {u.total_watch_seconds > 0 ? (
                              <div>
                                <div className="flex justify-between text-[11px] mb-1">
                                  <span className="text-muted">Avg</span>
                                  <span className="font-semibold text-fg">{u.completion_rate}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-accent rounded-full"
                                    style={{ width: `${Math.min(100, u.completion_rate)}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted/60">—</span>
                            )}
                          </td>

                          {/* Last Login */}
                          <td className="py-3 px-4 text-muted whitespace-nowrap">
                            {formatRelative(u.last_login_at)}
                          </td>

                          {/* Last Active */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {activeRecent ? (
                                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" title="Active recently" />
                              ) : (
                                <span className="size-2 rounded-full bg-muted/40" />
                              )}
                              <span className={activeRecent ? "text-emerald-400 font-medium" : "text-muted"}>
                                {formatRelative(u.last_active_at)}
                              </span>
                            </div>
                          </td>

                          {/* Drill-down Inspect Action */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setInspectUserId(u.id)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/10 border border-accent/30 text-[11px] font-semibold text-accent hover:bg-accent hover:text-accent-fg transition-all cursor-pointer shadow-sm"
                            >
                              <Eye className="size-3" />
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* User Drilldown Inspection Modal */}
      {inspectUserId && (
        <UserDetailModal
          userId={inspectUserId}
          onClose={() => setInspectUserId(null)}
        />
      )}
    </div>
  );
}

/* ─── Users Tab ──────────────────────────────────────────────────── */
function UsersTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [inspectUserId, setInspectUserId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await api.admin.getUsers(search || undefined, tierFilter === "all" ? undefined : tierFilter);
    setUsers(data.users);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [tierFilter]);

  const handleTierChange = async (userId: string, tier: SubscriptionTier) => {
    setActionLoading(userId + "-tier");
    const ok = await api.admin.updateUserTier(userId, tier);
    if (ok) {
      toast.success("Subscription tier updated.");
      void load();
    } else {
      toast.error("Failed to update tier.");
    }
    setActionLoading(null);
  };

  const handleBan = async (userId: string, currentTier: string) => {
    const isBanned = (currentTier as string) === "banned";
    setActionLoading(userId + "-ban");
    const ok = await api.admin.banUser(userId, !isBanned);
    if (ok) {
      toast.success(isBanned ? "User unbanned." : "User banned.");
      void load();
    } else {
      toast.error("Action failed.");
    }
    setActionLoading(null);
  };

  const handleDelete = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to permanently delete ${email}? This cannot be undone.`)) return;
    setActionLoading(userId + "-del");
    const ok = await api.admin.deleteUser(userId);
    if (ok) {
      toast.success("User deleted.");
      void load();
    } else {
      toast.error("Delete failed.");
    }
    setActionLoading(null);
  };

  const tierColor: Record<string, string> = {
    free: "text-muted",
    standard: "text-blue-400",
    premium: "text-amber-400",
    banned: "text-live",
  };

  return (
    <div>
      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            className="w-full rounded-lg bg-surface pl-10 pr-4 py-2 text-sm text-fg border border-border focus:outline-none focus:border-accent"
          />
        </div>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="rounded-lg bg-surface px-3 py-2 text-sm text-fg border border-border focus:outline-none"
        >
          <option value="all">All Plans</option>
          <option value="free">Free</option>
          <option value="standard">Standard</option>
          <option value="premium">Premium</option>
          <option value="banned">Banned</option>
        </select>
        <Button type="button" variant="line" onClick={load} className="shrink-0">
          <RefreshCw className="size-4" />
          Search
        </Button>
      </div>

      {loading ? (
        <p className="text-muted text-sm">Loading users...</p>
      ) : users.length === 0 ? (
        <p className="text-muted text-sm">No users found.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface border-b border-border text-xs text-muted uppercase tracking-wider">
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Joined</th>
                <th className="text-left px-4 py-3">Plan</th>
                <th className="text-left px-4 py-3">Change Plan</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-fg/3 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-fg">{u.name}</p>
                    <p className="text-xs text-muted truncate max-w-[200px]">{u.email}</p>
                    {u.is_admin && (
                      <span className="text-[10px] bg-accent/20 text-accent rounded px-1 mt-0.5 inline-block">Admin</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted hidden sm:table-cell">
                    {new Date(u.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold uppercase text-xs ${tierColor[u.subscription_tier] ?? "text-fg"}`}>
                      {u.subscription_tier}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={(u.subscription_tier as string) === "banned" ? "free" : u.subscription_tier}
                      onChange={(e) => handleTierChange(u.id, e.target.value as SubscriptionTier)}
                      disabled={actionLoading === u.id + "-tier" || u.is_admin}
                      className="rounded-md bg-elevated px-2 py-1 text-xs text-fg border border-border focus:outline-none disabled:opacity-50"
                    >
                      <option value="free">Free</option>
                      <option value="standard">Standard</option>
                      <option value="premium">Premium</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        title="Inspect User Viewing & Activity Intelligence"
                        onClick={() => setInspectUserId(u.id)}
                        className="p-1.5 rounded-md text-muted hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer"
                      >
                        <Eye className="size-4" />
                      </button>
                      {!u.is_admin && (
                        <>
                          <button
                            type="button"
                            title={(u.subscription_tier as string) === "banned" ? "Unban" : "Ban"}
                            onClick={() => handleBan(u.id, u.subscription_tier)}
                            disabled={actionLoading === u.id + "-ban"}
                            className="p-1.5 rounded-md text-muted hover:text-live hover:bg-live/10 transition-colors disabled:opacity-50"
                          >
                            {(u.subscription_tier as string) === "banned" ? (
                              <Shield className="size-4" />
                            ) : (
                              <ShieldOff className="size-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            title="Delete user"
                            onClick={() => handleDelete(u.id, u.email)}
                            disabled={actionLoading === u.id + "-del"}
                            className="p-1.5 rounded-md text-muted hover:text-live hover:bg-live/10 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-surface border-t border-border text-xs text-muted">
            Showing {users.length} user{users.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* User Drilldown Inspection Modal */}
      {inspectUserId && (
        <UserDetailModal
          userId={inspectUserId}
          onClose={() => setInspectUserId(null)}
        />
      )}
    </div>
  );
}

/* ─── Content Tab ─────────────────────────────────────────────────── */
function ContentTab() {
  const [titles, setTitles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTitle, setEditingTitle] = useState<any | null>(null);
  const [editingEpisodes, setEditingEpisodes] = useState<any[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [editingEpisodeForm, setEditingEpisodeForm] = useState<{
    id?: string;
    season_number: number;
    episode_number: number;
    title: string;
    runtime_min: number;
    synopsis: string;
    video_url: string;
    thumbnail_url: string;
  } | null>(null);
  const [savingEpisode, setSavingEpisode] = useState(false);
  const [isCustomKindNew, setIsCustomKindNew] = useState(false);
  const [isCustomKindEdit, setIsCustomKindEdit] = useState(false);

  const STANDARD_KINDS = [
    { value: "film", label: "Film / Movie" },
    { value: "series", label: "Web Series" },
    { value: "short_film", label: "Short Film" },
    { value: "documentary", label: "Documentary" },
    { value: "standup", label: "Stand-up Comedy" },
    { value: "music_video", label: "Music Video" },
    { value: "live", label: "Live TV" },
  ];

  const existingCustomKinds = useMemo(() => {
    const stdValues = new Set(STANDARD_KINDS.map((k) => k.value));
    const set = new Set<string>();
    titles.forEach((t: any) => {
      if (t.kind && !stdValues.has(t.kind)) {
        set.add(t.kind);
      }
    });
    return Array.from(set);
  }, [titles]);

  const [newTitle, setNewTitle] = useState({
    title: "",
    kind: "film",
    year: 2024,
    maturity: "U",
    runtime_min: 120,
    match_percent: 95,
    required_tier: "free",
    logline: "",
    synopsis: "",
    poster: "",
    backdrop: "",
    trailer: "",
    video_url: "",
    tone: "ember",
    original: false,
    kids: false,
    genres: "Action, Drama",
    badges: "HD, Tamil",
  });

  const load = async () => {
    setLoading(true);
    const data = await api.admin.getTitles();
    setTitles(data.titles || []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const fetchEpisodesForTitle = async (titleId: string) => {
    setLoadingEpisodes(true);
    try {
      const eps = await api.admin.getEpisodes(titleId);
      setEditingEpisodes(eps);
    } catch {
      setEditingEpisodes([]);
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const handleTierChange = async (titleId: string, tier: string) => {
    setActionLoading(titleId);
    const ok = await api.admin.updateTitle(titleId, { required_tier: tier });
    if (ok) {
      toast.success("Title access tier updated.");
      void load();
      void useAether.getState().fetchCatalog();
    } else {
      toast.error("Update failed.");
    }
    setActionLoading(null);
  };

  const handleOpenEdit = (t: any) => {
    const genresStr = Array.isArray(t.genres) ? t.genres.join(", ") : (t.genres || "Action, Drama");
    const badgesStr = Array.isArray(t.badges) ? t.badges.join(", ") : (t.badges || "HD, Tamil");
    setEditingTitle({
      id: t.id,
      title: t.title || "",
      kind: t.kind || "film",
      year: t.year || 2024,
      maturity: t.maturity || "U",
      runtime_min: t.runtime_min || t.runtimeMin || 120,
      match_percent: t.match_percent || t.match || 95,
      required_tier: t.required_tier || "free",
      logline: t.logline || "",
      synopsis: t.synopsis || "",
      poster: t.poster || "",
      backdrop: t.backdrop || "",
      trailer: t.trailer || "",
      video_url: t.video_url || t.videoUrl || "",
      tone: t.tone || "ember",
      original: Boolean(t.original),
      kids: Boolean(t.kids),
      genres: genresStr,
      badges: badgesStr,
    });
    setEditingEpisodeForm(null);
    const stdValues = new Set(["film", "series", "short_film", "documentary", "standup", "music_video", "live"]);
    const isCustom = !stdValues.has(t.kind || "film");
    setIsCustomKindEdit(isCustom);
    if ((t.kind || "film") === "series") {
      void fetchEpisodesForTitle(t.id);
    } else {
      setEditingEpisodes([]);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTitle || !editingTitle.id) return;
    if (!editingTitle.title.trim()) {
      toast.error("Title name is required.");
      return;
    }
    setActionLoading("edit");
    const genresArr = typeof editingTitle.genres === "string"
      ? editingTitle.genres.split(",").map((s: string) => s.trim()).filter(Boolean)
      : editingTitle.genres;
    const badgesArr = typeof editingTitle.badges === "string"
      ? editingTitle.badges.split(",").map((s: string) => s.trim()).filter(Boolean)
      : editingTitle.badges;

    const ok = await api.admin.updateTitle(editingTitle.id, {
      title: editingTitle.title.trim(),
      kind: editingTitle.kind,
      year: parseInt(editingTitle.year) || 2024,
      maturity: editingTitle.maturity,
      runtime_min: parseInt(editingTitle.runtime_min) || 120,
      match_percent: parseInt(editingTitle.match_percent) || 95,
      required_tier: editingTitle.required_tier,
      logline: editingTitle.logline,
      synopsis: editingTitle.synopsis,
      poster: editingTitle.poster,
      backdrop: editingTitle.backdrop,
      trailer: editingTitle.trailer,
      video_url: editingTitle.video_url,
      tone: editingTitle.tone,
      original: editingTitle.original,
      kids: editingTitle.kids,
      genres: genresArr,
      badges: badgesArr,
    });

    if (ok) {
      toast.success(`"${editingTitle.title}" updated successfully!`);
      setEditingTitle(null);
      void load();
      void useAether.getState().fetchCatalog();
    } else {
      toast.error("Failed to update title.");
    }
    setActionLoading(null);
  };

  const handleSaveEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTitle?.id || !editingEpisodeForm) return;
    if (!editingEpisodeForm.title.trim()) {
      toast.error("Episode title is required.");
      return;
    }
    setSavingEpisode(true);
    try {
      if (editingEpisodeForm.id) {
        const ok = await api.admin.updateEpisode(editingEpisodeForm.id, {
          season_number: Number(editingEpisodeForm.season_number) || 1,
          episode_number: Number(editingEpisodeForm.episode_number) || 1,
          title: editingEpisodeForm.title.trim(),
          runtime_min: Number(editingEpisodeForm.runtime_min) || 45,
          synopsis: editingEpisodeForm.synopsis,
          video_url: editingEpisodeForm.video_url,
          thumbnail_url: editingEpisodeForm.thumbnail_url,
        });
        if (ok) {
          toast.success("Episode updated successfully!");
          setEditingEpisodeForm(null);
          void fetchEpisodesForTitle(editingTitle.id);
          void useAether.getState().fetchCatalog();
        } else {
          toast.error("Failed to update episode.");
        }
      } else {
        const ok = await api.admin.createEpisode(editingTitle.id, {
          season_number: Number(editingEpisodeForm.season_number) || 1,
          episode_number: Number(editingEpisodeForm.episode_number) || 1,
          title: editingEpisodeForm.title.trim(),
          runtime_min: Number(editingEpisodeForm.runtime_min) || 45,
          synopsis: editingEpisodeForm.synopsis,
          video_url: editingEpisodeForm.video_url,
          thumbnail_url: editingEpisodeForm.thumbnail_url,
        });
        if (ok) {
          toast.success("Episode created successfully!");
          setEditingEpisodeForm(null);
          void fetchEpisodesForTitle(editingTitle.id);
          void useAether.getState().fetchCatalog();
        } else {
          toast.error("Failed to add episode.");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save episode.");
    } finally {
      setSavingEpisode(false);
    }
  };

  const handleDeleteEpisode = async (episodeId: string, epTitle: string) => {
    if (!confirm(`Delete episode "${epTitle}"?`)) return;
    try {
      const ok = await api.admin.deleteEpisode(episodeId);
      if (ok) {
        toast.success("Episode deleted.");
        if (editingTitle?.id) {
          void fetchEpisodesForTitle(editingTitle.id);
        }
        void useAether.getState().fetchCatalog();
      } else {
        toast.error("Failed to delete episode.");
      }
    } catch {
      toast.error("Failed to delete episode.");
    }
  };

  const handleCreateTitle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.title.trim()) {
      toast.error("Title name is required.");
      return;
    }
    setActionLoading("create");
    const genresArr = typeof newTitle.genres === "string"
      ? newTitle.genres.split(",").map((s: string) => s.trim()).filter(Boolean)
      : newTitle.genres;
    const badgesArr = typeof newTitle.badges === "string"
      ? newTitle.badges.split(",").map((s: string) => s.trim()).filter(Boolean)
      : newTitle.badges;

    const ok = await api.admin.createTitle({
      ...newTitle,
      video_url: newTitle.video_url,
      year: parseInt(String(newTitle.year)) || 2024,
      runtime_min: parseInt(String(newTitle.runtime_min)) || 120,
      match_percent: parseInt(String(newTitle.match_percent)) || 95,
      genres: genresArr,
      badges: badgesArr,
    });

    if (ok) {
      toast.success(`"${newTitle.title}" added to catalog!`);
      setShowAddModal(false);
      setNewTitle({
        title: "",
        kind: "film",
        year: 2024,
        maturity: "U",
        runtime_min: 120,
        match_percent: 95,
        required_tier: "free",
        logline: "",
        synopsis: "",
        poster: "",
        backdrop: "",
        trailer: "",
        video_url: "",
        tone: "ember",
        original: false,
        kids: false,
        genres: "Action, Drama",
        badges: "HD, Tamil",
      });
      void load();
      void useAether.getState().fetchCatalog();
    } else {
      toast.error("Failed to add title.");
    }
    setActionLoading(null);
  };

  const handleDeleteTitle = async (titleId: string, titleName: string) => {
    if (!confirm(`Are you sure you want to delete "${titleName}" from the catalog?`)) return;
    setActionLoading(titleId + "-del");
    const ok = await api.admin.deleteTitle(titleId);
    if (ok) {
      toast.success("Title removed from catalog.");
      void load();
      void useAether.getState().fetchCatalog();
    } else {
      toast.error("Failed to delete title.");
    }
    setActionLoading(null);
  };

  const tierColor: Record<string, string> = {
    free: "text-muted",
    standard: "text-blue-400",
    premium: "text-amber-400",
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-fg">Content Catalogue ({titles.length} titles)</h2>
          <p className="text-xs text-muted mt-0.5">Manage movies, web series, video stream links, tier access, and metadata</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-fg transition-colors"
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </button>
          <Button
            type="button"
            onClick={() => {
              setIsCustomKindNew(false);
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <Plus className="size-4" />
            Add New Title
          </Button>
        </div>
      </div>

      {/* Edit Title Modal */}
      {editingTitle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-surface p-6 border border-border shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setEditingTitle(null)}
              className="absolute right-4 top-4 text-muted hover:text-fg"
            >
              <X className="size-5" />
            </button>
            <h3 className="text-lg font-bold text-fg flex items-center gap-2">
              <Pencil className="size-4 text-accent" />
              Edit Title — {editingTitle.title}
            </h3>
            <p className="text-xs text-muted mt-0.5">Update streaming URLs, artwork, subscription tier, and title details</p>

            <form onSubmit={handleSaveEdit} className="mt-5 space-y-4">
              {/* Basic Information */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">1. General Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Title Name *</label>
                    <input
                      type="text"
                      required
                      value={editingTitle.title}
                      onChange={(e) => setEditingTitle({ ...editingTitle, title: e.target.value })}
                      className="w-full rounded-lg bg-elevated px-3 py-2 text-sm text-fg border border-border focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-muted">Content Type</label>
                      {isCustomKindEdit ? (
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomKindEdit(false);
                            setEditingTitle({ ...editingTitle, kind: "film" });
                          }}
                          className="text-[11px] text-accent hover:underline font-medium"
                        >
                          Use Presets
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomKindEdit(true);
                          }}
                          className="text-[11px] text-accent hover:underline font-medium"
                        >
                          + Custom Type
                        </button>
                      )}
                    </div>
                    {isCustomKindEdit ? (
                      <input
                        type="text"
                        required
                        placeholder="e.g. short_film, podcast, anime, event"
                        value={editingTitle.kind}
                        onChange={(e) => setEditingTitle({ ...editingTitle, kind: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                        className="w-full rounded-lg bg-elevated px-2.5 py-2 text-sm text-fg border border-accent focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <select
                        value={editingTitle.kind}
                        onChange={(e) => {
                          if (e.target.value === "__custom__") {
                            setIsCustomKindEdit(true);
                          } else {
                            setEditingTitle({ ...editingTitle, kind: e.target.value });
                          }
                        }}
                        className="w-full rounded-lg bg-elevated px-2.5 py-2 text-sm text-fg border border-border focus:outline-none"
                      >
                        <option value="film">Film / Movie</option>
                        <option value="series">Web Series</option>
                        <option value="short_film">Short Film</option>
                        <option value="documentary">Documentary</option>
                        <option value="standup">Stand-up Comedy</option>
                        <option value="music_video">Music Video</option>
                        <option value="live">Live TV</option>
                        {existingCustomKinds.map((k) => (
                          <option key={k} value={k}>
                            Custom: {k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " ")}
                          </option>
                        ))}
                        <option value="__custom__">+ Add Custom Type...</option>
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Year</label>
                    <input
                      type="number"
                      value={editingTitle.year}
                      onChange={(e) => setEditingTitle({ ...editingTitle, year: e.target.value })}
                      className="w-full rounded-lg bg-elevated px-2.5 py-1.5 text-xs text-fg border border-border focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Maturity</label>
                    <select
                      value={editingTitle.maturity}
                      onChange={(e) => setEditingTitle({ ...editingTitle, maturity: e.target.value })}
                      className="w-full rounded-lg bg-elevated px-2.5 py-1.5 text-xs text-fg border border-border focus:outline-none"
                    >
                      <option value="U">U</option>
                      <option value="PG">PG</option>
                      <option value="13+">13+</option>
                      <option value="16+">16+</option>
                      <option value="18+">18+</option>
                      <option value="A">A</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Required Tier</label>
                    <select
                      value={editingTitle.required_tier}
                      onChange={(e) => setEditingTitle({ ...editingTitle, required_tier: e.target.value })}
                      className="w-full rounded-lg bg-elevated px-2.5 py-1.5 text-xs text-fg border border-border focus:outline-none"
                    >
                      <option value="free">Free</option>
                      <option value="standard">Standard HD</option>
                      <option value="premium">Premium VIP (4K)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Runtime (min)</label>
                    <input
                      type="number"
                      value={editingTitle.runtime_min}
                      onChange={(e) => setEditingTitle({ ...editingTitle, runtime_min: e.target.value })}
                      className="w-full rounded-lg bg-elevated px-2.5 py-1.5 text-xs text-fg border border-border focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Streaming & Media URLs */}
              <div className="space-y-3 pt-2 border-t border-border">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent flex items-center gap-1.5">
                  <Video className="size-3.5" />
                  2. Video Streaming & Media Links
                </p>

                {/* Trailer / Teaser URL */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-muted">
                      {editingTitle.kind === "series" ? "Series Trailer / Teaser Video URL" : "Film / Title Trailer (Teaser Preview)"}
                    </label>
                    <UploadButton
                      accept="video/*"
                      label="Upload Trailer Video"
                      onUploaded={(url) => setEditingTitle({ ...editingTitle, trailer: url })}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="https://.../trailer.mp4 or /trailers/... or /uploads/..."
                    value={editingTitle.trailer}
                    onChange={(e) => setEditingTitle({ ...editingTitle, trailer: e.target.value })}
                    className="w-full rounded-lg bg-elevated px-3 py-2 text-xs font-mono text-fg border border-border focus:outline-none focus:border-accent"
                  />
                  <p className="text-[11px] text-muted mt-1">
                    This video plays in the Hero billboard backdrop, preview trailers modal, and teaser cards.
                  </p>
                </div>

                {/* Movie Playback URL (For Film, Documentary, Live) */}
                {editingTitle.kind !== "series" ? (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-muted">
                        Full Movie Stream / Playback URL (HLS .m3u8 or MP4)
                      </label>
                      <UploadButton
                        accept="video/*"
                        label="Upload Feature Video"
                        onUploaded={(url) => setEditingTitle({ ...editingTitle, video_url: url })}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="https://.../master.m3u8 or /uploads/movie.mp4"
                      value={editingTitle.video_url}
                      onChange={(e) => setEditingTitle({ ...editingTitle, video_url: e.target.value })}
                      className="w-full rounded-lg bg-elevated px-3 py-2 text-xs font-mono text-fg border border-border focus:outline-none focus:border-accent"
                    />
                    <p className="text-[11px] text-muted mt-1">
                      This full stream URL is loaded by the video player when users click "Watch Now".
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-accent/10 border border-accent/25 p-3 flex items-start gap-2.5">
                    <Tv className="size-4 text-accent shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-fg">Web Series Episode Architecture</p>
                      <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                        For series, the stream URLs are configured per episode. The Trailer above plays for previews, while individual episodes are managed below in Section 4.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-muted">Poster Artwork</label>
                      <UploadButton
                        accept="image/*"
                        label="Upload Image"
                        onUploaded={(url) => setEditingTitle({ ...editingTitle, poster: url })}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="/uploads/posters/poster.jpg or https://..."
                      value={editingTitle.poster}
                      onChange={(e) => setEditingTitle({ ...editingTitle, poster: e.target.value })}
                      className="w-full rounded-lg bg-elevated px-3 py-1.5 text-xs text-fg border border-border focus:outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-muted">Backdrop Banner</label>
                      <UploadButton
                        accept="image/*"
                        label="Upload Image"
                        onUploaded={(url) => setEditingTitle({ ...editingTitle, backdrop: url })}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="/uploads/backdrops/backdrop.jpg or https://..."
                      value={editingTitle.backdrop}
                      onChange={(e) => setEditingTitle({ ...editingTitle, backdrop: e.target.value })}
                      className="w-full rounded-lg bg-elevated px-3 py-1.5 text-xs text-fg border border-border focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Storyline, Genres & Flags */}
              <div className="space-y-3 pt-2 border-t border-border">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">3. Storyline & Categorization</p>

                <div>
                  <label className="block text-xs font-medium text-muted mb-1">One-line Logline</label>
                  <input
                    type="text"
                    placeholder="Brief hook or tagline..."
                    value={editingTitle.logline}
                    onChange={(e) => setEditingTitle({ ...editingTitle, logline: e.target.value })}
                    className="w-full rounded-lg bg-elevated px-3 py-1.5 text-xs text-fg border border-border focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Full Synopsis</label>
                  <textarea
                    rows={2}
                    placeholder="Detailed storyline..."
                    value={editingTitle.synopsis}
                    onChange={(e) => setEditingTitle({ ...editingTitle, synopsis: e.target.value })}
                    className="w-full rounded-lg bg-elevated px-3 py-2 text-xs text-fg border border-border focus:outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Genres (comma-separated)</label>
                    <input
                      type="text"
                      placeholder="Action, Thriller, Drama"
                      value={editingTitle.genres}
                      onChange={(e) => setEditingTitle({ ...editingTitle, genres: e.target.value })}
                      className="w-full rounded-lg bg-elevated px-3 py-1.5 text-xs text-fg border border-border focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Badges (comma-separated)</label>
                    <input
                      type="text"
                      placeholder="4K UHD, HDR10, Dolby Atmos, Tamil"
                      value={editingTitle.badges}
                      onChange={(e) => setEditingTitle({ ...editingTitle, badges: e.target.value })}
                      className="w-full rounded-lg bg-elevated px-3 py-1.5 text-xs text-fg border border-border focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-5 py-1">
                  <label className="flex items-center gap-2 text-xs text-fg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingTitle.original}
                      onChange={(e) => setEditingTitle({ ...editingTitle, original: e.target.checked })}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span>ARMSS Original</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-fg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingTitle.kids}
                      onChange={(e) => setEditingTitle({ ...editingTitle, kids: e.target.checked })}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span>Kids Safe</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-fg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasBadgeInString(editingTitle.badges, "Featured")}
                      onChange={(e) =>
                        setEditingTitle({
                          ...editingTitle,
                          badges: toggleBadgeInString(editingTitle.badges, "Featured", e.target.checked),
                        })
                      }
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span>Hero Billboard</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-fg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasBadgeInString(editingTitle.badges, "Trending")}
                      onChange={(e) =>
                        setEditingTitle({
                          ...editingTitle,
                          badges: toggleBadgeInString(editingTitle.badges, "Trending", e.target.checked),
                        })
                      }
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span>Trending Now</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-fg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasBadgeInString(editingTitle.badges, "Top 10")}
                      onChange={(e) =>
                        setEditingTitle({
                          ...editingTitle,
                          badges: toggleBadgeInString(editingTitle.badges, "Top 10", e.target.checked),
                        })
                      }
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span>Top 10 Row</span>
                  </label>
                </div>
              </div>

              {/* Section 4: Seasons & Episodes (For Series) */}
              {editingTitle.kind === "series" && (
                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-accent flex items-center gap-1.5">
                        <Tv className="size-3.5" />
                        4. Seasons & Episodes ({editingEpisodes.length} Episodes)
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">
                        Manage episode titles, season numbers, runtimes, and direct playback stream URLs
                      </p>
                    </div>
                    {!editingEpisodeForm && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          const maxEp = editingEpisodes.reduce((max, ep) => Math.max(max, ep.episode_number || 0), 0);
                          const currentSeason = editingEpisodes.length > 0 ? (editingEpisodes[editingEpisodes.length - 1].season_number || 1) : 1;
                          setEditingEpisodeForm({
                            season_number: currentSeason,
                            episode_number: maxEp + 1,
                            title: `Episode ${maxEp + 1}`,
                            runtime_min: 45,
                            synopsis: "",
                            video_url: "",
                            thumbnail_url: "",
                          });
                        }}
                        className="flex items-center gap-1 text-xs"
                      >
                        <Plus className="size-3.5" />
                        Add Episode
                      </Button>
                    )}
                  </div>

                  {/* Add / Edit Episode Sub-form */}
                  {editingEpisodeForm && (
                    <div className="rounded-xl bg-surface border border-accent/40 p-4 space-y-3 shadow-lg">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-fg flex items-center gap-1.5">
                          <Pencil className="size-3.5 text-accent" />
                          {editingEpisodeForm.id ? "Edit Episode Details" : "Add New Episode"}
                        </p>
                        <button
                          type="button"
                          onClick={() => setEditingEpisodeForm(null)}
                          className="text-muted hover:text-fg text-xs"
                        >
                          <X className="size-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-muted mb-1">Season #</label>
                          <input
                            type="number"
                            min={1}
                            value={editingEpisodeForm.season_number}
                            onChange={(e) => setEditingEpisodeForm({ ...editingEpisodeForm, season_number: parseInt(e.target.value) || 1 })}
                            className="w-full rounded-lg bg-elevated px-2.5 py-1.5 text-xs text-fg border border-border focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-muted mb-1">Episode #</label>
                          <input
                            type="number"
                            min={1}
                            value={editingEpisodeForm.episode_number}
                            onChange={(e) => setEditingEpisodeForm({ ...editingEpisodeForm, episode_number: parseInt(e.target.value) || 1 })}
                            className="w-full rounded-lg bg-elevated px-2.5 py-1.5 text-xs text-fg border border-border focus:outline-none"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[11px] font-medium text-muted mb-1">Episode Title *</label>
                          <input
                            type="text"
                            placeholder="e.g. Chapter 1: The Beginning"
                            value={editingEpisodeForm.title}
                            onChange={(e) => setEditingEpisodeForm({ ...editingEpisodeForm, title: e.target.value })}
                            className="w-full rounded-lg bg-elevated px-2.5 py-1.5 text-xs text-fg border border-border focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-muted mb-1">Runtime (min)</label>
                          <input
                            type="number"
                            value={editingEpisodeForm.runtime_min}
                            onChange={(e) => setEditingEpisodeForm({ ...editingEpisodeForm, runtime_min: parseInt(e.target.value) || 45 })}
                            className="w-full rounded-lg bg-elevated px-2.5 py-1.5 text-xs text-fg border border-border focus:outline-none"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-medium text-muted">Episode Stream URL (HLS / MP4)</label>
                            <UploadButton
                              accept="video/*"
                              label="Upload Episode Video"
                              onUploaded={(url) => setEditingEpisodeForm({ ...editingEpisodeForm, video_url: url })}
                            />
                          </div>
                          <input
                            type="text"
                            placeholder="https://.../episode.mp4 or /uploads/..."
                            value={editingEpisodeForm.video_url}
                            onChange={(e) => setEditingEpisodeForm({ ...editingEpisodeForm, video_url: e.target.value })}
                            className="w-full rounded-lg bg-elevated px-2.5 py-1.5 text-xs font-mono text-fg border border-border focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-medium text-muted">Episode Thumbnail Artwork (16:9)</label>
                          <UploadButton
                            accept="image/*"
                            label="Upload Thumbnail"
                            onUploaded={(url) => setEditingEpisodeForm({ ...editingEpisodeForm, thumbnail_url: url })}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="https://.../thumb.jpg or /uploads/..."
                            value={editingEpisodeForm.thumbnail_url}
                            onChange={(e) => setEditingEpisodeForm({ ...editingEpisodeForm, thumbnail_url: e.target.value })}
                            className="w-full rounded-lg bg-elevated px-2.5 py-1.5 text-xs font-mono text-fg border border-border focus:outline-none"
                          />
                          {editingEpisodeForm.thumbnail_url && (
                            <img
                              src={editingEpisodeForm.thumbnail_url}
                              alt="Thumb"
                              className="w-10 h-7 rounded object-cover border border-border shrink-0 bg-black/40"
                            />
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-muted mb-1">Episode Synopsis</label>
                        <textarea
                          rows={2}
                          placeholder="Brief recap or summary of this episode..."
                          value={editingEpisodeForm.synopsis}
                          onChange={(e) => setEditingEpisodeForm({ ...editingEpisodeForm, synopsis: e.target.value })}
                          className="w-full rounded-lg bg-elevated px-2.5 py-1.5 text-xs text-fg border border-border focus:outline-none resize-none"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          type="button"
                          variant="line"
                          size="sm"
                          onClick={() => setEditingEpisodeForm(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={savingEpisode}
                          onClick={handleSaveEpisode}
                        >
                          {savingEpisode ? "Saving..." : editingEpisodeForm.id ? "Update Episode" : "Save Episode"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Episodes List */}
                  {loadingEpisodes ? (
                    <div className="py-6 text-center text-xs text-muted">
                      <RefreshCw className="size-4 animate-spin inline-block mr-2" />
                      Loading episodes...
                    </div>
                  ) : editingEpisodes.length === 0 ? (
                    <div className="rounded-xl bg-elevated/40 border border-border/60 p-5 text-center">
                      <Tv className="size-6 text-muted mx-auto mb-1.5" />
                      <p className="text-xs font-medium text-fg">No episodes added yet</p>
                      <p className="text-[11px] text-muted mt-0.5">Click "Add Episode" above to upload your first episode stream.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {editingEpisodes.map((ep) => (
                        <div
                          key={ep.id}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-elevated/70 border border-border hover:border-border/80 transition-all text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {ep.thumbnail_url ? (
                              <img
                                src={ep.thumbnail_url}
                                alt={ep.title}
                                className="w-12 h-7 rounded object-cover border border-border shrink-0 bg-black/40"
                              />
                            ) : (
                              <span className="shrink-0 font-mono font-bold text-[11px] bg-accent/15 text-accent px-2 py-0.5 rounded">
                                S{ep.season_number} E{ep.episode_number}
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="font-medium text-fg truncate">
                                {ep.thumbnail_url && (
                                  <span className="font-mono text-accent mr-1.5 font-bold">
                                    S{ep.season_number} E{ep.episode_number}
                                  </span>
                                )}
                                {ep.title}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-muted">
                                <span>{ep.runtime_min} mins</span>
                                <span>•</span>
                                {ep.video_url ? (
                                  <span className="text-emerald-400 flex items-center gap-1 font-mono">
                                    <Check className="size-3" /> Stream Ready
                                  </span>
                                ) : (
                                  <span className="text-amber-400 font-mono">No Video URL</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEpisodeForm({
                                  id: ep.id,
                                  season_number: ep.season_number,
                                  episode_number: ep.episode_number,
                                  title: ep.title,
                                  runtime_min: ep.runtime_min,
                                  synopsis: ep.synopsis || "",
                                  video_url: ep.video_url || "",
                                  thumbnail_url: ep.thumbnail_url || "",
                                });
                              }}
                              className="p-1 rounded text-muted hover:text-accent hover:bg-surface transition-colors"
                              title="Edit episode"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEpisode(ep.id, ep.title)}
                              className="p-1 rounded text-muted hover:text-rose-400 hover:bg-surface transition-colors"
                              title="Delete episode"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="line" onClick={() => setEditingTitle(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={actionLoading === "edit"}>
                  {actionLoading === "edit" ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Title Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-surface p-6 border border-border shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 text-muted hover:text-fg"
            >
              <X className="size-5" />
            </button>
            <h3 className="text-lg font-bold text-fg flex items-center gap-2">
              <Plus className="size-4 text-accent" />
              Add New Title to Catalog
            </h3>
            <p className="text-xs text-muted mt-0.5">Fill in title details and streaming URLs to publish directly to ARMSS OTT</p>

            <form onSubmit={handleCreateTitle} className="mt-5 space-y-4">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">1. General Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Title Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Inception, Breaking Bad, The Dark Knight"
                      value={newTitle.title}
                      onChange={(e) => setNewTitle({ ...newTitle, title: e.target.value })}
                      className="w-full rounded-lg bg-elevated px-3 py-2 text-sm text-fg border border-border focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-muted">Content Type</label>
                      {isCustomKindNew ? (
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomKindNew(false);
                            setNewTitle({ ...newTitle, kind: "film" });
                          }}
                          className="text-[11px] text-accent hover:underline font-medium"
                        >
                          Use Presets
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomKindNew(true);
                            setNewTitle({ ...newTitle, kind: "" });
                          }}
                          className="text-[11px] text-accent hover:underline font-medium"
                        >
                          + Custom Type
                        </button>
                      )}
                    </div>
                    {isCustomKindNew ? (
                      <input
                        type="text"
                        required
                        placeholder="e.g. short_film, podcast, anime, event"
                        value={newTitle.kind}
                        onChange={(e) => setNewTitle({ ...newTitle, kind: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                        className="w-full rounded-lg bg-elevated px-2.5 py-2 text-sm text-fg border border-accent focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <select
                        value={newTitle.kind}
                        onChange={(e) => {
                          if (e.target.value === "__custom__") {
                            setIsCustomKindNew(true);
                            setNewTitle({ ...newTitle, kind: "" });
                          } else {
                            setNewTitle({ ...newTitle, kind: e.target.value });
                          }
                        }}
                        className="w-full rounded-lg bg-elevated px-2.5 py-2 text-sm text-fg border border-border focus:outline-none"
                      >
                        <option value="film">Film / Movie</option>
                        <option value="series">Web Series</option>
                        <option value="short_film">Short Film</option>
                        <option value="documentary">Documentary</option>
                        <option value="standup">Stand-up Comedy</option>
                        <option value="music_video">Music Video</option>
                        <option value="live">Live TV</option>
                        {existingCustomKinds.map((k) => (
                          <option key={k} value={k}>
                            Custom: {k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " ")}
                          </option>
                        ))}
                        <option value="__custom__">+ Add Custom Type...</option>
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Year</label>
                    <input
                      type="number"
                      value={newTitle.year}
                      onChange={(e) => setNewTitle({ ...newTitle, year: parseInt(e.target.value) || 2024 })}
                      className="w-full rounded-lg bg-elevated px-2.5 py-1.5 text-xs text-fg border border-border focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Maturity</label>
                    <select
                      value={newTitle.maturity}
                      onChange={(e) => setNewTitle({ ...newTitle, maturity: e.target.value })}
                      className="w-full rounded-lg bg-elevated px-2.5 py-1.5 text-xs text-fg border border-border focus:outline-none"
                    >
                      <option value="U">U</option>
                      <option value="PG">PG</option>
                      <option value="13+">13+</option>
                      <option value="16+">16+</option>
                      <option value="18+">18+</option>
                      <option value="A">A</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Required Tier</label>
                    <select
                      value={newTitle.required_tier}
                      onChange={(e) => setNewTitle({ ...newTitle, required_tier: e.target.value })}
                      className="w-full rounded-lg bg-elevated px-2.5 py-1.5 text-xs text-fg border border-border focus:outline-none"
                    >
                      <option value="free">Free</option>
                      <option value="standard">Standard HD</option>
                      <option value="premium">Premium VIP (4K)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Runtime (min)</label>
                    <input
                      type="number"
                      value={newTitle.runtime_min}
                      onChange={(e) => setNewTitle({ ...newTitle, runtime_min: parseInt(e.target.value) || 120 })}
                      className="w-full rounded-lg bg-elevated px-2.5 py-1.5 text-xs text-fg border border-border focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Streaming & Media URLs */}
              <div className="space-y-3 pt-2 border-t border-border">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent flex items-center gap-1.5">
                  <Video className="size-3.5" />
                  2. Video Streaming & Media Links
                </p>

                {/* Trailer / Teaser URL */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-muted">
                      {newTitle.kind === "series" ? "Series Trailer / Teaser Video URL" : "Film / Title Trailer (Teaser Preview)"}
                    </label>
                    <UploadButton
                      accept="video/*"
                      label="Upload Trailer Video"
                      onUploaded={(url) => setNewTitle({ ...newTitle, trailer: url })}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="https://.../trailer.mp4 or /trailers/... or /uploads/..."
                    value={newTitle.trailer}
                    onChange={(e) => setNewTitle({ ...newTitle, trailer: e.target.value })}
                    className="w-full rounded-lg bg-elevated px-3 py-2 text-xs font-mono text-fg border border-border focus:outline-none focus:border-accent"
                  />
                  <p className="text-[11px] text-muted mt-1">
                    Plays in the hero billboard preview and trailer teaser modal.
                  </p>
                </div>

                {/* Movie Playback URL (For non-series) */}
                {newTitle.kind !== "series" ? (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-muted">
                        Full Movie Stream / Playback URL (HLS .m3u8 or MP4)
                      </label>
                      <UploadButton
                        accept="video/*"
                        label="Upload Feature Video"
                        onUploaded={(url) => setNewTitle({ ...newTitle, video_url: url })}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="https://.../master.m3u8 or /uploads/movie.mp4"
                      value={newTitle.video_url}
                      onChange={(e) => setNewTitle({ ...newTitle, video_url: e.target.value })}
                      className="w-full rounded-lg bg-elevated px-3 py-2 text-xs font-mono text-fg border border-border focus:outline-none focus:border-accent"
                    />
                    <p className="text-[11px] text-muted mt-1">
                      This full stream URL plays when users click "Watch Now".
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-accent/10 border border-accent/25 p-3 flex items-start gap-2.5">
                    <Tv className="size-4 text-accent shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-fg">Web Series Architecture</p>
                      <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                        For series, upload the teaser trailer above. After creating the series, you can open it in the catalog to add and manage its seasons and individual episodes.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-muted">Poster Artwork</label>
                      <UploadButton
                        accept="image/*"
                        label="Upload Image"
                        onUploaded={(url) => setNewTitle({ ...newTitle, poster: url })}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="/posters/default.jpg or /uploads/..."
                      value={newTitle.poster}
                      onChange={(e) => setNewTitle({ ...newTitle, poster: e.target.value })}
                      className="w-full rounded-lg bg-elevated px-3 py-1.5 text-xs text-fg border border-border focus:outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-muted">Backdrop Banner</label>
                      <UploadButton
                        accept="image/*"
                        label="Upload Image"
                        onUploaded={(url) => setNewTitle({ ...newTitle, backdrop: url })}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="/backdrops/default.jpg or /uploads/..."
                      value={newTitle.backdrop}
                      onChange={(e) => setNewTitle({ ...newTitle, backdrop: e.target.value })}
                      className="w-full rounded-lg bg-elevated px-3 py-1.5 text-xs text-fg border border-border focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Storyline & Metadata */}
              <div className="space-y-3 pt-2 border-t border-border">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">3. Storyline & Categorization</p>

                <div>
                  <label className="block text-xs font-medium text-muted mb-1">One-line Logline</label>
                  <input
                    type="text"
                    placeholder="One sentence storyline..."
                    value={newTitle.logline}
                    onChange={(e) => setNewTitle({ ...newTitle, logline: e.target.value })}
                    className="w-full rounded-lg bg-elevated px-3 py-1.5 text-xs text-fg border border-border focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Full Synopsis</label>
                  <textarea
                    rows={2}
                    placeholder="Full plot details..."
                    value={newTitle.synopsis}
                    onChange={(e) => setNewTitle({ ...newTitle, synopsis: e.target.value })}
                    className="w-full rounded-lg bg-elevated px-3 py-2 text-xs text-fg border border-border focus:outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Genres (comma-separated)</label>
                    <input
                      type="text"
                      placeholder="Action, Thriller, Drama"
                      value={newTitle.genres}
                      onChange={(e) => setNewTitle({ ...newTitle, genres: e.target.value })}
                      className="w-full rounded-lg bg-elevated px-3 py-1.5 text-xs text-fg border border-border focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Badges (comma-separated)</label>
                    <input
                      type="text"
                      placeholder="HD, Tamil, 4K"
                      value={newTitle.badges}
                      onChange={(e) => setNewTitle({ ...newTitle, badges: e.target.value })}
                      className="w-full rounded-lg bg-elevated px-3 py-1.5 text-xs text-fg border border-border focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-5 py-1">
                  <label className="flex items-center gap-2 text-xs text-fg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTitle.original}
                      onChange={(e) => setNewTitle({ ...newTitle, original: e.target.checked })}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span>ARMSS Original</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-fg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newTitle.kids}
                      onChange={(e) => setNewTitle({ ...newTitle, kids: e.target.checked })}
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span>Kids Safe</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-fg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasBadgeInString(newTitle.badges, "Featured")}
                      onChange={(e) =>
                        setNewTitle({
                          ...newTitle,
                          badges: toggleBadgeInString(newTitle.badges, "Featured", e.target.checked),
                        })
                      }
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span>Hero Billboard</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-fg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasBadgeInString(newTitle.badges, "Trending")}
                      onChange={(e) =>
                        setNewTitle({
                          ...newTitle,
                          badges: toggleBadgeInString(newTitle.badges, "Trending", e.target.checked),
                        })
                      }
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span>Trending Now</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-fg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasBadgeInString(newTitle.badges, "Top 10")}
                      onChange={(e) =>
                        setNewTitle({
                          ...newTitle,
                          badges: toggleBadgeInString(newTitle.badges, "Top 10", e.target.checked),
                        })
                      }
                      className="rounded border-border text-accent focus:ring-accent"
                    />
                    <span>Top 10 Row</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button type="button" variant="line" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={actionLoading === "create"}>
                  {actionLoading === "create" ? "Adding..." : "Save Title"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-muted text-sm">Loading titles from backend...</p>
      ) : titles.length === 0 ? (
        <div className="rounded-xl bg-surface border border-border p-8 text-center">
          <Film className="size-10 text-muted mx-auto mb-3" />
          <p className="text-sm text-fg font-medium">No titles in backend catalogue yet</p>
          <p className="text-xs text-muted mt-1">Use the "+ Add New Title" button above to publish titles to the backend catalogue.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface border-b border-border text-xs text-muted uppercase tracking-wider">
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Kind</th>
                <th className="text-left px-4 py-3">Access Tier</th>
                <th className="text-left px-4 py-3">Change Tier</th>
                <th className="text-left px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {titles.map((t: any) => (
                <tr key={t.id} className="hover:bg-fg/3 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-fg flex items-center gap-1.5">
                      <span>{t.title}</span>
                      {t.trailer ? (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-1.5 py-0.5 inline-flex items-center gap-1" title="Stream URL Configured">
                          <Video className="size-2.5" />
                          Stream
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted">
                      {t.year} · {t.maturity}
                      {t.original ? <span className="ml-1.5 text-[10px] text-accent font-semibold">ARMSS Original</span> : null}
                      {t.kids ? <span className="ml-1.5 text-[10px] text-match font-semibold">Kids</span> : null}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted capitalize hidden sm:table-cell">{t.kind}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold uppercase text-xs ${tierColor[t.required_tier ?? "free"] ?? "text-fg"}`}>
                      {t.required_tier ?? "free"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={t.required_tier ?? "free"}
                      onChange={(e) => handleTierChange(t.id, e.target.value)}
                      disabled={actionLoading === t.id}
                      className="rounded-md bg-elevated px-2 py-1 text-xs text-fg border border-border focus:outline-none disabled:opacity-50"
                    >
                      <option value="free">Free</option>
                      <option value="standard">Standard</option>
                      <option value="premium">Premium</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        title="Edit title details & streaming links"
                        onClick={() => handleOpenEdit(t)}
                        className="p-1.5 rounded-md text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        title="Delete title"
                        onClick={() => handleDeleteTitle(t.id, t.title)}
                        disabled={actionLoading === t.id + "-del"}
                        className="p-1.5 rounded-md text-muted hover:text-live hover:bg-live/10 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-surface border-t border-border text-xs text-muted flex justify-between items-center">
            <span>Showing {titles.length} title{titles.length !== 1 ? "s" : ""}</span>
            <span className="text-[11px] text-muted">Titles in SQL Database</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Broadcast Tab ──────────────────────────────────────────────── */
function BroadcastTab() {
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"info" | "warning" | "success">("info");
  const [sending, setSending] = useState(false);
  const [activeBroadcast, setActiveBroadcast] = useState<{
    message: string;
    type: "info" | "warning" | "success";
    sent_at: string;
  } | null>(null);
  const [loadingActive, setLoadingActive] = useState(true);
  const [clearing, setClearing] = useState(false);

  const loadActive = async () => {
    try {
      setLoadingActive(true);
      const res = await api.getLatestNotification();
      setActiveBroadcast(res);
    } catch {
      setActiveBroadcast(null);
    } finally {
      setLoadingActive(false);
    }
  };

  useEffect(() => {
    void loadActive();
  }, []);

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message to broadcast.");
      return;
    }
    setSending(true);
    const ok = await api.admin.broadcast(message.trim(), type);
    if (ok) {
      toast.success("Notification broadcast sent to all users.");
      setMessage("");
      await loadActive();
    } else {
      toast.error("Broadcast failed. Backend may not be connected.");
    }
    setSending(false);
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      const ok = await api.admin.clearBroadcast();
      if (ok) {
        toast.success("Active broadcast message has been deactivated.");
        setActiveBroadcast(null);
      } else {
        toast.error("Failed to deactivate broadcast.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to clear broadcast.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-fg mb-2">Broadcast Notification</h2>
        <p className="text-sm text-muted">
          Send a platform-wide notification banner to all active users, or deactivate the message currently on air.
        </p>
      </div>

      {/* ── Active Broadcast Status Card ── */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span
              className={`size-2.5 rounded-full ${
                activeBroadcast ? "bg-match animate-pulse" : "bg-muted"
              }`}
            />
            <h3 className="text-sm font-semibold text-fg">Active Broadcast Status</h3>
          </div>
          {activeBroadcast && (
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                activeBroadcast.type === "warning"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  : activeBroadcast.type === "success"
                  ? "bg-match/20 text-match border border-match/30"
                  : "bg-accent/20 text-accent border border-accent/30"
              }`}
            >
              {activeBroadcast.type}
            </span>
          )}
        </div>

        {loadingActive ? (
          <div className="py-6 flex items-center justify-center text-xs text-muted">
            <RefreshCw className="size-3.5 animate-spin mr-2 text-accent" />
            Checking broadcast status...
          </div>
        ) : activeBroadcast && activeBroadcast.message ? (
          <div className="pt-4 space-y-4">
            <div className="rounded-lg bg-surface-elevated border border-border/80 p-3.5">
              <p className="text-sm text-fg font-medium leading-relaxed">{activeBroadcast.message}</p>
              {activeBroadcast.sent_at && (
                <p className="text-[11px] text-muted mt-2">
                  Broadcasted {formatRelativeGlobal(activeBroadcast.sent_at)} ({new Date(activeBroadcast.sent_at).toLocaleTimeString()})
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="line"
                disabled={clearing}
                onClick={handleClear}
                className="text-xs text-red-400 border-red-500/30 hover:bg-red-500/15 hover:text-red-300 hover:border-red-500/50 flex items-center gap-2"
              >
                {clearing ? <RefreshCw className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                {clearing ? "Deactivating..." : "Deactivate / Clear Broadcast"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="pt-4 py-2 text-xs text-muted flex items-center justify-between">
            <span>No active broadcast notification on air.</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={loadActive}
              className="text-[11px] text-muted hover:text-fg h-7 px-2"
            >
              <RefreshCw className="size-3 mr-1" />
              Refresh
            </Button>
          </div>
        )}
      </div>

      {/* ── Publish New Broadcast Form ── */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-fg">Publish New Broadcast</h3>

        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">Notification Type</label>
          <div className="flex gap-2">
            {(["info", "success", "warning"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium capitalize transition-all ${
                  type === t
                    ? t === "warning"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                      : t === "success"
                      ? "bg-match/20 text-match border border-match/30"
                      : "bg-accent/20 text-accent border border-accent/30"
                    : "bg-surface-elevated text-muted border border-border hover:text-fg"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your broadcast message to all users..."
            rows={4}
            className="w-full rounded-lg bg-surface-elevated px-4 py-3 text-sm text-fg border border-border focus:outline-none focus:border-accent resize-none placeholder:text-muted"
          />
          <p className="mt-1 text-xs text-muted">{message.length} / 280 characters</p>
        </div>

        <Button
          type="button"
          onClick={handleSend}
          disabled={sending || !message.trim()}
          className="flex items-center gap-2"
        >
          <Bell className="size-4" />
          {sending ? "Sending..." : "Send Broadcast"}
        </Button>
      </div>
    </div>
  );
}

/* ─── Display & Home Screen Layout Tab ──────────────────────────── */
function DisplayLayoutTab() {
  const currentSettings = useAether((s) => s.displaySettings) ?? DEFAULT_DISPLAY_SETTINGS;
  const updateDisplaySettings = useAether((s) => s.updateDisplaySettings);
  const resetDisplaySettings = useAether((s) => s.resetDisplaySettings);

  const [settings, setSettings] = useState<SiteDisplaySettings>(() => ({
    navVisibility: { ...DEFAULT_DISPLAY_SETTINGS.navVisibility, ...currentSettings.navVisibility },
    homeLayout: {
      ...DEFAULT_DISPLAY_SETTINGS.homeLayout,
      ...currentSettings.homeLayout,
      rowOrder: currentSettings.homeLayout?.rowOrder?.length
        ? [...currentSettings.homeLayout.rowOrder]
        : [...DEFAULT_DISPLAY_SETTINGS.homeLayout.rowOrder],
    },
  }));

  const [hasChanges, setHasChanges] = useState(false);

  // Toggle user nav visibility (Films, Series, Live, etc.)
  const toggleNav = (key: keyof typeof settings.navVisibility) => {
    setSettings((prev) => ({
      ...prev,
      navVisibility: {
        ...prev.navVisibility,
        [key]: !prev.navVisibility[key],
      },
    }));
    setHasChanges(true);
  };

  // Reorder home screen rows
  const moveRow = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= settings.homeLayout.rowOrder.length) return;
    const nextOrder = [...settings.homeLayout.rowOrder];
    const temp = nextOrder[index];
    nextOrder[index] = nextOrder[newIndex];
    nextOrder[newIndex] = temp;
    setSettings((prev) => ({
      ...prev,
      homeLayout: {
        ...prev.homeLayout,
        rowOrder: nextOrder,
      },
    }));
    setHasChanges(true);
  };

  // Toggle home row visibility
  const toggleRow = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      homeLayout: {
        ...prev.homeLayout,
        rowOrder: prev.homeLayout.rowOrder.map((r) =>
          r.id === id ? { ...r, visible: !r.visible } : r,
        ),
      },
    }));
    setHasChanges(true);
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const ok = await api.admin.updateSiteDisplaySettings(settings);
      if (ok) {
        updateDisplaySettings(() => settings);
        setHasChanges(false);
        toast.success("Home layout & visibility preferences saved and synced globally!");
      } else {
        updateDisplaySettings(() => settings);
        setHasChanges(false);
        toast.warning("Server sync responded with error, but applied locally.");
      }
    } catch {
      updateDisplaySettings(() => settings);
      setHasChanges(false);
      toast.warning("Network issue syncing with server, applied locally.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      await api.admin.resetSiteDisplaySettings();
      resetDisplaySettings();
      setSettings(DEFAULT_DISPLAY_SETTINGS);
      setHasChanges(false);
      toast.info("Reset display settings to default layout.");
    } catch {
      resetDisplaySettings();
      setSettings(DEFAULT_DISPLAY_SETTINGS);
      setHasChanges(false);
    } finally {
      setSaving(false);
    }
  };

  const navItems = [
    {
      key: "films" as const,
      label: "Films & Movies",
      desc: "Top navigation link and movies browsing catalog for users",
      icon: Film,
      visible: settings.navVisibility.films,
    },
    {
      key: "series" as const,
      label: "TV & Web Series",
      desc: "Series category link and multi-episode series showcase",
      icon: Tv,
      visible: settings.navVisibility.series,
    },
    {
      key: "live" as const,
      label: "Live TV Channels",
      desc: "Live TV streaming navigation and 24/7 channels section",
      icon: Video,
      visible: settings.navVisibility.live,
    },
    {
      key: "myList" as const,
      label: "My List (Watchlist)",
      desc: "Personal watchlist bookmarking access in navigation",
      icon: Eye,
      visible: settings.navVisibility.myList,
    },
    {
      key: "comingSoon" as const,
      label: "Coming Soon & Trailers",
      desc: "Upcoming releases, festival teasers, and trailer notifications",
      icon: Bell,
      visible: settings.navVisibility.comingSoon,
    },
    {
      key: "plans" as const,
      label: "Subscription Plans",
      desc: "Membership tier comparison and upgrade page in top bar",
      icon: Crown,
      visible: settings.navVisibility.plans,
    },
  ];

  return (
    <div className="space-y-10">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-surface p-6 border border-border">
        <div>
          <h2 className="text-xl font-semibold text-fg">Home Screen & Visibility Controls</h2>
          <p className="mt-1 text-sm text-muted">
            Choose which options are visible to viewers (Films, Live TV, Series) and customize the layout alignment and sequence of home screen data.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
            className="flex items-center gap-2 text-muted hover:text-fg text-xs"
          >
            <RotateCcw className="size-3.5" />
            Reset Defaults
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex items-center gap-2 text-xs"
          >
            {saving ? <RefreshCw className="size-4 animate-spin" /> : <Check className="size-4" />}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button asChild variant="line" className="text-xs">
            <Link to="/" target="_blank" className="flex items-center gap-1.5">
              <ExternalLink className="size-3.5" />
              Preview Home
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Section 1: User Feature Visibility Controls ── */}
      <div className="rounded-xl bg-surface p-6 border border-border">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Eye className="size-5 text-accent" />
              <h3 className="text-base font-semibold text-fg">Visible Options for Users</h3>
            </div>
            <p className="mt-1 text-xs text-muted">
              Enable or disable primary content sections and navigation options visible to regular users.
            </p>
          </div>
          <span className="text-xs text-muted">
            {Object.values(settings.navVisibility).filter(Boolean).length} of 6 active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {navItems.map((item) => (
            <div
              key={item.key}
              onClick={() => toggleNav(item.key)}
              className={`flex flex-col justify-between p-4 rounded-xl border transition-all cursor-pointer select-none ${
                item.visible
                  ? "bg-surface-elevated/70 border-accent/40 shadow-sm"
                  : "bg-surface/40 border-border/70 opacity-60 hover:opacity-80"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-lg ${
                        item.visible ? "bg-accent/15 text-accent" : "bg-surface text-muted"
                      }`}
                    >
                      <item.icon className="size-4" />
                    </div>
                    <span className="text-sm font-semibold text-fg">{item.label}</span>
                  </div>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      item.visible
                        ? "bg-match/20 text-match border border-match/30"
                        : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                    }`}
                  >
                    {item.visible ? "Visible" : "Hidden"}
                  </span>
                </div>
                <p className="mt-3 text-xs text-muted leading-relaxed">{item.desc}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                <span className="text-muted">User Visibility</span>
                <span className={`font-medium ${item.visible ? "text-accent" : "text-zinc-500"}`}>
                  {item.visible ? "Turn Off" : "Turn On"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 2: Hero Billboard Spotlight & Alignment ── */}
      <div className="rounded-xl bg-surface p-6 border border-border">
        <div className="flex items-center gap-2 mb-6">
          <Sliders className="size-5 text-accent" />
          <div>
            <h3 className="text-base font-semibold text-fg">Hero Billboard Spotlight & Alignment</h3>
            <p className="mt-0.5 text-xs text-muted">
              Choose the featured movie/series in the main hero billboard, upload custom backdrops or teaser videos, and configure layout alignment.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Spotlight Title Selector */}
          <div>
            <label className="block text-xs font-medium text-muted mb-2">Featured Spotlight Title</label>
            <select
              value={settings.homeLayout.heroTitleId}
              onChange={(e) => {
                setSettings((prev) => ({
                  ...prev,
                  homeLayout: { ...prev.homeLayout, heroTitleId: e.target.value },
                }));
                setHasChanges(true);
              }}
              className="w-full rounded-lg bg-surface-elevated px-3 py-2.5 text-sm text-fg border border-border focus:outline-none focus:border-accent"
            >
              <option value="auto">Auto (Popular & Trending)</option>
              {TITLES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.year}) — {t.kind.toUpperCase()}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] text-muted">
              Choose a specific title to pin to the home billboard, or leave on Auto.
            </p>
          </div>

          {/* Billboard Height */}
          <div>
            <label className="block text-xs font-medium text-muted mb-2">Billboard Height (Viewport)</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "compact", label: "Compact", sub: "60vh" },
                { id: "standard", label: "Standard", sub: "75vh" },
                { id: "full", label: "Cinematic", sub: "85vh" },
              ].map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    setSettings((prev) => ({
                      ...prev,
                      homeLayout: {
                        ...prev.homeLayout,
                        heroHeight: h.id as "full" | "standard" | "compact",
                      },
                    }));
                    setHasChanges(true);
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs font-medium transition-all ${
                    settings.homeLayout.heroHeight === h.id
                      ? "bg-accent/15 text-accent border-accent/40"
                      : "bg-surface-elevated text-muted border-border hover:text-fg"
                  }`}
                >
                  <span>{h.label}</span>
                  <span className="text-[10px] opacity-70">{h.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Billboard Text Alignment */}
          <div>
            <label className="block text-xs font-medium text-muted mb-2">Billboard Text Alignment</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "left", label: "Left Aligned", desc: "Classic cinematic" },
                { id: "center", label: "Center Aligned", desc: "Centered showcase" },
              ].map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setSettings((prev) => ({
                      ...prev,
                      homeLayout: {
                        ...prev.homeLayout,
                        heroAlignment: a.id as "left" | "center",
                      },
                    }));
                    setHasChanges(true);
                  }}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-xs font-medium transition-all ${
                    settings.homeLayout.heroAlignment === a.id
                      ? "bg-accent/15 text-accent border-accent/40"
                      : "bg-surface-elevated text-muted border-border hover:text-fg"
                  }`}
                >
                  <span>{a.label}</span>
                  <span className="text-[10px] opacity-70">{a.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Spotlight Live Preview & Quick Media Upload */}
        {(() => {
          const spotlight =
            settings.homeLayout.heroTitleId && settings.homeLayout.heroTitleId !== "auto"
              ? TITLES.find((t) => t.id === settings.homeLayout.heroTitleId) || TITLES[0]
              : TITLES[0];
          if (!spotlight) return null;

          return (
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3 flex items-center gap-1.5">
                <Film className="size-3.5 text-accent" />
                Spotlight Title Live Preview & Direct Media Upload
              </p>

              <div className="relative rounded-xl border border-border overflow-hidden bg-surface-elevated/60">
                {/* Banner preview area */}
                <div className="relative h-48 sm:h-56 w-full overflow-hidden bg-bg">
                  <BackdropArt title={spotlight} kenburns className="h-full w-full" />
                  <div className="hero-scrim absolute inset-0" />
                  <div className="hero-floor absolute inset-0" />
                  <div className="absolute inset-0 p-6 flex flex-col justify-end">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-accent">
                      {spotlight.original ? "ARMSS Original" : spotlight.kind}
                    </span>
                    <h4 className="font-display italic text-2xl sm:text-3xl text-fg mt-0.5">
                      {spotlight.title}
                    </h4>
                    <p className="text-xs text-muted max-w-lg mt-1 line-clamp-2">
                      {spotlight.logline}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-bold text-match">{spotlight.match}% Match</span>
                      <span className="text-[10px] text-muted">{spotlight.year}</span>
                      <span className="text-[10px] px-1 rounded bg-surface border border-border text-fg font-medium">
                        {spotlight.maturity}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                          spotlight.trailer ? "bg-match/20 text-match" : "bg-amber-500/20 text-amber-400"
                        }`}
                      >
                        {spotlight.trailer ? "Video Stream Ready" : "No Stream URL"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Upload Controls for this title */}
                <div className="p-4 bg-surface flex flex-wrap items-center justify-between gap-3 border-t border-border">
                  <div className="flex flex-wrap items-center gap-2">
                    <UploadButton
                      accept="image/*"
                      label="Upload Hero Backdrop"
                      onUploaded={async (url) => {
                        const ok = await api.admin.updateTitle(spotlight.id, { backdrop: url });
                        if (ok) {
                          toast.success(`Updated ${spotlight.title}'s backdrop!`);
                          void useAether.getState().fetchCatalog();
                        }
                      }}
                    />
                    <UploadButton
                      accept="video/*"
                      label="Upload Teaser Video (.mp4)"
                      onUploaded={async (url) => {
                        const ok = await api.admin.updateTitle(spotlight.id, { trailer: url });
                        if (ok) {
                          toast.success(`Updated ${spotlight.title}'s video stream!`);
                          void useAether.getState().fetchCatalog();
                        }
                      }}
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span>Active backdrop:</span>
                    <span className="font-mono text-fg text-[11px] truncate max-w-xs">
                      {spotlight.backdrop || spotlight.poster || "Tone artwork"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Section 3: Home Screen Data Rows Alignment & Sequence ── */}
      <div className="rounded-xl bg-surface p-6 border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <LayoutTemplate className="size-5 text-accent" />
              <h3 className="text-base font-semibold text-fg">Home Screen Data Rows Alignment & Order</h3>
            </div>
            <p className="mt-1 text-xs text-muted">
              Use the Up/Down buttons to re-order rows on the home page, and toggle visibility for any row.
            </p>
          </div>
          <span className="text-xs text-muted">
            {settings.homeLayout.rowOrder.filter((r) => r.visible).length} of{" "}
            {settings.homeLayout.rowOrder.length} rows visible
          </span>
        </div>

        <div className="space-y-2">
          {settings.homeLayout.rowOrder.map((row, index) => (
            <div
              key={row.id}
              className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                row.visible
                  ? "bg-surface-elevated/60 border-border"
                  : "bg-surface/30 border-border/40 opacity-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="grid size-6 place-items-center rounded bg-surface text-xs font-semibold text-muted">
                  #{index + 1}
                </span>
                <div>
                  <span className="text-sm font-medium text-fg">{row.label}</span>
                  <span className="ml-2 text-[10px] text-muted font-mono uppercase tracking-wider">
                    id: {row.id}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Re-order Up */}
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveRow(index, -1)}
                  aria-label="Move row up"
                  className="grid size-8 place-items-center rounded-lg bg-surface border border-border text-muted hover:text-fg disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ArrowUp className="size-4" />
                </button>

                {/* Re-order Down */}
                <button
                  type="button"
                  disabled={index === settings.homeLayout.rowOrder.length - 1}
                  onClick={() => moveRow(index, 1)}
                  aria-label="Move row down"
                  className="grid size-8 place-items-center rounded-lg bg-surface border border-border text-muted hover:text-fg disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ArrowDown className="size-4" />
                </button>

                {/* Toggle Visibility */}
                <button
                  type="button"
                  onClick={() => toggleRow(row.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    row.visible
                      ? "bg-match/15 text-match border-match/30 hover:bg-match/25"
                      : "bg-surface text-muted border-border hover:text-fg"
                  }`}
                >
                  {row.visible ? (
                    <>
                      <Eye className="size-3.5" />
                      Visible
                    </>
                  ) : (
                    <>
                      <EyeOff className="size-3.5" />
                      Hidden
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 4: Container Width Alignment ── */}
      <div className="rounded-xl bg-surface p-6 border border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-fg">Container Width Alignment</h3>
            <p className="mt-0.5 text-xs text-muted">
              Choose between edge-to-edge full width fluid layout or centered boxed alignment for home rows.
            </p>
          </div>
          <div className="flex gap-2">
            {[
              { id: "fluid", label: "Fluid (Edge-to-Edge)" },
              { id: "constrained", label: "Centered (Max 7XL)" },
            ].map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => {
                  setSettings((prev) => ({
                    ...prev,
                    homeLayout: {
                      ...prev.homeLayout,
                      containerWidth: w.id as "fluid" | "constrained",
                    },
                  }));
                  setHasChanges(true);
                }}
                className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all ${
                  settings.homeLayout.containerWidth === w.id
                    ? "bg-accent/15 text-accent border-accent/40"
                    : "bg-surface-elevated text-muted border-border hover:text-fg"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Save Reminder Sticky Bar */}
      {hasChanges && (
        <div className="sticky bottom-6 z-30 flex items-center justify-between p-4 rounded-xl bg-surface-elevated border border-accent/40 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-accent animate-pulse" />
            <span className="text-sm font-medium text-fg">You have unsaved layout & visibility changes</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSettings(currentSettings);
                setHasChanges(false);
              }}
              className="text-xs"
            >
              Discard
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="text-xs flex items-center gap-1.5"
            >
              {saving ? <RefreshCw className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              {saving ? "Saving..." : "Save & Apply"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Plans & Content Access Management Tab
// ─────────────────────────────────────────────────────────────────────────────

interface AdminPlanState {
  id: string;
  name: string;
  price_inr: number;
  billing_period: string;
  daily_movie_limit: number;
  daily_episode_limit: number;
  max_quality: number;
  max_devices: number;
  razorpay_plan_id: string;
  is_active: boolean;
}

function PlansAccessTab() {
  const [plans, setPlans] = useState<AdminPlanState[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<AdminPlanState | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  // Content series access config state
  const [titles, setTitles] = useState<Title[]>([]);
  const [seriesSearch, setSeriesSearch] = useState("");
  const [seriesAccess, setSeriesAccess] = useState<Record<string, { tier: string; freeEps: number }>>({});
  const [savingAccess, setSavingAccess] = useState<Record<string, boolean>>({});

  const loadPlans = async () => {
    setLoading(true);
    try {
      const data = await api.admin.getPlans();
      if (data && data.length > 0) {
        setPlans(data as AdminPlanState[]);
      }
    } catch {
      toast.error("Failed loading subscription plans.");
    } finally {
      setLoading(false);
    }
  };

  const loadTitles = async () => {
    try {
      const res = await api.admin.getTitles();
      if (res && res.titles) {
        setTitles(res.titles);
        // Initialize access state from titles
        const map: Record<string, { tier: string; freeEps: number }> = {};
        for (const t of res.titles) {
          map[t.id] = {
            tier: t.required_tier || "free",
            freeEps: (t as any).free_episodes ?? 0,
          };
        }
        setSeriesAccess(map);
      }
    } catch {
      // fallback to catalog
      setTitles(TITLES);
    }
  };

  useEffect(() => {
    void loadPlans();
    void loadTitles();
  }, []);

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    setSavingPlan(true);
    try {
      const ok = await api.admin.updatePlan(editingPlan.id, editingPlan);
      if (ok) {
        toast.success(`Plan "${editingPlan.name}" updated successfully!`);
        setEditingPlan(null);
        await loadPlans();
      } else {
        toast.error("Failed updating plan.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed updating plan.");
    } finally {
      setSavingPlan(false);
    }
  };

  const handleSaveTitleAccess = async (titleId: string) => {
    const config = seriesAccess[titleId];
    if (!config) return;
    setSavingAccess((prev) => ({ ...prev, [titleId]: true }));
    try {
      const ok = await api.admin.updateTitleAccess(titleId, {
        required_tier: config.tier,
        free_episodes: config.freeEps,
      });
      if (ok) {
        toast.success("Content access updated successfully!");
      } else {
        toast.error("Failed updating content access.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed updating content access.");
    } finally {
      setSavingAccess((prev) => ({ ...prev, [titleId]: false }));
    }
  };

  const filteredTitles = titles.filter(
    (t) =>
      t.title.toLowerCase().includes(seriesSearch.toLowerCase()) ||
      t.kind.toLowerCase().includes(seriesSearch.toLowerCase())
  );

  return (
    <div className="space-y-12">
      {/* ── Section 1: Subscription Plans ── */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-display font-semibold text-fg flex items-center gap-2">
              <Crown className="size-5 text-accent" />
              Subscription Plans & Quotas
            </h2>
            <p className="text-sm text-muted mt-1">
              Configure daily movie/episode quotas, max playback resolution, and device limits per tier.
            </p>
          </div>
          <Button
            type="button"
            variant="line"
            size="sm"
            onClick={loadPlans}
            disabled={loading}
            className="self-start sm:self-auto flex items-center gap-1.5"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            Refresh Plans
          </Button>
        </div>

        {loading ? (
          <div className="mt-6 flex h-48 items-center justify-center rounded-xl bg-surface border border-border">
            <RefreshCw className="size-6 text-muted animate-spin" />
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "relative flex flex-col justify-between rounded-2xl p-6 border transition-all",
                  p.id === "premium"
                    ? "bg-gradient-to-b from-accent/10 via-surface to-surface border-accent/40 shadow-lg"
                    : "bg-surface border-border hover:border-border-subtle"
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold tracking-wider uppercase text-accent">
                      {p.id.toUpperCase()}
                    </span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider",
                        p.is_active
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-red-500/15 text-red-400 border border-red-500/30"
                      )}
                    >
                      {p.is_active ? "Active" : "Disabled"}
                    </span>
                  </div>

                  <h3 className="mt-2 text-lg font-bold text-fg">{p.name}</h3>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-fg">₹{p.price_inr}</span>
                    <span className="text-xs text-muted">/{p.billing_period}</span>
                  </div>

                  <div className="mt-6 space-y-3 text-xs text-muted">
                    <div className="flex justify-between pb-2 border-b border-border/50">
                      <span>Daily Movie Limit:</span>
                      <strong className="text-fg">{p.daily_movie_limit} movies / day</strong>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-border/50">
                      <span>Daily Episode Limit:</span>
                      <strong className="text-fg">{p.daily_episode_limit} episodes / day</strong>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-border/50">
                      <span>Max Resolution:</span>
                      <strong className="text-fg">{p.max_quality}p</strong>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-border/50">
                      <span>Device Limit:</span>
                      <strong className="text-fg">{p.max_devices} devices</strong>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-border/50">
                      <span>Razorpay Plan ID:</span>
                      <strong className="text-fg truncate max-w-[140px]" title={p.razorpay_plan_id || "None"}>
                        {p.razorpay_plan_id || "—"}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-border/60">
                  <Button
                    type="button"
                    variant="line"
                    size="sm"
                    onClick={() => setEditingPlan({ ...p })}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold"
                  >
                    <Pencil className="size-3.5" />
                    Edit Plan Settings
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Edit Plan Modal ── */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-surface-elevated border border-border p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <h3 className="text-base font-bold text-fg flex items-center gap-2">
                <Crown className="size-4 text-accent" />
                Edit Plan: {editingPlan.id.toUpperCase()}
              </h3>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="text-muted hover:text-fg transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted block mb-1">Display Name</label>
                <input
                  type="text"
                  value={editingPlan.name}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  required
                  className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted block mb-1">Price (₹ INR)</label>
                  <input
                    type="number"
                    min="0"
                    value={editingPlan.price_inr}
                    onChange={(e) => setEditingPlan({ ...editingPlan, price_inr: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted block mb-1">Billing Period</label>
                  <select
                    value={editingPlan.billing_period}
                    onChange={(e) => setEditingPlan({ ...editingPlan, billing_period: e.target.value })}
                    className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted block mb-1">Daily Movie Limit</label>
                  <input
                    type="number"
                    min="1"
                    value={editingPlan.daily_movie_limit}
                    onChange={(e) => setEditingPlan({ ...editingPlan, daily_movie_limit: parseInt(e.target.value) || 1 })}
                    required
                    className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted block mb-1">Daily Episode Limit</label>
                  <input
                    type="number"
                    min="1"
                    value={editingPlan.daily_episode_limit}
                    onChange={(e) => setEditingPlan({ ...editingPlan, daily_episode_limit: parseInt(e.target.value) || 1 })}
                    required
                    className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted block mb-1">Max Quality</label>
                  <select
                    value={editingPlan.max_quality}
                    onChange={(e) => setEditingPlan({ ...editingPlan, max_quality: parseInt(e.target.value) || 720 })}
                    className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none"
                  >
                    <option value={720}>720p HD</option>
                    <option value={1080}>1080p Full HD</option>
                    <option value={2160}>2160p 4K UHD</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted block mb-1">Max Devices</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={editingPlan.max_devices}
                    onChange={(e) => setEditingPlan({ ...editingPlan, max_devices: parseInt(e.target.value) || 1 })}
                    className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted block mb-1">Razorpay Plan ID</label>
                <input
                  type="text"
                  placeholder="plan_xxxxxxxxxxxxxx"
                  value={editingPlan.razorpay_plan_id}
                  onChange={(e) => setEditingPlan({ ...editingPlan, razorpay_plan_id: e.target.value })}
                  className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none font-mono text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="plan-active"
                  checked={editingPlan.is_active}
                  onChange={(e) => setEditingPlan({ ...editingPlan, is_active: e.target.checked })}
                  className="rounded border-border accent-accent"
                />
                <label htmlFor="plan-active" className="text-xs font-medium text-fg cursor-pointer">
                  Plan is Active (visible and purchasable)
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-border">
                <Button type="button" variant="ghost" onClick={() => setEditingPlan(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={savingPlan} className="flex items-center gap-1.5">
                  {savingPlan ? <RefreshCw className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  {savingPlan ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Section 2: Content Access & Free Episodes Boundary ── */}
      <div className="pt-6 border-t border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-display font-semibold text-fg flex items-center gap-2">
              <Film className="size-5 text-accent" />
              Content Access & Free Episodes per Series
            </h2>
            <p className="text-sm text-muted mt-1">
              Set content required tiers and configure how many episodes free users can watch for each series.
            </p>
          </div>

          <div className="w-full sm:w-64">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted" />
              <input
                type="text"
                placeholder="Search titles..."
                value={seriesSearch}
                onChange={(e) => setSeriesSearch(e.target.value)}
                className="w-full rounded-xl bg-surface border border-border pl-9 pr-3 py-2 text-xs text-fg placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-elevated border-b border-border text-muted">
              <tr>
                <th className="py-3 px-4 font-semibold">Title</th>
                <th className="py-3 px-4 font-semibold">Kind</th>
                <th className="py-3 px-4 font-semibold">Required Tier</th>
                <th className="py-3 px-4 font-semibold">Free Episodes (for Series)</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredTitles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted">
                    No titles found matching your search.
                  </td>
                </tr>
              ) : (
                filteredTitles.map((t) => {
                  const currentAccess = seriesAccess[t.id] || { tier: "free", freeEps: 0 };
                  const isSaving = savingAccess[t.id];
                  const isSeries = t.kind.toLowerCase() === "series";

                  return (
                    <tr key={t.id} className="hover:bg-surface-elevated/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-fg">{t.title}</div>
                        <div className="text-[10px] text-muted font-mono">{t.id}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider",
                            isSeries ? "bg-purple-500/15 text-purple-400" : "bg-blue-500/15 text-blue-400"
                          )}
                        >
                          {t.kind}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={currentAccess.tier}
                          onChange={(e) =>
                            setSeriesAccess((prev) => ({
                              ...prev,
                              [t.id]: { ...currentAccess, tier: e.target.value },
                            }))
                          }
                          className="rounded-lg bg-surface border border-border px-2 py-1 text-xs text-fg focus:border-accent focus:outline-none"
                        >
                          <option value="free">Free (All users)</option>
                          <option value="standard">Standard (₹99+)</option>
                          <option value="premium">Premium (₹199+)</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        {isSeries ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={currentAccess.freeEps}
                              onChange={(e) =>
                                setSeriesAccess((prev) => ({
                                  ...prev,
                                  [t.id]: {
                                    ...currentAccess,
                                    freeEps: parseInt(e.target.value) || 0,
                                  },
                                }))
                              }
                              className="w-16 rounded-lg bg-surface border border-border px-2 py-1 text-xs text-fg focus:border-accent focus:outline-none"
                            />
                            <span className="text-[11px] text-muted">
                              {currentAccess.freeEps === 0
                                ? "(None - requires tier)"
                                : `Episodes 1..${currentAccess.freeEps} free`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted text-[11px]">— (Movie)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          type="button"
                          size="sm"
                          disabled={isSaving}
                          onClick={() => handleSaveTitleAccess(t.id)}
                          className="text-xs h-7 px-2.5"
                        >
                          {isSaving ? <RefreshCw className="size-3 animate-spin" /> : "Save"}
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

