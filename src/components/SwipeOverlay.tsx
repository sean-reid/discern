"use client";

interface SwipeOverlayProps {
  /** -1 (full left/AI) to +1 (full right/Real), 0 = centered */
  progress: number;
}

export function SwipeOverlay({ progress }: SwipeOverlayProps) {
  const aiOpacity = Math.max(0, -progress);
  const realOpacity = Math.max(0, progress);

  return (
    <>
      {/* AI label — left side, red */}
      <div
        className="absolute top-8 left-6 z-20 pointer-events-none"
        style={{ opacity: aiOpacity }}
      >
        <div className="border-4 border-red-500 rounded-lg px-4 py-2 -rotate-12">
          <span className="text-red-500 text-3xl font-black tracking-wider">
            AI
          </span>
        </div>
      </div>

      {/* REAL label — right side, green */}
      <div
        className="absolute top-8 right-6 z-20 pointer-events-none"
        style={{ opacity: realOpacity }}
      >
        <div className="border-4 border-emerald-500 rounded-lg px-4 py-2 rotate-12">
          <span className="text-emerald-500 text-3xl font-black tracking-wider">
            REAL
          </span>
        </div>
      </div>
    </>
  );
}
