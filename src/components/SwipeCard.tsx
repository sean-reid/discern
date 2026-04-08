"use client";

import {
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "motion/react";
import { SWIPE_THRESHOLD_PX, SWIPE_VELOCITY_THRESHOLD } from "@/lib/constants";

interface SwipeCardProps {
  imageUrl: string;
  isTop: boolean;
  onSwipe: (direction: "left" | "right") => void;
  onDragProgress: (progress: number) => void;
}

export function SwipeCard({
  imageUrl,
  isTop,
  onSwipe,
  onDragProgress,
}: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-15, 0, 15]);
  const opacity = useTransform(
    x,
    [-300, -100, 0, 100, 300],
    [0.5, 1, 1, 1, 0.5]
  );

  // Report drag progress for overlay labels
  x.on("change", (latest) => {
    const progress = latest / SWIPE_THRESHOLD_PX;
    onDragProgress(Math.max(-1, Math.min(1, progress)));
  });

  function handleDragEnd(_: unknown, info: PanInfo) {
    const { offset, velocity } = info;

    if (
      offset.x > SWIPE_THRESHOLD_PX ||
      velocity.x > SWIPE_VELOCITY_THRESHOLD
    ) {
      onSwipe("right");
      return;
    }

    if (
      offset.x < -SWIPE_THRESHOLD_PX ||
      velocity.x < -SWIPE_VELOCITY_THRESHOLD
    ) {
      onSwipe("left");
      return;
    }

    // Snap back handled by dragSnapToOrigin
  }

  // Background card: not draggable, visual depth effect
  if (!isTop) {
    return (
      <motion.div
        className="absolute inset-0 rounded-2xl overflow-hidden"
        style={{ scale: 0.95, y: 8 }}
      >
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-black/20" />
      </motion.div>
    );
  }

  return (
    <motion.div
      className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none rounded-2xl overflow-hidden shadow-2xl"
      style={{ x, rotate, opacity }}
      drag="x"
      dragSnapToOrigin
      dragElastic={0.8}
      onDragEnd={handleDragEnd}
      exit={{
        x: 500,
        opacity: 0,
        transition: { duration: 0.3 },
      }}
    >
      <img
        src={imageUrl}
        alt="Is this image real or AI-generated?"
        className="w-full h-full object-cover"
        draggable={false}
      />
    </motion.div>
  );
}
