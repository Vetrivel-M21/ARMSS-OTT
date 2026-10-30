export type SubscriptionTier = "free" | "standard" | "premium" | "banned";

export interface User {
  id: string;
  email: string;
  name: string;
  subscription_tier: SubscriptionTier;
  is_admin?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  avatar_color: string;
  is_kids: boolean;
  pin?: string;
  created_at: string;
}

export interface PlanInfo {
  tier: SubscriptionTier;
  name: string;
  price_monthly: string;
  price_annual: string;
  resolution: string;
  devices: number;
  ad_free: boolean;
  downloads: boolean;
  live_sports: boolean;
  originals: boolean;
}

export interface PlaybackTicketResponse {
  allowed: boolean;
  title_id?: string;
  user_tier?: SubscriptionTier;
  max_resolution?: string;
  ad_free?: boolean;
  ticket?: string;
  error?: string;
  required_tier?: SubscriptionTier;
  message?: string;
  manifest_url?: string;
}

export interface SubscriptionCheckoutResponse {
  subscription_id?: string;
  order_id?: string;
  payment_session_id?: string;
  key_id?: string;
  plan_id: string;
  plan_name: string;
  amount_inr: number;
  currency: string;
  user_email: string;
  user_name: string;
  gateway?: string;
  environment?: string;
}

export interface VerifySubscriptionRequest {
  plan_id: string;
  gateway?: string;
  cashfree_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_subscription_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

export interface AnalyticsOverview {
  total_users: number;
  free_count: number;
  standard_count: number;
  premium_count: number;
  admin_count: number;
  banned_count: number;
  dau_today: number;
  wau_7d: number;
  mau_30d: number;
  total_watch_hours: number;
  avg_session_minutes: number;
  completion_rate_percent: number;
  total_titles: number;
  film_count: number;
  series_count: number;
  live_count: number;
  revenue_estimate_inr: number;
  new_signups_30d: number;
  timestamp: string;
}

export interface DailyActiveTrend {
  date: string;
  label: string;
  active_users: number;
  logins: number;
  watch_hours: number;
}

export interface TopWatchedTitle {
  title_id: string;
  title: string;
  poster: string;
  kind: string;
  total_watch_hours: number;
  viewer_count: number;
  completion_rate: number;
}

export interface UserAnalyticsItem {
  id: string;
  name: string;
  email: string;
  subscription_tier: SubscriptionTier;
  is_admin: boolean;
  created_at: string;
  last_login_at?: string;
  last_active_at?: string;
  total_watch_seconds: number;
  titles_watched_count: number;
  completion_rate: number;
}

export interface UserWatchedTitleDetail {
  title_id: string;
  title: string;
  poster: string;
  kind: string;
  episode_id?: string;
  progress_percent: number;
  time_seconds: number;
  updated_at: string;
}

export interface UserActivityLog {
  id: string;
  user_id: string;
  action: string;
  details?: string;
  created_at: string;
}

export interface UserRating {
  user_id: string;
  title_id: string;
  score: number;
  updated_at: string;
}

export interface UserDetailResponse {
  user: User;
  total_watch_seconds: number;
  titles_watched_count: number;
  completion_rate: number;
  watched_titles: UserWatchedTitleDetail[];
  activity_logs: UserActivityLog[];
  watchlist_titles: string[];
  ratings: UserRating[];
}

export interface HistoryItem {
  title_id: string;
  title: string;
  poster: string;
  backdrop: string;
  kind: string;
  runtime_min: number;
  episode_id?: string;
  progress_percent: number;
  time_seconds: number;
  updated_at: string;
}

export type NavVisibility = {
  films: boolean;
  series: boolean;
  live: boolean;
  myList: boolean;
  comingSoon: boolean;
  plans: boolean;
};

export type RowOrderConfig = {
  id: string;
  label: string;
  visible: boolean;
};

export type HomeLayoutSettings = {
  heroTitleId: string;
  heroHeight: "full" | "standard" | "compact";
  heroAlignment: "left" | "center";
  containerWidth: "fluid" | "constrained";
  rowOrder: RowOrderConfig[];
};

export type SiteDisplaySettings = {
  navVisibility: NavVisibility;
  homeLayout: HomeLayoutSettings;
};

function getApiBase(): string {
  // In the browser, always use relative "/api" so requests go to the same origin
  // and are proxied by Vite in dev (or nginx in prod), preventing CORS or host mismatches.
  if (typeof window !== "undefined") {
    const custom = import.meta?.env?.VITE_API_BASE_URL;
    if (custom && custom.startsWith("/")) {
      return custom;
    }
    return "/api";
  }
  // In SSR (Node.js runtime), read INTERNAL_API_URL at call-time (not module load-time)
  // so Docker runtime env vars are used instead of being baked in as undefined at build time.
  return process.env["INTERNAL_API_URL"] || "http://backend:8090/api";
}

// NOTE: Do NOT cache as a module-level constant — SSR must read env at request time.
// The function is lightweight enough to call per-request.
const API_BASE = getApiBase;

export function getToken(): string | null {
  if (typeof window === "undefined") return null;

  // Check URL query parameters for mobile session transfer link (?token=... or ?session_token=...)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get("token") || urlParams.get("session_token") || urlParams.get("auth_token");
    if (urlToken && urlToken.trim().length > 10) {
      localStorage.setItem("armss_ott_token", urlToken.trim());
      // Sanitize URL immediately to avoid leaking session tokens in browser history
      urlParams.delete("token");
      urlParams.delete("session_token");
      urlParams.delete("auth_token");
      const remainingQuery = urlParams.toString();
      const sanitizedUrl = window.location.pathname + (remainingQuery ? `?${remainingQuery}` : "") + window.location.hash;
      window.history.replaceState({}, document.title, sanitizedUrl);
      return urlToken.trim();
    }
  } catch (_) {}

  return localStorage.getItem("armss_ott_token");
}

export function setToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("armss_ott_token", token);
  }
}

export function clearToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("armss_ott_token");
  }
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const base = API_BASE();
  try {
    const res = await fetch(`${base}${endpoint}`, {
      ...options,
      headers,
    });
    return res;
  } catch (err) {
    console.warn(`[ARMSS-OTT API] Failed to connect to ${base}${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // Auth
  async login(identifier: string, password: string): Promise<{ token: string; user: User; profiles: Profile[] }> {
    const res = await fetchWithAuth("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, email: identifier, password }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Login failed");
    }
    const data = await res.json();
    setToken(data.token);
    return data;
  },

  async register(email: string, password: string, name: string): Promise<{ token: string; user: User; profiles: Profile[] }> {
    const res = await fetchWithAuth("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Registration failed");
    }
    const data = await res.json();
    setToken(data.token);
    return data;
  },

  async requestPasswordReset(identifier: string): Promise<{ success: boolean; message: string }> {
    const res = await fetchWithAuth("/auth/forgot-password/request", {
      method: "POST",
      body: JSON.stringify({ email: identifier }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to request password reset code");
    }
    return res.json();
  },

  async resetPasswordWithOtp(identifier: string, otp: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const res = await fetchWithAuth("/auth/forgot-password/reset", {
      method: "POST",
      body: JSON.stringify({ email: identifier, otp, new_password: newPassword }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "OTP verification or password reset failed");
    }
    return res.json();
  },

  async loginWithGoogle(data: { email: string; name?: string; credential?: string; avatar?: string }): Promise<{ token: string; user: User; profiles: Profile[] }> {
    const res = await fetchWithAuth("/auth/google", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Google sign-in failed");
    }
    const json = await res.json();
    setToken(json.token);
    return json;
  },

  async getMe(): Promise<{ user: User; profiles: Profile[] } | null> {
    const token = getToken();
    if (!token) return null;
    try {
      const res = await fetchWithAuth("/auth/me");
      if (!res.ok) {
        clearToken();
        return null;
      }
      return await res.json();
    } catch {
      return null;
    }
  },

  // Subscription Plans
  async getPlans(): Promise<PlanInfo[]> {
    try {
      const res = await fetchWithAuth("/subscription/plans");
      if (!res.ok) return [];
      const data = await res.json();
      return data.plans || [];
    } catch {
      return [];
    }
  },

  // Public Catalog
  async getTitles(): Promise<any[]> {
    try {
      const res = await fetchWithAuth("/titles");
      if (!res.ok) return [];
      const data = await res.json();
      return data.titles || [];
    } catch {
      return [];
    }
  },

  async upgradeTier(tier: "standard" | "premium"): Promise<{ user: User; token: string }> {
    const res = await fetchWithAuth("/subscription/upgrade", {
      method: "POST",
      body: JSON.stringify({ tier }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to upgrade subscription");
    }
    const data = await res.json();
    if (data.token) setToken(data.token);
    return data;
  },

  async cancelTier(): Promise<{ user: User; token: string }> {
    const res = await fetchWithAuth("/subscription/cancel", {
      method: "POST",
    });
    if (!res.ok) {
      throw new Error("Failed to cancel subscription");
    }
    const data = await res.json();
    if (data.token) setToken(data.token);
    return data;
  },

  async createSubscriptionCheckout(plan_id: "standard" | "premium"): Promise<SubscriptionCheckoutResponse> {
    const res = await fetchWithAuth("/subscription/checkout", {
      method: "POST",
      body: JSON.stringify({ plan_id }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to initiate subscription checkout");
    }
    return res.json();
  },

  async verifySubscriptionPayment(payload: VerifySubscriptionRequest): Promise<{ user: User; token: string }> {
    const res = await fetchWithAuth("/subscription/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Payment verification failed");
    }
    const data = await res.json();
    if (data.token) setToken(data.token);
    return data;
  },

  // Playback Entitlement Ticket
  async checkPlaybackTicket(titleId: string): Promise<PlaybackTicketResponse> {
    try {
      const res = await fetchWithAuth(`/titles/${titleId}/playback-ticket`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status === 403) {
        return {
          allowed: false,
          error: data.error || "tier_upgrade_required",
          message: data.message || "Upgrade your subscription to continue watching.",
          required_tier: data.required_tier,
        };
      }
      return {
        allowed: true,
        ...data,
      };
    } catch {
      // Fallback allowed for offline demo mode
      return { allowed: true, max_resolution: "1080p", ad_free: true };
    }
  },

  // Playback Stream Ticket (/videos/:id/playback)
  async getPlayback(
    videoId: string,
    clientType = "web",
    deviceId?: string,
  ): Promise<{
    manifestUrl: string;
    maxHeight: number;
    resumePositionSec: number;
  }> {
    const headers: Record<string, string> = {
      "X-Client-Type": clientType,
    };
    if (deviceId) {
      headers["X-Device-ID"] = deviceId;
    }
    const res = await fetchWithAuth(`/videos/${videoId}/playback`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Playback request failed (${res.status})`);
    }
    return await res.json();
  },

  // Save Watch Progress (/videos/:id/progress)
  async saveWatchProgress(
    videoId: string,
    timeSeconds: number,
    progressPercent: number,
    profileId?: string,
    deviceId?: string,
  ): Promise<void> {
    try {
      await fetchWithAuth(`/videos/${videoId}/progress`, {
        method: "POST",
        body: JSON.stringify({
          time_seconds: timeSeconds,
          progress_percent: progressPercent,
          profile_id: profileId,
          device_id: deviceId,
        }),
      });
    } catch {
      // Non-blocking sync
    }
  },

  // Stream Concurrency Heartbeat (/videos/:id/heartbeat)
  async sendStreamHeartbeat(
    videoId: string,
    sessionId?: string,
    deviceId?: string,
  ): Promise<{ session_id?: string }> {
    try {
      const res = await fetchWithAuth(`/videos/${videoId}/heartbeat`, {
        method: "POST",
        body: JSON.stringify({ session_id: sessionId, device_id: deviceId }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Non-blocking heartbeat
    }
    return {};
  },

  // Public Platform Broadcast Notification
  async getLatestNotification(): Promise<{ message: string; type: "info" | "warning" | "success"; sent_at: string } | null> {
    try {
      const res = await fetchWithAuth("/notifications/latest");
      if (!res.ok) return null;
      const data = await res.json();
      return data.notification || null;
    } catch {
      return null;
    }
  },

  // Sync: Watchlist
  async getWatchlist(profileId: string = "default"): Promise<string[]> {
    try {
      const res = await fetchWithAuth(`/watchlist?profile_id=${profileId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.title_ids || [];
    } catch {
      return [];
    }
  },

  async toggleWatchlist(titleId: string, profileId: string = "default"): Promise<boolean> {
    try {
      const res = await fetchWithAuth("/watchlist/toggle", {
        method: "POST",
        body: JSON.stringify({ title_id: titleId, profile_id: profileId }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      return data.in_list;
    } catch {
      return false;
    }
  },

  // Sync: Watch Progress Heartbeat
  async sendProgressHeartbeat(titleId: string, progressPercent: number, timeSeconds: number, episodeId?: string, profileId: string = "default") {
    try {
      await fetchWithAuth("/progress/heartbeat", {
        method: "POST",
        body: JSON.stringify({
          title_id: titleId,
          episode_id: episodeId,
          progress_percent: progressPercent,
          time_seconds: timeSeconds,
          profile_id: profileId,
        }),
      });
    } catch {
      // Ignore heartbeat network drops
    }
  },

  async setRating(titleId: string, score: 1 | -1 | 0) {
    try {
      await fetchWithAuth("/ratings", {
        method: "POST",
        body: JSON.stringify({ title_id: titleId, score }),
      });
    } catch {
      // Ignore
    }
  },

  // Watch History
  async getHistory(profileId: string = "default"): Promise<HistoryItem[]> {
    try {
      const res = await fetchWithAuth(`/history?profile_id=${profileId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.items || [];
    } catch {
      return [];
    }
  },

  async deleteHistoryItem(titleId: string): Promise<boolean> {
    try {
      const res = await fetchWithAuth(`/history/${titleId}`, {
        method: "DELETE",
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async clearHistory(): Promise<boolean> {
    try {
      const res = await fetchWithAuth("/history", {
        method: "DELETE",
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // Display & Layout Settings (Public GET)
  async getSiteDisplaySettings(): Promise<SiteDisplaySettings | null> {
    try {
      const res = await fetch(`${API_BASE()}/settings/layout`);
      if (!res.ok) return null;
      const data = await res.json();
      return (data.settings as SiteDisplaySettings) || null;
    } catch {
      return null;
    }
  },

  // Public Title & Episodes (GET)
  async getTitle(id: string): Promise<any | null> {
    try {
      const res = await fetch(`${API_BASE()}/titles/${id}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async getEpisodes(titleId: string): Promise<any[]> {
    try {
      const res = await fetch(`${API_BASE()}/titles/${titleId}/episodes`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.episodes || [];
    } catch {
      return [];
    }
  },

  // Admin API
  admin: {
    async getUserDetails(userId: string): Promise<UserDetailResponse | null> {
      try {
        const res = await fetchWithAuth(`/admin/users/${userId}/details`);
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    },

    async getUsers(search?: string, tier?: string): Promise<{ users: User[]; count: number }> {
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (tier) params.set("tier", tier);
        const res = await fetchWithAuth(`/admin/users?${params.toString()}`);
        if (!res.ok) return { users: [], count: 0 };
        return await res.json();
      } catch {
        return { users: [], count: 0 };
      }
    },

    async updateUserTier(userId: string, tier: SubscriptionTier): Promise<boolean> {
      try {
        const res = await fetchWithAuth(`/admin/users/${userId}/subscription`, {
          method: "PUT",
          body: JSON.stringify({ tier }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },

    async banUser(userId: string, banned: boolean): Promise<boolean> {
      try {
        const res = await fetchWithAuth(`/admin/users/${userId}/ban`, {
          method: "PUT",
          body: JSON.stringify({ banned }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },

    async deleteUser(userId: string): Promise<boolean> {
      try {
        const res = await fetchWithAuth(`/admin/users/${userId}`, {
          method: "DELETE",
        });
        return res.ok;
      } catch {
        return false;
      }
    },

    async getTitles(): Promise<{ titles: any[]; count: number }> {
      try {
        const res = await fetchWithAuth("/admin/titles");
        if (!res.ok) return { titles: [], count: 0 };
        return await res.json();
      } catch {
        return { titles: [], count: 0 };
      }
    },

    async updateTitle(titleId: string, data: Record<string, any>): Promise<boolean> {
      try {
        const res = await fetchWithAuth(`/admin/titles/${titleId}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
        return res.ok;
      } catch {
        return false;
      }
    },

    async createTitle(data: any): Promise<boolean> {
      try {
        const res = await fetchWithAuth("/admin/titles", {
          method: "POST",
          body: JSON.stringify(data),
        });
        return res.ok;
      } catch {
        return false;
      }
    },

    async deleteTitle(titleId: string): Promise<boolean> {
      try {
        const res = await fetchWithAuth(`/admin/titles/${titleId}`, {
          method: "DELETE",
        });
        return res.ok;
      } catch {
        return false;
      }
    },

    async getEpisodes(titleId: string): Promise<any[]> {
      try {
        const res = await fetchWithAuth(`/admin/titles/${titleId}/episodes`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.episodes || [];
      } catch {
        return [];
      }
    },

    async createEpisode(titleId: string, data: any): Promise<boolean> {
      try {
        const res = await fetchWithAuth(`/admin/titles/${titleId}/episodes`, {
          method: "POST",
          body: JSON.stringify(data),
        });
        return res.ok;
      } catch {
        return false;
      }
    },

    async updateEpisode(episodeId: string, data: any): Promise<boolean> {
      try {
        const res = await fetchWithAuth(`/admin/episodes/${episodeId}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
        return res.ok;
      } catch {
        return false;
      }
    },

    async deleteEpisode(episodeId: string): Promise<boolean> {
      try {
        const res = await fetchWithAuth(`/admin/episodes/${episodeId}`, {
          method: "DELETE",
        });
        return res.ok;
      } catch {
        return false;
      }
    },

    async getAnalytics(): Promise<Record<string, number>> {
      try {
        const res = await fetchWithAuth("/admin/analytics");
        if (!res.ok) return {};
        return await res.json();
      } catch {
        return {};
      }
    },

    async getAnalyticsOverview(): Promise<AnalyticsOverview | null> {
      try {
        const res = await fetchWithAuth("/admin/analytics/overview");
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    },

    async getDailyTrends(days: number = 14): Promise<DailyActiveTrend[]> {
      try {
        const res = await fetchWithAuth(`/admin/analytics/daily-trends?days=${days}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.trends || [];
      } catch {
        return [];
      }
    },

    async getTopWatchedTitles(): Promise<TopWatchedTitle[]> {
      try {
        const res = await fetchWithAuth("/admin/analytics/top-titles");
        if (!res.ok) return [];
        const data = await res.json();
        return data.titles || [];
      } catch {
        return [];
      }
    },

    async getUserAnalytics(search?: string, tier?: string): Promise<{ users: UserAnalyticsItem[]; count: number }> {
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (tier) params.set("tier", tier);
        const res = await fetchWithAuth(`/admin/analytics/users?${params.toString()}`);
        if (!res.ok) return { users: [], count: 0 };
        return await res.json();
      } catch {
        return { users: [], count: 0 };
      }
    },

    async broadcast(message: string, type: "info" | "warning" | "success" = "info"): Promise<boolean> {
      try {
        const res = await fetchWithAuth("/admin/notifications", {
          method: "POST",
          body: JSON.stringify({ message, type }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },

    async clearBroadcast(): Promise<boolean> {
      try {
        const res = await fetchWithAuth("/admin/notifications", {
          method: "DELETE",
        });
        return res.ok;
      } catch {
        return false;
      }
    },

    async upload(file: File): Promise<{ success: boolean; url: string; name?: string }> {
      const formData = new FormData();
      formData.append("file", file);
      const token = getToken();
      const res = await fetch(`${API_BASE()}/admin/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Upload failed (HTTP ${res.status}: ${res.statusText})`);
      }
      return await res.json();
    },

    async updateSiteDisplaySettings(settings: SiteDisplaySettings): Promise<boolean> {
      try {
        const res = await fetchWithAuth("/admin/settings/layout", {
          method: "PUT",
          body: JSON.stringify(settings),
        });
        return res.ok;
      } catch {
        return false;
      }
    },

    async resetSiteDisplaySettings(): Promise<boolean> {
      try {
        const res = await fetchWithAuth("/admin/settings/layout", {
          method: "DELETE",
        });
        return res.ok;
      } catch {
        return false;
      }
    },

    async getPlans(): Promise<AdminPlan[]> {
      try {
        const res = await fetchWithAuth("/admin/plans");
        if (!res.ok) return [];
        const data = await res.json();
        return data.plans || [];
      } catch {
        return [];
      }
    },

    async updatePlan(id: string, plan: Partial<AdminPlan>): Promise<boolean> {
      try {
        const res = await fetchWithAuth(`/admin/plans/${id}`, {
          method: "PUT",
          body: JSON.stringify(plan),
        });
        return res.ok;
      } catch {
        return false;
      }
    },

    async getTitleAccess(id: string): Promise<TitleAccessInfo | null> {
      try {
        const res = await fetchWithAuth(`/admin/titles/${id}/access`);
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    },

    async updateTitleAccess(id: string, access: { required_tier: string; free_episodes: number }): Promise<boolean> {
      try {
        const res = await fetchWithAuth(`/admin/titles/${id}/access`, {
          method: "PUT",
          body: JSON.stringify(access),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  },

  async getPublicPlans(): Promise<AdminPlan[]> {
    try {
      const res = await fetch(`${API_BASE()}/plans`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.plans || [];
    } catch {
      return [];
    }
  },
};

export interface AdminPlan {
  id: string;
  name: string;
  price_inr: number;
  billing_period: string;
  daily_movie_limit: number;
  daily_episode_limit: number;
  max_quality: number;
  max_devices: number;
  razorpay_plan_id: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TitleAccessInfo {
  id: string;
  title: string;
  kind: string;
  required_tier: string;
  free_episodes: number;
}


