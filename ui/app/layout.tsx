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
              (function() {
                try {
                  const saved = localStorage.getItem("systemone-theme") || "system";
                  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                  const mode = saved === "system" ? (dark ? "dark" : "light") : saved;
                  document.documentElement.setAttribute("data-theme", mode);
                  document.querySelector('meta[name="color-scheme"]').content = mode;
                } catch (e) {}
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
