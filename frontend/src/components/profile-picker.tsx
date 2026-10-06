import { useAether } from "@/lib/store";
import { Logo } from "./logo";

export function ProfilePicker() {
  const setProfile = useAether((s) => s.setProfile);
  const user = useAether((s) => s.user);

  const displayName = user?.name?.trim() || "Main Profile";
  const displayInitial = user?.name?.trim() ? user.name.trim().charAt(0).toUpperCase() : "M";

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-bg px-6">
      <Logo className="pointer-events-none mb-12" />
      <h1 className="font-display italic text-4xl tracking-tight text-fg sm:text-5xl">
        Who’s watching?
      </h1>
      <p className="mt-3 max-w-sm text-center text-sm text-muted">
        Profiles keep My List, continue watching, and Kids titles apart on this
        device.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-6">
        <button
          type="button"
          onClick={() => setProfile("arjun")}
          className="group flex w-32 flex-col items-center gap-3"
        >
          <span className="grid size-28 place-items-center rounded-lg bg-gradient-to-br from-accent to-red-600 text-3xl font-bold text-white shadow-[var(--shadow-border)] transition-transform duration-200 group-hover:-translate-y-0.5 group-active:scale-[0.96]">
            {displayInitial}
          </span>
          <span className="text-sm font-medium text-muted group-hover:text-fg">{displayName}</span>
        </button>
        <button
          type="button"
          onClick={() => setProfile("kids")}
          className="group flex w-32 flex-col items-center gap-3"
        >
          <span className="grid size-28 place-items-center rounded-lg bg-tone-moss text-3xl font-bold text-fg shadow-[var(--shadow-border)] transition-transform duration-200 group-hover:-translate-y-0.5 group-active:scale-[0.96]">
            K
          </span>
          <span className="text-sm font-medium text-muted group-hover:text-fg">Kids</span>
        </button>
      </div>
    </div>
  );
}
