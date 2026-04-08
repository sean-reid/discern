"use client";

import { useEffect } from "react";
import { useGameStore } from "@/stores/game-store";
import { getDeviceId } from "@/lib/device-id";

/**
 * Initialize device ID on first render.
 * Reads from localStorage or generates a new UUID.
 */
export function useDeviceId() {
  const deviceId = useGameStore((s) => s.deviceId);
  const setDeviceId = useGameStore((s) => s.setDeviceId);

  useEffect(() => {
    if (!deviceId) {
      setDeviceId(getDeviceId());
    }
  }, [deviceId, setDeviceId]);

  return deviceId;
}
