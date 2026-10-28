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
  const shortFilms = pool.filter((t) => t.kind === "short_film" || t.kind === "short film");
  const standup = pool.filter((t) => t.kind === "standup" || t.kind === "stand_up");
  const musicVideos = pool.filter((t) => t.kind === "music_video" || t.kind === "music video");
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

  // Strict cross-row deduplication tracker to prevent repeating the same title in multiple discovery rows
  const seenCount = new Map<string, number>();

  const takeFresh = (items: Title[], n = 12): Title[] => {
    if (!items || items.length === 0) return [];

    // Strictly filter out any title that has already appeared in an earlier discovery row
    const freshOnly = items.filter((t) => (seenCount.get(t.id) ?? 0) === 0);
    if (freshOnly.length === 0) return [];

    const chosen = freshOnly.slice(0, n);
    for (const item of chosen) {
      seenCount.set(item.id, (seenCount.get(item.id) ?? 0) + 1);
    }
    return chosen;
  };

  const take = (items: Title[], n = 12) => items.slice(0, n);

  if (profile === "kids") {
    return {
      hero,
      rows: [
        ...(navVisibility?.myList === false ? [] : [{ id: "continue", heading: "Continue watching", items: continueItems }]),
        ...(navVisibility?.myList === false ? [] : [{ id: "list", heading: "My List", items: list }]),
        { id: "fresh", heading: "New on ARMSS Kids", items: takeFresh(fresh) },
        { id: "adv", heading: "Tamil Adventures", items: takeFresh(pool) },
        { id: "nature", heading: "Nature & Wildlife", items: takeFresh(docs) },
      ].filter((r) => r.items.length > 0),
    };
  }

  // Pre-register top 10 titles to prevent immediately repeating them in following rows
  for (const t of top10) {
    seenCount.set(t.id, (seenCount.get(t.id) ?? 0) + 1);
  }

  const dramaList = pool.filter((t) =>
    t.genres.some((g) => ["drama", "social", "legal drama", "romance"].includes(g.toLowerCase())),
  );
  const actionList = pool.filter((t) =>
    t.genres.some((g) => ["action", "blockbuster", "adventure"].includes(g.toLowerCase())),
  );

  const rows: RowDef[] = [
    ...(navVisibility?.myList === false ? [] : [{ id: "continue", heading: "Continue watching", items: continueItems }]),
    { id: "top", heading: "Top 10 on ARMSS Today", items: top10, ranked: true },
    { id: "trend", heading: "Trending Now", items: takeFresh(trending) },
    {
      id: "because",
      heading: last ? `Because you watched ${last.title}` : "Recommended for You",
      items: takeFresh(because, 10),
    },
    { id: "fresh", heading: "New & Noteworthy", items: takeFresh(fresh) },
    ...(navVisibility?.films === false ? [] : [
      { id: "blockbusters", heading: "Tamil Blockbusters", items: takeFresh(actionList) },
    ]),
    ...(shortFilms.length > 0 ? [
      { id: "short_films", heading: "Spotlight on Short Films", items: takeFresh(shortFilms) },
    ] : []),
    { id: "orig", heading: "Only on ARMSS", items: takeFresh(originals) },
    ...(navVisibility?.live === false ? [] : [{ id: "live", heading: "Live Now", items: live }]),
    ...(navVisibility?.series === false ? [] : [{ id: "series", heading: "Binge-worthy Web Series", items: takeFresh(series) }]),
    ...(standup.length > 0 ? [
      { id: "standup", heading: "Stand-up Comedy & Specials", items: takeFresh(standup) },
    ] : []),
    ...(musicVideos.length > 0 ? [
      { id: "music_videos", heading: "Music Videos & Concerts", items: takeFresh(musicVideos) },
    ] : []),
    { id: "thrill", heading: "Edge-of-your-seat Thrillers", items: takeFresh(thrillers) },
    { id: "drama", heading: "Drama & Acclaimed Stories", items: takeFresh(dramaList) },
    ...(navVisibility?.films === false ? [] : [
      { id: "films", heading: "Featured Films", items: takeFresh(films) },
    ]),
    { id: "docs", heading: "Documentaries", items: takeFresh(docs) },
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
  if (s === "short_film" || s === "short-film" || s === "short film" || s === "short_films" || s === "shortfilms") {
    return {
      heading: "Short Films",
      items: pool.filter((t) => t.kind === "short_film" || t.kind === "short film"),
    };
  }
  if (s === "standup" || s === "stand_up" || s === "comedy") {
    return {
      heading: "Stand-up Comedy",
      items: pool.filter((t) => t.kind === "standup" || t.kind === "stand_up"),
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
