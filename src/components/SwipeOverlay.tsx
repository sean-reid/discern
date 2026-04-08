"use client";

interface SwipeOverlayProps {
  progress: number;
}

export function SwipeOverlay({ progress }: SwipeOverlayProps) {
  const aiOpacity = Math.max(0, -progress);
  const realOpacity = Math.max(0, progress);

  return (
    <>
      {/* AI label */}
      <div
        className="absolute top-6 left-5 z-20 pointer-events-none"
        style={{ opacity: aiOpacity }}
      >
        <div className="border-2 border-red/80 bg-red/10 rounded-lg px-3 py-1.5 -rotate-12 backdrop-blur-sm">
          <span className="text-red text-xl font-bold tracking-wide">
            FAKE
          </span>
        </div>
      </div>

      {/* REAL label */}
      <div
        className="absolute top-6 right-5 z-20 pointer-events-none"
        style={{ opacity: realOpacity }}
      >
        <div className="border-2 border-green/80 bg-green/10 rounded-lg px-3 py-1.5 rotate-12 backdrop-blur-sm">
          <span className="text-green text-xl font-bold tracking-wide">
            REAL
          </span>
        </div>
      </div>
    </>
  );
}
