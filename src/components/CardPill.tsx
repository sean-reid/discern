"use client";

import { motion } from "motion/react";

interface CardPillProps {
  children: React.ReactNode;
  testId: string;
  tone?: "neutral" | "green" | "red";
}

const TONE_CLASS = {
  neutral: "text-fg",
  green: "text-green",
  red: "text-red",
} as const;

export function CardPill({ children, testId, tone = "neutral" }: CardPillProps) {
  return (
    <motion.div
      className="absolute inset-x-0 top-3 z-30 flex justify-center px-4 pointer-events-none"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      data-testid={testId}
    >
      <div
        className={`rounded-full bg-black/70 backdrop-blur-sm px-4 py-2 text-center text-sm font-semibold leading-snug ${TONE_CLASS[tone]}`}
      >
        {children}
      </div>
    </motion.div>
  );
}
