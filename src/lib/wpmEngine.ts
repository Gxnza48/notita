export interface WpmSnapshot {
  visible: boolean;
  wpm: number;
}

type WpmListener = (snapshot: WpmSnapshot) => void;

const WINDOW_MS = 5000;
const TICK_MS = 200;
const IDLE_HIDE_MS = 2200;
const MIN_SPAN_MS = 700;
const MIN_VISIBLE_WPM = 12;
const PERSIST_INTERVAL_MS = 4000;
const EMA_ALPHA = 0.3;

const EMPTY_SNAPSHOT: WpmSnapshot = { visible: false, wpm: 0 };

export class WpmEngine {
  private samples: { t: number; chars: number }[] = [];
  private lastActivity = 0;
  private smoothedWpm = 0;
  /** Cumulative characters typed since the engine was created (this app run). */
  private totalChars = 0;
  private tickHandle: number | null = null;
  private listeners = new Set<WpmListener>();
  private lastRecordedAt = 0;

  constructor(private onPersist: (wpm: number, chars: number) => void) {}

  subscribe(fn: WpmListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(snapshot: WpmSnapshot) {
    for (const listener of this.listeners) listener(snapshot);
  }

  recordDelta(charsDelta: number) {
    const now = performance.now();
    this.lastActivity = now;
    if (charsDelta > 0) {
      this.samples.push({ t: now, chars: charsDelta });
      this.totalChars += charsDelta;
    }
    const cutoff = now - WINDOW_MS;
    this.samples = this.samples.filter((s) => s.t >= cutoff);

    if (this.tickHandle === null) {
      this.tickHandle = window.setInterval(() => this.tick(), TICK_MS);
      this.tick();
    }
  }

  private tick() {
    const now = performance.now();
    const idleFor = now - this.lastActivity;
    const cutoff = now - WINDOW_MS;
    this.samples = this.samples.filter((s) => s.t >= cutoff);

    if (idleFor > IDLE_HIDE_MS || this.samples.length === 0) {
      this.smoothedWpm = 0;
      this.emit(EMPTY_SNAPSHOT);
      if (this.tickHandle !== null) {
        window.clearInterval(this.tickHandle);
        this.tickHandle = null;
      }
      return;
    }

    const oldest = this.samples[0].t;
    const spanMs = Math.max(now - oldest, MIN_SPAN_MS);
    const totalChars = this.samples.reduce((sum, s) => sum + s.chars, 0);
    const rawWpm = totalChars / 5 / (spanMs / 60000);
    this.smoothedWpm = this.smoothedWpm === 0 ? rawWpm : this.smoothedWpm * (1 - EMA_ALPHA) + rawWpm * EMA_ALPHA;
    const displayWpm = Math.round(this.smoothedWpm);

    if (displayWpm >= MIN_VISIBLE_WPM && now - this.lastRecordedAt > PERSIST_INTERVAL_MS) {
      this.lastRecordedAt = now;
      this.onPersist(displayWpm, this.totalChars);
    }

    this.emit({ visible: displayWpm >= MIN_VISIBLE_WPM, wpm: displayWpm });
  }

  dispose() {
    if (this.tickHandle !== null) window.clearInterval(this.tickHandle);
    this.listeners.clear();
  }
}
