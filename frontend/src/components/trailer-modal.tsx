import { useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { Title } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { BackdropArt } from "./poster";

export function TrailerModal({
  title,
  open,
  onClose,
}: {
  title: Title;
  open: boolean;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Pause video when modal closes, play when it opens
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (open) {
      v.currentTime = 0;
      void v.play().catch(() => {
        /* autoplay blocked — silently ignore */
      });
    } else {
      v.pause();
    }
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        {/* ── Backdrop overlay ── */}
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-bg/80 backdrop-blur-md",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "duration-200",
          )}
        />

        {/* ── Modal panel ── */}
        <Dialog.Content
          className={cn(
            "fixed inset-4 z-50 overflow-hidden rounded-xl bg-bg shadow-2xl",
            "sm:inset-12 md:inset-20",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
            "duration-200",
          )}
          // Prevent the default auto-focus on open (it can cause scroll jump)
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Accessibility title (visually hidden) */}
          <Dialog.Title className="sr-only">
            {title.title} — Trailer
          </Dialog.Title>

          {/* ── Media area ── */}
          <div className="relative h-full w-full">
            {title.trailer ? (
              <>
                <video
                  ref={videoRef}
                  src={title.trailer}
                  className="h-full w-full object-cover"
                  autoPlay
                  loop
                  playsInline
                  // Not muted — this is a trailer preview the user intends to hear
                  poster={title.backdrop || title.poster}
                />
                {/* Subtle gradient floor for the title overlay */}
                <div className="title-floor pointer-events-none absolute inset-x-0 bottom-0 h-2/5" />
              </>
            ) : (
              <>
                {/* No trailer — show backdrop with overlay message */}
                <BackdropArt title={title} className="h-full" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg/60 backdrop-blur-sm">
                  <span className="text-sm font-medium uppercase tracking-widest text-muted">
                    No trailer available
                  </span>
                </div>
                {/* Still show the floor gradient for the title block */}
                <div className="title-floor pointer-events-none absolute inset-x-0 bottom-0 h-2/5" />
              </>
            )}

            {/* ── Title & logline overlay ── */}
            <div className="absolute inset-x-0 bottom-0 px-6 pb-7 pt-16">
              <p className="font-display italic text-3xl leading-tight text-fg sm:text-4xl">
                {title.title}
              </p>
              {title.logline ? (
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
                  {title.logline}
                </p>
              ) : null}
              {/* Genre pills */}
              {title.genres.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {title.genres.map((g) => (
                    <span
                      key={g}
                      className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-subtle"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {/* ── Close button ── */}
            <Dialog.Close
              asChild
              onClick={onClose}
            >
              <button
                type="button"
                aria-label="Close trailer"
                className={cn(
                  "absolute right-4 top-4 z-10",
                  "flex size-9 items-center justify-center rounded-full",
                  "bg-bg/60 text-fg backdrop-blur-sm",
                  "ring-1 ring-border/40",
                  "transition-colors hover:bg-bg/90 hover:ring-border",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                )}
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
