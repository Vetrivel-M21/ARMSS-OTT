import { useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAether } from "@/lib/store";
import { api, getToken } from "@/lib/api";
import { ProfilePicker } from "../profile-picker";
import { MobileNav, Nav } from "./nav";
import { Logo } from "../logo";
import { AuthModal } from "../auth-modal";
import { UpgradeModal } from "../upgrade-modal";

export function Shell({ children }: { children: React.ReactNode }) {
  const [boot, setBoot] = useState(true);
  const navigate = useNavigate();
  const user = useAether((s) => s.user);
  const authChecked = useAether((s) => s.authChecked);
  const profile = useAether((s) => s.activeProfile);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLoginPage = pathname === "/login";
  const isPublicRoute =
    isLoginPage ||
    pathname === "/privacy" ||
    pathname === "/privacy-policy" ||
    pathname === "/terms" ||
    pathname === "/delete-account";
  const cinema = pathname.startsWith("/watch");

  // Only login and compliance pages are accessible without being logged in
  const requiresAuth = !isPublicRoute;

  // Synchronous token verification check
  const hasToken = typeof window !== "undefined" ? Boolean(getToken()) : false;
  const isAuthenticated = Boolean(authChecked && user && hasToken);

  useEffect(() => {
    void useAether.persist.rehydrate();
    // Sync dynamic content catalog & site display settings from backend
    void useAether.getState().fetchCatalog();
    void useAether.getState().fetchDisplaySettings();

    const t = window.setTimeout(() => setBoot(false), 80);
    return () => window.clearTimeout(t);
  }, []);

  // Poll for admin broadcast notifications
  const lastNotifiedAt = useRef<string | null>(null);
  useEffect(() => {
    let isMounted = true;
    const checkNotification = async () => {
      try {
        const notif = await api.getLatestNotification();
        if (!isMounted || !notif || !notif.message) return;
        if (lastNotifiedAt.current === notif.sent_at) return;
        lastNotifiedAt.current = notif.sent_at;

        if (notif.type === "warning") {
          toast.warning(notif.message, { duration: 8000 });
        } else if (notif.type === "success") {
          toast.success(notif.message, { duration: 8000 });
        } else {
          toast.info(notif.message, { duration: 8000 });
        }
      } catch {
        // Ignore network drops
      }
    };

    void checkNotification();
    const interval = window.setInterval(checkNotification, 20000);
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  // Authentication Guard: Redirect whenever not authenticated
  useEffect(() => {
    if (isPublicRoute) return;

    // If client has confirmed no token or session check finished with no user
    if ((!hasToken && !boot) || (authChecked && !user)) {
      void navigate({
        to: "/login",
        search: pathname !== "/" ? ({ redirect: pathname } as any) : undefined,
      });
    }
  }, [isPublicRoute, boot, authChecked, user, hasToken, pathname, navigate]);

  // 1. If currently on login page or standalone public page without authentication
  if (isLoginPage || (isPublicRoute && !isAuthenticated)) {
    return (
      <div className="min-h-svh bg-bg text-fg">
        <main>{children}</main>
      </div>
    );
  }

  // 2. Initial Boot Screen: Block content while verifying session
  if (boot || !authChecked) {
    if (isPublicRoute) {
      return (
        <div className="min-h-svh bg-bg text-fg">
          <main>{children}</main>
        </div>
      );
    }
    return (
      <div className="grid min-h-svh place-items-center bg-bg">
        <div className="stagger-in flex flex-col items-center gap-3">
          <Logo className="pointer-events-none" />
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="size-2 rounded-full bg-accent animate-ping" />
            <span>Checking authentication...</span>
          </div>
        </div>
      </div>
    );
  }

  // 3. If unauthenticated, block content while redirecting to /login
  if (!isAuthenticated) {
    if (isPublicRoute) {
      return (
        <div className="min-h-svh bg-bg text-fg">
          <main>{children}</main>
        </div>
      );
    }
    return (
      <div className="grid min-h-svh place-items-center bg-bg">
        <div className="stagger-in flex flex-col items-center gap-3">
          <Logo className="pointer-events-none" />
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="size-2 rounded-full bg-accent animate-ping" />
            <span>Checking authentication...</span>
          </div>
        </div>
      </div>
    );
  }

  // 3. If unauthenticated, block content while redirecting to /login
  if (!isAuthenticated) {
    return (
      <div className="grid min-h-svh place-items-center bg-bg">
        <div className="stagger-in flex flex-col items-center gap-3">
          <Logo className="pointer-events-none" />
          <p className="text-xs text-muted">Authentication required. Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  // 4. Authenticated profile selection (render picker if user has not selected a profile)
  if (isAuthenticated && !profile) {
    return <ProfilePicker />;
  }

  // 5. Authenticated App Layout
  return (
    <div className="min-h-svh bg-bg text-fg">
      {!cinema ? <Nav /> : null}
      <main className={cinema ? "" : "pb-20 md:pb-12"}>{children}</main>
      {!cinema ? <MobileNav /> : null}
      <AuthModal />
      <UpgradeModal />
    </div>
  );
}
