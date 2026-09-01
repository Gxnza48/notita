let flushFn: (() => void) | null = null;

export function registerEditorFlush(fn: (() => void) | null) {
  flushFn = fn;
}

export function flushEditor() {
  flushFn?.();
}
