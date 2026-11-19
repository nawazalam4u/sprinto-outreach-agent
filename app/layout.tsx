import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import Shell from "./components/Shell";
import "./globals.css";

// Self-hosted at build time by next/font: no request leaves our domain (CSP default-src 'self').
const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-display", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["italic", "normal"], variable: "--font-serif", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Sprinto Outreach · Prospect Quest",
  description: "Researches SaaS companies, qualifies them against Sprinto's ICP with an agent loop, finds the right person and sends a cited email to your own inbox.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#17153b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
