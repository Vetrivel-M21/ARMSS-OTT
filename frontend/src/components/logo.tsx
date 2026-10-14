import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="ARMSS OTT"
      className={cn("size-8 object-contain drop-shadow-[0_2px_8px_rgba(255,100,50,0.35)]", className)}
    />
  );
}

export function Logo({
  className,
  to = "/",
}: {
  className?: string;
  to?: "/";
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2.5 text-fg no-underline group",
        className,
      )}
      aria-label="ARMSS-OTT home"
    >
      <Mark className="transition-transform duration-200 group-hover:scale-105" />
      <span className="font-display italic text-2xl leading-none tracking-tight flex items-center">
        ARMSS<span className="not-italic text-sm ml-1.5 px-1.5 py-0.5 rounded bg-accent text-accent-fg font-bold tracking-wider">OTT</span>
      </span>
    </Link>
  );
}
