"use client";

const VISITOR_STORAGE_KEY = "h1b-visitor-id";

export function getOrCreateVisitorId() {
  if (typeof window === "undefined") return null;
  if (typeof localStorage === "undefined") return null;

  let visitorId = localStorage.getItem(VISITOR_STORAGE_KEY);
  if (visitorId) return visitorId;

  visitorId =
    (window.crypto && "randomUUID" in window.crypto
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  localStorage.setItem(VISITOR_STORAGE_KEY, visitorId);
  return visitorId;
}
