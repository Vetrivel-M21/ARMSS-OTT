import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

export function TermsPage() {
  const lastUpdated = "November 4, 2026";

  return (
    <div className="min-h-screen bg-bg text-fg">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-fg"
            >
              <ArrowLeft className="size-4" />
              <span>Back to Stream</span>
            </Link>
            <div className="h-4 w-px bg-border" />
            <Logo className="h-7 w-auto" />
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Link to="/privacy" className="text-muted hover:text-fg">
              Privacy Policy
            </Link>
            <Link to="/delete-account" className="text-muted hover:text-live">
              Delete Account
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="rounded-2xl border border-border bg-surface p-6 sm:p-10 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent/20 text-accent">
              <FileText className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Legal & Compliance
              </p>
              <h1 className="font-display italic text-3xl sm:text-4xl text-fg">
                Terms of Service
              </h1>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted">
            Last Updated: {lastUpdated} · Effective Date: November 1, 2026
          </p>

          <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted">
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-fg">1. Acceptance of Terms</h2>
              <p>
                By accessing or using <strong className="text-fg">ARMSS OTT</strong> (&quot;the Service&quot;), provided by <strong className="text-fg">Aura Pictures</strong>, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-fg">2. Subscription &amp; Payments</h2>
              <p>
                Certain features and video content require an active subscription tier (e.g., Standard Full HD or Premium VIP 4K).
              </p>
              <ul className="list-inside list-disc space-y-1 text-xs">
                <li>Subscriptions are billed in Indian Rupees (INR) through authorized payment gateways (Cashfree / Razorpay).</li>
                <li>Prices are inclusive of applicable taxes unless specified otherwise.</li>
                <li>Concurrent device limits apply based on your selected plan (e.g., 2 screens for Standard, 4 screens for Premium).</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-fg">3. Cancellation &amp; Refund Policy</h2>
              <p>
                You may cancel your subscription at any time via your Account Settings. Upon cancellation, your subscription will remain active until the end of your current billing cycle. Because digital content access is provisioned immediately, refunds for partially used billing periods are not provided except where required by law.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-fg">4. Content Usage &amp; Intellectual Property</h2>
              <p>
                All videos, audio tracks, graphics, logos, and software made available through ARMSS OTT are the property of Aura Pictures or its licensors. You are granted a limited, personal, non-commercial license to view content. Any downloading, recording, or redistributing outside official app features is strictly prohibited.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-fg">5. Termination &amp; Account Deletion</h2>
              <p>
                You may terminate your account at any time using the in-app Delete Account feature or via{" "}
                <Link to="/delete-account" className="text-accent underline">
                  aurapictures.online/delete-account
                </Link>
                . We reserve the right to suspend or terminate accounts that violate these Terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-fg">6. Contact Information</h2>
              <p className="text-xs">
                For questions regarding these Terms, contact our legal and support team at{" "}
                <a href="mailto:support@aurapictures.online" className="text-accent underline">
                  support@aurapictures.online
                </a>
                .
              </p>
            </section>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-muted">
          <p>&copy; {new Date().getFullYear()} ARMSS OTT · Aura Pictures. All rights reserved.</p>
        </div>
      </main>
    </div>
  );
}

