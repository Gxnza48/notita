import { useEffect } from "react";
import { useVoiceStore } from "../lib/voiceStore";
import { MicIcon } from "./icons";
import { Tooltip } from "./Tooltip";

export function VoiceButton() {
  const modelReady = useVoiceStore((s) => s.modelReady);
  const downloading = useVoiceStore((s) => s.downloading);
  const downloadProgress = useVoiceStore((s) => s.downloadProgress);
  const recording = useVoiceStore((s) => s.recording);
  const error = useVoiceStore((s) => s.error);
  const checkModelStatus = useVoiceStore((s) => s.checkModelStatus);
  const toggleRecording = useVoiceStore((s) => s.toggleRecording);

  useEffect(() => {
    if (modelReady === null) checkModelStatus();
  }, [modelReady, checkModelStatus]);

  const label = downloading
    ? `Downloading speech model… ${downloadProgress}%`
    : recording
      ? "Stop voice note"
      : modelReady
        ? "Start voice note (Ctrl Shift V)"
        : "Start voice note — downloads a one-time speech model (~466 MB)";

  return (
    <div className="voice-wrap">
      {error && <div className="voice-error">{error}</div>}
      <Tooltip label={label}>
        <button
          type="button"
          className={"voice-btn" + (recording ? " recording" : "") + (downloading ? " downloading" : "")}
          onClick={toggleRecording}
          aria-label={label}
          disabled={downloading}
        >
          {downloading ? <span className="voice-progress-text">{downloadProgress}%</span> : <MicIcon size={13} />}
          {recording && <span className="voice-pulse" />}
        </button>
      </Tooltip>
    </div>
  );
}
