"use client";

import { motion } from "motion/react";
import { useEffect } from "react";
import { RESULT_FLASH_DURATION_MS } from "@/lib/constants";

interface ResultFlashProps {
  correct: boolean;
  isAi: boolean;
  onComplete: () => void;
}

export function ResultFlash({ correct, isAi, onComplete }: ResultFlashProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, RESULT_FLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.2 }}
      onClick={onComplete}
    >
      {/* Background overlay */}
      <div
        className={`absolute inset-0 ${
          correct ? "bg-emerald-500/90" : "bg-red-500/90"
        }`}
      />

      {/* Content */}
      <div className="relative z-10 text-center text-white">
        {/* Icon */}
        <div className="text-7xl mb-4">{correct ? "✓" : "✗"}</div>

        {/* Result text */}
        <p className="text-2xl font-bold mb-2">
          {correct ? "Correct!" : "Wrong!"}
        </p>
        <p className="text-lg opacity-90">
          It was <span className="font-bold">{isAi ? "AI" : "REAL"}</span>
        </p>
      </div>
    </motion.div>
  );
}
