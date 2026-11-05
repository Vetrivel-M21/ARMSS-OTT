import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth/provider";
import { Shell } from "@/components/layout/shell";
import appCss from "../styles.css?url";

const APP_NAME = "AURA";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AURA — Watch Movies, Series & Originals" },
      {
        name: "description",
        content:
          "AURA — A premium streaming platform for cinema, original series, live sports, and 4K entertainment.",
      },
      { name: "theme-color", content: "#070708" },
      // OpenGraph (WhatsApp, Telegram, Facebook, LinkedIn previews)
      { property: "og:site_name", content: "AURA" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://aurapictures.online" },
      { property: "og:title", content: "AURA — Watch Movies, Series & Originals" },
      {
        property: "og:description",
        content:
          "Stream cinema, original series, live entertainment, and 4K movies on AURA.",
      },
      { property: "og:image", content: "https://aurapictures.online/logo.png" },
      { property: "og:image:secure_url", content: "https://aurapictures.online/logo.png" },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      // Twitter Card previews
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AURA — Watch Movies, Series & Originals" },
      {
        name: "twitter:description",
        content:
          "Stream cinema, original series, live entertainment, and 4K movies on AURA.",
      },
      { name: "twitter:image", content: "https://aurapictures.online/logo.png" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/logo.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/logo.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600;700&display=swap",
      },
    ],
    scripts: [
      {
        src: "https://accounts.google.com/gsi/client",
        async: true,
        defer: true,
      },
    ],
  }),
  component: Root,
});

function Root() {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-fg font-sans">
        <AuthProvider>
          <Shell>
            <Outlet />
          </Shell>
        </AuthProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "oklch(20% 0.006 285)",
              border: "1px solid oklch(97% 0.002 270 / 0.10)",
              color: "oklch(97% 0.002 270)",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
            },
          }}
        />
        <Scripts />
      </body>
    </html>
  );
}
