// Cashfree Checkout integration helper for ARMSS-OTT (Cashfree JS SDK v3)

export interface CashfreeCheckoutOptions {
  paymentSessionId: string;
  environment?: "SANDBOX" | "PRODUCTION" | string;
  onSuccess?: (orderId: string) => void;
  onFailure?: (error: any) => void;
}

declare global {
  interface Window {
    Cashfree?: (config: { mode: "sandbox" | "production" }) => {
      checkout: (options: {
        paymentSessionId: string;
        redirectTarget?: "_modal" | "_self" | "_blank";
      }) => Promise<{
        error?: { message: string; code: string };
        redirect?: boolean;
        paymentDetails?: any;
      }>;
    };
  }
}

/**
 * Dynamically loads the official Cashfree JS SDK script
 */
export function loadCashfreeScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    if (window.Cashfree) {
      resolve(true);
      return;
    }

    const scriptSrc = "https://sdk.cashfree.com/js/v3/cashfree.js";
    const existingScript = document.querySelector(`script[src="${scriptSrc}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true));
      existingScript.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = scriptSrc;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

/**
 * Launches the Cashfree modal checkout flow
 */
export async function launchCashfreeCheckout(options: {
  paymentSessionId: string;
  environment?: string;
}): Promise<boolean> {
  const loaded = await loadCashfreeScript();
  if (!loaded || !window.Cashfree) {
    throw new Error("Unable to load Cashfree payment SDK");
  }

  const mode: "sandbox" | "production" =
    options.environment?.toUpperCase() === "PRODUCTION" ? "production" : "sandbox";

  const cashfree = window.Cashfree({ mode });
  const result = await cashfree.checkout({
    paymentSessionId: options.paymentSessionId,
    redirectTarget: "_modal",
  });

  if (result?.error) {
    throw new Error(result.error.message || "Payment cancelled or failed");
  }

  return true;
}
