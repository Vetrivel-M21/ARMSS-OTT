import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search as SearchIcon, X } from "lucide-react";
import { TitleCard } from "@/components/title-card";
import { GENRES, searchTitles } from "@/lib/catalog";
import { useAether } from "@/lib/store";
import { cn } from "@/lib/utils";

type SearchParams = { q?: string };

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    q: typeof s.q === "string" ? s.q : "",
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q = "" } = Route.useSearch();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const profile = useAether((s) => s.activeProfile);
  const history = useAether((s) => s.searchHistory);
  const pushSearch = useAether((s) => s.pushSearch);
  const [value, setValue] = useState(q);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setValue(q);
  }, [q]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void navigate({ to: "/search", search: { q: value }, replace: true });
    }, 160);
    return () => window.clearTimeout(t);
  }, [value, navigate]);

  const catalogVersion = useAether((s) => s.catalogVersion);

  const results = useMemo(
    () => searchTitles(value, profile),
    [value, profile, catalogVersion],
  );

  const commit = (term: string) => {
    setValue(term);
    pushSearch(term);
    void navigate({ to: "/search", search: { q: term } });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-28 sm:px-8 sm:pt-36">
      <label className="relative block">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(value);
          }}
          placeholder="Search Tamil films, web series, directors, actors..."
          className="h-14 w-full rounded-2xl border border-white/10 bg-elevated/90 pl-12 pr-12 text-base text-fg shadow-xl outline-none placeholder:text-subtle focus:border-accent/40 focus:ring-1 focus:ring-accent/40 backdrop-blur-md transition-all"
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear"
            className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center text-muted hover:text-fg"
            onClick={() => commit("")}
          >
            <X className="size-4" />
          </button>
        ) : null}
      </label>

      {!value ? (
        <div className="mt-8">
          {history.length > 0 ? (
            <div className="mb-8">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Recent searches</h2>
              <div className="flex flex-wrap gap-2">
                {history.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => commit(h)}
                    className="rounded-full border border-white/10 bg-elevated/60 px-4 py-1.5 text-xs font-medium text-fg hover:border-white/25 hover:bg-white/10 transition-colors"
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Browse by genre</h2>
          <div className="flex flex-wrap gap-2">
            {GENRES.filter((g) =>
              profile === "kids" ? g === "Family" || g === "Documentary" : true,
            ).map((g) => (
              <Link
                key={g}
                to="/browse/$genre"
                params={{ genre: g.toLowerCase() }}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-muted hover:border-white/20 hover:text-fg hover:bg-white/10 transition-colors"
              >
                {g}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
            <p className="text-sm font-medium text-muted">
              Found <span className="text-fg font-bold">{results.length}</span> {results.length === 1 ? "result" : "results"} for &ldquo;<span className="text-accent">{value}</span>&rdquo;
            </p>
          </div>
          {results.length === 0 ? (
            <div className="mt-12 rounded-2xl border border-white/10 bg-elevated/40 p-8 text-center max-w-md mx-auto">
              <p className="text-base font-semibold text-fg">No matches found</p>
              <p className="mt-1 text-sm text-muted">Try searching with a different actor name, movie title, or genre.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-6">
              {results.map((t) => (
                <TitleCard key={t.id} title={t} size="fill" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
