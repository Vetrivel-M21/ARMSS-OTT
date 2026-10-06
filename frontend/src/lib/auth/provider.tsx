import { useEffect, type ReactNode } from "react";
import { api, getToken } from "@/lib/api";
import { useAether } from "@/lib/store";

/**
 * App-wide authentication provider mounted near root.
 * Validates active session token against Go backend on initial load / refresh,
 * keeping auth state and user entitlement perfectly synchronized.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const setUser = useAether((s) => s.setUser);
  const logout = useAether((s) => s.logout);
  const setAuthChecked = useAether((s) => s.setAuthChecked);

  useEffect(() => {
    void useAether.persist.rehydrate();
    const token = getToken();
    if (!token) {
      setUser(null);
      setAuthChecked(true);
      return;
    }

    let isMounted = true;
    api
      .getMe()
      .then((data) => {
        if (!isMounted) return;
        if (data && data.user) {
          setUser(data.user);
        } else {
          logout();
        }
      })
      .catch(() => {
        if (isMounted) {
          logout();
        }
      })
      .finally(() => {
        if (isMounted) setAuthChecked(true);
      });

    return () => {
      isMounted = false;
    };
  }, [setUser, logout, setAuthChecked]);

  return <>{children}</>;
}
