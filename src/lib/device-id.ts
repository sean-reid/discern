import { v4 as uuidv4 } from "uuid";

const STORAGE_KEY = "discern-device-id";

/**
 * Get or create a persistent device ID (client-side only).
 * Stored in localStorage. Generates a UUID v4 on first visit.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") {
    throw new Error("getDeviceId must be called on the client");
  }

  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const id = uuidv4();
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}
