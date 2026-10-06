import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PlayerView, episodeFromSearch } from "@/components/player-view";
import { getTitle } from "@/lib/catalog";
import { useAether } from "@/lib/store";

type WatchSearch = { e?: string };

export const Route = createFileRoute("/watch/$id")({
  validateSearch: (s: Record<string, unknown>): WatchSearch => ({
    e: typeof s.e === "string" ? s.e : undefined,
  }),
  component: WatchPage,
});

function WatchPage() {
  const { id } = Route.useParams();
  const { e } = Route.useSearch();
  const navigate = Route.useNavigate();
  const user = useAether((s) => s.user);
  const authChecked = useAether((s) => s.authChecked);
  const catalogVersion = useAether((s) => s.catalogVersion);
  const title = getTitle(id);
  const saved = useAether((s) => s.progressFor(id));

  // Ensure catalog is fresh on direct deep link
  useEffect(() => {
    void useAether.getState().fetchCatalog();
  }, []);

  // Redirect to login if user is not authenticated once verification is done
  useEffect(() => {
    if (authChecked && !user) {
      navigate({
        to: "/login",
        search: { redirect: `/watch/${id}${e ? `?e=${e}` : ""}` } as any,
      });
    }
  }, [authChecked, user, id, e, navigate]);

  if (!authChecked || !user) {
    return (
      <div className="grid min-h-svh place-items-center bg-bg text-fg">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-accent border-solid mx-auto" />
          <p className="text-sm text-muted">
            {!authChecked ? "Verifying streaming session..." : "Redirecting to sign in..."}
          </p>
        </div>
      </div>
    );
  }

  if (!title) {
    return (
      <div className="grid min-h-svh place-items-center bg-bg">
        <Link to="/" className="text-sm text-muted">
          Title unavailable — return home
        </Link>
      </div>
    );
  }

  const episode = title.episodes
    ? episodeFromSearch(title, e ?? saved?.episodeId)
    : undefined;

  return <PlayerView title={title} episode={episode} />;
}
