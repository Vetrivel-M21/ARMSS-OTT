import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  BellOff,
  Check,
  Download,
  Info,
  Play,
  Plus,
  Share2,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import { BackdropArt } from "@/components/poster";
import { MaturityPill } from "@/components/hero-billboard";
import { TitleCard } from "@/components/title-card";
import { Button } from "@/components/ui/button";
import {
  getTitle,
  kindLabel,
  similarTitles,
  type Episode,
} from "@/lib/catalog";
import { useAether } from "@/lib/store";
import { api } from "@/lib/api";
import { cn, formatRuntime } from "@/lib/utils";

export const Route = createFileRoute("/title/$id")({ component: TitlePage });

/* ─── Trailer Modal ─── */
function TrailerModal({
  title,
  open,
  onClose,
}: {
  title: ReturnType<typeof getTitle>;
  open: boolean;
  onClose: () => void;
}) {
  if (!title) return null;
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/85 backdrop-blur-md fade-in" />
        <Dialog.Content className="fixed inset-4 sm:inset-10 md:inset-16 z-50 overflow-hidden rounded-xl bg-bg shadow-2xl scale-in focus:outline-none">
          <Dialog.Title className="sr-only">
            {title.title} — Trailer
          </Dialog.Title>
          {/* Video / backdrop */}
          <div className="relative h-full w-full">
            {title.trailer ? (
              <video
                key={open ? "open" : "closed"}
                src={title.trailer}
                className="h-full w-full object-cover"
                autoPlay
                loop
                playsInline
                controls={false}
                poster={title.backdrop || title.poster}
              />
            ) : (
              <BackdropArt title={title} className="h-full" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-bg/90 via-bg/20 to-transparent" />

            {/* Title overlay */}
            <div className="absolute inset-x-0 bottom-0 p-6">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted">
                {title.original ? "ARMSS Original" : kindLabel(title.kind)}{" "}
                · Trailer
              </p>
              <h2 className="mt-1 font-display italic text-3xl sm:text-4xl">
                {title.title}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-fg/80 leading-relaxed">
                {title.logline}
              </p>
              {!title.trailer && (
                <p className="mt-3 text-xs text-muted">
                  Trailer not yet available — showing key art.
                </p>
              )}
            </div>
          </div>

          {/* Close */}
          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Close trailer"
              className="absolute right-4 top-4 z-10 grid size-9 place-items-center rounded-full bg-bg/70 text-fg shadow-[var(--shadow-border)] backdrop-blur-sm hover:bg-bg transition-colors"
            >
              <X className="size-4" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ─── Main Page ─── */
function TitlePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const user = useAether((s) => s.user);
  const catalogVersion = useAether((s) => s.catalogVersion);
  const title = getTitle(id);
  const profile = useAether((s) => s.activeProfile);
  const inList = useAether((s) => s.inList(id));
  const toggleList = useAether((s) => s.toggleList);
  const saved = useAether((s) => s.progressFor(id));
  const reminders = useAether((s) => s.reminders);
  const toggleReminder = useAether((s) => s.toggleReminder);
  const ratings = useAether((s) => s.ratings);
  const setRating = useAether((s) => s.setRating);
  const isDownloaded = useAether((s) => s.isDownloaded(id));
  const addDownload = useAether((s) => s.addDownload);
  const removeDownload = useAether((s) => s.removeDownload);

  const [tab, setTab] = useState<"episodes" | "related" | "details">(
    title?.episodes?.length ? "episodes" : "related",
  );
  const [trailerOpen, setTrailerOpen] = useState(false);

  if (!title) {
    return (
      <div className="grid min-h-svh place-items-center px-6 pt-24">
        <p className="text-muted">That title is not in the house.</p>
        <Link to="/" className="mt-3 text-sm text-fg">
          Back to Home
        </Link>
      </div>
    );
  }

  const coming = Boolean(title.comingSoon);
  const related = similarTitles(title, profile);
  const resume = saved && saved.progress > 0.05 && saved.progress < 0.95;
  const rating = ratings[title.id];
  const reminded = reminders.includes(title.id);

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      void navigator.share({ title: title.title, url });
    } else {
      void navigator.clipboard.writeText(url).then(() => {
        toast("Link copied to clipboard");
      });
    }
  };

  const handleDownload = () => {
    if (isDownloaded) {
      removeDownload(id);
      toast(`Removed "${title.title}" from downloads`);
    } else {
      addDownload(id);
      toast(`Downloading "${title.title}"…`);
    }
  };

  return (
    <article>
      <TrailerModal
        title={title}
        open={trailerOpen}
        onClose={() => setTrailerOpen(false)}
      />

      <div className="relative min-h-[28rem] overflow-hidden sm:min-h-[36rem]">
        <div className="absolute inset-0">
          {title.trailer ? (
            <video
              src={title.trailer}
              className="h-full w-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              poster={title.backdrop || title.poster}
            />
          ) : (
            <BackdropArt title={title} className="h-full" />
          )}
        </div>
        <div className="title-floor absolute inset-0" />
        <div className="relative z-10 mx-auto flex min-h-[28rem] max-w-5xl flex-col justify-end px-4 pb-10 pt-28 sm:min-h-[36rem] sm:px-8">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted">
            {title.original ? "ARMSS Original" : kindLabel(title.kind)}
          </p>
          <h1 className="mt-2 font-display italic text-4xl leading-[0.95] sm:text-6xl">
            {title.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
            {title.match > 0 ? (
              <span className="font-medium text-match tabular-nums">
                {title.match}% Match
              </span>
            ) : null}
            <span>{title.year}</span>
            <MaturityPill value={title.maturity} />
            <span>
              {title.kind === "series"
                ? `${title.seasons ?? 1} season${(title.seasons ?? 1) > 1 ? "s" : ""}`
                : formatRuntime(title.runtimeMin)}
            </span>
            {title.badges.map((b) => (
              <span
                key={b}
                className="rounded-xs px-1.5 py-0.5 text-[10px] tracking-wide text-fg/80 shadow-[var(--shadow-border)]"
              >
                {b}
              </span>
            ))}
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-fg/85 sm:text-base">
            {title.synopsis}
          </p>

          {/* Action buttons */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {coming ? (
              <Button
                size="lg"
                variant={reminded ? "ghost" : "play"}
                onClick={() => toggleReminder(title.id)}
              >
                {reminded ? (
                  <BellOff className="size-5" />
                ) : (
                  <Bell className="size-5" />
                )}
                {reminded ? "Reminder on" : "Remind me"}
              </Button>
            ) : (
              <Button
                size="lg"
                className="cursor-pointer"
                onClick={() => {
                  if (!user) {
                    void navigate({ to: "/login", search: { redirect: `/watch/${title.id}` } as any });
                  } else {
                    void navigate({
                      to: "/watch/$id",
                      params: { id: title.id },
                      search: saved?.episodeId ? { e: saved.episodeId } : undefined,
                    });
                  }
                }}
              >
                <Play className="size-5 fill-current ml-0.5" />
                {title.kind === "live"
                  ? "Watch live"
                  : resume
                    ? "Resume"
                    : "Play"}
              </Button>
            )}

            {/* Trailer button */}
            <Button
              size="lg"
              variant="line"
              onClick={() => setTrailerOpen(true)}
            >
              <Info className="size-5" />
              Trailer
            </Button>

            <Button
              size="lg"
              variant="ghost"
              onClick={() => {
                toggleList(title.id);
                toast(
                  inList
                    ? `Removed from My List`
                    : `Added "${title.title}" to My List`,
                );
              }}
            >
              {inList ? <Check className="size-5" /> : <Plus className="size-5" />}
              My List
            </Button>

            {/* Download */}
            {!coming && title.kind !== "live" ? (
              <Button
                size="icon"
                variant={isDownloaded ? "play" : "line"}
                aria-label={isDownloaded ? "Remove download" : "Download"}
                onClick={handleDownload}
              >
                <Download className="size-4" />
              </Button>
            ) : null}

            {/* Share */}
            <Button
              size="icon"
              variant="line"
              aria-label="Share"
              onClick={handleShare}
            >
              <Share2 className="size-4" />
            </Button>

            {/* Rating */}
            <Button
              size="icon"
              variant={rating === 1 ? "play" : "line"}
              aria-label="Like"
              onClick={() => {
                const nextScore = rating === 1 ? 0 : 1;
                setRating(title.id, nextScore);
                if (user) {
                  void api.setRating(title.id, nextScore);
                }
                if (rating !== 1) toast("Thanks for the rating!");
              }}
            >
              <ThumbsUp className="size-4" />
            </Button>
            <Button
              size="icon"
              variant={rating === -1 ? "ghost" : "line"}
              aria-label="Dislike"
              onClick={() => {
                const nextScore = rating === -1 ? 0 : -1;
                setRating(title.id, nextScore);
                if (user) {
                  void api.setRating(title.id, nextScore);
                }
              }}
            >
              <ThumbsDown className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <div className="flex gap-5 border-b border-border text-sm">
          {(title.episodes?.length
            ? (["episodes", "related", "details"] as const)
            : (["related", "details"] as const)
          ).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "border-b-2 pb-3 capitalize",
                tab === t
                  ? "border-fg text-fg"
                  : "border-transparent text-muted hover:text-fg",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "episodes" && title.episodes ? (
          <EpisodeList
            titleId={title.id}
            episodes={title.episodes}
            activeId={saved?.episodeId}
          />
        ) : null}

        {tab === "related" ? (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {related.map((t) => (
              <TitleCard key={t.id} title={t} size="fill" />
            ))}
          </div>
        ) : null}

        {tab === "details" ? (
          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Cast</dt>
              <dd className="mt-1 text-fg">
                {title.cast.map((c) => c.name).join(", ")}
              </dd>
            </div>
            {title.director ? (
              <div>
                <dt className="text-muted">Director</dt>
                <dd className="mt-1 text-fg">{title.director}</dd>
              </div>
            ) : null}
            {title.creators ? (
              <div>
                <dt className="text-muted">Created by</dt>
                <dd className="mt-1 text-fg">{title.creators.join(", ")}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted">Genres</dt>
              <dd className="mt-1 flex flex-wrap gap-2">
                {title.genres.map((g) => (
                  <Link
                    key={g}
                    to="/browse/$genre"
                    params={{ genre: g.toLowerCase() }}
                    className="rounded-xs px-2 py-1 text-fg shadow-[var(--shadow-border)] hover:bg-fg/8"
                  >
                    {g}
                  </Link>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Audio & accessibility</dt>
              <dd className="mt-1 text-fg">
                {title.badges.join(" · ") || "Stereo · CC"}
              </dd>
            </div>
          </dl>
        ) : null}
      </div>
    </article>
  );
}

function EpisodeList({
  titleId,
  episodes,
  activeId,
}: {
  titleId: string;
  episodes: Episode[];
  activeId?: string;
}) {
  const navigate = useNavigate();
  const seasons = Array.from(new Set(episodes.map((e) => e.season)));
  const [season, setSeason] = useState(seasons[0] ?? 1);
  const list = episodes.filter((e) => e.season === season);

  return (
    <div className="mt-6">
      {seasons.length > 1 ? (
        <div className="mb-6 flex gap-2">
          {seasons.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSeason(s)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all",
                s === season
                  ? "bg-accent text-accent-fg font-bold shadow-md"
                  : "bg-white/5 border border-white/10 text-muted hover:text-fg hover:border-white/20",
              )}
            >
              Season {s}
            </button>
          ))}
        </div>
      ) : (
        <p className="mb-5 text-xs font-bold uppercase tracking-wider text-accent">
          Season {season} ({list.length} Episodes)
        </p>
      )}
      <ol className="space-y-3">
        {list.map((ep) => {
          const isActive = activeId === ep.id;
          return (
            <li key={ep.id}>
              <Link
                to="/watch/$id"
                params={{ id: titleId }}
                search={{ e: ep.id }}
                onClick={(e) => {
                  const user = useAether.getState().user;
                  if (!user) {
                    e.preventDefault();
                    void navigate({ to: "/login", search: { redirect: `/watch/${titleId}?e=${ep.id}` } as any });
                  }
                }}
                className={cn(
                  "group flex items-center justify-between gap-4 p-4 rounded-xl border transition-all duration-200",
                  isActive
                    ? "bg-accent/15 border-accent/40 shadow-lg"
                    : "bg-elevated/60 border-white/10 hover:border-white/25 hover:bg-elevated/90",
                )}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-fg group-hover:bg-accent group-hover:text-accent-fg transition-colors">
                    {ep.number}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-fg truncate group-hover:text-accent transition-colors">
                        {ep.title}
                      </h3>
                      {isActive && (
                        <span className="rounded-full bg-accent/20 px-2 py-0.2 text-[10px] font-bold text-accent uppercase">
                          Watching
                        </span>
                      )}
                    </div>
                    {ep.synopsis && (
                      <p className="mt-1 text-xs text-muted line-clamp-1 leading-relaxed">
                        {ep.synopsis}
                      </p>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-3">
                  <span className="text-xs font-medium text-muted tabular-nums">
                    {ep.runtime} min
                  </span>
                  <span className="grid size-8 place-items-center rounded-full bg-white/5 border border-white/10 group-hover:bg-accent group-hover:text-accent-fg transition-colors">
                    <Play className="size-3.5 fill-current ml-0.5" />
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
