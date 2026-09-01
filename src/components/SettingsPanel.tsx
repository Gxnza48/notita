import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { Modal } from "./Modal";
import { useUiStore } from "../lib/uiStore";
import { useSettingsStore } from "../lib/settingsStore";
import { useUpdaterStore } from "../lib/updaterStore";
import { useVoiceStore, type VoiceLanguage } from "../lib/voiceStore";
import type { ThemePreference } from "../lib/types";
import { COMMANDS, type CommandCategory } from "../lib/commands";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

const VOICE_LANGUAGE_OPTIONS: { value: VoiceLanguage; label: string }[] = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "auto", label: "Auto" },
];

const CATEGORY_ORDER: CommandCategory[] = ["General", "Notes", "Navigation", "Windows"];

export function SettingsPanel() {
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  const fontSize = useSettingsStore((s) => s.fontSize);
  const lineHeight = useSettingsStore((s) => s.lineHeight);
  const openLastNote = useSettingsStore((s) => s.openLastNote);
  const startWithWindows = useSettingsStore((s) => s.startWithWindows);
  const closeToTray = useSettingsStore((s) => s.closeToTray);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const setLineHeight = useSettingsStore((s) => s.setLineHeight);
  const setOpenLastNote = useSettingsStore((s) => s.setOpenLastNote);
  const setStartWithWindows = useSettingsStore((s) => s.setStartWithWindows);
  const setCloseToTray = useSettingsStore((s) => s.setCloseToTray);

  const voiceLanguage = useVoiceStore((s) => s.language);
  const setVoiceLanguage = useVoiceStore((s) => s.setLanguage);

  return (
    <Modal onClose={() => setSettingsOpen(false)}>
      <div className="settings-panel">
        <div className="settings-header">Settings</div>

        <div className="settings-group">
          <div className="settings-group-title">Appearance</div>
          <div className="segmented">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={"segmented-item" + (theme === opt.value ? " active" : "")}
                onClick={() => setTheme(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-group">
          <div className="settings-group-title">Editor</div>
          <div className="settings-row">
            <span>Font size</span>
            <div className="settings-row-control">
              <input
                type="range"
                min={14}
                max={22}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
              />
              <span className="settings-value">{fontSize}px</span>
            </div>
          </div>
          <div className="settings-row">
            <span>Line height</span>
            <div className="settings-row-control">
              <input
                type="range"
                min={1.3}
                max={2.1}
                step={0.1}
                value={lineHeight}
                onChange={(e) => setLineHeight(Number(e.target.value))}
              />
              <span className="settings-value">{lineHeight.toFixed(1)}</span>
            </div>
          </div>
        </div>

        <div className="settings-group">
          <div className="settings-group-title">Voice</div>
          <div className="settings-row">
            <span>Dictation language</span>
            <div className="segmented">
              {VOICE_LANGUAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={"segmented-item" + (voiceLanguage === opt.value ? " active" : "")}
                  onClick={() => setVoiceLanguage(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="settings-group">
          <div className="settings-group-title">Behavior</div>
          <label className="settings-row settings-toggle-row">
            <span>Open last note on launch</span>
            <input type="checkbox" checked={openLastNote} onChange={(e) => setOpenLastNote(e.target.checked)} />
          </label>
          <label className="settings-row settings-toggle-row">
            <span>Start with Windows</span>
            <input
              type="checkbox"
              checked={startWithWindows}
              onChange={(e) => setStartWithWindows(e.target.checked)}
            />
          </label>
          <label className="settings-row settings-toggle-row">
            <span>Minimize to tray on close</span>
            <input type="checkbox" checked={closeToTray} onChange={(e) => setCloseToTray(e.target.checked)} />
          </label>
          <div className="settings-row settings-static">
            <span>Autosave</span>
            <span className="settings-value">Always on</span>
          </div>
        </div>

        <div className="settings-group">
          <div className="settings-group-title">Keyboard Shortcuts</div>
          {CATEGORY_ORDER.map((category) => {
            const items = COMMANDS.filter((c) => c.category === category && c.shortcut);
            if (items.length === 0) return null;
            return (
              <div className="shortcut-category" key={category}>
                <div className="shortcut-category-title">{category}</div>
                {items.map((c) => (
                  <div className="settings-row shortcut-row" key={c.id}>
                    <span>{c.label}</span>
                    <kbd>{c.shortcut!.display}</kbd>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <UpdatesSection />
      </div>
    </Modal>
  );
}

function UpdatesSection() {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const status = useUpdaterStore((s) => s.status);
  const latestVersion = useUpdaterStore((s) => s.latestVersion);
  const notes = useUpdaterStore((s) => s.notes);
  const progress = useUpdaterStore((s) => s.progress);
  const errorMessage = useUpdaterStore((s) => s.errorMessage);
  const checkForUpdates = useUpdaterStore((s) => s.checkForUpdates);
  const installUpdate = useUpdaterStore((s) => s.installUpdate);

  useEffect(() => {
    getVersion().then(setCurrentVersion);
  }, []);

  return (
    <div className="settings-group">
      <div className="settings-group-title">Updates</div>
      <div className="settings-row">
        <span>Version</span>
        <span className="settings-value">{currentVersion ? `${currentVersion}` : "…"}</span>
      </div>

      {status === "idle" && (
        <button className="text-btn update-check-btn" onClick={checkForUpdates}>
          Check for updates
        </button>
      )}
      {status === "checking" && <div className="update-status">Checking for updates…</div>}
      {status === "up-to-date" && (
        <div className="update-status">
          You're up to date.
          <button className="text-btn update-recheck-btn" onClick={checkForUpdates}>
            Check again
          </button>
        </div>
      )}
      {status === "available" && (
        <div className="update-available">
          <div className="update-available-title">Version {latestVersion} is available</div>
          {notes && <div className="update-notes">{notes}</div>}
          <button className="confirm-btn confirm-btn-danger update-install-btn" onClick={installUpdate}>
            Install &amp; Restart
          </button>
        </div>
      )}
      {status === "downloading" && (
        <div className="update-status">
          <div className="update-progress-track">
            <div className="update-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          Downloading… {progress}%
        </div>
      )}
      {status === "ready" && <div className="update-status">Installed. Restarting…</div>}
      {status === "error" && (
        <div className="update-status update-error">
          Couldn't check for updates{errorMessage ? `: ${errorMessage}` : "."}
          <button className="text-btn update-recheck-btn" onClick={checkForUpdates}>
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
