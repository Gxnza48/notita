import { invoke } from "@tauri-apps/api/core";

function report(message: string) {
  invoke("log_client_error", { message }).catch(() => {
    // if logging itself fails there's nothing more we can do
  });
}

/** Catches uncaught exceptions and rejections so a black/broken window can be diagnosed from its log file. */
export function installErrorLogging(context: string) {
  window.addEventListener("error", (e) => {
    report(`[${context}] uncaught error: ${e.message} at ${e.filename}:${e.lineno}:${e.colno}\n${e.error?.stack ?? ""}`);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason instanceof Error ? `${e.reason.message}\n${e.reason.stack}` : String(e.reason);
    report(`[${context}] unhandled rejection: ${reason}`);
  });
}
