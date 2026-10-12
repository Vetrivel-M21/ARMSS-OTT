import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PlayerView } from "@/components/player-view";
import { getTitle, type Title, type Episode } from "@/lib/catalog";
import { api } from "@/lib/api";
import { useAether } from "@/lib/store";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/watch/$id")({
  component: WatchPage,
});

function WatchPage() {
  const { id } = Route.useParams();
  const [episodeId, setEpisodeId] = useState<string | undefined>(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      return sp.get("e") || undefined;
    }
    return undefined;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      setEpisodeId(sp.get("e") || undefined);
    }
  }, []);
  const navigate = useNavigate();
  const catalogVersion = useAether((s) => s.catalogVersion);

  const staticTitle = getTitle(id);
  const [currentTitle, setCurrentTitle] = useState<Title | undefined>(staticTitle);
  const [episodes, setEpisodes] = useState<Episode[]>(staticTitle?.episodes || []);
  const [loading, setLoading] = useState(!staticTitle);

  // Sync title from backend API if not in static catalog or to get updated video_url
  useEffect(() => {
    let active = true;
    api
      .getTitle(id)
      .then((t) => {
        if (!active || !t) return;
        setCurrentTitle((prev) => {
          if (!prev) {
            return {
              id: t.id,
              title: t.title,
              kind: t.kind,
              year: t.year || 2024,
              maturity: (t.maturity as any) || "13+",
              runtimeMin: t.runtime_min || 120,
              genres: Array.isArray(t.genres) ? t.genres : [],
              logline: t.logline || "",
              synopsis: t.synopsis || "",
              match: 95,
              badges: ["4K", "HDR", "Atmos"],
              language: (t.language as any) || "Tamil",
              poster: t.poster || "",
              backdrop: t.backdrop || "",
              trailer: t.trailer || "",
              videoUrl: t.video_url || t.videoUrl || "",
              required_tier: (t.required_tier as any) || "free",
              tone: "ember",
              letter: (t.title || "A")[0].toUpperCase(),
              cast: [],
              similar: [],
            };
          }
          return {
            ...prev,
            videoUrl: t.video_url || t.videoUrl || prev.videoUrl,
            trailer: t.trailer || prev.trailer,
            required_tier: (t.required_tier as any) || prev.required_tier || "free",
          };
        });
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    // Fetch dynamic episodes for series
    api
      .getEpisodes(id)
      .then((eps) => {
        if (!active || !Array.isArray(eps) || eps.length === 0) return;
        setEpisodes(
          eps.map((e: any) => ({
            id: e.id,
            season: e.season_number || e.season || 1,
            number: e.episode_number || e.number || 1,
            title: e.title,
            runtime: e.runtime_min || e.runtime || 45,
            synopsis: e.synopsis || "",
            video_url: e.video_url || e.videoUrl || "",
            thumbnail_url: e.thumbnail_url || "",
          }))
        );
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [id, catalogVersion]);

  const activeEpisode =
    episodes.find((ep) => ep.id === episodeId) ||
    (currentTitle?.kind === "series" && episodes.length > 0 ? episodes[0] : undefined);

  if (!currentTitle) {
    if (loading) {
      return (
        <div className="grid min-h-screen place-items-center bg-bg text-fg">
          <p className="text-muted">Loading player…</p>
        </div>
      );
    }
    return (
      <div className="grid min-h-screen place-items-center bg-bg px-6 text-fg">
        <div className="text-center">
          <p className="text-xl font-medium">Title not found</p>
          <Button className="mt-4" onClick={() => navigate({ to: "/" })}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  // Pass dynamic episodes attached to title so PlayerView's episode list modal sees them
  const titleWithEpisodes: Title = {
    ...currentTitle,
    episodes: episodes.length > 0 ? episodes : currentTitle.episodes,
  };

  return <PlayerView title={titleWithEpisodes} episode={activeEpisode} />;
}
