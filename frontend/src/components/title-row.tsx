import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Title } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { TitleCard } from "./title-card";

export function TitleRow({
  heading,
  items,
  progressById,
  ranked = false,
  id,
  removable = false,
  onRemove,
}: {
  heading: string;
  items: Title[];
  progressById?: Record<string, number>;
  ranked?: boolean;
  id?: string;
  /** When true, each TitleCard receives an X button that removes it. */
  removable?: boolean;
  /** Called with the title id when the user clicks the X button. */
  onRemove?: (id: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  if (items.length === 0) return null;

  const scrollBy = (dir: number) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="relative" aria-labelledby={id}>
      <div className="mb-3 flex items-end justify-between px-4 sm:px-8">
        <h2
          id={id}
          className="text-base font-medium tracking-tight text-fg sm:text-lg"
        >
          {heading}
        </h2>
        <div className="hidden gap-1 md:flex">
          <button
            type="button"
            aria-label="Previous"
            onClick={() => scrollBy(-1)}
            className="grid size-9 place-items-center rounded-sm text-muted hover:bg-fg/8 hover:text-fg"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => scrollBy(1)}
            className="grid size-9 place-items-center rounded-sm text-muted hover:bg-fg/8 hover:text-fg"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>
      <div
        ref={scroller}
        className={cn(
          "scroll-row flex items-start gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory sm:gap-4 sm:px-8",
          ranked && "pt-2",
        )}
      >
        {items.map((t, i) => (
          <TitleCard
            key={t.id}
            title={t}
            rank={ranked ? (t.rank ?? i + 1) : undefined}
            progress={progressById?.[t.id]}
            size={ranked ? "lg" : "md"}
            onRemove={removable && onRemove ? () => onRemove(t.id) : undefined}
          />
        ))}
      </div>
    </section>
  );
}
