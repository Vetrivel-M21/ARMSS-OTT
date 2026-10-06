import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Crown, HelpCircle, Shield, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, type SubscriptionTier } from "@/lib/api";
import { useAether } from "@/lib/store";

export const Route = createFileRoute("/plans")({ component: PlansPage });

function PlansPage() {
  const user = useAether((s) => s.user);
  const setUser = useAether((s) => s.setUser);
  const setAuthModalOpen = useAether((s) => s.setAuthModalOpen);

  const [annual, setAnnual] = useState(false);
  const [loadingTier, setLoadingTier] = useState<SubscriptionTier | null>(null);

  const currentTier: SubscriptionTier = user?.subscription_tier || "free";

  const handleSelectPlan = async (tier: SubscriptionTier) => {
    if (!user) {
      setAuthModalOpen(true);
      toast.info("Please sign in or register to select a plan.");
      return;
    }

    if (tier === currentTier) {
      toast.info("You are already on this plan.");
      return;
    }

    setLoadingTier(tier);
    try {
      if (tier === "free") {
        const res = await api.cancelTier();
        setUser(res.user);
        toast.success("Switched to Free plan.");
      } else if (tier === "standard" || tier === "premium") {
        const res = await api.upgradeTier(tier);
        setUser(res.user);
        toast.success(`Successfully activated ${tier === "premium" ? "Premium VIP 4K" : "Standard HD"}!`);
      }
    } catch (err: any) {
      toast.error(err.message || "Could not update your plan. Please try again.");
    } finally {
      setLoadingTier(null);
    }
  };

  const plans = [
    {
      tier: "free" as SubscriptionTier,
      name: "Free Member",
      tagline: "Perfect for casual viewers. Enjoy a curated Tamil catalog at no cost.",
      price: "₹0",
      period: "forever, no card needed",
      resolution: "720p HD",
      devices: "1 screen at a time",
      adFree: false,
      downloads: false,
      originals: false,
      badge: null,
    },
    {
      tier: "standard" as SubscriptionTier,
      name: "Standard HD",
      tagline: "Full HD Tamil entertainment with zero ad breaks, anytime, anywhere.",
      price: annual ? "₹79" : "₹99",
      period: annual ? "per month (billed annually)" : "per month",
      resolution: "1080p Full HD",
      devices: "2 screens simultaneously",
      adFree: true,
      downloads: false,
      originals: true,
      badge: "Most Popular",
    },
    {
      tier: "premium" as SubscriptionTier,
      name: "Premium VIP",
      tagline: "The ultimate Tamil cinema experience — 4K HDR, Dolby Atmos & offline downloads.",
      price: annual ? "₹159" : "₹199",
      period: annual ? "per month (billed annually)" : "per month",
      resolution: "4K Ultra HD + HDR10",
      devices: "4 screens simultaneously",
      adFree: true,
      downloads: true,
      originals: true,
      badge: "Best Value",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-24 sm:px-8">
      {/* Title */}
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
          Subscriptions & Pricing
        </p>
        <h1 className="mt-3 font-display italic text-4xl tracking-tight sm:text-5xl text-fg">
          Choose the right plan for you
        </h1>
        <p className="mt-3 text-sm text-muted max-w-xl mx-auto">
          Watch anywhere across India. Cancel anytime. All plans give you instant access to ARMSS OTT's world-class Tamil streaming library.
        </p>

        {/* Billing Cycle Switch */}
        <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-surface p-1.5 border border-border">
          <button
            type="button"
            onClick={() => setAnnual(false)}
            className={`rounded-full px-5 py-1.5 text-xs font-medium transition-all ${
              !annual ? "bg-accent text-accent-fg shadow-sm" : "text-muted hover:text-fg"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setAnnual(true)}
            className={`rounded-full px-5 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5 ${
              annual ? "bg-accent text-accent-fg shadow-sm" : "text-muted hover:text-fg"
            }`}
          >
            <span>Annual</span>
            <span className="rounded-full bg-amber-500/20 text-amber-400 px-2 py-0.2 text-[10px] font-bold">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Plan Cards Grid */}
      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.tier === currentTier;
          const isVIP = p.tier === "premium";

          return (
            <div
              key={p.tier}
              className={`relative flex flex-col justify-between rounded-2xl p-6 sm:p-7 transition-all ${
                isVIP
                  ? "bg-gradient-to-b from-surface via-surface to-amber-950/20 border-2 border-amber-500/40 shadow-xl shadow-amber-500/5"
                  : "bg-surface border border-border hover:border-fg/20"
              }`}
            >
              {p.badge && (
                <div
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                    isVIP
                      ? "bg-gradient-to-r from-amber-400 to-amber-600 text-bg shadow-sm"
                      : "bg-accent text-accent-fg"
                  }`}
                >
                  {p.badge}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-fg">{p.name}</h3>
                  {isVIP && <Crown className="size-5 text-amber-400" />}
                </div>
                <p className="mt-2 text-xs text-muted leading-relaxed">{p.tagline}</p>

                <div className="mt-6 border-b border-border pb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display italic text-4xl font-bold text-fg">{p.price}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{p.period}</p>
                </div>

                {/* Features list */}
                <ul className="mt-6 space-y-3.5 text-xs text-fg/90">
                  <li className="flex items-center gap-2.5">
                    <Check className="size-4 shrink-0 text-match" />
                    <span>Resolution: <strong>{p.resolution}</strong></span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="size-4 shrink-0 text-match" />
                    <span>Simultaneous streams: <strong>{p.devices}</strong></span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    {p.adFree ? (
                      <Check className="size-4 shrink-0 text-match" />
                    ) : (
                      <X className="size-4 shrink-0 text-muted" />
                    )}
                    <span className={p.adFree ? "" : "text-muted"}>100% ad-free streaming</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    {p.downloads ? (
                      <Check className="size-4 shrink-0 text-match" />
                    ) : (
                      <X className="size-4 shrink-0 text-muted" />
                    )}
                    <span className={p.downloads ? "" : "text-muted"}>Offline downloads for mobile</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    {p.originals ? (
                      <Check className="size-4 shrink-0 text-match" />
                    ) : (
                      <X className="size-4 shrink-0 text-muted" />
                    )}
                    <span className={p.originals ? "" : "text-muted"}>All ARMSS Originals unlocked</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="size-4 shrink-0 text-match" />
                    <span>Tamil, Hindi &amp; English audio tracks</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8">
                <Button
                  type="button"
                  variant={isCurrent ? "ghost" : isVIP ? "play" : "line"}
                  disabled={loadingTier !== null}
                  onClick={() => handleSelectPlan(p.tier)}
                  className={`w-full justify-center ${
                    isVIP && !isCurrent
                      ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-bg font-bold shadow-md shadow-amber-500/20"
                      : ""
                  }`}
                >
                  {loadingTier === p.tier
                    ? "Please wait..."
                    : isCurrent
                    ? "Current Plan"
                    : isVIP
                    ? "Upgrade to VIP"
                    : "Select Plan"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trust & Guarantee Banner */}
      <div className="mt-16 rounded-2xl bg-elevated/50 p-6 border border-border text-center sm:flex sm:items-center sm:justify-between sm:text-left">
        <div className="flex items-center gap-3.5 justify-center sm:justify-start">
          <Shield className="size-7 text-match shrink-0" />
          <div>
            <h4 className="text-sm font-semibold text-fg">No Questions Asked 30-Day Refund</h4>
            <p className="text-xs text-muted mt-0.5">Switch or cancel your subscription at any time. Full refund within 30 days, guaranteed.</p>
          </div>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center justify-center gap-2 text-xs text-muted">
          <HelpCircle className="size-4" />
          <span>Need help? Contact support@armss.com</span>
        </div>
      </div>

      {/* UPI & Payment note */}
      <p className="mt-6 text-center text-xs text-subtle">
        Pay securely via UPI, Net Banking, Credit/Debit Card or EMI. Prices in INR inclusive of GST.
      </p>
    </div>
  );
}
