import { createFileRoute, Link } from "@tanstack/react-router";
import { TitleCard } from "@/components/title-card";
import { GENRES } from "@/lib/catalog";
import { browseCollection } from "@/lib/rows";
import { useAether } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/browse/$genre")({
  component: BrowsePage,
});

function BrowsePage() {
  const { genre } = Route.useParams();
  const profile = useAether((s) => s.activeProfile) ?? "arjun";
  const catalogVersion = useAether((s) => s.catalogVersion);
  const { heading, items } = browseCollection(genre, profile);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-28 sm:px-8 sm:pt-36">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-5">
        {["films", "series", ...GENRES.map((g) => g.toLowerCase())]
          .filter((g, i, arr) => arr.indexOf(g) === i)
          .filter((g) =>
            profile === "kids"
              ? g === "family" || g === "series" || g === "documentary"
              : true,
          )
          .map((g) => {
            const isActive = g === genre.toLowerCase();
            return (
              <Link
                key={g}
                to="/browse/$genre"
                params={{ genre: g }}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all",
                  isActive
                    ? "border border-accent/40 bg-accent text-accent-fg shadow-md shadow-white/5"
                    : "border border-white/10 bg-white/5 text-muted hover:border-white/20 hover:text-fg hover:bg-white/10",
                )}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </Link>
            );
          })}
      </div>

      <div className="mt-8 flex items-end justify-between">
        <div>
          <h1 className="font-display italic text-4xl font-bold tracking-tight text-fg sm:text-5xl">
            {heading}
          </h1>
          <p className="mt-2 text-sm text-muted">
            Browsing all titles in <span className="text-fg font-medium">{heading}</span> on ARMSS OTT.
          </p>
        </div>
        {items.length > 0 && (
          <span className="text-xs font-semibold text-accent bg-accent/10 border border-accent/20 px-3 py-1 rounded-full">
            {items.length} Titles
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-16 max-w-md rounded-2xl border border-white/10 bg-elevated/40 p-8 text-center mx-auto">
          <p className="text-base font-semibold text-fg">No titles in this collection yet</p>
          <p className="mt-1 text-sm text-muted">Check back soon as new content is added daily to ARMSS OTT.</p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-6">
          {items.map((t) => (
            <TitleCard key={t.id} title={t} size="fill" />
          ))}
        </div>
      )}
    </div>
  );
}
