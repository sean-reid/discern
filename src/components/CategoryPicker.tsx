"use client";

import { CATEGORIES } from "@/lib/constants";
import { useGameStore } from "@/stores/game-store";

export function CategoryPicker() {
  const selected = useGameStore((s) => s.selectedCategory);
  const setCategory = useGameStore((s) => s.setCategory);

  return (
    <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-none">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.slug}
          onClick={() => setCategory(cat.slug)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            selected === cat.slug
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          <span>{cat.icon}</span>
          <span>{cat.name}</span>
        </button>
      ))}
    </div>
  );
}
