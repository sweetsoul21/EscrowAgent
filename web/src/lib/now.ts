"use client";

import { useSyncExternalStore } from "react";

// One shared clock (unix seconds) that ticks every 15 s. It reads 0 while prerendering,
// so nothing time-dependent is baked into the static HTML.
let current = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    current = Math.floor(Date.now() / 1000);
    timer = setInterval(() => {
      current = Math.floor(Date.now() / 1000);
      listeners.forEach((l) => l());
    }, 15_000);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

export function useNow() {
  return useSyncExternalStore(
    subscribe,
    () => current || Math.floor(Date.now() / 1000),
    () => 0
  );
}
