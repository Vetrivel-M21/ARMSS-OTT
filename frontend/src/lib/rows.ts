import {
  comingSoon,
  getTitle,
  liveNow,
  visibleTitles,
  type ProfileId,
  type Title,
} from "./catalog";
import type { ContinueItem, NavVisibility } from "./store";

export type RowDef = {
  id: string;
  heading: string;
  items: Title[];
  ranked?: boolean;
};

export function homeRows(
  profile: ProfileId,
  continueWatching: ContinueItem[],
  myList: string[],
  navVisibility?: NavVisibility,
): { hero: Title[]; rows: RowDef[] } {
  let pool = visibleTitles(profile);

  // Filter pool according to site visibility settings
  if (navVisibility) {
    if (navVisibility.films === false) {
      pool = pool.filter((t) => t.kind !== "film");
    }
    if (navVisibility.series === false) {
      pool = pool.filter((t) => t.kind !== "series");
    }
    if (navVisibility.live === false) {
      pool = pool.filter((t) => t.kind !== "live");
    }
  }

  const byId = (ids: string[]) =>
    ids.map(getTitle).filter((t): t is Title => Boolean(t) && pool.includes(t));

  const featured = pool.filter((t) => t.featured);
  const hero =
    profile === "kids"
      ? pool.filter((t) => t.kids).slice(0, 4)
      : (featured.length ? featured : pool).slice(0, 5);

  const continueItems = (navVisibility?.myList === false)
    ? []
    : continueWatching
        .map((c) => getTitle(c.id))
        .filter((t): t is Title => Boolean(t) && pool.some((p) => p.id === t.id));

  const top10 = [...pool]
    .filter((t) => t.rank)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    .slice(0, 10);

  const trending = pool.filter((t) => t.trending && t.kind !== "live");
  const fresh = pool.filter((t) => t.fresh);
  const originals = pool.filter((t) => t.original && t.kind !== "live");
  const films = navVisibility?.films === false ? [] : pool.filter((t) => t.kind === "film");
  const series = navVisibility?.series === false ? [] : pool.filter((t) => t.kind === "series");
  const docs = pool.filter((t) => t.kind === "documentary");
  const thrillers = pool.filter((t) => t.genres.includes("Thriller"));
  const dramas = pool.filter((t) => t.genres.includes("Drama"));
  const scifi = pool.filter((t) => t.genres.includes("Sci-Fi"));
  const list = navVisibility?.myList === false ? [] : byId(myList);
  const live = (profile === "kids" || navVisibility?.live === false) ? [] : liveNow();
  const soon = (profile === "kids" || navVisibility?.comingSoon === false) ? [] : comingSoon();

  const last = continueItems[0];
  const because = last
    ? pool.filter(
        (t) =>
          t.id !== last.id && t.genres.some((g) => last.genres.includes(g)),
      )
    : [];

  const take = (items: Title[], n = 12) => items.slice(0, n);

  if (profile === "kids") {
    return {
      hero,
      rows: [
        ...(navVisibility?.myList === false ? [] : [{ id: "continue", heading: "Continue watching", items: continueItems }]),
        ...(navVisibility?.myList === false ? [] : [{ id: "list", heading: "My List", items: list }]),
        { id: "fresh", heading: "New on ARMSS Kids", items: fresh },
        { id: "adv", heading: "Tamil Adventures", items: pool },
        { id: "nature", heading: "Nature & Wildlife", items: docs },
      ].filter((r) => r.items.length > 0),
    };
  }

  const rows: RowDef[] = [
    ...(navVisibility?.myList === false ? [] : [{ id: "continue", heading: "Continue watching", items: continueItems }]),
    { id: "top", heading: "Top 10 on ARMSS Today", items: top10, ranked: true },
    { id: "trend", heading: "Trending Now", items: take(trending) },
    {
      id: "because",
      heading: last ? `Because you watched ${last.title}` : "Recommended",
      items: take(because, 10),
    },
    { id: "fresh", heading: "New & Noteworthy", items: take(fresh) },
    ...(navVisibility?.films === false ? [] : [
      { id: "blockbusters", heading: "Tamil Blockbusters", items: take(pool.filter(t => t.kind === "film" && t.genres.includes("Action"))) },
      { id: "award", heading: "Award-winning Films", items: take(pool.filter(t => t.genres.includes("Social") || t.genres.includes("Legal Drama") || t.genres.includes("Drama")).slice(0, 10)) },
    ]),
    { id: "orig", heading: "Only on ARMSS", items: take(originals) },
    ...(navVisibility?.live === false ? [] : [{ id: "live", heading: "Live Now", items: live }]),
    ...(navVisibility?.series === false ? [] : [{ id: "series", heading: "Binge-worthy Web Series", items: take(series) }]),
    { id: "thrill", heading: "Edge-of-your-seat Thrillers", items: take(thrillers) },
    { id: "drama", heading: "Drama", items: take(dramas) },
    { id: "scifi", heading: "Action & Blockbusters", items: take(scifi) },
    ...(navVisibility?.films === false ? [] : [{ id: "films", heading: "Films", items: take(films) }]),
    { id: "docs", heading: "Documentaries", items: docs },
    ...(navVisibility?.myList === false ? [] : [{ id: "list", heading: "My List", items: list }]),
    ...(navVisibility?.comingSoon === false ? [] : [{ id: "soon", heading: "Coming Soon", items: soon }]),
  ];

  return { hero, rows: rows.filter((r) => r.items.length > 0) };
}

export function browseCollection(slug: string, profile: ProfileId, navVisibility?: NavVisibility): {
  heading: string;
  items: Title[];
} {
  let pool = visibleTitles(profile);
  if (navVisibility) {
    if (navVisibility.films === false) pool = pool.filter((t) => t.kind !== "film");
    if (navVisibility.series === false) pool = pool.filter((t) => t.kind !== "series");
    if (navVisibility.live === false) pool = pool.filter((t) => t.kind !== "live");
  }
  const s = slug.toLowerCase();
  if (s === "films" || s === "film") {
    if (navVisibility?.films === false) return { heading: "Films", items: [] };
    return { heading: "Films", items: pool.filter((t) => t.kind === "film") };
  }
  if (s === "series") {
    if (navVisibility?.series === false) return { heading: "Series", items: [] };
    return { heading: "Series", items: pool.filter((t) => t.kind === "series") };
  }
  if (s === "documentaries" || s === "documentary") {
    return {
      heading: "Documentaries",
      items: pool.filter((t) => t.kind === "documentary"),
    };
  }
  const heading = s.charAt(0).toUpperCase() + s.slice(1);
  return {
    heading,
    items: pool.filter((t) =>
      t.genres.some((g) => g.toLowerCase() === s),
    ),
  };
}
