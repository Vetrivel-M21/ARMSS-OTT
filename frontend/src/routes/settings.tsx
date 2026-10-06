import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAether } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div className="min-w-0">
        <p className="text-sm text-fg">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative shrink-0 h-6 w-11 rounded-full transition-colors duration-200",
          checked ? "bg-accent" : "bg-fg/20",
        )}
      >
        <span
          className={cn(
            "absolute top-1 size-4 rounded-full bg-bg transition-transform duration-200",
            checked ? "translate-x-[1.375rem]" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
  description,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div className="min-w-0">
        <p className="text-sm text-fg">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        ) : null}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md bg-elevated px-3 py-1.5 text-sm text-fg shadow-[var(--shadow-border)] focus:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
        {title}
      </h2>
      <div className="mt-2 divide-y divide-border rounded-lg bg-surface shadow-[var(--shadow-border)]">
        <div className="px-5">{children}</div>
      </div>
    </section>
  );
}

function DangerButton({
  label,
  description,
  onClick,
}: {
  label: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div className="min-w-0">
        <p className="text-sm text-fg">{label}</p>
        {description ? (
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClick}
        className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-live shadow-[var(--shadow-border)] hover:bg-live/10 transition-colors"
      >
        Clear
      </button>
    </div>
  );
}

function SettingsPage() {
  const profile = useAether((s) => s.activeProfile) ?? "arjun";
  const prefs = useAether((s) => s.playbackPrefs);
  const setPlaybackPref = useAether((s) => s.setPlaybackPref);
  const clearHistory = useAether((s) => s.clearHistory);
  const clearContinue = useAether((s) => s.clearContinue);
  const continueWatching = useAether(
    (s) => s.continueWatching[profile] ?? [],
  );
  const searchHistory = useAether((s) => s.searchHistory);
  const downloads = useAether((s) => s.downloads[profile] ?? []);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-24 sm:px-8">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted">
        Preferences
      </p>
      <h1 className="mt-2 font-display italic text-4xl tracking-tight sm:text-5xl">
        Settings
      </h1>

      <Section title="Playback">
        <Toggle
          label="Autoplay next episode"
          description="Automatically play the next episode when the current one ends."
          checked={prefs.autoplay}
          onChange={(v) => setPlaybackPref("autoplay", v)}
        />
        <Select
          label="Video quality"
          description="Default quality for streaming. Auto adjusts based on your internet speed."
          value={prefs.quality}
          options={["Auto", "4K", "1080p", "720p"]}
          onChange={(v) =>
            setPlaybackPref("quality", v as typeof prefs.quality)
          }
        />
        <Toggle
          label="Subtitles on by default"
          description="Show subtitles automatically whenever they are available."
          checked={prefs.subtitles}
          onChange={(v) => setPlaybackPref("subtitles", v)}
        />
      </Section>

      <Section title="Language & Region">
        <Select
          label="App language"
          description="Language for menus and on-screen text."
          value="English"
          options={["English", "Tamil (தமிழ்)"]}
          onChange={() => toast.info("Language switching coming soon!")}
        />
        <Select
          label="Default audio track"
          description="Preferred audio language when multiple tracks are available."
          value="Tamil"
          options={["Tamil", "Hindi", "Telugu", "English"]}
          onChange={() => toast.info("Audio preference saved.")}
        />
        <Select
          label="Default subtitles"
          description="Subtitle language shown automatically during playback."
          value="Off"
          options={["Off", "Tamil", "English", "Hindi"]}
          onChange={() => toast.info("Subtitle preference saved.")}
        />
      </Section>

      <Section title="Data & Privacy">
        <DangerButton
          label="Clear search history"
          description={
            searchHistory.length > 0
              ? `${searchHistory.length} recent searches`
              : "No recent searches"
          }
          onClick={() => {
            clearHistory();
            toast("Search history cleared.");
          }}
        />
        <DangerButton
          label="Clear continue watching"
          description={
            continueWatching.length > 0
              ? `${continueWatching.length} titles in progress`
              : "Nothing in progress"
          }
          onClick={() => {
            clearContinue();
            toast("Continue watching cleared.");
          }}
        />
      </Section>

      <Section title="Downloads">
        <div className="py-4">
          <p className="text-sm text-fg">
            {downloads.length === 0
              ? "No downloads on this device"
              : `${downloads.length} title${downloads.length === 1 ? "" : "s"} downloaded`}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {downloads.length > 0
              ? `${downloads.reduce((a, d) => a + d.sizeMb, 0).toFixed(0)} MB used · Downloads available offline on mobile`
              : "Download films and series to watch offline on your mobile."}
          </p>
        </div>
      </Section>

      <Section title="About">
        <div className="py-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Platform</span>
            <span className="text-fg">ARMSS OTT</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Version</span>
            <span className="text-fg">2.0.0</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Profile</span>
            <span className="text-fg capitalize">{profile}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Region</span>
            <span className="text-fg">India (Tamil Nadu)</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Storage</span>
            <span className="text-fg">Device (localStorage)</span>
          </div>
        </div>
      </Section>

      <p className="mt-8 text-center text-xs text-subtle">
        Settings are saved on this device for the current profile.
      </p>
    </div>
  );
}
