import type { Metadata, Viewport } from "next";
import Shell from "./components/Shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sprinto Outreach Agent",
  description: "Researches SaaS companies, qualifies them against Sprinto's ICP with an agent loop, finds the right person and writes a cited cold email.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#fbfbf9" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
