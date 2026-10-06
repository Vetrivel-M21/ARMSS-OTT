import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, HardDrive, Play, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PosterArt } from "@/components/poster";
import { Button } from "@/components/ui/button";
import { getTitle, type Title } from "@/lib/catalog";
import { useAether, type DownloadItem } from "@/lib/store";
import { cn, formatRuntime } from "@/lib/utils";

export const Route = createFileRoute("/downloads")({ component: DownloadsPage });

/** Simulated download progress — shows a brief animation when freshly added */
function DownloadCard({
  item,
  title,
  onRemove,
}: {
  item: DownloadItem;
  title: Title;
  onRemove: () => void;
}) {
  const ageMs = Date.now() - item.addedAt;
  const isNew = ageMs < 8000; // show progress bar if added within 8 seconds
  const [progress, setProgress] = useState(isNew ? 0.1 : 1);

  // Animate to 100% over 6 seconds for newly added downloads
  useState(() => {
    if (!isNew) return;
    const start = Date.now();
    const duration = 6000;
    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.min(1, elapsed / duration);
      setProgress(p);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  return (
    <article className="flex gap-4 rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
      {/* Poster */}
      <Link
        to="/title/$id"
        params={{ id: title.id }}
        className="shrink-0 overflow-hidden rounded-md shadow-[var(--shadow-border)]"
      >
        <div className="aspect-poster w-16 sm:w-20 overflow-hidden bg-elevated">
          <PosterArt title={title} sizes="80px" />
        </div>
      </Link>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Link
              to="/title/$id"
              params={{ id: title.id }}
              className="block truncate text-sm font-medium text-fg hover:text-muted"
            >
              {title.title}
            </Link>
            <p className="mt-0.5 text-xs text-muted">
              {title.year} ·{" "}
              {title.kind === "series"
                ? `${title.seasons ?? 1} season${(title.seasons ?? 1) > 1 ? "s" : ""}`
                : formatRuntime(title.runtimeMin)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Remove download"
            onClick={onRemove}
            className="shrink-0 grid size-8 place-items-center rounded-sm text-muted hover:text-fg hover:bg-fg/8 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Progress / status */}
        {progress < 1 ? (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-muted mb-1">
              <span>Downloading…</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-1 w-full rounded-full bg-fg/10">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <HardDrive className="size-3" />
              <span>{item.sizeMb.toFixed(0)} MB</span>
            </div>
            <Button
              asChild
              size="sm"
              className="h-7 px-2.5 text-xs"
            >
              <Link to="/watch/$id" params={{ id: title.id }}>
                <Play className="size-3 fill-current ml-0.5" />
                Play offline
              </Link>
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

function DownloadsPage() {
  const profile = useAether((s) => s.activeProfile) ?? "arjun";
  const downloads = useAether((s) => s.downloads[profile] ?? []);
  const removeDownload = useAether((s) => s.removeDownload);

  const items = downloads
    .map((d) => ({ item: d, title: getTitle(d.id) }))
    .filter((x): x is { item: DownloadItem; title: Title } =>
      Boolean(x.title),
    );

  const totalMb = downloads.reduce((a, d) => a + d.sizeMb, 0);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-24 sm:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted">
        Offline
      </p>
      <h1 className="mt-2 font-display italic text-4xl tracking-tight sm:text-5xl">
        Downloads
      </h1>

      {items.length > 0 ? (
        <>
          <div className="mt-3 flex items-center gap-3 text-sm text-muted">
            <span>
              {items.length} title{items.length === 1 ? "" : "s"}
            </span>
            <span>·</span>
            <div className="flex items-center gap-1.5">
              <HardDrive className="size-3.5" />
              <span>{(totalMb / 1024).toFixed(2)} GB used</span>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {items.map(({ item, title }) => (
              <DownloadCard
                key={item.id}
                item={item}
                title={title}
                onRemove={() => {
                  removeDownload(item.id);
                  toast(`Removed "${title.title}" from downloads`);
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              downloads.forEach((d) => removeDownload(d.id));
              toast("All downloads removed");
            }}
            className="mt-8 flex items-center gap-2 text-sm text-live hover:opacity-80 transition-opacity"
          >
            <Trash2 className="size-4" />
            Remove all downloads
          </button>
        </>
      ) : (
        <div className="mt-16 max-w-md">
          <div className="flex size-14 items-center justify-center rounded-full bg-elevated shadow-[var(--shadow-border)]">
            <Download className="size-6 text-muted" />
          </div>
          <h2 className="mt-4 text-lg font-medium text-fg">
            No downloads yet
          </h2>
          <p className="mt-2 text-sm text-muted leading-relaxed">
            Add titles to your downloads from any film or series page. They'll
            appear here, stored on this device.
          </p>
          <Link
            to="/"
            className="mt-6 inline-block text-sm text-fg underline-offset-2 hover:underline"
          >
            Browse ARMSS
          </Link>
        </div>
      )}
    </div>
  );
}

