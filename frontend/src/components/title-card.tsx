import { Link, useNavigate } from "@tanstack/react-router";
import { Check, Info, Play, Plus, X } from "lucide-react";
import type { Title } from "@/lib/catalog";
import { useAether } from "@/lib/store";
import { cn } from "@/lib/utils";
import { PosterArt } from "./poster";
import { Button } from "./ui/button";

export function TitleCard({
  title,
  progress,
  rank,
  size = "md",
  onRemove,
}: {
  title: Title;
  progress?: number;
  rank?: number;
  size?: "sm" | "md" | "lg" | "fill";
  /** When provided, renders an X button on the card that calls this handler. */
  onRemove?: () => void;
}) {
  const inList = useAether((s) => s.inList(title.id));
  const toggleList = useAether((s) => s.toggleList);
  const navigate = useNavigate();
  const coming = Boolean(title.comingSoon);
  const live = title.kind === "live";

  const width =
    size === "fill"
      ? "w-full"
      : size === "lg"
        ? "w-44 sm:w-52"
        : size === "sm"
          ? "w-28 sm:w-32"
          : "w-32 sm:w-36 md:w-44";

  if (rank) {
    return (
      <div className="group relative shrink-0 snap-start flex flex-col w-[192px] sm:w-[224px] md:w-[240px] min-w-[192px] sm:min-w-[224px] md:min-w-[240px] max-w-[192px] sm:max-w-[224px] md:max-w-[240px]">
        <div className="relative flex items-end w-full min-w-0">
          {/* Dedicated Rank Number Column */}
          <div
            className={cn(
              "shrink-0 flex items-end justify-center select-none pointer-events-none pb-0.5 z-0",
              rank >= 10 ? "w-16 sm:w-20 -mr-6 sm:-mr-8" : "w-14 sm:w-16 -mr-4 sm:-mr-6",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "rank-num select-none",
                rank >= 10 && "text-[4.5rem] sm:text-[5.5rem] tracking-tighter",
              )}
            >
              {rank}
            </span>
          </div>

          {/* Overlapping Poster Card */}
          <div className="relative flex-1 min-w-0 z-10 shadow-[-10px_0_20px_rgba(0,0,0,0.85)]">
            <CardFace
              title={title}
              progress={progress}
              coming={coming}
              live={live}
              inList={inList}
              toggleList={toggleList}
              navigate={navigate}
              onRemove={onRemove}
            />
          </div>
        </div>

        {/* Card Metadata: precisely aligned under the poster */}
        <div className="mt-2.5 pl-10 sm:pl-12 flex flex-col gap-0.5 min-w-0 max-w-full">
          <Link
            to="/title/$id"
            params={{ id: title.id }}
            className="truncate font-semibold text-sm text-fg tracking-tight hover:text-accent transition-colors leading-snug"
            title={title.title}
          >
            {title.title}
          </Link>
          <div className="flex items-center gap-1.5 text-xs text-muted leading-tight truncate">
            <span>{title.year}</span>
            <span className="text-white/20">·</span>
            <span className="rounded-xs border border-white/15 bg-white/5 px-1 py-0.2 text-[10px] font-semibold uppercase text-muted">
              {title.maturity}
            </span>
            <span className="text-white/20">·</span>
            <span className="truncate">{title.genres[0] || "Tamil"}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("group relative shrink-0 snap-start flex flex-col min-w-0", width)}>
      <CardFace
        title={title}
        progress={progress}
        coming={coming}
        live={live}
        inList={inList}
        toggleList={toggleList}
        navigate={navigate}
        onRemove={onRemove}
      />

      {/* Card Metadata & Labels */}
      <div className="mt-2.5 flex flex-col gap-0.5 min-w-0 max-w-full">
        <Link
          to="/title/$id"
          params={{ id: title.id }}
          className="truncate font-semibold text-sm text-fg tracking-tight hover:text-accent transition-colors leading-snug"
          title={title.title}
        >
          {title.title}
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-muted leading-tight truncate">
          {live ? (
            <span className="text-live font-medium">{title.live?.channel}</span>
          ) : coming ? (
            <span className="text-accent font-medium">{title.comingSoon?.label}</span>
          ) : (
            <>
              <span>{title.year}</span>
              <span className="text-white/20">·</span>
              <span className="rounded-xs border border-white/15 bg-white/5 px-1 py-0.2 text-[10px] font-semibold uppercase text-muted">
                {title.maturity}
              </span>
              <span className="text-white/20">·</span>
              <span className="truncate">{title.genres[0] || "Tamil"}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CardFace({
  title,
  progress,
  coming,
  live,
  inList,
  toggleList,
  navigate,
  onRemove,
}: {
  title: Title;
  progress?: number;
  coming: boolean;
  live: boolean;
  inList: boolean;
  toggleList: (id: string) => void;
  navigate: ReturnType<typeof useNavigate>;
  onRemove?: () => void;
}) {
  return (
    <div className="relative w-full min-w-0 max-w-full">
      <Link
        to="/title/$id"
        params={{ id: title.id }}
        aria-label={title.title}
        className="block w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-white/10 bg-elevated shadow-lg transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:border-accent/40 group-hover:shadow-[0_12px_28px_rgba(0,0,0,0.7)]"
      >
        <div className="aspect-poster w-full overflow-hidden bg-elevated relative">
          <PosterArt title={title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Watch Progress Bar */}
        {typeof progress === "number" && progress > 0.02 && progress < 0.97 ? (
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/60">
            <div
              className="h-full bg-accent shadow-[0_0_8px_rgba(255,255,255,0.8)]"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        ) : null}

        {/* Live Tag */}
        {live ? (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-live px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fg shadow-md">
            <span className="live-dot size-1.5 rounded-full bg-fg" />
            Live
          </span>
        ) : null}

        {/* Original Tag */}
        {title.original && !live ? (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-black/70 border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fg/90 backdrop-blur-sm shadow-md">
            Original
          </span>
        ) : null}

        {/* Match score badge (top right on hover) */}
        {title.match > 0 && (
          <span className="absolute right-2.5 top-2.5 opacity-0 group-hover:opacity-100 rounded-full bg-match/20 border border-match/40 px-1.5 py-0.2 text-[10px] font-bold text-match backdrop-blur-sm transition-opacity duration-200">
            {title.match}%
          </span>
        )}
      </Link>

      {/* Remove (X) button — always visible on mobile, hover-only on desktop */}
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${title.title}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className={cn(
            "absolute right-2 top-2 z-10 grid size-7 place-items-center rounded-full bg-black/80 border border-white/20 text-fg hover:bg-white/20 transition-all",
            "opacity-100 md:opacity-0 md:group-hover:opacity-100",
          )}
        >
          <X className="size-3.5" />
        </button>
      ) : null}

      {/* Hover action buttons (play / list / info) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 hidden justify-center gap-1.5 md:group-hover:pointer-events-auto md:group-hover:flex z-20">
        {!coming ? (
          <Button
            size="icon-sm"
            variant="play"
            className="size-9 shadow-xl cursor-pointer"
            aria-label={`Play ${title.title}`}
            onClick={() => {
              const user = useAether.getState().user;
              if (!user) {
                void navigate({ to: "/login", search: { redirect: `/watch/${title.id}` } as any });
              } else {
                void navigate({ to: "/watch/$id", params: { id: title.id } });
              }
            }}
          >
            <Play className="size-4 fill-current ml-0.5" />
          </Button>
        ) : null}
        <Button
          size="icon-sm"
          variant="ghost"
          className="size-9 bg-black/70 border border-white/20 backdrop-blur-md shadow-xl hover:bg-black/90"
          aria-label={inList ? "Remove from My List" : "Add to My List"}
          onClick={() => toggleList(title.id)}
        >
          {inList ? <Check className="size-4 text-accent" /> : <Plus className="size-4" />}
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          className="size-9 bg-black/70 border border-white/20 backdrop-blur-md shadow-xl hover:bg-black/90"
          aria-label={`Details for ${title.title}`}
          onClick={() =>
            navigate({ to: "/title/$id", params: { id: title.id } })
          }
        >
          <Info className="size-4" />
        </Button>
      </div>
    </div>
  );
}
