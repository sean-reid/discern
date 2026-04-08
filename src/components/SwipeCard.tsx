"use client";

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
  onDragProgress: (progress: number) => void;
}

export function SwipeCard({
  imageUrl,
  isTop,
  onSwipe,
  onDragProgress,
}: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 0, 300], [-12, 0, 12]);
  const [scope, animate] = useAnimate();

  x.on("change", (latest) => {
    const progress = latest / SWIPE_THRESHOLD_PX;
    onDragProgress(Math.max(-1, Math.min(1, progress)));
  });

  async function flyOut(direction: "left" | "right") {
    const target = direction === "left" ? -600 : 600;
    await animate(scope.current, { x: target, opacity: 0 }, { duration: 0.25 });
    onSwipe(direction);
  }

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
    onDragProgress(0);
  }

  if (!isTop) {
    return (
      <motion.div
        className="absolute inset-0 rounded-xl overflow-hidden border border-white/5"
        style={{ scale: 0.96, y: 6 }}
      >
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-black/30" />
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={scope}
      className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none rounded-xl overflow-hidden shadow-lg shadow-black/40 border border-white/10"
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
    </motion.div>
  );
}
