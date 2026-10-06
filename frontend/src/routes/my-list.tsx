import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, Sparkles } from "lucide-react";
import { TitleCard } from "@/components/title-card";
import { getTitle, type Title } from "@/lib/catalog";
import { useAether } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/my-list")({ component: MyListPage });

type SortKey = "date" | "az" | "genre";

const SORT_CHIPS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Recently Added" },
  { key: "az", label: "Alphabetical (A–Z)" },
  { key: "genre", label: "By Genre" },
];

function MyListPage() {
  const profile = useAether((s) => s.activeProfile) ?? "arjun";
  const user = useAether((s) => s.user);
  const ids = useAether((s) => s.myList[profile] ?? []);
  const toggleList = useAether((s) => s.toggleList);
  const [sort, setSort] = useState<SortKey>("date");

  useEffect(() => {
    if (user) {
      void useAether.getState().fetchWatchlist();
    }
  }, [user, profile]);

  const profileName = profile === "kids" ? "Kids Profile" : (user?.name || "Arjun");

  const items = useMemo(() => {
    const resolved = ids
      .map(getTitle)
      .filter((t): t is Title => Boolean(t));

    if (sort === "az") {
      return [...resolved].sort((a, b) =>
        a.title.localeCompare(b.title),
      );
    }
    if (sort === "genre") {
      return [...resolved].sort((a, b) =>
        (a.genres[0] ?? "").localeCompare(b.genres[0] ?? ""),
      );
    }
    // "date" — preserve insertion order (most-recently added is first in ids)
    return resolved;
  }, [ids, sort]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-28 sm:px-8 sm:pt-36">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-0.5 text-xs font-semibold text-muted uppercase tracking-wider mb-2">
            <Bookmark className="size-3.5 text-accent" />
            Personal Watchlist
          </div>
          <h1 className="font-display italic text-4xl font-bold tracking-tight text-fg sm:text-5xl">
            My List
          </h1>
          <p className="mt-2 text-sm text-muted">
            Saved movies and series curated for <span className="text-fg font-medium">{profileName}</span>.
          </p>
        </div>
        {items.length > 0 && (
          <p className="shrink-0 text-xs sm:text-sm font-semibold text-accent bg-accent/10 border border-accent/20 px-3 py-1.5 rounded-full self-start sm:self-auto">
            {items.length} {items.length === 1 ? "Saved Title" : "Saved Titles"}
          </p>
        )}
      </div>

      {/* ── Sort chips ── */}
      {items.length > 1 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-subtle mr-1">Sort by:</span>
          {SORT_CHIPS.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setSort(chip.key)}
              className={cn(
                "rounded-full border px-4 py-1 text-xs font-medium transition-all duration-150",
                sort === chip.key
                  ? "border-accent/50 bg-accent text-accent-fg font-semibold shadow-md"
                  : "border-white/10 bg-elevated text-muted hover:border-white/20 hover:text-fg",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Content Grid ── */}
      {items.length === 0 ? (
        <div className="mt-16 max-w-lg rounded-2xl border border-white/10 bg-elevated/40 p-8 text-center mx-auto">
          <Bookmark className="size-12 text-muted mx-auto mb-3 opacity-60" />
          <h3 className="text-lg font-bold text-fg">Your Watchlist is empty</h3>
          <p className="mt-2 text-sm text-muted leading-relaxed">
            Add movies, series, or live TV events to your list by clicking the <span className="font-semibold text-fg">+</span> icon on any title card.
          </p>
          <div className="mt-6">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-bold text-accent-fg shadow-lg hover:bg-fg transition-all"
            >
              <Sparkles className="size-4" />
              Explore Catalog
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-6">
          {items.map((t) => (
            <TitleCard
              key={t.id}
              title={t}
              size="fill"
              onRemove={() => toggleList(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
