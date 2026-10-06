import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { BackdropArt } from "@/components/poster";
import { Button } from "@/components/ui/button";
import { liveNow } from "@/lib/catalog";
import { useAether } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/live")({ component: LivePage });

/** Generate three EPG time slots seeded from the title's runtime. */
function buildEpgSlots(runtimeMin: number, logline: string) {
  const now = Date.now();
  const slotMs = runtimeMin * 60 * 1000;

  const elapsed = now % slotMs;
  const progress = elapsed / slotMs;

  const nowStart = new Date(now - elapsed);
  const nextStart = new Date(now - elapsed + slotMs);
  const thenStart = new Date(now - elapsed + slotMs * 2);

  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const words = logline.split(" ").filter((w) => w.length > 3);
  const pick = (offset: number) =>
    words.slice(offset % words.length, (offset % words.length) + 3).join(" ");

  return {
    progress,
    slots: [
      {
        label: "Now",
        time: fmt(nowStart),
        title: pick(0),
        duration: runtimeMin,
      },
      {
        label: "Next",
        time: fmt(nextStart),
        title: pick(3),
        duration: Math.round(runtimeMin * 0.85),
      },
      {
        label: "+30",
        time: fmt(thenStart),
        title: pick(6),
        duration: Math.round(runtimeMin * 0.7),
      },
    ],
  };
}

function EpgStrip({
  runtimeMin,
  logline,
}: {
  runtimeMin: number;
  logline: string;
}) {
  const { progress, slots } = buildEpgSlots(runtimeMin, logline);
  const pct = Math.round(progress * 100);

  return (
    <div className="border-t border-border px-5 pb-4 pt-3">
      <p className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
        Schedule
      </p>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {slots.map((slot, i) => (
          <div
            key={i}
            className={cn(
              "flex min-w-[7.5rem] flex-col gap-1 rounded-md px-3 py-2.5",
              i === 0 ? "bg-accent/12 ring-1 ring-inset ring-accent/25" : "bg-surface",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "text-[9px] font-semibold uppercase tracking-widest",
                  i === 0 ? "text-accent" : "text-muted",
                )}
              >
                {slot.label}
              </span>
              <span className="text-[10px] tabular-nums text-muted">
                {slot.time}
              </span>
            </div>
            <p
              className={cn(
                "line-clamp-2 text-xs leading-snug",
                i === 0 ? "text-fg" : "text-subtle",
              )}
            >
              {slot.title}
            </p>
            <p className="text-[10px] text-muted">{slot.duration} min</p>
          </div>
        ))}
      </div>

      {/* Progress bar for now-playing */}
      <div className="mt-3">
        <div className="flex items-center justify-between pb-1.5">
          <span className="text-[10px] text-muted">
            {slots[0].title}
          </span>
          <span className="text-[10px] tabular-nums text-muted">{pct}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-fg/10">
          <div
            className="h-full rounded-full bg-live transition-[width] duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-[9px] tabular-nums text-muted">
            {slots[0].time}
          </span>
          <span className="text-[9px] tabular-nums text-muted">
            {slots[1].time}
          </span>
        </div>
      </div>
    </div>
  );
}

function LivePage() {
  const navigate = useNavigate();
  const user = useAether((s) => s.user);
  const profile = useAether((s) => s.activeProfile);
  const channels = liveNow();

  if (profile === "kids") {
    return (
      <div className="mx-auto max-w-lg px-4 pb-16 pt-24">
        <h1 className="font-display italic text-4xl">Live</h1>
        <p className="mt-3 text-sm text-muted">
          Live sports and TV channels are available on the main profile. Switch to Arjun's profile to watch live cricket, Sun TV, and more.
        </p>
        <Link to="/" className="mt-6 inline-block text-sm text-fg underline">
          Back to Kids home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-28 sm:px-8 sm:pt-36">
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-live/30 bg-live/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-fg">
          <span className="live-dot size-1.5 rounded-full bg-live" />
          ARMSS Sports & 24/7 TV
        </div>
        <h1 className="mt-3 font-display italic text-4xl font-bold tracking-tight text-fg sm:text-5xl">
          Live Streaming
        </h1>
        <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          IPL cricket, Tamil entertainment channels, and live breaking sports — broadcast in high definition with low latency.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {channels.map((t) => (
          <article
            key={t.id}
            className="group overflow-hidden rounded-2xl border border-white/10 bg-elevated/80 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-white/25 flex flex-col justify-between"
          >
            <div>
              {/* Backdrop / thumbnail */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!user) {
                    void navigate({ to: "/login", search: { redirect: `/watch/${t.id}` } as any });
                  } else {
                    void navigate({ to: "/watch/$id", params: { id: t.id } });
                  }
                }}
                className="relative block aspect-video w-full overflow-hidden bg-black/40 cursor-pointer"
              >
                <BackdropArt
                  title={t}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <span className="absolute left-3.5 top-3.5 inline-flex items-center gap-1.5 rounded-full bg-live px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-fg shadow-lg">
                  <span className="live-dot size-1.5 rounded-full bg-fg" />
                  Live Now
                </span>
                {t.badges?.[0] && (
                  <span className="absolute right-3.5 top-3.5 rounded-md border border-white/20 bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-fg/90 backdrop-blur-sm">
                    {t.badges[0]}
                  </span>
                )}
              </div>

              {/* Channel info + Watch button */}
              <div className="p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                  {t.live?.channel} {t.live?.sport ? `· ${t.live?.sport}` : ""}
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-fg leading-snug">
                  <Link to="/watch/$id" params={{ id: t.id }} className="hover:text-accent transition-colors">
                    {t.title}
                  </Link>
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted line-clamp-2">
                  {t.logline}
                </p>
                <div className="mt-5">
                  <Button
                    className="gap-2 shadow-lg font-semibold px-5 cursor-pointer"
                    onClick={() => {
                      if (!user) {
                        void navigate({ to: "/login", search: { redirect: `/watch/${t.id}` } as any });
                      } else {
                        void navigate({ to: "/watch/$id", params: { id: t.id } });
                      }
                    }}
                  >
                    <Play className="size-4 fill-current ml-0.5" />
                    Watch Live Stream
                  </Button>
                </div>
              </div>
            </div>

            {/* EPG schedule strip */}
            <EpgStrip runtimeMin={t.runtimeMin} logline={t.logline} />
          </article>
        ))}
      </div>
    </div>
  );
}
