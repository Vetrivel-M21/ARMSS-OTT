import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type ProfileId, syncBackendTitles } from "./catalog";
import {
  type User,
  clearToken,
  api,
  type SiteDisplaySettings,
  type NavVisibility,
  type RowOrderConfig,
  type HomeLayoutSettings,
} from "./api";

export type { SiteDisplaySettings, NavVisibility, RowOrderConfig, HomeLayoutSettings };

export type ContinueItem = {
  id: string;
  episodeId?: string;
  progress: number;
  updatedAt: number;
};

export type DownloadItem = {
  id: string;
  addedAt: number;
  /** Simulated size in MB */
  sizeMb: number;
};

export type PlaybackPrefs = {
  autoplay: boolean;
  quality: "Auto" | "4K" | "1080p" | "720p";
  subtitles: boolean;
};

type ListMap = Record<ProfileId, string[]>;
type ContinueMap = Record<ProfileId, ContinueItem[]>;
type DownloadMap = Record<ProfileId, DownloadItem[]>;

export const DEFAULT_DISPLAY_SETTINGS: SiteDisplaySettings = {
  navVisibility: {
    films: true,
    series: true,
    live: true,
    myList: true,
    comingSoon: true,
    plans: true,
  },
  homeLayout: {
    heroTitleId: "auto",
    heroHeight: "standard",
    heroAlignment: "left",
    containerWidth: "fluid",
    rowOrder: [
      { id: "continue", label: "Continue watching", visible: true },
      { id: "top", label: "Top 10 on ARMSS Today", visible: true },
      { id: "trend", label: "Trending Now", visible: true },
      { id: "blockbusters", label: "Tamil Blockbusters", visible: true },
      { id: "orig", label: "Only on ARMSS Originals", visible: true },
      { id: "live", label: "Live Now (Channels)", visible: true },
      { id: "series", label: "Binge-worthy Web Series", visible: true },
      { id: "fresh", label: "New & Noteworthy", visible: true },
      { id: "thrill", label: "Edge-of-your-seat Thrillers", visible: true },
      { id: "drama", label: "Award-winning Films & Drama", visible: true },
      { id: "scifi", label: "Action & Sci-Fi", visible: true },
      { id: "films", label: "All Films Collection", visible: true },
      { id: "list", label: "My List", visible: true },
      { id: "soon", label: "Coming Soon", visible: true },
    ],
  },
};

type AetherState = {
  user: User | null;
  authModalOpen: boolean;
  upgradeModalOpen: boolean;
  upgradeTargetTitle: string | null;
  activeProfile: ProfileId | null;
  myList: ListMap;
  continueWatching: ContinueMap;
  downloads: DownloadMap;
  reminders: string[];
  searchHistory: string[];
  ratings: Record<string, 1 | -1>;
  heroMuted: boolean;
  playbackPrefs: PlaybackPrefs;

  /* Display & Layout Settings */
  displaySettings: SiteDisplaySettings;
  updateDisplaySettings: (updater: (prev: SiteDisplaySettings) => SiteDisplaySettings) => void;
  resetDisplaySettings: () => void;

  /* User & Modals */
  authChecked: boolean;
  setAuthChecked: (checked: boolean) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
  setAuthModalOpen: (open: boolean) => void;
  setUpgradeModalOpen: (open: boolean, targetTitle?: string) => void;

  /* Profile */
  setProfile: (p: ProfileId | null) => void;

  /* My List */
  toggleList: (id: string) => void;
  inList: (id: string) => boolean;

  /* Continue Watching */
  setProgress: (id: string, progress: number, episodeId?: string) => void;
  progressFor: (id: string) => ContinueItem | undefined;
  removeContinue: (id: string) => void;

  /* Downloads */
  addDownload: (id: string, sizeMb?: number) => void;
  removeDownload: (id: string) => void;
  isDownloaded: (id: string) => boolean;

  /* Reminders */
  toggleReminder: (id: string) => void;

  /* Search */
  pushSearch: (q: string) => void;
  clearHistory: () => void;

  /* Ratings */
  setRating: (id: string, v: 1 | -1 | 0) => void;

  /* Hero */
  setHeroMuted: (v: boolean) => void;

  /* Playback prefs */
  setPlaybackPref: <K extends keyof PlaybackPrefs>(k: K, v: PlaybackPrefs[K]) => void;

  /* Data management */
  clearContinue: () => void;

  /* Dynamic Catalog Sync */
  catalogVersion: number;
  fetchCatalog: () => Promise<void>;

  /* Cloud Sync */
  fetchWatchlist: () => Promise<void>;
  fetchDisplaySettings: () => Promise<void>;
};

const seedContinue: ContinueItem[] = [
  {
    id: "vikram",
    progress: 0.42,
    updatedAt: Date.now() - 1000 * 60 * 50,
  },
  {
    id: "soorarai-pottru",
    progress: 0.61,
    updatedAt: Date.now() - 1000 * 60 * 60 * 18,
  },
  {
    id: "96",
    progress: 0.22,
    updatedAt: Date.now() - 1000 * 60 * 180,
  },
];

export const useAether = create<AetherState>()(
  persist(
    (set, get) => ({
      user: null,
      authModalOpen: false,
      upgradeModalOpen: false,
      upgradeTargetTitle: null,
      activeProfile: null,
      myList: {
        arjun: ["vikram", "ponniyin-selvan-1", "jai-bhim"],
        kids: ["chutti-chutties", "naattu-kili"],
      },
      continueWatching: {
        arjun: seedContinue,
        kids: [
          {
            id: "chutti-chutties",
            episodeId: "chutti-s1e2",
            progress: 0.35,
            updatedAt: Date.now() - 1000 * 60 * 40,
          },
        ],
      },
      downloads: { arjun: [], kids: [] },
      reminders: ["thalaivar-169"],
      searchHistory: [],
      ratings: {},
      heroMuted: true,
      playbackPrefs: {
        autoplay: true,
        quality: "Auto",
        subtitles: false,
      },

      /* ── Display Settings ── */
      displaySettings: DEFAULT_DISPLAY_SETTINGS,
      updateDisplaySettings: (updater) =>
        set((state) => ({
          displaySettings: updater(state.displaySettings ?? DEFAULT_DISPLAY_SETTINGS),
        })),
      resetDisplaySettings: () =>
        set({ displaySettings: DEFAULT_DISPLAY_SETTINGS }),

      /* ── User & Modals ── */
      authChecked: false,
      setAuthChecked: (checked) => set({ authChecked: checked }),
      setUser: (user) => {
        set({ user });
        if (user) {
          void get().fetchWatchlist();
        }
      },
      logout: () => {
        clearToken();
        set({ user: null, activeProfile: null });
      },
      setAuthModalOpen: (open) => set({ authModalOpen: open }),
      setUpgradeModalOpen: (open, targetTitle) =>
        set({ upgradeModalOpen: open, upgradeTargetTitle: targetTitle ?? null }),

      /* ── Profile ── */
      setProfile: (p) => {
        set({ activeProfile: p });
        if (p && get().user) {
          void get().fetchWatchlist();
        }
      },

      /* ── My List ── */
      toggleList: (id) => {
        const profile = get().activeProfile ?? "arjun";
        const current = get().myList[profile] ?? [];
        const next = current.includes(id)
          ? current.filter((x) => x !== id)
          : [id, ...current];
        set({ myList: { ...get().myList, [profile]: next } });

        // Sync with Go backend if user is authenticated
        if (get().user) {
          api.toggleWatchlist(id, profile).catch((err) => {
            console.warn("[ARMSS-OTT] Failed syncing watchlist toggle to cloud:", err);
          });
        }
      },
      inList: (id) => {
        const profile = get().activeProfile ?? "arjun";
        return (get().myList[profile] ?? []).includes(id);
      },

      /* ── Continue Watching ── */
      setProgress: (id, progress, episodeId) => {
        const profile = get().activeProfile ?? "arjun";
        const list = get().continueWatching[profile] ?? [];
        const item: ContinueItem = {
          id,
          episodeId,
          progress,
          updatedAt: Date.now(),
        };
        const next = [item, ...list.filter((x) => x.id !== id)].slice(0, 24);
        set({
          continueWatching: { ...get().continueWatching, [profile]: next },
        });
      },
      progressFor: (id) => {
        const profile = get().activeProfile ?? "arjun";
        return (get().continueWatching[profile] ?? []).find((x) => x.id === id);
      },
      removeContinue: (id) => {
        const profile = get().activeProfile ?? "arjun";
        set({
          continueWatching: {
            ...get().continueWatching,
            [profile]: (get().continueWatching[profile] ?? []).filter(
              (x) => x.id !== id,
            ),
          },
        });
      },
      clearContinue: () => {
        const profile = get().activeProfile ?? "arjun";
        set({
          continueWatching: { ...get().continueWatching, [profile]: [] },
        });
      },

      /* ── Downloads ── */
      addDownload: (id, sizeMb) => {
        const profile = get().activeProfile ?? "arjun";
        const list = get().downloads[profile] ?? [];
        if (list.some((d) => d.id === id)) return;
        const item: DownloadItem = {
          id,
          addedAt: Date.now(),
          sizeMb: sizeMb ?? Math.round(400 + Math.random() * 800),
        };
        set({
          downloads: {
            ...get().downloads,
            [profile]: [item, ...list],
          },
        });
      },
      removeDownload: (id) => {
        const profile = get().activeProfile ?? "arjun";
        set({
          downloads: {
            ...get().downloads,
            [profile]: (get().downloads[profile] ?? []).filter(
              (d) => d.id !== id,
            ),
          },
        });
      },
      isDownloaded: (id) => {
        const profile = get().activeProfile ?? "arjun";
        return (get().downloads[profile] ?? []).some((d) => d.id === id);
      },

      /* ── Reminders ── */
      toggleReminder: (id) => {
        const has = get().reminders.includes(id);
        set({
          reminders: has
            ? get().reminders.filter((x) => x !== id)
            : [id, ...get().reminders],
        });
      },

      /* ── Search ── */
      pushSearch: (q) => {
        const clean = q.trim();
        if (!clean) return;
        set({
          searchHistory: [
            clean,
            ...get().searchHistory.filter((x) => x !== clean),
          ].slice(0, 8),
        });
      },
      clearHistory: () => set({ searchHistory: [] }),

      /* ── Ratings ── */
      setRating: (id, v) => {
        const next = { ...get().ratings };
        if (v === 0) delete next[id];
        else next[id] = v;
        set({ ratings: next });
        if (get().user) {
          api.setRating(id, v).catch((err) => {
            console.warn("[ARMSS-OTT] Failed syncing rating to cloud:", err);
          });
        }
      },

      /* ── Hero ── */
      setHeroMuted: (v) => set({ heroMuted: v }),

      /* ── Playback prefs ── */
      setPlaybackPref: (k, v) =>
        set({
          playbackPrefs: { ...get().playbackPrefs, [k]: v },
        }),

      /* ── Dynamic Catalog Sync ── */
      catalogVersion: 0,
      fetchCatalog: async () => {
        try {
          const titles = await api.getTitles();
          if (titles && titles.length > 0) {
            syncBackendTitles(titles);
            set((s) => ({ catalogVersion: s.catalogVersion + 1 }));
          }
        } catch (err) {
          console.warn("[ARMSS-OTT] Failed syncing dynamic catalog from backend:", err);
        }
      },

      /* ── Cloud Watchlist Sync ── */
      fetchWatchlist: async () => {
        const user = get().user;
        if (!user) return;
        const profile = get().activeProfile ?? "arjun";
        try {
          const ids = await api.getWatchlist(profile);
          if (Array.isArray(ids) && ids.length > 0) {
            set((s) => ({
              myList: {
                ...s.myList,
                [profile]: ids,
              },
            }));
          }
        } catch (err) {
          console.warn("[ARMSS-OTT] Failed syncing cloud watchlist:", err);
        }
      },

      /* ── Display Settings Cloud Sync ── */
      fetchDisplaySettings: async () => {
        try {
          const settings = await api.getSiteDisplaySettings();
          if (settings) {
            set({ displaySettings: settings });
          }
        } catch (err) {
          console.warn("[ARMSS-OTT] Failed syncing display settings:", err);
        }
      },
    }),
    {
      name: "armss-v1",
      skipHydration: true,
      partialize: (state) => ({
        myList: state.myList,
        continueWatching: state.continueWatching,
        downloads: state.downloads,
        reminders: state.reminders,
        searchHistory: state.searchHistory,
        ratings: state.ratings,
        heroMuted: state.heroMuted,
        playbackPrefs: state.playbackPrefs,
        displaySettings: state.displaySettings,
        activeProfile: state.activeProfile,
      }),
    },
  ),
);
