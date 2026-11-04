import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Trash2,
  AlertTriangle,
  Lock,
  Mail,
  ArrowLeft,
  CheckCircle2,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { api, getToken } from "@/lib/api";
import { useAether } from "@/lib/store";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/delete-account")({
  component: DeleteAccountPage,
});

export function DeleteAccountPage() {
  const navigate = useNavigate();
  const user = useAether((s) => s.user);
  const logout = useAether((s) => s.logout);
  const hasToken = typeof window !== "undefined" ? Boolean(getToken()) : false;
  const isLoggedIn = Boolean(user && hasToken);

  // Form states for unauthenticated deletion request
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [deletedSuccess, setDeletedSuccess] = useState(false);

  // Handle deletion for authenticated user
  const handleAuthenticatedDelete = async () => {
    if (confirmPhrase.trim().toUpperCase() !== "DELETE") {
      toast.error("Please type DELETE to confirm");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.deleteAccount();
      if (res.success) {
        toast.success("Account and associated data deleted successfully");
        setDeletedSuccess(true);
        setShowConfirmModal(false);
        logout();
      } else {
        toast.error(res.message || "Failed to delete account");
      }
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle deletion for unauthenticated user via verification form
  const handleUnauthenticatedDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please provide both email and password to verify ownership");
      return;
    }
    if (confirmPhrase.trim().toUpperCase() !== "DELETE") {
      toast.error("Please type DELETE to confirm account deletion");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.requestAccountDeletion(email.trim(), password);
      if (res.success) {
        toast.success("Account and associated data deleted successfully");
        setDeletedSuccess(true);
        logout();
      } else {
        toast.error(res.message || "Invalid credentials or account not found");
      }
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

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
            <Link to="/terms" className="text-muted hover:text-fg">
              Terms of Service
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-border bg-surface p-6 sm:p-10 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-live/20 text-live">
              <Trash2 className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-live">
                Account &amp; Data Erasure
              </p>
              <h1 className="font-display italic text-3xl sm:text-4xl text-fg">
                Delete Account
              </h1>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted">
            Official Account Deletion Portal for ARMSS OTT (Google Play Store Compliant)
          </p>

          {deletedSuccess ? (
            <div className="mt-8 rounded-xl border border-border/80 bg-surfaceElevated p-6 text-center space-y-4">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="size-7" />
              </div>
              <h2 className="text-xl font-semibold text-fg">Account Successfully Deleted</h2>
              <p className="text-sm text-muted">
                Your ARMSS OTT account, profile records, watch history, and personal information have been permanently removed from our active servers.
              </p>
              <div className="pt-2">
                <Link
                  to="/"
                  className="inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-xs font-semibold text-bg hover:opacity-90 transition"
                >
                  Return to Home
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Important Policy Notice Box */}
              <div className="mt-6 rounded-xl border border-live/30 bg-live/10 p-4 text-xs space-y-2 text-fg">
                <div className="flex items-center gap-2 font-semibold text-live">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>Permanent Action Warning</span>
                </div>
                <p className="text-muted leading-relaxed">
                  Deleting your account will immediately and permanently erase all your data. This action cannot be reversed.
                </p>
                <ul className="list-inside list-disc space-y-1 text-muted">
                  <li>Your user login, email, and authentication records are deleted.</li>
                  <li>All viewing profiles, kid pins, and avatars are removed.</li>
                  <li>Your watchlist, ratings, and video resume progress are deleted.</li>
                  <li>Any active subscription benefits will immediately terminate.</li>
                </ul>
              </div>

              {/* Logged In View */}
              {isLoggedIn ? (
                <div className="mt-8 space-y-6">
                  <div className="rounded-xl border border-border bg-elevated p-4 space-y-2 text-xs">
                    <p className="text-muted">You are currently signed in as:</p>
                    <p className="text-sm font-semibold text-fg">{user?.name} ({user?.email})</p>
                    <p className="text-muted">
                      Subscription Plan: <span className="uppercase text-accent font-medium">{user?.subscription_tier || "Free"}</span>
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-medium text-muted">
                      To confirm permanent deletion, type <span className="font-bold text-live">DELETE</span> below:
                    </label>
                    <input
                      type="text"
                      value={confirmPhrase}
                      onChange={(e) => setConfirmPhrase(e.target.value)}
                      placeholder="Type DELETE"
                      className="w-full rounded-lg border border-border bg-bg px-3.5 py-2.5 text-sm text-fg placeholder:text-muted/50 focus:border-live focus:outline-none"
                    />
                  </div>

                  <Button
                    variant="destructive"
                    onClick={handleAuthenticatedDelete}
                    disabled={submitting || confirmPhrase.trim().toUpperCase() !== "DELETE"}
                    className="w-full h-11 text-xs font-bold uppercase tracking-wider bg-live hover:bg-live/90 text-white"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Deleting Account...
                      </span>
                    ) : (
                      "Permanently Delete My Account"
                    )}
                  </Button>
                </div>
              ) : (
                /* Unauthenticated View: Verification Form */
                <form onSubmit={handleUnauthenticatedDelete} className="mt-8 space-y-5">
                  <p className="text-xs text-muted">
                    If you are not currently signed in, please enter the registered email and password of the account you wish to delete:
                  </p>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-muted">Registered Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 size-4 text-muted" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-lg border border-border bg-bg pl-10 pr-3.5 py-2.5 text-sm text-fg placeholder:text-muted/50 focus:border-accent focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-muted">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 size-4 text-muted" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full rounded-lg border border-border bg-bg pl-10 pr-3.5 py-2.5 text-sm text-fg placeholder:text-muted/50 focus:border-accent focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-muted">
                      Type <span className="font-bold text-live">DELETE</span> to confirm
                    </label>
                    <input
                      type="text"
                      required
                      value={confirmPhrase}
                      onChange={(e) => setConfirmPhrase(e.target.value)}
                      placeholder="Type DELETE"
                      className="w-full rounded-lg border border-border bg-bg px-3.5 py-2.5 text-sm text-fg placeholder:text-muted/50 focus:border-live focus:outline-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={submitting || confirmPhrase.trim().toUpperCase() !== "DELETE"}
                    className="w-full h-11 text-xs font-bold uppercase tracking-wider bg-live hover:bg-live/90 text-white"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        Verifying &amp; Deleting...
                      </span>
                    ) : (
                      "Verify Credentials &amp; Delete Account"
                    )}
                  </Button>

                  <div className="pt-2 text-center text-xs text-muted">
                    Prefer to log in first?{" "}
                    <Link to="/login" className="text-accent underline font-medium">
                      Sign in to your account
                    </Link>
                  </div>
                </form>
              )}

              {/* Data Retention & Regulatory Details */}
              <div className="mt-10 border-t border-border pt-6 text-xs text-muted space-y-2">
                <h3 className="font-medium text-fg">Google Play Data Safety &amp; Retention Notice</h3>
                <p>
                  As mandated by Google Play Store guidelines and the Digital Personal Data Protection Act, requests initiated through this portal or the mobile application immediately disconnect all active user sessions and purge personal identifiers within our database systems.
                </p>
                <p>
                  If you need additional assistance with account closure, you may also reach our support team directly at{" "}
                  <a href="mailto:support@aurapictures.online" className="text-accent underline">
                    support@aurapictures.online
                  </a>
                  .
                </p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

