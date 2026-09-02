let insertHandler: ((text: string) => void) | null = null;
let partialHandler: ((text: string) => void) | null = null;

/** The mounted Editor registers itself so finalized dictation lands at the cursor of whichever note is open. */
export function registerVoiceInsertHandler(fn: ((text: string) => void) | null) {
  insertHandler = fn;
}

export function insertVoiceSegment(text: string) {
  insertHandler?.(text);
}

/** The mounted Editor registers itself so the live (not-yet-confirmed) transcript renders inline while dictating. */
export function registerVoicePartialHandler(fn: ((text: string) => void) | null) {
  partialHandler = fn;
}

export function setVoicePartial(text: string) {
  partialHandler?.(text);
}
