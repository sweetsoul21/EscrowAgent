"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_KEY as KEY } from "@/lib/theme-script";

export type ThemePref = "light" | "dark" | "system";

const listeners = new Set<() => void>();
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && media().matches);
  document.documentElement.classList.toggle("dark", dark);
}

function setPref(pref: ThemePref) {
  try {
    if (pref === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // Private mode: the choice just won't survive a reload.
  }
  apply(pref);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onSystem = () => {
    if (readPref() === "system") apply("system");
    cb();
  };
  const mq = media();
  mq.addEventListener("change", onSystem);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", onSystem);
  };
}

const NEXT: Record<ThemePref, ThemePref> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<ThemePref, string> = { system: "Theme: match device", light: "Theme: light", dark: "Theme: dark" };

export function ThemeToggle() {
  const pref = useSyncExternalStore<ThemePref | null>(subscribe, readPref, () => null);
  const Icon = pref === "dark" ? Moon : pref === "light" ? Sun : Monitor;
  return (
    <button
      onClick={() => pref && setPref(NEXT[pref])}
      title={pref ? `${LABEL[pref]} (click to change)` : "Theme"}
      aria-label={pref ? LABEL[pref] : "Theme"}
      className="flex size-11 items-center justify-center rounded-xl border border-line bg-paper text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
    >
      {pref ? <Icon className="size-[18px]" /> : <span className="size-[18px]" />}
    </button>
  );
}
