import { api, type User } from "@/lib/api";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
            error_callback?: (error: any) => void;
          }) => {
            requestAccessToken: () => void;
          };
        };
        id: {
          initialize: (config: any) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          prompt: (notification?: (n: any) => void) => void;
          cancel: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

const STORAGE_KEY = "armss_google_client_id";

/**
 * Returns the active Google OAuth Client ID, checking environment variable first,
 * then falling back to user-configured localStorage override.
 */
export function getGoogleClientId(): string {
  const envId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (envId && envId.trim()) {
    return envId.trim();
  }
  if (typeof window !== "undefined") {
    return localStorage.getItem(STORAGE_KEY) || "";
  }
  return "";
}

/**
 * Allows setting or updating the Google OAuth Client ID at runtime.
 */
export function saveGoogleClientId(clientId: string) {
  if (typeof window !== "undefined") {
    const clean = clientId.trim();
    if (clean) {
      localStorage.setItem(STORAGE_KEY, clean);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

/**
 * Waits for the Google Identity Services SDK to be fully loaded.
 * Retries up to 20 times with 250ms intervals (5 seconds total).
 */
function waitForGoogleSdk(maxWaitMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.google?.accounts?.oauth2) {
      resolve(true);
      return;
    }
    const interval = 250;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += interval;
      if (window.google?.accounts?.oauth2) {
        clearInterval(timer);
        resolve(true);
      } else if (elapsed >= maxWaitMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, interval);
  });
}

/**
 * Initiates Google Sign-In using the OAuth2 Token flow (popup).
 * Falls back with a clear error if the SDK is blocked or the popup fails.
 */
export async function startGoogleSignIn(options: {
  onSuccess: (user: User) => void;
  onError: (errMsg: string) => void;
  onClientIdRequired: () => void;
}) {
  const clientId = getGoogleClientId();
  if (!clientId) {
    options.onClientIdRequired();
    return;
  }

  // Wait for the Google GIS SDK to load
  const sdkReady = await waitForGoogleSdk(5000);
  if (!sdkReady || !window.google?.accounts?.oauth2) {
    options.onError(
      "Google Sign-In SDK failed to load. This may be caused by an ad-blocker or network issue. " +
      "Please disable any ad-blockers and refresh the page, then try again."
    );
    return;
  }

  try {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "openid email profile",
      callback: async (tokenResponse) => {
        if (tokenResponse.error) {
          if (tokenResponse.error === "access_denied") {
            options.onError("Google Sign-In was cancelled. Please try again.");
          } else if (tokenResponse.error === "popup_closed_by_user") {
            options.onError("Google popup was closed. Please try again.");
          } else if (tokenResponse.error === "popup_blocked_by_browser") {
            options.onError(
              "Google Sign-In popup was blocked by your browser. " +
              "Please allow popups for this site in your browser settings."
            );
          } else {
            options.onError(
              `Google sign-in failed: ${tokenResponse.error}. ` +
              "Make sure this site's URL is added as an Authorized JavaScript Origin in your Google Cloud Console."
            );
          }
          return;
        }

        if (!tokenResponse.access_token) {
          options.onError("No access token received from Google. Please try again.");
          return;
        }

        try {
          // Fetch authenticated Google User Profile from Google APIs
          const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: {
              Authorization: `Bearer ${tokenResponse.access_token}`,
            },
          });

          if (!profileRes.ok) {
            throw new Error(
              `Failed to fetch Google profile (HTTP ${profileRes.status}). Please try again.`
            );
          }

          const googleUser = await profileRes.json();
          if (!googleUser.email) {
            throw new Error(
              "No verified email found in this Google Account. " +
              "Please use an account with a verified email address."
            );
          }

          // Exchange Google Profile with ARMSS backend
          const res = await api.loginWithGoogle({
            email: googleUser.email,
            name: googleUser.name || googleUser.given_name || googleUser.email.split("@")[0],
            avatar: googleUser.picture || "",
            credential: tokenResponse.access_token,
          });

          options.onSuccess(res.user);
        } catch (err: any) {
          options.onError(
            err.message || "Failed to complete sign-in with ARMSS backend. Please try again."
          );
        }
      },
      error_callback: (err: any) => {
        const code = err?.type || err?.message || "";
        if (code === "popup_closed") {
          options.onError("Google popup was closed. Click the button again to sign in.");
        } else if (code === "popup_failed_to_open") {
          options.onError(
            "Google Sign-In popup was blocked. Please allow popups for this site."
          );
        } else {
          options.onError(
            err?.message || "Google Sign-In encountered an error. Please try again."
          );
        }
      },
    });

    tokenClient.requestAccessToken();
  } catch (err: any) {
    options.onError(
      err.message ||
      "Failed to initialize Google Sign-In. " +
      "Ensure the Client ID is correct and this origin is whitelisted in Google Cloud Console."
    );
  }
}
