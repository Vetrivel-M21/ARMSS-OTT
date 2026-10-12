import { createFileRoute } from "@tanstack/react-router";
import { HeroBillboard } from "@/components/hero-billboard";
import { TitleRow } from "@/components/title-row";
import { useAether } from "@/lib/store";
import { homeRows, type RowDef } from "@/lib/rows";
import { getTitle } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const profile = useAether((s) => s.activeProfile) ?? "arjun";
  const continueWatching = useAether(
    (s) => s.continueWatching[profile] ?? [],
  );
  const myList = useAether((s) => s.myList[profile] ?? []);
  const removeContinue = useAether((s) => s.removeContinue);
  const catalogVersion = useAether((s) => s.catalogVersion);
  const displaySettings = useAether((s) => s.displaySettings);

  const navVis = displaySettings?.navVisibility;
  const { hero, rows } = homeRows(profile, continueWatching, myList, navVis);
  const progressById = Object.fromEntries(
    continueWatching.map((c) => [c.id, c.progress]),
  );

  const homeLayout = displaySettings?.homeLayout;

  // Custom Hero Spotlight (if configured by admin)
  const specificHero =
    homeLayout?.heroTitleId && homeLayout.heroTitleId !== "auto"
      ? getTitle(homeLayout.heroTitleId)
      : null;

  const isSpecificHeroAllowed =
    !specificHero ||
    ((navVis?.films !== false || specificHero.kind !== "film") &&
      (navVis?.series !== false || specificHero.kind !== "series") &&
      (navVis?.live !== false || specificHero.kind !== "live"));

  const finalHero =
    specificHero && isSpecificHeroAllowed
      ? [specificHero, ...hero.filter((h) => h.id !== specificHero.id)]
      : hero;

  // Row Ordering & Visibility alignment (if configured by admin)
  let finalRows: RowDef[] = rows;
  if (homeLayout?.rowOrder && homeLayout.rowOrder.length > 0 && profile !== "kids") {
    const rowMap = new Map(rows.map((r) => [r.id, r]));
    const reordered: RowDef[] = [];

    for (const conf of homeLayout.rowOrder) {
      if (!conf.visible) continue;
      const found = rowMap.get(conf.id);
      if (found) {
        reordered.push(found);
        rowMap.delete(conf.id);
      }
    }
    // Append any unconfigured rows
    for (const rem of rowMap.values()) {
      reordered.push(rem);
    }
    finalRows = reordered;
  }

  const isConstrained = homeLayout?.containerWidth === "constrained";

  return (
    <div>
      <HeroBillboard
        titles={finalHero}
        height={homeLayout?.heroHeight ?? "standard"}
        alignment={homeLayout?.heroAlignment ?? "left"}
      />
      <div
        className={cn(
          "-mt-10 flex flex-col gap-10 sm:gap-12 transition-all",
          isConstrained && "max-w-7xl mx-auto px-4",
        )}
      >
        {finalRows.map((row) => (
          <TitleRow
            key={row.id}
            id={row.id}
            heading={row.heading}
            items={row.items}
            ranked={row.ranked}
            progressById={progressById}
            removable={row.id === "continue"}
            onRemove={row.id === "continue" ? removeContinue : undefined}
          />
        ))}
      </div>
    </div>
  );
}
