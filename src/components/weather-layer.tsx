"use client";

import { useEffect, useState } from "react";

import type { Weather } from "@/lib/atmosphere";

/** Lightweight CSS particle weather — no external assets. */
export function WeatherLayer({ weather }: { weather: Weather }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready || weather === "clear") return null;

  if (weather === "rain") {
    return (
      <div className="weather-layer weather-rain" aria-hidden>
        {Array.from({ length: 36 }, (_, i) => (
          <span
            key={i}
            className="rain-drop"
            style={{
              left: `${(i * 2.7) % 100}%`,
              animationDelay: `${(i % 12) * 0.12}s`,
              animationDuration: `${0.7 + (i % 5) * 0.1}s`,
            }}
          />
        ))}
      </div>
    );
  }

  if (weather === "snow") {
    return (
      <div className="weather-layer weather-snow" aria-hidden>
        {Array.from({ length: 28 }, (_, i) => (
          <span
            key={i}
            className="snow-flake"
            style={{
              left: `${(i * 3.5) % 100}%`,
              animationDelay: `${(i % 10) * 0.25}s`,
              animationDuration: `${4 + (i % 6) * 0.6}s`,
              fontSize: `${0.45 + (i % 4) * 0.15}rem`,
            }}
          >
            ✦
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="weather-layer weather-leaves" aria-hidden>
      {Array.from({ length: 16 }, (_, i) => (
        <span
          key={i}
          className="leaf-flake"
          style={{
            left: `${(i * 6.1) % 100}%`,
            animationDelay: `${(i % 8) * 0.35}s`,
            animationDuration: `${5 + (i % 5) * 0.8}s`,
          }}
        >
          ❦
        </span>
      ))}
    </div>
  );
}
