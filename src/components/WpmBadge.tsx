import { useEffect, useState } from "react";
import { useWpmStore } from "../lib/wpmStore";

function glyphFor(wpm: number): string {
  if (wpm >= 160) return "💀";
  if (wpm >= 130) return "🔥";
  if (wpm >= 100) return "⚡";
  return "";
}

export function WpmBadge() {
  const visible = useWpmStore((s) => s.visible);
  const wpm = useWpmStore((s) => s.wpm);
  const sessionAverage = useWpmStore((s) => s.sessionAverage);
  const sessionPeak = useWpmStore((s) => s.sessionPeak);
  const sessionChars = useWpmStore((s) => s.sessionChars);
  const bestWpm = useWpmStore((s) => s.bestWpm);
  const refreshBest = useWpmStore((s) => s.refreshBest);
  const refreshSessionStats = useWpmStore((s) => s.refreshSessionStats);

  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    refreshBest();
  }, [refreshBest]);

  useEffect(() => {
    if (!visible) setShowStats(false);
  }, [visible]);

  const toggleStats = () => {
    setShowStats((v) => {
      const next = !v;
      if (next) refreshSessionStats();
      return next;
    });
  };

  const glyph = glyphFor(wpm);

  return (
    <div className="wpm-wrap">
      {showStats && visible && (
        <div className="wpm-stats-panel">
          <div className="wpm-stats-title">Session</div>
          <div className="wpm-stats-row">
            <span>Average</span>
            <span>{sessionAverage} WPM</span>
          </div>
          <div className="wpm-stats-row">
            <span>Peak</span>
            <span>{sessionPeak} WPM</span>
          </div>
          <div className="wpm-stats-row">
            <span>Characters</span>
            <span>{sessionChars.toLocaleString()}</span>
          </div>
          {bestWpm > 0 && (
            <>
              <div className="wpm-stats-title wpm-stats-title-spaced">Your best</div>
              <div className="wpm-stats-row wpm-stats-best">
                <span>
                  {glyphFor(bestWpm)} {bestWpm} WPM
                </span>
              </div>
            </>
          )}
        </div>
      )}
      <button
        type="button"
        className={"wpm-badge" + (visible ? " visible" : "")}
        aria-live="polite"
        onClick={toggleStats}
      >
        {glyph && <span className="wpm-glyph">{glyph}</span>}
        <span className="wpm-value">{wpm}</span>
        <span className="wpm-unit">WPM</span>
      </button>
    </div>
  );
}
