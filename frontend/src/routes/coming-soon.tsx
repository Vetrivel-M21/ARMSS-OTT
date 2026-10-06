import { createFileRoute, Link } from "@tanstack/react-router";
import { BellOff, BellRing, Calendar, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { BackdropArt } from "@/components/poster";
import { Button } from "@/components/ui/button";
import { comingSoon } from "@/lib/catalog";
import { useAether } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/coming-soon")({
  component: ComingSoonPage,
});

function ComingSoonPage() {
  const items = comingSoon();
  const reminders = useAether((s) => s.reminders);
  const toggleReminder = useAether((s) => s.toggleReminder);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-28 sm:px-8 sm:pt-36">
      {/* ── Page Header with clear hierarchy & high contrast ── */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
          <Sparkles className="size-3.5" />
          Exclusive Premieres
        </div>
        <h1 className="mt-3 font-display italic text-4xl font-bold tracking-tight text-fg sm:text-5xl">
          Coming Soon
        </h1>
        <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
          Upcoming blockbuster films and original series releasing on ARMSS OTT. Turn on reminders to receive alerts the moment each title premieres.
        </p>
      </div>

      {/* ── Cards List ── */}
      <ol className="space-y-6">
        {items.map((t) => {
          const on = reminders.includes(t.id);
          return (
            <li
              key={t.id}
              className="group grid overflow-hidden rounded-2xl border border-white/10 bg-elevated/80 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-white/20 sm:grid-cols-[18rem_1fr] md:grid-cols-[22rem_1fr] items-stretch"
            >
              {/* Image banner: stretch to full height with no empty black bars */}
              <Link
                to="/title/$id"
                params={{ id: t.id }}
                className="relative block h-56 w-full overflow-hidden bg-black/40 sm:h-full sm:min-h-[220px]"
              >
                <BackdropArt
                  title={t}
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-elevated/90 via-transparent to-transparent sm:bg-gradient-to-r sm:from-transparent sm:via-transparent sm:to-elevated/90" />
              </Link>

              {/* Card Content with clean spacing and clear typography */}
              <div className="flex flex-col justify-between p-6 sm:p-7">
                <div>
                  {/* Badge Row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
                      <Calendar className="size-3.5" />
                      {t.comingSoon?.label || "Coming Soon"}
                    </span>
                    {t.original && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-fg/80">
                        ARMSS Original
                      </span>
                    )}
                    {t.badges?.slice(0, 2).map((b) => (
                      <span
                        key={b}
                        className="rounded-xs border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] font-medium text-muted"
                      >
                        {b}
                      </span>
                    ))}
                  </div>

                  {/* Title */}
                  <h2 className="mt-3 text-2xl font-bold tracking-tight text-fg sm:text-3xl leading-snug">
                    <Link
                      to="/title/$id"
                      params={{ id: t.id }}
                      className="transition-colors hover:text-accent"
                    >
                      {t.title}
                    </Link>
                  </h2>

                  {/* Synopsis / Logline */}
                  <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base line-clamp-3">
                    {t.synopsis || t.logline}
                  </p>

                  {/* Cast & Director */}
                  {t.cast && t.cast.length > 0 && (
                    <p className="mt-3 text-xs font-medium text-subtle">
                      Starring:{" "}
                      <span className="text-fg/80">
                        {t.cast.slice(0, 3).map((c) => c.name).join(", ")}
                      </span>
                      {t.director ? ` · Directed by ${t.director}` : ""}
                    </p>
                  )}
                </div>

                {/* Actions Row */}
                <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
                  <Button
                    variant={on ? "ghost" : "play"}
                    onClick={() => {
                      toggleReminder(t.id);
                      toast(
                        on
                          ? `Reminder removed for ${t.title}`
                          : `Reminder set for ${t.title}! We will alert you on premiere day.`,
                      );
                    }}
                    className={cn(
                      "gap-2 px-5 font-semibold transition-all",
                      on
                        ? "border border-white/20 bg-white/10 text-fg hover:bg-white/15"
                        : "shadow-lg shadow-white/5",
                    )}
                  >
                    {on ? (
                      <>
                        <BellOff className="size-4 text-accent" />
                        <span>Reminder on</span>
                      </>
                    ) : (
                      <>
                        <BellRing className="size-4" />
                        <span>Remind me</span>
                      </>
                    )}
                  </Button>

                  <Link
                    to="/title/$id"
                    params={{ id: t.id }}
                    className="text-xs font-semibold text-muted transition-colors hover:text-fg"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
