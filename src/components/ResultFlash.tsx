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
      className="absolute inset-0 z-50 flex items-center justify-center rounded-xl overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onComplete}
    >
      <div className="absolute inset-0 backdrop-blur-md bg-black/50" />

      <motion.div
        className={`relative z-10 px-8 py-4 rounded-xl border ${
          correct
            ? "bg-green/15 border-green/30"
            : "bg-red/15 border-red/30"
        }`}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 28, delay: 0.03 }}
      >
        <p className={`text-lg font-bold text-center ${
          correct ? "text-green" : "text-red"
        }`}>
          {correct ? "Correct" : "Wrong"}
        </p>
        <p className="text-fg/60 text-xs text-center mt-0.5">
          It was {isAi ? "AI" : "real"}
        </p>
      </motion.div>
    </motion.div>
  );
}
