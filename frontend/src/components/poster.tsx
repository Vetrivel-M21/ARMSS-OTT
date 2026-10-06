import { useEffect, useState } from "react";
import type { Title } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { EditorialPoster } from "./editorial-poster";

const BACKDROP_FALLBACKS: Record<string, string> = {
  velvet: "/backdrops/velvet-protocol.jpg",
  ember: "/backdrops/ember-hour.jpg",
  marble: "/backdrops/crownless.jpg",
  forest: "/backdrops/afterlight.jpg",
  copper: "/backdrops/glass-harbor.jpg",
  signal: "/backdrops/hollow-choir.jpg",
  sky: "/backdrops/pale-meridian.jpg",
  moss: "/backdrops/north-of-stillness.jpg",
  pixel: "/backdrops/low-orbit.jpg",
  live: "/backdrops/last-frequency.jpg",
};

export function PosterArt({
  title,
  className,
  sizes = "160px",
}: {
  title: Title;
  className?: string;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [title.id, title.poster]);

  const fallback = BACKDROP_FALLBACKS[title.tone] || BACKDROP_FALLBACKS.velvet;
  const primarySrc = title.poster || fallback;
  const src = !failed ? primarySrc : fallback;

  if (failed && !fallback) {
    return <EditorialPoster title={title} className={className} />;
  }

  return (
    <img
      key={src}
      src={src}
      alt={title.title}
      sizes={sizes}
      className={cn("h-full w-full object-cover", className)}
      onError={() => {
        if (!failed) setFailed(true);
      }}
    />
  );
}

export function BackdropArt({
  title,
  className,
  kenburns = false,
}: {
  title: Title;
  className?: string;
  kenburns?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const fallback = BACKDROP_FALLBACKS[title.tone] || BACKDROP_FALLBACKS.velvet;

  useEffect(() => {
    setFailed(false);
  }, [title.id, title.backdrop, title.poster]);

  const primarySrc = title.backdrop || title.poster || fallback;
  const src = !failed ? primarySrc : fallback;

  return (
    <img
      key={src}
      src={src}
      alt={title.title}
      className={cn(
        "h-full w-full object-cover object-center",
        kenburns && "kenburns origin-center",
        className,
      )}
      onError={() => {
        if (!failed) setFailed(true);
      }}
    />
  );
}
