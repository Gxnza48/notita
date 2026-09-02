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
  const hint = useVoiceStore((s) => s.hint);
  const deviceName = useVoiceStore((s) => s.deviceName);
  const checkModelStatus = useVoiceStore((s) => s.checkModelStatus);
  const toggleRecording = useVoiceStore((s) => s.toggleRecording);

  useEffect(() => {
    if (modelReady === null) checkModelStatus();
  }, [modelReady, checkModelStatus]);

  const label = downloading
    ? `Descargando modelo de voz… ${downloadProgress}%`
    : recording
      ? deviceName
        ? `Detener nota de voz — grabando desde ${deviceName}`
        : "Detener nota de voz"
      : modelReady
        ? "Iniciar nota de voz (Ctrl Shift V)"
        : "Iniciar nota de voz — descarga un modelo de voz único (~150 MB)";

  return (
    <div className="voice-wrap">
      {error && <div className="voice-error">{error}</div>}
      {!error && hint && <div className="voice-hint">{hint}</div>}
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
