import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Lock,
  Mail,
  User as UserIcon,
  X,
  Eye,
  EyeOff,
  ArrowLeft,
  KeyRound,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAether } from "@/lib/store";
import { Button } from "./ui/button";
import { startGoogleSignIn } from "@/lib/auth/google";

export function AuthModal() {
  const open = useAether((s) => s.authModalOpen);
  const setOpen = useAether((s) => s.setAuthModalOpen);
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

  // Forgot Password OTP state (aligned with mis_desktop strategy)
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

  // Cooldown countdown timer for OTP resend
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const interval = setInterval(() => {
      setOtpCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [otpCooldown]);

  // Reset modal state when closed
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setError(null);
      setMode("login");
      setOtpSent(false);
      setOtpCooldown(0);
    }
  };

  const handleGoogleClick = () => {
    setError(null);
    setGoogleLoading(true);

    startGoogleSignIn({
      onSuccess: (authedUser) => {
        setGoogleLoading(false);
        setUser(authedUser);
        toast.success(`Signed in with Google as ${authedUser.name}!`);
        setOpen(false);
      },
      onError: (errMsg) => {
        setGoogleLoading(false);
        setError(errMsg);
      },
      onClientIdRequired: () => {
        setGoogleLoading(false);
        setError(
          "Google Sign-In is not configured for this deployment. Please sign in with your email or username."
        );
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === "login") {
      if (!identifier.trim()) {
        setError("Please enter your email address or username.");
        return;
      }
      setLoading(true);
      try {
        const res = await api.login(identifier.trim(), password);
        setUser(res.user);
        toast.success(`Welcome back, ${res.user.name}! Enjoy streaming.`);
        setOpen(false);
      } catch (err: any) {
        setError(err.message || "Something went wrong. Please check your credentials.");
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
        setError("Passwords do not match.");
        return;
      }

      setLoading(true);
      try {
        const res = await api.register(email.trim(), password, name.trim());
        setUser(res.user);
        toast.success(`Account created! Welcome to ARMSS OTT, ${res.user.name}.`);
        setOpen(false);
      } catch (err: any) {
        setError(err.message || "Registration failed. Please check your details.");
      } finally {
        setLoading(false);
      }
    }
  };

  // Request OTP for Password Reset
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

  // Verify OTP and update password
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
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-md fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-xl md:max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-5 sm:p-7 shadow-2xl border border-border scale-in focus:outline-none">
          {/* Close */}
          <Dialog.Close asChild>
            <button
              type="button"
              className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-muted hover:text-fg hover:bg-fg/8 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </Dialog.Close>

          {/* Header */}
          <div className="text-center">
            <span className="font-display italic text-2xl tracking-tight text-fg">
              ARMSS<span className="not-italic text-xs sm:text-sm ml-1 px-1.5 py-0.5 rounded bg-accent text-accent-fg font-bold tracking-wider">OTT</span>
            </span>
            <Dialog.Title className="mt-1.5 text-xl font-semibold text-fg">
              {mode === "login"
                ? "Sign in to your account"
                : mode === "register"
                ? "Create your account"
                : "Reset password"}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-muted max-w-lg mx-auto">
              {mode === "forgot"
                ? "Enter your registered email address or username to receive a 6-digit OTP."
                : mode === "login"
                ? "Sign in with your email or username to access your synchronized watchlist."
                : "Join ARMSS OTT for the best Tamil films, web series, and live TV."}
            </Dialog.Description>
          </div>

          {/* Mode Switcher & Google Sign-In Side-by-Side on sm: */}
          {mode !== "forgot" ? (
            <>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 items-center">
                {/* Tabs */}
                <div className="grid grid-cols-2 rounded-lg bg-elevated p-1 text-xs font-medium h-10 items-center">
                  <button
                    type="button"
                    onClick={() => { setMode("login"); setError(null); }}
                    className={`h-full rounded-md transition-all cursor-pointer flex items-center justify-center ${
                      mode === "login" ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg"
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode("register"); setError(null); }}
                    className={`h-full rounded-md transition-all cursor-pointer flex items-center justify-center ${
                      mode === "register" ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg"
                    }`}
                  >
                    Register
                  </button>
                </div>

                {/* Continue with Google */}
                <button
                  type="button"
                  disabled={googleLoading || loading}
                  onClick={handleGoogleClick}
                  className="h-10 flex items-center justify-center gap-2.5 px-3 rounded-lg bg-white text-gray-900 font-semibold text-xs sm:text-sm shadow hover:bg-gray-100 active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer border border-gray-200"
                >
                  <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span className="truncate">{googleLoading ? "Connecting..." : "Continue with Google"}</span>
                </button>
              </div>

              {/* Divider */}
              <div className="relative my-3 sm:my-3.5 flex items-center justify-center">
                <div className="w-full border-t border-border" />
                <span className="absolute bg-surface px-2.5 text-[10px] uppercase tracking-wider text-muted font-medium">
                  {mode === "login" ? "Or with email or username" : "Or fill in your details"}
                </span>
              </div>
            </>
          ) : (
            <div className="mt-3 flex items-center">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                  setOtpSent(false);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg font-medium transition-colors cursor-pointer"
              >
                <ArrowLeft className="size-3.5" />
                Back to Sign In
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-3 mt-2 rounded-lg bg-live/15 p-2.5 text-xs text-live border border-live/30">
              {error}
            </div>
          )}

          {/* Standard Login / Register Form */}
          {mode !== "forgot" && (
            <form onSubmit={handleSubmit} className="space-y-3.5">
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
                        className="w-full rounded-lg bg-elevated pl-9 pr-3 py-2 text-sm text-fg placeholder:text-muted/60 border border-border focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-medium text-muted mb-1">Email address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full rounded-lg bg-elevated pl-9 pr-3 py-2 text-sm text-fg placeholder:text-muted/60 border border-border focus:outline-none focus:border-accent"
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
                        className="w-full rounded-lg bg-elevated pl-9 pr-10 py-2 text-sm text-fg placeholder:text-muted/60 border border-border focus:outline-none focus:border-accent"
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
                    <label className="block text-xs font-medium text-muted mb-1">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-lg bg-elevated pl-9 pr-10 py-2 text-sm text-fg placeholder:text-muted/60 border border-border focus:outline-none focus:border-accent"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">
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
                        placeholder="name@example.com or username"
                        className="w-full rounded-lg bg-elevated pl-9 pr-3 py-2 text-sm text-fg placeholder:text-muted/60 border border-border focus:outline-none focus:border-accent"
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
                        placeholder="••••••••"
                        className="w-full rounded-lg bg-elevated pl-9 pr-10 py-2 text-sm text-fg placeholder:text-muted/60 border border-border focus:outline-none focus:border-accent"
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

              <Button type="submit" disabled={loading} className="w-full font-semibold h-10 mt-1">
                {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
              </Button>
            </form>
          )}

          {/* Forgot Password OTP Mode */}
          {mode === "forgot" && (
            <div className="mt-3 space-y-3.5">
              {!otpSent ? (
                <form onSubmit={handleRequestOtp} className="space-y-3.5">
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
                        className="w-full rounded-lg bg-elevated pl-9 pr-3 py-2 text-sm text-fg placeholder:text-muted/60 border border-border focus:outline-none focus:border-accent"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      We'll dispatch a 6-digit OTP code to the registered email on file.
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
                <form onSubmit={handleVerifyOtpAndReset} className="space-y-3.5">
                  <div className="rounded-lg bg-accent/10 border border-accent/25 p-2.5 flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-accent shrink-0 mt-0.5" />
                    <div className="text-xs text-fg leading-relaxed">
                      <span className="font-semibold text-accent">OTP Code Sent!</span> A 6-digit verification code was sent to the registered email for <span className="font-mono text-accent-fg bg-accent/20 px-1 py-0.5 rounded">{forgotIdentifier}</span>. It is valid for 15 minutes.
                    </div>
                  </div>

                  {/* OTP & Passwords side by side on sm: */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* 6-Digit OTP */}
                    <div className="sm:col-span-1">
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
                          className="w-full tracking-widest text-center font-mono text-base rounded-lg bg-elevated pl-8 pr-2 py-2 text-fg placeholder:text-muted/40 border border-border focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>

                    {/* New Password */}
                    <div className="sm:col-span-1">
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
                          className="w-full rounded-lg bg-elevated pl-9 pr-9 py-2 text-sm text-fg placeholder:text-muted/60 border border-border focus:outline-none focus:border-accent"
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
                    <div className="sm:col-span-1">
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
                          className="w-full rounded-lg bg-elevated pl-9 pr-3 py-2 text-sm text-fg placeholder:text-muted/60 border border-border focus:outline-none focus:border-accent"
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
