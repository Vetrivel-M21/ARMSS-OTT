export type Maturity = "U" | "PG" | "13+" | "16+" | "18+" | "A";
export type TitleKind = "film" | "series" | "documentary" | "live" | (string & {});
export type Badge = "4K" | "HDR" | "Atmos" | "IMAX" | "AD" | "CC" | "Tamil" | "Telugu" | "Hindi";
export type Language = "Tamil" | "Telugu" | "Hindi" | "English" | "Multi";
export type Tone =
  | "ice"
  | "fog"
  | "signal"
  | "ember"
  | "orbit"
  | "choir"
  | "marble"
  | "velvet"
  | "mesa"
  | "after"
  | "ink"
  | "forest"
  | "copper"
  | "court"
  | "bloom"
  | "sky"
  | "moss"
  | "pixel"
  | "live";

export type Person = { name: string; role: string };

export type Episode = {
  id: string;
  season: number;
  number: number;
  title: string;
  runtime: number;
  synopsis: string;
  video_url?: string;
  thumbnail_url?: string;
  videoUrl?: string;
};

export type Title = {
  id: string;
  title: string;
  kind: TitleKind;
  year: number;
  maturity: Maturity;
  runtimeMin: number;
  seasons?: number;
  genres: string[];
  logline: string;
  synopsis: string;
  match: number;
  badges: Badge[];
  language?: Language;
  poster?: string;
  backdrop?: string;
  trailer?: string;
  tone: Tone;
  letter: string;
  featured?: boolean;
  rank?: number;
  trending?: boolean;
  fresh?: boolean;
  original?: boolean;
  required_tier?: "free" | "standard" | "premium";
  videoUrl?: string;
  comingSoon?: { date: string; label: string };
  kids?: boolean;
  live?: { channel: string; sport: string };
  cast: Person[];
  director?: string;
  creators?: string[];
  episodes?: Episode[];
  similar: string[];
};

function eps(
  prefix: string,
  season: number,
  items: [string, number, string][],
): Episode[] {
  return items.map(([title, runtime, synopsis], i) => ({
    id: `${prefix}-s${season}e${i + 1}`,
    season,
    number: i + 1,
    title,
    runtime,
    synopsis,
  }));
}

export const DEFAULT_SAMPLE_TRAILERS: Record<string, string> = {};

const RAW_STATIC_TITLES: Title[] = [];
export const INITIAL_STATIC_TITLES: Title[] = RAW_STATIC_TITLES;

export const TITLES: Title[] = [...INITIAL_STATIC_TITLES];

export const TITLE_BY_ID: Record<string, Title> = Object.fromEntries(
  TITLES.map((t) => [t.id, t]),
);

/**
 * Merges dynamic titles from the Go backend database into the client catalog.
 * Overwrites existing static metadata when backend overrides exist (e.g. tier changes),
 * and dynamically injects new titles added via the Admin CMS.
 */
export function syncBackendTitles(backendTitles: any[]): Title[] {
  if (!backendTitles || !Array.isArray(backendTitles)) return TITLES;

  const titleMap = new Map<string, Title>();
  const staticLookup = new Map(INITIAL_STATIC_TITLES.map((t) => [t.id, t]));

  if (backendTitles.length === 0) {
    TITLES.length = 0;
    for (const k of Object.keys(TITLE_BY_ID)) {
      delete TITLE_BY_ID[k];
    }
    return TITLES;
  } else {
    for (const bt of backendTitles) {
      if (!bt || !bt.id) continue;
      const existing = staticLookup.get(bt.id);

      const genres = Array.isArray(bt.genres)
        ? bt.genres
        : typeof bt.genres === "string" && bt.genres
          ? bt.genres.split(",").map((s: string) => s.trim()).filter(Boolean)
          : existing?.genres || ["Action"];

      const badges = Array.isArray(bt.badges)
        ? bt.badges
        : typeof bt.badges === "string" && bt.badges
          ? bt.badges.split(",").map((s: string) => s.trim()).filter(Boolean)
          : existing?.badges || ["HD", "Tamil"];

      const titleStr = bt.title || existing?.title || bt.id;
      const updated: Title = {
        id: bt.id,
        title: titleStr,
        kind: (bt.kind as TitleKind) || existing?.kind || "film",
        year: bt.year || existing?.year || 2024,
        maturity: (bt.maturity as Maturity) || existing?.maturity || "U",
        runtimeMin: bt.runtime_min || existing?.runtimeMin || 120,
        match: bt.match || bt.match_percent || existing?.match || 95,
        logline: bt.logline || existing?.logline || "",
        synopsis: bt.synopsis || existing?.synopsis || bt.logline || "",
        poster: bt.poster || existing?.poster || "/posters/default.jpg",
        backdrop: bt.backdrop || existing?.backdrop || bt.poster || "/backdrops/default.jpg",
        trailer: bt.trailer || existing?.trailer || DEFAULT_SAMPLE_TRAILERS[bt.id] || "",
        tone: (bt.tone as Tone) || existing?.tone || "ember",
        letter: titleStr.charAt(0).toUpperCase(),
        original: bt.original !== undefined ? Boolean(bt.original) : existing?.original ?? false,
        kids: bt.kids !== undefined ? Boolean(bt.kids) : existing?.kids ?? false,
        required_tier: (bt.required_tier || existing?.required_tier || "free") as "free" | "standard" | "premium",
        genres,
        badges: badges as Badge[],
        cast: existing?.cast || [],
        director: existing?.director || "",
        creators: existing?.creators,
        videoUrl: bt.video_url || bt.videoUrl || existing?.videoUrl,
        episodes: Array.isArray(bt.episodes) && bt.episodes.length > 0
          ? bt.episodes.map((ep: any) => ({
              id: ep.id,
              season: ep.season_number || ep.season || 1,
              number: ep.episode_number || ep.number || 1,
              title: ep.title,
              runtime: ep.runtime_min || ep.runtime || 45,
              synopsis: ep.synopsis || "",
              video_url: ep.video_url || ep.videoUrl || "",
              thumbnail_url: ep.thumbnail_url || "",
            }))
          : existing?.episodes,
        seasons: Array.isArray(bt.episodes) && bt.episodes.length > 0
          ? Math.max(1, ...bt.episodes.map((ep: any) => ep.season_number || ep.season || 1))
          : existing?.seasons,
        comingSoon: existing?.comingSoon,
        featured: badges.some((b: string) => b.trim().toLowerCase() === "featured") || (existing?.featured ?? false),
        rank: badges.some((b: string) => b.trim().toLowerCase() === "top 10") ? (existing?.rank ?? 1) : existing?.rank,
        trending: badges.some((b: string) => b.trim().toLowerCase() === "trending") || (existing?.trending ?? false),
        fresh: badges.some((b: string) => ["fresh", "new"].includes(b.trim().toLowerCase())) || (existing?.fresh ?? true),
        similar: existing?.similar || [],
      };

      titleMap.set(bt.id, updated);
    }
  }

  TITLES.length = 0;
  TITLES.push(...Array.from(titleMap.values()));

  for (const k of Object.keys(TITLE_BY_ID)) {
    delete TITLE_BY_ID[k];
  }
  for (const [id, t] of titleMap.entries()) {
    TITLE_BY_ID[id] = t;
  }

  return TITLES;
}

export const GENRES = [
  "Action",
  "Drama",
  "Thriller",
  "Romance",
  "Historical",
  "Comedy",
  "Family",
  "Sports",
  "Social",
  "Legal Drama",
  "Documentary",
  "Political",
  "Biography",
  "Entertainment",
  "Live",
] as const;

export type ProfileId = "arjun" | "kids";

export function getTitle(id: string) {
  return TITLE_BY_ID[id];
}

export function isKidsSafe(t: Title) {
  return t.kids || t.maturity === "U" || (t.maturity === "PG" && t.kind !== "live");
}

export function visibleTitles(profile: ProfileId | null) {
  if (profile === "kids") return TITLES.filter((t) => t.kids);
  return TITLES.filter((t) => !t.comingSoon && !t.kids);
}

export function comingSoon() {
  return TITLES.filter((t) => t.comingSoon);
}

export function liveNow() {
  return TITLES.filter((t) => t.kind === "live");
}

export function searchTitles(q: string, profile: ProfileId | null) {
  const query = q.trim().toLowerCase();
  const pool = profile === "kids" ? TITLES.filter((t) => t.kids) : TITLES;
  if (!query) return pool.filter((t) => !t.comingSoon);
  return pool.filter((t) => {
    const hay = [
      t.title,
      t.logline,
      t.synopsis,
      t.kind,
      t.language,
      t.director,
      ...(t.creators ?? []),
      ...t.genres,
      ...t.cast.map((c) => c.name),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(query);
  });
}

export function similarTitles(t: Title, profile: ProfileId | null) {
  const ids = t.similar;
  return ids
    .map(getTitle)
    .filter((x): x is Title => Boolean(x))
    .filter((x) => (profile === "kids" ? x.kids : !x.kids || x.id === t.id));
}

export const TONE_CLASS: Record<Tone, string> = {
  ice: "bg-tone-ice",
  fog: "bg-tone-fog",
  signal: "bg-tone-signal",
  ember: "bg-tone-ember",
  orbit: "bg-tone-orbit",
  choir: "bg-tone-choir",
  marble: "bg-tone-marble",
  velvet: "bg-tone-velvet",
  mesa: "bg-tone-mesa",
  after: "bg-tone-after",
  ink: "bg-tone-ink",
  forest: "bg-tone-forest",
  copper: "bg-tone-copper",
  court: "bg-tone-court",
  bloom: "bg-tone-bloom",
  sky: "bg-tone-sky",
  moss: "bg-tone-moss",
  pixel: "bg-tone-pixel",
  live: "bg-tone-live",
};

export function kindLabel(kind: TitleKind) {
  if (kind === "film") return "Film";
  if (kind === "series") return "Web Series";
  if (kind === "documentary") return "Documentary";
  return "Live";
}
