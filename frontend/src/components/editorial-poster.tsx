import { TONE_CLASS, type Title } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export function EditorialPoster({
  title,
  className,
}: {
  title: Title;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col justify-end overflow-hidden p-3 film-grain",
        TONE_CLASS[title.tone],
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-6 -right-2 font-display italic leading-none text-fg/12 text-[7rem]"
      >
        {title.letter}
      </span>
      <p className="relative text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
        {title.original ? "Aether Original" : title.kind}
      </p>
      <h3 className="relative mt-1 font-display text-xl leading-tight text-fg italic">
        {title.title}
      </h3>
      <p className="relative mt-1 text-xs text-muted">{title.year}</p>
    </div>
  );
}
