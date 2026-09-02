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
          <div className="wpm-stats-title">Sesión</div>
          <div className="wpm-stats-row">
            <span>Promedio</span>
            <span>{sessionAverage} PPM</span>
          </div>
          <div className="wpm-stats-row">
            <span>Máximo</span>
            <span>{sessionPeak} PPM</span>
          </div>
          <div className="wpm-stats-row">
            <span>Caracteres</span>
            <span>{sessionChars.toLocaleString("es-419")}</span>
          </div>
          {bestWpm > 0 && (
            <>
              <div className="wpm-stats-title wpm-stats-title-spaced">Tu mejor marca</div>
              <div className="wpm-stats-row wpm-stats-best">
                <span>
                  {glyphFor(bestWpm)} {bestWpm} PPM
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
        <span className="wpm-unit">PPM</span>
      </button>
    </div>
  );
}
