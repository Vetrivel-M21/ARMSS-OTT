import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  CalendarClock,
  Crown,
  Home,
  LayoutDashboard,
  ListVideo,
  LogIn,
  LogOut,
  Search,
  Sparkles,
  Tv2,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { comingSoon } from "@/lib/catalog";
import { useAether } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Logo } from "../logo";

function NavLink({
  to,
  pathname,
  children,
  exact,
  match,
  params,
}: {
  to: "/" | "/live" | "/my-list" | "/history" | "/browse/$genre" | "/coming-soon" | "/plans";
  pathname: string;
  children: React.ReactNode;
  exact?: boolean;
  match?: string;
  params?: { genre: string };
}) {
  const href = match ?? to;
  const active = exact
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      to={to}
      params={params}
      className={cn(
        "text-sm transition-colors duration-150",
        active ? "text-fg" : "text-muted hover:text-fg",
      )}
    >
      {children}
    </Link>
  );
}

export function Nav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [scrolled, setScrolled] = useState(false);
  const profile = useAether((s) => s.activeProfile);
  const user = useAether((s) => s.user);
  const reminders = useAether((s) => s.reminders);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const homeish = pathname === "/";

  const displaySettings = useAether((s) => s.displaySettings);
  const navVis = displaySettings?.navVisibility ?? {
    films: true,
    series: true,
    live: true,
    myList: true,
    comingSoon: true,
    plans: true,
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-[background-color,backdrop-filter] duration-300",
        scrolled || !homeish
          ? "bg-bg/92 backdrop-blur-md"
          : "bg-gradient-to-b from-bg/80 to-transparent",
      )}
    >
      <div className="flex h-16 items-center gap-4 px-4 sm:h-[4.25rem] sm:px-8">
        <Logo />
        <nav className="ml-4 hidden items-center gap-5 md:flex">
          <NavLink to="/" pathname={pathname} exact>
            Home
          </NavLink>
          {navVis.films && (
            <NavLink
              to="/browse/$genre"
              params={{ genre: "films" }}
              pathname={pathname}
              match="/browse/films"
            >
              Films
            </NavLink>
          )}
          {navVis.series && (
            <NavLink
              to="/browse/$genre"
              params={{ genre: "series" }}
              pathname={pathname}
              match="/browse/series"
            >
              Series
            </NavLink>
          )}
          {navVis.live && profile !== "kids" ? (
            <NavLink to="/live" pathname={pathname}>
              Live
            </NavLink>
          ) : null}
          {navVis.myList && (
            <NavLink to="/my-list" pathname={pathname}>
              My List
            </NavLink>
          )}
          {user && (
            <NavLink to="/history" pathname={pathname}>
              History
            </NavLink>
          )}
          {navVis.comingSoon && (
            <NavLink to="/coming-soon" pathname={pathname}>
              Coming soon
            </NavLink>
          )}
          {navVis.plans && (
            <NavLink to="/plans" pathname={pathname}>
              Plans
            </NavLink>
          )}
          {user?.is_admin && (
            <Link
              to="/admin"
              className={cn(
                "flex items-center gap-1.5 text-sm transition-colors duration-150",
                pathname === "/admin" ? "text-accent" : "text-muted hover:text-accent",
              )}
            >
              <LayoutDashboard className="size-3.5" />
              Admin
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {/* User Tier Indicator or Sign In button */}
          <NavUserActions />

          <Link
            to="/search"
            aria-label="Search"
            className="grid size-11 place-items-center rounded-md text-fg hover:bg-fg/8"
          >
            <Search className="size-5" />
          </Link>
          <Reminders count={reminders.length} />
          <ProfileMenu profile={profile} />
        </div>
      </div>
    </header>
  );
}

function NavUserActions() {
  const user = useAether((s) => s.user);
  const setAuthModalOpen = useAether((s) => s.setAuthModalOpen);
  const setUpgradeModalOpen = useAether((s) => s.setUpgradeModalOpen);

  if (!user) {
    return null;
  }

  if (user.subscription_tier === "premium") {
    return (
      <Link
        to="/plans"
        className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-amber-600/10 px-3 py-1 text-xs font-bold text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-all shadow-sm shadow-amber-500/5"
      >
        <Crown className="size-3.5" />
        VIP 4K
      </Link>
    );
  }

  if (user.subscription_tier === "standard") {
    return (
      <Link
        to="/plans"
        className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 px-3 py-1 text-xs font-bold text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 transition-all"
      >
        1080p HD
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setUpgradeModalOpen(true)}
      className="hidden sm:inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-fg hover:opacity-90 transition-opacity shadow-sm"
    >
      <Sparkles className="size-3" />
      Upgrade VIP
    </button>
  );
}

function Reminders({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const reminders = useAether((s) => s.reminders);
  const coming = comingSoon().filter((t) => reminders.includes(t.id));
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative hidden sm:block">
      <button
        type="button"
        aria-label="Reminders"
        onClick={() => setOpen((v) => !v)}
        className="relative grid size-11 place-items-center rounded-md text-fg hover:bg-fg/8"
      >
        <Bell className="size-5" />
        {count > 0 ? (
          <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-live" />
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-12 w-72 overflow-hidden rounded-lg bg-elevated p-3 shadow-[var(--shadow-border)]">
          <p className="px-1 text-xs font-medium uppercase tracking-[0.18em] text-muted">
            Coming up
          </p>
          {coming.length === 0 ? (
            <p className="mt-3 px-1 text-sm text-muted">
              Reminders you set will live here.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {coming.map((t) => (
                <li key={t.id}>
                  <Link
                    to="/title/$id"
                    params={{ id: t.id }}
                    onClick={() => setOpen(false)}
                    className="block rounded-md px-2 py-2 hover:bg-fg/6"
                  >
                    <p className="text-sm text-fg">{t.title}</p>
                    <p className="text-xs text-muted">{t.comingSoon?.label}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/coming-soon"
            onClick={() => setOpen(false)}
            className="mt-2 block px-2 py-2 text-sm text-muted hover:text-fg"
          >
            All coming soon
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function ProfileMenu({ profile }: { profile: "arjun" | "kids" | null }) {
  const [open, setOpen] = useState(false);
  const setProfile = useAether((s) => s.setProfile);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const user = useAether((s) => s.user);
  const logout = useAether((s) => s.logout);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // If user is not signed in, show simple Sign In link
  if (!user) {
    return (
      <Link
        to="/login"
        className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg hover:opacity-90 transition-opacity shadow-sm"
      >
        <LogIn className="size-3.5" />
        Sign In
      </Link>
    );
  }

  // Authenticated user profile
  const isKids = profile === "kids";
  const userName = user.name?.trim() || "User";
  const userInitial = userName.charAt(0).toUpperCase();
  const activeName = isKids ? "Kids" : userName;
  const activeLetter = isKids ? "K" : userInitial;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-label="Profiles"
        onClick={() => setOpen((v) => !v)}
        className="flex size-11 items-center justify-center"
      >
        <span
          className={cn(
            "grid size-8 place-items-center rounded-md text-xs font-bold shadow-sm transition-transform hover:scale-105",
            isKids
              ? "bg-tone-moss text-fg"
              : "bg-gradient-to-br from-accent to-red-600 text-white",
          )}
        >
          {activeLetter}
        </span>
      </button>
      {open ? (
        <div className="absolute right-0 top-12 w-60 overflow-hidden rounded-lg bg-elevated py-2 shadow-[var(--shadow-border)] divide-y divide-border">
          <div className="px-3 pb-2 pt-1">
            <p className="text-xs text-muted">Watching as <strong className="text-fg">{activeName}</strong></p>
            <p className="mt-0.5 text-[11px] text-muted truncate">
              {user.email} · <span className="text-amber-400 font-semibold uppercase">{user.subscription_tier}</span>
            </p>
          </div>

          <div className="py-1">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-fg/6"
              onClick={() => {
                setProfile(isKids ? "arjun" : "kids");
                setOpen(false);
                void navigate({ to: "/" });
              }}
            >
              Switch to {isKids ? userName : "Kids"}
            </button>
            <Link
              to="/plans"
              onClick={() => setOpen(false)}
              className="flex w-full items-center px-3 py-2 text-sm text-muted hover:bg-fg/6 hover:text-fg"
            >
              Subscription Plans
            </Link>
            <Link
              to="/history"
              onClick={() => setOpen(false)}
              className="flex w-full items-center px-3 py-2 text-sm text-muted hover:bg-fg/6 hover:text-fg"
            >
              Watch History
            </Link>
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex w-full items-center px-3 py-2 text-sm text-muted hover:bg-fg/6 hover:text-fg"
            >
              Settings
            </Link>
            <Link
              to="/downloads"
              onClick={() => setOpen(false)}
              className="flex w-full items-center px-3 py-2 text-sm text-muted hover:bg-fg/6 hover:text-fg"
            >
              Downloads
            </Link>
            <button
              type="button"
              className="flex w-full items-center px-3 py-2 text-left text-sm text-muted hover:bg-fg/6 hover:text-fg"
              onClick={() => {
                setProfile(null);
                setOpen(false);
              }}
            >
              Who's watching
            </button>
          </div>

          <div className="pt-1">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-live hover:bg-fg/6 cursor-pointer font-medium"
              onClick={() => {
                logout();
                setOpen(false);
                toast.success("Signed out successfully");
                void navigate({ to: "/login" });
              }}
            >
              <LogOut className="size-4" />
              Sign Out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type MobileNavItem = {
  to: "/" | "/live" | "/search" | "/my-list" | "/coming-soon";
  label: string;
  icon: React.ElementType;
};

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const profile = useAether((s) => s.activeProfile);
  const displaySettings = useAether((s) => s.displaySettings);
  const navVis = displaySettings?.navVisibility ?? {
    films: true,
    series: true,
    live: true,
    myList: true,
    comingSoon: true,
    plans: true,
  };

  const allItems: MobileNavItem[] = [
    { to: "/", label: "Home", icon: Home },
    ...(navVis.live ? [{ to: "/live" as const, label: "Live", icon: Tv2 }] : []),
    { to: "/search", label: "Search", icon: Search },
    ...(navVis.myList ? [{ to: "/my-list" as const, label: "List", icon: ListVideo }] : []),
    ...(navVis.comingSoon ? [{ to: "/coming-soon" as const, label: "Soon", icon: CalendarClock }] : []),
  ];

  const items = allItems.filter((item) =>
    profile === "kids" ? item.to !== "/live" : true,
  );

  const colCount = Math.max(1, items.length);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/94 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
      <ul
        className="grid"
        style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}
      >
        {items.map((item) => {
          const active =
            item.to === "/"
              ? pathname === "/"
              : pathname === item.to ||
                pathname.startsWith(`${item.to}/`);
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[10px]",
                  active ? "text-fg" : "text-muted",
                )}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
