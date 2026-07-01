"use client";

import { useState } from "react";

const STORAGE_KEY = "onepos_terminal_id";

/**
 * Phase 2 was explicitly single-terminal, online-only (docs/08-roadmap.md) and used a fixed
 * placeholder terminal id. Phase 3 needs a stable per-browser terminal identity for shifts/sales
 * (there's still no real terminal-registration module — that's Phase 3+ per the roadmap), so this
 * generates a random id on first use and persists it in localStorage, returning the same id on
 * every later call in that browser.
 */
function readOrCreateTerminalId(): string {
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, id);
  return id;
}

/**
 * Client-component hook returning this browser's terminal id. Returns `null` during SSR
 * (localStorage isn't available there) — callers should treat `null` as "not ready yet" (e.g.
 * gate queries on it via `enabled: Boolean(terminalId)`). Uses a lazy `useState` initializer
 * rather than an effect: hydration itself runs in the browser, so the real id is available
 * synchronously on the first client render with no extra render pass.
 */
export function useTerminalId(): string | null {
  const [terminalId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readOrCreateTerminalId(),
  );
  return terminalId;
}
