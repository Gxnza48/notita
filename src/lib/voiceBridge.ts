let insertHandler: ((text: string) => void) | null = null;

/** The mounted Editor registers itself so transcribed segments land at the cursor of whichever note is open. */
export function registerVoiceInsertHandler(fn: ((text: string) => void) | null) {
  insertHandler = fn;
}

export function insertVoiceSegment(text: string) {
  insertHandler?.(text);
}
