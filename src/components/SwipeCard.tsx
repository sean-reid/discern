"use client";

import {
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useAnimate,
  type PanInfo,
} from "motion/react";
import { SWIPE_THRESHOLD_PX, SWIPE_VELOCITY_THRESHOLD } from "@/lib/constants";

interface SwipeCardProps {
  imageUrl: string;
  isTop: boolean;
  onSwipe: (direction: "left" | "right") => void;
  onDragProgress?: (progress: number) => void;
  overlayOpacity?: number;
}

export interface SwipeCardHandle {
  flyOut: (direction: "left" | "right") => void;
}

// Vivid glow colors: electric blue = AI/digital, hot orange = real/natural
const GLOW_AI = "80,100,255";
const GLOW_REAL = "255,150,20";

function computeGlowShadow(progress: number): string {
  const abs = Math.abs(progress);
  if (abs < 0.05) return "none";

  const color = progress < 0 ? GLOW_AI : GLOW_REAL;
  const sign = progress < 0 ? "" : "-";

  // Tight inner edge glow
  const insetX = Math.round(4 + abs * 8);
  const insetBlur = Math.round(15 + abs * 25);
  const insetAlpha = (abs * 0.7).toFixed(2);

  // Thin rim highlight
  const rimAlpha = (abs * 0.8).toFixed(2);

  let shadow = `inset ${sign}${insetX}px 0 ${insetBlur}px rgba(${color},${insetAlpha}), 0 0 3px rgba(${color},${rimAlpha})`;

  // Wide outer bloom
  if (abs > 0.15) {
    const outerBlur = Math.round((abs - 0.15) * 60);
    const outerAlpha = ((abs - 0.15) * 0.55).toFixed(2);
    shadow += `, 0 0 ${outerBlur}px rgba(${color},${outerAlpha})`;
  }

  return shadow;
}


export const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(
  function SwipeCard({ imageUrl, isTop, onSwipe, onDragProgress, overlayOpacity }, ref) {
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-300, 0, 300], [-12, 0, 12]);
    const [scope, animate] = useAnimate();

    const glowShadow = useTransform(x, (latest) => {
      const p = Math.max(-1, Math.min(1, latest / SWIPE_THRESHOLD_PX));
      return computeGlowShadow(p);
    });

    x.on("change", (latest) => {
      const p = Math.abs(latest / SWIPE_THRESHOLD_PX);
      onDragProgress?.(Math.min(1, p));
    });

    async function flyOut(direction: "left" | "right") {
      const target = direction === "left" ? -600 : 600;
      await animate(scope.current, { x: target, opacity: 0 }, { duration: 0.25 });
      onSwipe(direction);
    }

    useImperativeHandle(ref, () => ({ flyOut }));

    function handleDragEnd(_: unknown, info: PanInfo) {
      const { offset, velocity } = info;

      if (
        offset.x > SWIPE_THRESHOLD_PX ||
        velocity.x > SWIPE_VELOCITY_THRESHOLD
      ) {
        flyOut("right");
        return;
      }

      if (
        offset.x < -SWIPE_THRESHOLD_PX ||
        velocity.x < -SWIPE_VELOCITY_THRESHOLD
      ) {
        flyOut("left");
        return;
      }

      animate(scope.current, { x: 0 }, { type: "spring", stiffness: 400, damping: 30 });
    }

    if (!isTop) {
      return (
        <div className="absolute inset-0 rounded-xl overflow-hidden">
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover"
            draggable={false}
          />
          <div
            className="absolute inset-0 bg-bg transition-opacity duration-500 ease-out"
            style={{ opacity: overlayOpacity ?? 0.7 }}
          />
        </div>
      );
    }

    return (
      <motion.div
        ref={scope}
        className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none rounded-xl overflow-hidden shadow-lg shadow-black/40"
        style={{ x, rotate }}
        drag="x"
        dragElastic={0.7}
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={handleDragEnd}
      >
        <img
          src={imageUrl}
          alt="Real or fake?"
          className="w-full h-full object-cover"
          draggable={false}
        />

        {/* Edge glow — color indicates direction */}
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none z-10"
          style={{ boxShadow: glowShadow }}
        />
      </motion.div>
    );
  }
);
