import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  Lock,
  Mail,
  User as UserIcon,
  Eye,
  EyeOff,
  ArrowLeft,
  KeyRound,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { api, getToken } from "@/lib/api";
import { useAether } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { startGoogleSignIn } from "@/lib/auth/google";
import { CinematicMovieWall } from "@/components/cinematic-movie-wall";

type LoginSearch = {
  redirect?: string;
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  component: LoginPage,
});

export function GoogleGIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const user = useAether((s) => s.user);
  const authChecked = useAether((s) => s.authChecked);
  const setAuthChecked = useAether((s) => s.setAuthChecked);
  const setUser = useAether((s) => s.setUser);

  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  
  // Sign In / Register state
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Forgot password OTP flow state (modeled after mis_desktop strategy)
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OTP cooldown countdown timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const interval = setInterval(() => {
      setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [otpCooldown]);

  // If already logged in with a valid session token, redirect to destination
  useEffect(() => {
    if (authChecked && user && getToken()) {
      const target = redirect || "/";
      void navigate({ to: target as any });
    }
  }, [authChecked, user, redirect, navigate]);

  const handleFinishAuth = (userData: any, successMsg: string) => {
    setUser(userData);
    setAuthChecked(true);
    toast.success(successMsg);
    const target = redirect || "/";
    void navigate({ to: target as any });
  };

  // Real Google Sign-In via Google Identity Services (GIS)
  const handleGoogleSignInClick = () => {
    setError(null);
    setGoogleLoading(true);

    startGoogleSignIn({
      onSuccess: (authedUser) => {
        setGoogleLoading(false);
        handleFinishAuth(authedUser, `Signed in with Google as ${authedUser.name}!`);
      },
      onError: (errMsg) => {
        setGoogleLoading(false);
        setError(errMsg);
      },
      onClientIdRequired: () => {
        setGoogleLoading(false);
        setError(
          "Google Sign-In is not configured for this deployment. Please sign in with your email or username and password."
        );
      },
    });
  };

  // Standard Login / Registration Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === "login") {
      const cleanIdentifier = identifier.trim();
      if (!cleanIdentifier) {
        setError("Please enter your email address or username.");
        return;
      }
      if (!password) {
        setError("Please enter your password.");
        return;
      }
      setLoading(true);
      console.log("[ARMSS-OTT] Submitting login request for:", cleanIdentifier);
      try {
        const res = await api.login(cleanIdentifier, password);
        console.log("[ARMSS-OTT] Login successful:", res.user);
        handleFinishAuth(res.user, `Welcome back, ${res.user.name}!`);
      } catch (err: any) {
        console.error("[ARMSS-OTT] Login failed:", err);
        setError(err.message || "Authentication failed. Please check your credentials.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === "register") {
      if (!name.trim()) {
        setError("Please enter your full name / username.");
        return;
      }
      if (!email.trim()) {
        setError("Please enter your email address.");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match. Please verify both passwords.");
        return;
      }

      setLoading(true);
      try {
        const res = await api.register(email.trim(), password, name.trim());
        handleFinishAuth(res.user, `Account created! Welcome to ARMSS OTT, ${res.user.name}.`);
      } catch (err: any) {
        setError(err.message || "Registration failed. Please check your details.");
      } finally {
        setLoading(false);
      }
    }
  };

  // Forgot Password: Request OTP (Step 1)
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!forgotIdentifier.trim()) {
      setError("Please enter your registered email address or username.");
      return;
    }
    setError(null);
    setIsSendingOtp(true);

    try {
      const res = await api.requestPasswordReset(forgotIdentifier.trim());
      setOtpSent(true);
      setOtpCooldown(120);
      toast.success(res.message || "A 6-digit OTP code has been sent to your registered email.");
    } catch (err: any) {
      setError(err.message || "Failed to send OTP. Please check your email or username.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Forgot Password: Verify OTP & Change Password (Step 2)
  const handleVerifyOtpAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.trim().length !== 6) {
      setError("Please enter the complete 6-digit OTP code.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError(null);
    setIsVerifyingOtp(true);

    try {
      const res = await api.resetPasswordWithOtp(forgotIdentifier.trim(), otp.trim(), newPassword);
      toast.success(res.message || "OTP verified! Password successfully changed.");
      // Pre-fill the login identifier and return to login mode
      setIdentifier(forgotIdentifier.trim());
      setPassword("");
      setOtp("");
      setNewPassword("");
      setConfirmNewPassword("");
      setOtpSent(false);
      setOtpCooldown(0);
      setMode("login");
    } catch (err: any) {
      setError(err.message || "Invalid or expired OTP. Please try again.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-3 sm:p-6 bg-bg overflow-y-auto select-none">
      {/* Animated Cinematic Movie Wall Background */}
      <CinematicMovieWall />

      {/* Main Split Auth Card */}
      <div className="relative z-10 w-full max-w-4xl rounded-2xl sm:rounded-3xl bg-surface/90 border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] backdrop-blur-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[460px]">
        {/* LEFT PART: Application Name, Continue with Google, Register / Sign In Switcher */}
        <div className="md:col-span-5 p-6 sm:p-8 flex flex-col justify-between bg-elevated/40 border-b md:border-b-0 md:border-r border-white/10 relative overflow-hidden">
          {/* Subtle Ambient Accent inside left panel */}
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-accent/15 blur-3xl rounded-full pointer-events-none" />

          {/* Brand Header */}
          <div className="relative z-10">
            <Link to="/" className="inline-flex items-center gap-3 group">
              <img
                src="/logo.png"
                alt="ARMSS OTT Logo"
                className="size-10 sm:size-12 object-contain drop-shadow-[0_4px_16px_rgba(255,80,30,0.4)] transition-transform duration-300 group-hover:scale-105"
              />
              <span className="font-display italic text-3xl sm:text-4xl tracking-tight text-fg group-hover:text-accent transition-colors flex items-center">
                ARMSS<span className="not-italic text-xs sm:text-sm ml-1.5 px-2 py-0.5 rounded bg-accent text-accent-fg font-bold tracking-wider">OTT</span>
              </span>
            </Link>
            <p className="mt-2 text-xs text-muted leading-relaxed">
              Tamil cinema, blockbuster releases, live sports, and original series streaming in 4K HDR.
            </p>
          </div>

          {/* Quick Connect & Mode Selection */}
          <div className="relative z-10 my-6 space-y-4">
            {mode !== "forgot" ? (
              <>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
                    Account Access
                  </label>
                  {/* Mode Switcher Tabs */}
                  <div className="grid grid-cols-2 rounded-xl bg-surface/90 p-1 text-xs font-semibold border border-white/10">
                    <button
                      type="button"
                      onClick={() => { setMode("login"); setError(null); }}
                      className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                        mode === "login"
                          ? "bg-accent text-accent-fg shadow-md font-bold"
                          : "text-muted hover:text-fg"
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMode("register"); setError(null); }}
                      className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                        mode === "register"
                          ? "bg-accent text-accent-fg shadow-md font-bold"
                          : "text-muted hover:text-fg"
                      }`}
                    >
                      Register
                    </button>
                  </div>
                </div>

                <div className="relative my-3 flex items-center justify-center">
                  <div className="w-full border-t border-white/10" />
                  <span className="absolute bg-surface px-2.5 text-[10px] uppercase tracking-wider text-muted font-medium">
                    Quick Connect
                  </span>
                </div>

                {/* Continue with Google */}
                <button
                  type="button"
                  disabled={googleLoading || loading}
                  onClick={handleGoogleSignInClick}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl bg-white text-gray-900 font-semibold text-xs sm:text-sm shadow-md hover:bg-gray-100 active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer border border-gray-200"
                >
                  <GoogleGIcon className="size-4.5 shrink-0" />
                  <span className="truncate">{googleLoading ? "Connecting..." : "Continue with Google"}</span>
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl bg-surface/70 border border-white/10 p-3 text-xs text-muted leading-relaxed">
                  Resetting your password via 6-digit OTP verification code sent to your registered email.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                    setOtpSent(false);
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-white/10 text-xs font-semibold text-fg hover:bg-elevated transition-colors cursor-pointer"
                >
                  <ArrowLeft className="size-4 text-accent" />
                  Back to Sign In
                </button>
              </div>
            )}
          </div>

          {/* Perks / Footer */}
          <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-muted font-medium">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-accent animate-pulse" />
              4K Ultra HD
            </span>
            <span>•</span>
            <span>Dolby Atmos</span>
            <span>•</span>
            <span>Zero Ads</span>
          </div>
        </div>

        {/* RIGHT PART: Input Fields & Action Form */}
        <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-center">
          {/* Header of Right Panel */}
          <div className="mb-4">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-fg">
              {mode === "login"
                ? "Sign in to your account"
                : mode === "register"
                ? "Create your account"
                : "Reset password"}
            </h2>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              {mode === "forgot"
                ? "Enter your registered email address or username to receive a 6-digit verification code."
                : redirect
                ? "Sign in with your account to watch this title in full quality."
                : mode === "login"
                ? "Sign in with your email or username to access your synchronized watchlist."
                : "Fill in your details below to activate your ARMSS OTT streaming membership."}
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-3.5 rounded-lg bg-live/15 p-2.5 text-xs text-live border border-live/30 flex items-start gap-2">
              <span className="font-bold">•</span>
              <span>{error}</span>
            </div>
          )}

          {/* Standard Login / Register Form */}
          {mode !== "forgot" && (
            <form
              action="javascript:void(0)"
              method="dialog"
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void handleSubmit(e);
              }}
              className="space-y-3.5"
            >
              {mode === "register" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">
                      Your Name / Username
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="arjun_kumar"
                        className="w-full rounded-lg bg-elevated pl-9 pr-3 py-2 text-sm text-fg placeholder:text-muted/50 border border-white/10 focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full rounded-lg bg-elevated pl-9 pr-3 py-2 text-sm text-fg placeholder:text-muted/50 border border-white/10 focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-lg bg-elevated pl-9 pr-10 py-2 text-sm text-fg placeholder:text-muted/50 border border-white/10 focus:outline-none focus:border-accent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg cursor-pointer"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-lg bg-elevated pl-9 pr-10 py-2 text-sm text-fg placeholder:text-muted/50 border border-white/10 focus:outline-none focus:border-accent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg cursor-pointer"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {/* Email / Username */}
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">
                      Email address or Username
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
                      <input
                        type="text"
                        required
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleSubmit(e);
                          }
                        }}
                        placeholder="name@example.com or username"
                        className="w-full rounded-lg bg-elevated pl-9 pr-3 py-2 text-sm text-fg placeholder:text-muted/50 border border-white/10 focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-muted">Password</label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotIdentifier(identifier.trim());
                          setMode("forgot");
                          setError(null);
                        }}
                        className="text-[11px] text-accent hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleSubmit(e);
                          }
                        }}
                        placeholder="••••••••"
                        className="w-full rounded-lg bg-elevated pl-9 pr-10 py-2 text-sm text-fg placeholder:text-muted/50 border border-white/10 focus:outline-none focus:border-accent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg cursor-pointer"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || googleLoading}
                onClick={(e) => {
                  e.preventDefault();
                  void handleSubmit(e);
                }}
                className="w-full font-semibold h-10 mt-2 cursor-pointer"
              >
                {loading
                  ? "Signing in..."
                  : mode === "login"
                  ? "Sign In & Stream"
                  : "Create Account"}
              </Button>
            </form>
          )}

          {/* Forgot Password OTP Mode */}
          {mode === "forgot" && (
            <div className="space-y-3.5">
              {!otpSent ? (
                <form action="#" onSubmit={handleRequestOtp} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">
                      Email address or Username
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
                      <input
                        type="text"
                        required
                        value={forgotIdentifier}
                        onChange={(e) => setForgotIdentifier(e.target.value)}
                        placeholder="name@example.com or username"
                        className="w-full rounded-lg bg-elevated pl-9 pr-3 py-2 text-sm text-fg placeholder:text-muted/50 border border-white/10 focus:outline-none focus:border-accent"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      We'll dispatch a 6-digit verification code to your registered email address.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSendingOtp}
                    className="w-full font-semibold h-10"
                  >
                    {isSendingOtp ? "Dispatching OTP Code..." : "Send Verification Code"}
                  </Button>
                </form>
              ) : (
                <form action="#" onSubmit={handleVerifyOtpAndReset} className="space-y-3.5">
                  <div className="rounded-lg bg-accent/10 border border-accent/25 p-2.5 flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-accent shrink-0 mt-0.5" />
                    <div className="text-xs text-fg leading-relaxed">
                      <span className="font-semibold text-accent">OTP Code Sent!</span> A 6-digit OTP code has been dispatched to the email for <span className="font-mono text-accent-fg bg-accent/20 px-1 py-0.5 rounded">{forgotIdentifier}</span>. Valid for 15 minutes.
                    </div>
                  </div>

                  {/* 6-Digit OTP */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-muted">
                        6-Digit OTP
                      </label>
                      <button
                        type="button"
                        disabled={otpCooldown > 0 || isSendingOtp}
                        onClick={() => handleRequestOtp()}
                        className="text-[10px] font-medium text-accent hover:underline disabled:opacity-50 cursor-pointer inline-flex items-center gap-1"
                      >
                        <RefreshCw className={`size-2.5 ${isSendingOtp ? "animate-spin" : ""}`} />
                        {otpCooldown > 0 ? `${otpCooldown}s` : "Resend"}
                      </button>
                    </div>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
                      <input
                        type="text"
                        maxLength={6}
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        placeholder="123456"
                        className="w-full tracking-widest text-center font-mono text-base rounded-lg bg-elevated pl-8 pr-2 py-2 text-fg placeholder:text-muted/40 border border-white/10 focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  {/* Passwords in 2 columns */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* New Password */}
                    <div>
                      <label className="block text-xs font-medium text-muted mb-1">
                        New Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
                        <input
                          type={showNewPassword ? "text" : "password"}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min 6 chars"
                          className="w-full rounded-lg bg-elevated pl-9 pr-9 py-2 text-sm text-fg placeholder:text-muted/50 border border-white/10 focus:outline-none focus:border-accent"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-fg cursor-pointer"
                          aria-label={showNewPassword ? "Hide password" : "Show password"}
                        >
                          {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm New Password */}
                    <div>
                      <label className="block text-xs font-medium text-muted mb-1">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
                        <input
                          type={showNewPassword ? "text" : "password"}
                          required
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full rounded-lg bg-elevated pl-9 pr-3 py-2 text-sm text-fg placeholder:text-muted/50 border border-white/10 focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isVerifyingOtp}
                    className="w-full font-semibold h-10"
                  >
                    {isVerifyingOtp ? "Verifying & Updating..." : "Verify OTP & Reset Password"}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtp("");
                      }}
                      className="text-xs text-muted hover:text-fg underline cursor-pointer"
                    >
                      Entered wrong email/username? Change it
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
