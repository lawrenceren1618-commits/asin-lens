import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  Great_Vibes,
  IBM_Plex_Mono,
  Literata,
  Source_Sans_3,
} from "next/font/google";

import "./globals.css";

const display = Literata({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const script = Great_Vibes({
  variable: "--font-script",
  subsets: ["latin"],
  weight: ["400"],
});

const quoteSerif = Cormorant_Garamond({
  variable: "--font-quote-serif",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "asin-lens",
  description: "A quiet workspace for ASIN research and daily insight",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh-CN"
      data-day="dusk"
      data-season="summer"
      data-weather="clear"
      data-atmosphere="auto"
      data-ink="dark"
      data-bg-source="builtin"
      className="h-full overflow-hidden"
    >
      <body
        className={`${display.variable} ${body.variable} ${mono.variable} ${script.variable} ${quoteSerif.variable} h-full overflow-hidden antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
