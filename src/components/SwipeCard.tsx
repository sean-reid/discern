"use client";

import {
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "motion/react";
import { SWIPE_THRESHOLD_PX, SWIPE_VELOCITY_THRESHOLD } from "@/lib/constants";
import { useRef } from "react";

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
  const swipeDirection = useRef<"left" | "right" | null>(null);

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
      swipeDirection.current = "right";
      onSwipe("right");
      return;
    }

    if (
      offset.x < -SWIPE_THRESHOLD_PX ||
      velocity.x < -SWIPE_VELOCITY_THRESHOLD
    ) {
      swipeDirection.current = "left";
      onSwipe("left");
      return;
    }

    // Below threshold: snap back, reset overlay
    onDragProgress(0);
  }

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
      style={{ x, rotate }}
      drag="x"
      dragSnapToOrigin
      dragElastic={0.8}
      onDragEnd={handleDragEnd}
      exit={{
        x: swipeDirection.current === "left" ? -500 : 500,
        opacity: 0,
        transition: { duration: 0.3 },
      }}
    >
      <img
        src={imageUrl}
        alt="Real or fake?"
        className="w-full h-full object-cover"
        draggable={false}
      />
    </motion.div>
  );
}
