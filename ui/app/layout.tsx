import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "System One — Autonomous Browser Agent",
  description: "High-speed dual-process autonomous browser agent harness combining TypeSafe AI Jev System 1 reflex and Stagehand with System 2 fallback.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              /* Keep the storage key in sync with lib/theme.ts THEME_STORAGE_KEY.
                 A concrete data-theme is ALWAYS written, even if localStorage or
                 matchMedia throw, because globals.css defines the dark palette
                 only under [data-theme="dark"]. */
              (function() {
                var mode = "light";
                try {
                  var saved = localStorage.getItem("systemone-theme") || "system";
                  var dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                  mode = saved === "system" ? (dark ? "dark" : "light") : saved;
                } catch (e) {}
                document.documentElement.setAttribute("data-theme", mode);
                var meta = document.querySelector('meta[name="color-scheme"]');
                if (meta) meta.content = mode;
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full font-sans selection:bg-[#edf6f5] dark:selection:bg-[#1f3b35] selection:text-[#0f7b6c] dark:selection:text-[#4dab9a]">
        {children}
      </body>
    </html>
  );
}
