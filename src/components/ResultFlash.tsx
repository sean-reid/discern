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
      className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onComplete}
    >
      {/* Frosted glass background */}
      <div className="absolute inset-0 backdrop-blur-sm bg-black/40" />

      {/* Result pill */}
      <motion.div
        className={`relative z-10 px-8 py-5 rounded-2xl ${
          correct
            ? "bg-emerald-500 shadow-lg shadow-emerald-500/30"
            : "bg-red-500 shadow-lg shadow-red-500/30"
        }`}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.05 }}
      >
        <p className="text-white text-xl font-bold text-center">
          {correct ? "Correct" : "Wrong"}
        </p>
        <p className="text-white/80 text-sm text-center mt-1">
          It was {isAi ? "AI" : "real"}
        </p>
      </motion.div>
    </motion.div>
  );
}
