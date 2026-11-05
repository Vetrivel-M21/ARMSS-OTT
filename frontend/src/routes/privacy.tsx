import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Lock, CreditCard, UserX, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPolicyPage,
});

export function PrivacyPolicyPage() {
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
            <Link to="/terms" className="text-muted hover:text-fg">
              Terms of Service
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
              <Shield className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
                Legal & Compliance
              </p>
              <h1 className="font-display italic text-3xl sm:text-4xl text-fg">
                Privacy Policy
              </h1>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted">
            Last Updated: {lastUpdated} · Effective Date: November 1, 2026
          </p>

          <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted">
            {/* Overview */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-fg">1. Overview & Commitment</h2>
              <p>
                Welcome to <strong className="text-fg">AURA</strong> (&quot;Platform&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), operated by <strong className="text-fg">Aura Pictures</strong>. We are committed to protecting the privacy, personal data, and rights of our viewers across our web platform, mobile applications, and connected TV devices.
              </p>
              <p>
                This Privacy Policy outlines how we collect, handle, store, and safeguard your personal information in accordance with applicable Indian laws, including the Information Technology Act, 2000, the Digital Personal Data Protection (DPDP) Act, and international digital privacy standards.
              </p>
            </section>

            {/* Information Collected */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-fg">2. Information We Collect</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-elevated p-4">
                  <h3 className="font-medium text-fg">A. Account Information</h3>
                  <p className="mt-1 text-xs">
                    Your name, email address, password hash, created viewing profiles (including Kids profile flags and PINs), and selected subscription tier.
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-elevated p-4">
                  <h3 className="font-medium text-fg">B. Device &amp; Stream Diagnostics</h3>
                  <p className="mt-1 text-xs">
                    Device model, operating system (Android, iOS, Web browser), screen resolution capability (e.g. 1080p, 4K HDR), network connection type, and playback heartbeat diagnostics for adaptive bitrate streaming.
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-elevated p-4">
                  <h3 className="font-medium text-fg">C. Viewing History &amp; Preferences</h3>
                  <p className="mt-1 text-xs">
                    Watchlist titles, watch progress timestamps, liked/rated titles, and search queries within the app to deliver personalized content recommendations.
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-elevated p-4">
                  <h3 className="font-medium text-fg">D. Google Sign-In Data</h3>
                  <p className="mt-1 text-xs">
                    When choosing to authenticate via Google, we collect your verified email, display name, and public profile avatar securely via Google OAuth 2.0.
                  </p>
                </div>
              </div>
            </section>

            {/* Payment & Financial Data */}
            <section className="space-y-3 rounded-xl border border-accent/30 bg-accent/5 p-5">
              <div className="flex items-center gap-2 text-fg">
                <CreditCard className="size-5 text-accent" />
                <h2 className="text-base font-semibold">3. Payment &amp; Financial Security (Cashfree &amp; Razorpay)</h2>
              </div>
              <p>
                All subscription payments on AURA are processed exclusively through Reserve Bank of India (RBI) authorized, PCI-DSS Level 1 compliant payment gateways, including <strong className="text-fg">Cashfree Payments</strong> and <strong className="text-fg">Razorpay</strong>.
              </p>
              <ul className="list-inside list-disc space-y-1 text-xs">
                <li><strong className="text-fg">Zero Card Storage:</strong> AURA servers NEVER receive, process, or store your credit card or debit card numbers, expiration dates, or CVV codes.</li>
                <li><strong className="text-fg">Direct Tokenization:</strong> All card, UPI, net banking, and wallet transactions take place directly on encrypted bank/gateway checkout interfaces.</li>
                <li><strong className="text-fg">Order Records:</strong> We only store merchant transaction references (Order ID, Payment ID, Plan Tier, Amount, and Status) for receipt issuance and subscription fulfillment.</li>
              </ul>
            </section>

            {/* How We Use Your Data */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-fg">4. How We Use Your Information</h2>
              <ul className="space-y-2 text-xs">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 shrink-0 text-accent mt-0.5" />
                  <span>To provide adaptive high-definition and 4K video playback tailored to your device and bandwidth.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 shrink-0 text-accent mt-0.5" />
                  <span>To authenticate your sessions across devices, synchronize your watchlist, and resume video progress.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 shrink-0 text-accent mt-0.5" />
                  <span>To manage subscription renewals, send payment invoices, and notify you of new cinema releases.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 shrink-0 text-accent mt-0.5" />
                  <span>To detect and prevent fraudulent access, unauthorized account sharing beyond plan screen limits, and platform misuse.</span>
                </li>
              </ul>
            </section>

            {/* Account Deletion & Data Rights */}
            <section className="space-y-3 rounded-xl border border-border bg-surfaceElevated p-5">
              <div className="flex items-center gap-2 text-fg">
                <UserX className="size-5 text-live" />
                <h2 className="text-base font-semibold">5. Account Deletion &amp; Right to Erasure (Google Play Compliant)</h2>
              </div>
              <p>
                In strict compliance with Google Play Developer Policies and global data privacy standards, all AURA users have the absolute right to request the permanent deletion of their account and all associated personal data at any time.
              </p>
              <p className="text-xs">
                You can delete your account through two convenient methods:
              </p>
              <div className="grid gap-3 pt-1 sm:grid-cols-2 text-xs">
                <div className="rounded-lg border border-border bg-surface p-3">
                  <p className="font-semibold text-fg">Option A: In-App Deletion</p>
                  <p className="mt-1 text-muted">
                    Open the mobile app or web platform &rarr; navigate to <strong>Settings</strong> &rarr; scroll to <strong>Danger Zone</strong> &rarr; click <strong>Delete Account</strong>.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-surface p-3">
                  <p className="font-semibold text-fg">Option B: Public Web URL</p>
                  <p className="mt-1 text-muted">
                    Visit our dedicated public portal at{" "}
                    <Link to="/delete-account" className="text-accent underline font-medium">
                      aurapictures.online/delete-account
                    </Link>{" "}
                    to instantly delete or submit an account deletion request.
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted">
                <strong>What data is purged:</strong> Your email, profile details, watch progress, viewing history, device tokens, and rating records are immediately and permanently removed from our active databases.
              </p>
            </section>

            {/* Cookies & Security */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-fg">6. Security &amp; Data Storage</h2>
              <p>
                We employ industry-standard security measures, including 256-bit TLS/SSL encryption for all data in transit, bcrypt cryptographic hashing for passwords, and secure cloud storage infrastructure (Cloudflare R2 and AWS S3).
              </p>
            </section>

            {/* Contact & Grievance */}
            <section className="space-y-3 rounded-xl border border-border bg-surfaceElevated p-5">
              <div className="flex items-center gap-2 text-fg">
                <Mail className="size-5 text-accent" />
                <h2 className="text-base font-semibold">7. Grievance Officer &amp; Contact Information</h2>
              </div>
              <p className="text-xs">
                If you have questions regarding this Privacy Policy, wish to exercise your data protection rights, or have a grievance regarding your personal information, please contact our designated Grievance Officer:
              </p>
              <div className="mt-2 space-y-1 text-xs text-fg">
                <p><strong>Grievance Officer:</strong> Data Protection &amp; Privacy Compliance Officer</p>
                <p><strong>Entity:</strong> Aura Pictures / AURA</p>
                <p><strong>Email:</strong> <a href="mailto:armssinfotech@gmail.com" className="text-accent underline">armssinfotech@gmail.com</a></p>
                <p><strong>Turnaround Time:</strong> Grievances will be addressed within 30 days as prescribed under the Information Technology Rules.</p>
              </div>
            </section>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-xs text-muted">
          <p>&copy; {new Date().getFullYear()} AURA · Aura Pictures. All rights reserved.</p>
        </div>
      </main>
    </div>
  );
}
