import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-7 text-accent", className)}
    >
      <circle
        cx="16"
        cy="16"
        r="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeDasharray="60 30"
      />
      <circle cx="16" cy="16" r="5" fill="currentColor" />
    </svg>
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
        "flex items-center gap-2 text-fg no-underline",
        className,
      )}
      aria-label="ARMSS-OTT home"
    >
      <Mark />
      <span className="font-display italic text-2xl leading-none tracking-tight flex items-center">
        ARMSS<span className="not-italic text-sm ml-1.5 px-1.5 py-0.5 rounded bg-accent text-accent-fg font-bold tracking-wider">OTT</span>
      </span>
    </Link>
  );
}
