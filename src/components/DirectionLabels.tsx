"use client";

import { motion, useTransform, type MotionValue } from "motion/react";

interface DirectionLabelsProps {
  drag: MotionValue<number>;
}

const BASE =
  "absolute bottom-3 z-30 pointer-events-none rounded-full bg-black/60 backdrop-blur-sm px-3 py-1.5 text-xs font-bold uppercase tracking-widest";

export function DirectionLabels({ drag }: DirectionLabelsProps) {
  const aiOpacity = useTransform(drag, [-1, 0, 1], [1, 0.55, 0.15]);
  const realOpacity = useTransform(drag, [-1, 0, 1], [0.15, 0.55, 1]);
  const aiScale = useTransform(drag, [-1, 0, 1], [1.15, 1, 1]);
  const realScale = useTransform(drag, [-1, 0, 1], [1, 1, 1.15]);

  return (
    <>
      <motion.span
        className={`${BASE} left-3 origin-bottom-left text-ai`}
        style={{ opacity: aiOpacity, scale: aiScale }}
        data-testid="label-ai"
      >
        &larr; AI
      </motion.span>
      <motion.span
        className={`${BASE} right-3 origin-bottom-right text-real`}
        style={{ opacity: realOpacity, scale: realScale }}
        data-testid="label-real"
      >
        Real &rarr;
      </motion.span>
    </>
  );
}
