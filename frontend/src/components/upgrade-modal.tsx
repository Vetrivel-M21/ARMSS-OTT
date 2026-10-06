import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Crown, Download, Film, ShieldCheck, Sparkles, Tv, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAether } from "@/lib/store";
import { Button } from "./ui/button";

export function UpgradeModal() {
  const open = useAether((s) => s.upgradeModalOpen);
  const setOpen = useAether((s) => s.setUpgradeModalOpen);
  const targetTitle = useAether((s) => s.upgradeTargetTitle);
  const user = useAether((s) => s.user);
  const setUser = useAether((s) => s.setUser);
  const setAuthModalOpen = useAether((s) => s.setAuthModalOpen);

  const [loading, setLoading] = useState(false);

  const handleUpgrade = async (tier: "standard" | "premium") => {
    if (!user) {
      setOpen(false);
      setAuthModalOpen(true);
      toast.info("Please sign in or create an account first to choose a plan.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.upgradeTier(tier);
      setUser(res.user);
      toast.success(`Upgraded to ${tier === "premium" ? "Premium VIP 4K" : "Standard 1080p"}!`);
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Upgrade failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => setOpen(v)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/85 backdrop-blur-md fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg max-h-[calc(100vh-2.5rem)] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-6 sm:p-8 shadow-2xl border border-border scale-in focus:outline-none">
          {/* Close */}
          <Dialog.Close asChild>
            <button
              type="button"
              className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-muted hover:text-fg hover:bg-fg/8 transition-colors"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </Dialog.Close>

          {/* Icon Badge */}
          <div className="flex justify-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 via-amber-500/10 to-transparent border border-amber-400/30 text-amber-400 shadow-lg shadow-amber-500/10">
              <Crown className="size-7" />
            </div>
          </div>

          {/* Title */}
          <div className="mt-4 text-center">
            <Dialog.Title className="text-2xl font-bold tracking-tight text-fg">
              Unlock Premium VIP Access
            </Dialog.Title>
            <Dialog.Description className="mt-1.5 text-sm text-muted">
              {targetTitle
                ? `"${targetTitle}" is an exclusive Premium Original available on VIP tiers.`
                : "Upgrade your account to experience ARMSS-OTT in full 4K Ultra HD quality."}
            </Dialog.Description>
          </div>

          {/* VIP Perks */}
          <div className="mt-6 space-y-2.5 rounded-xl bg-elevated/70 p-4 border border-border">
            <div className="flex items-center gap-3 text-sm text-fg">
              <Sparkles className="size-4 shrink-0 text-amber-400" />
              <span>Crystal clear <strong>4K Ultra HD + HDR</strong> streaming</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-fg">
              <Film className="size-4 shrink-0 text-amber-400" />
              <span>Full catalog access including all <strong>ARMSS Originals</strong></span>
            </div>
            <div className="flex items-center gap-3 text-sm text-fg">
              <Download className="size-4 shrink-0 text-amber-400" />
              <span>Download movies and series for <strong>Offline Playback</strong></span>
            </div>
            <div className="flex items-center gap-3 text-sm text-fg">
              <Tv className="size-4 shrink-0 text-amber-400" />
              <span>Watch on up to <strong>4 simultaneous devices</strong></span>
            </div>
            <div className="flex items-center gap-3 text-sm text-fg">
              <ShieldCheck className="size-4 shrink-0 text-amber-400" />
              <span>100% Ad-free uninterrupted cinematic experience</span>
            </div>
          </div>

          {/* Current Status */}
          <div className="mt-4 flex items-center justify-between text-xs px-1 text-muted">
            <span>Current plan: <strong className="text-fg uppercase">{user?.subscription_tier || "Guest (Free)"}</strong></span>
            <span>Instant activation · Cancel anytime</span>
          </div>

          {/* Actions */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              type="button"
              variant="line"
              disabled={loading}
              onClick={() => handleUpgrade("standard")}
              className="w-full justify-center"
            >
              Standard HD ($9.99/mo)
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={() => handleUpgrade("premium")}
              className="w-full justify-center bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-bg font-bold shadow-md shadow-amber-500/20"
            >
              <Crown className="size-4 mr-1.5" />
              {loading ? "Activating..." : "Upgrade to VIP ($14.99)"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

