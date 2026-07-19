"use client";

import { useEffect, useState } from "react";

import { pickSafeQuotePair, type QuotePair } from "@/lib/quotes";

type QuoteLayout = "horizontal" | "vertical" | "script";

const LAYOUTS: QuoteLayout[] = ["horizontal", "vertical", "script"];

/**
 * Soft ambient bilingual line — soothe, not shout.
 * Readable at a glance; never a card, never the product core.
 */
export function SideQuote() {
  const [pair, setPair] = useState<QuotePair | null>(null);
  const [layout, setLayout] = useState<QuoteLayout>("horizontal");

  useEffect(() => {
    const seed = Date.now() ^ (Math.floor(Math.random() * 1e6) | 0);
    setPair(pickSafeQuotePair(seed));
    setLayout(LAYOUTS[Math.abs(seed) % LAYOUTS.length]!);
  }, []);

  if (!pair) return null;

  if (layout === "vertical") {
    return (
      <aside className="pointer-events-none absolute right-4 top-[58%] hidden xl:block">
        <div className="quote-vertical ambient-line max-h-[36vh]">
          <p className="quote-line text-[15px] leading-[1.85]">{pair.zh}</p>
          <p className="ambient-line-en mt-4 text-[13px] leading-[1.7] tracking-wide">
            {pair.en}
          </p>
        </div>
      </aside>
    );
  }

  if (layout === "script") {
    return (
      <aside className="pointer-events-none absolute right-7 top-[58%] hidden w-48 xl:block">
        <p className="ambient-line quote-script-zh text-[16px] leading-7">{pair.zh}</p>
        <p className="ambient-line-en quote-script-en mt-2.5 text-[1.05rem] leading-6">
          {pair.en}
        </p>
      </aside>
    );
  }

  return (
    <aside className="pointer-events-none absolute right-6 top-[58%] hidden w-44 xl:block">
      <p className="ambient-line quote-line text-[15px] leading-7">{pair.zh}</p>
      <p className="ambient-line-en mt-2 text-[13px] leading-6">{pair.en}</p>
    </aside>
  );
}
