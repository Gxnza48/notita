import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { Modal } from "./Modal";
import { useUiStore } from "../lib/uiStore";
import { useSettingsStore } from "../lib/settingsStore";
import { useUpdaterStore } from "../lib/updaterStore";
import { useVoiceStore, type VoiceLanguage } from "../lib/voiceStore";
import type { ThemePreference } from "../lib/types";
import { COMMANDS, type CommandCategory } from "../lib/commands";
import { THEME_PRESETS } from "../lib/themePresets";
import { FONT_OPTIONS } from "../lib/fontOptions";
import type { CustomColors } from "../lib/themeCustomization";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "dark", label: "Oscuro" },
  { value: "light", label: "Claro" },
];

const VOICE_LANGUAGE_OPTIONS: { value: VoiceLanguage; label: string }[] = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "auto", label: "Auto" },
];

const CATEGORY_ORDER: CommandCategory[] = ["General", "Notas", "Navegación", "Ventanas"];

export function SettingsPanel() {
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const themePresetId = useUiStore((s) => s.themePresetId);
  const setThemePresetId = useUiStore((s) => s.setThemePresetId);
  const customColors = useUiStore((s) => s.customColors);
  const setCustomColors = useUiStore((s) => s.setCustomColors);
  const fontId = useUiStore((s) => s.fontId);
  const setFontId = useUiStore((s) => s.setFontId);
  const selectionColor = useUiStore((s) => s.selectionColor);
  const setSelectionColor = useUiStore((s) => s.setSelectionColor);

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
        <div className="settings-header">Configuración</div>

        <div className="settings-group">
          <div className="settings-group-title">Apariencia</div>
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
          <div className="settings-group-title">Tema</div>
          <div className="theme-swatch-grid">
            <button
              type="button"
              className={"theme-swatch theme-swatch-default" + (themePresetId === "default" ? " active" : "")}
              onClick={() => setThemePresetId("default")}
              title="Predeterminado (negro / blanco puro)"
              aria-label="Tema predeterminado"
            />
            {THEME_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.id}
                className={"theme-swatch" + (themePresetId === preset.id ? " active" : "")}
                style={{ background: preset.bg }}
                onClick={() => setThemePresetId(preset.id)}
                title={preset.name}
                aria-label={preset.name}
              >
                <span className="theme-swatch-accent" style={{ background: preset.accent }} />
              </button>
            ))}
            <button
              type="button"
              className={"theme-swatch theme-swatch-custom" + (themePresetId === "custom" ? " active" : "")}
              onClick={() => setThemePresetId("custom")}
              title="Personalizado"
              aria-label="Tema personalizado"
            />
          </div>
          {themePresetId === "custom" && (
            <CustomColorPicker colors={customColors} onChange={setCustomColors} />
          )}
          <div className="settings-row">
            <span>Color de selección</span>
            <div className="settings-row-control">
              <input
                type="color"
                className="selection-color-input"
                value={selectionColor ?? "#168fc0"}
                onChange={(e) => setSelectionColor(e.target.value)}
              />
              {selectionColor && (
                <button className="text-btn" onClick={() => setSelectionColor(null)}>
                  Restablecer
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="settings-group">
          <div className="settings-group-title">Editor</div>
          <div className="settings-row">
            <span>Fuente</span>
            <div className="segmented segmented-wrap">
              {FONT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  className={"segmented-item" + (fontId === opt.id ? " active" : "")}
                  style={{ fontFamily: opt.stack }}
                  onClick={() => setFontId(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="settings-row">
            <span>Tamaño de fuente</span>
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
            <span>Interlineado</span>
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
          <div className="settings-group-title">Voz</div>
          <div className="settings-row">
            <span>Idioma de dictado</span>
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
          <div className="settings-group-title">Comportamiento</div>
          <label className="settings-row settings-toggle-row">
            <span>Abrir la última nota al iniciar</span>
            <input type="checkbox" checked={openLastNote} onChange={(e) => setOpenLastNote(e.target.checked)} />
          </label>
          <label className="settings-row settings-toggle-row">
            <span>Iniciar con Windows</span>
            <input
              type="checkbox"
              checked={startWithWindows}
              onChange={(e) => setStartWithWindows(e.target.checked)}
            />
          </label>
          <label className="settings-row settings-toggle-row">
            <span>Minimizar a la bandeja al cerrar</span>
            <input type="checkbox" checked={closeToTray} onChange={(e) => setCloseToTray(e.target.checked)} />
          </label>
          <div className="settings-row settings-static">
            <span>Guardado automático</span>
            <span className="settings-value">Siempre activo</span>
          </div>
        </div>

        <div className="settings-group">
          <div className="settings-group-title">Atajos de teclado</div>
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

const DEFAULT_CUSTOM_COLORS: CustomColors = { bg: "#0d1117", fg: "#e6edf3", accent: "#58a6ff" };

function CustomColorPicker({
  colors,
  onChange,
}: {
  colors: CustomColors | null;
  onChange: (colors: CustomColors) => void;
}) {
  const value = colors ?? DEFAULT_CUSTOM_COLORS;

  const set = (patch: Partial<CustomColors>) => onChange({ ...value, ...patch });

  return (
    <div className="theme-custom-colors">
      <label className="theme-color-field">
        <input type="color" value={value.bg} onChange={(e) => set({ bg: e.target.value })} />
        <span>Fondo</span>
      </label>
      <label className="theme-color-field">
        <input type="color" value={value.fg} onChange={(e) => set({ fg: e.target.value })} />
        <span>Texto</span>
      </label>
      <label className="theme-color-field">
        <input type="color" value={value.accent} onChange={(e) => set({ accent: e.target.value })} />
        <span>Acento</span>
      </label>
    </div>
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
      <div className="settings-group-title">Actualizaciones</div>
      <div className="settings-row">
        <span>Versión</span>
        <span className="settings-value">{currentVersion ? `${currentVersion}` : "…"}</span>
      </div>

      {status === "idle" && (
        <button className="text-btn update-check-btn" onClick={checkForUpdates}>
          Buscar actualizaciones
        </button>
      )}
      {status === "checking" && <div className="update-status">Buscando actualizaciones…</div>}
      {status === "up-to-date" && (
        <div className="update-status">
          Estás al día.
          <button className="text-btn update-recheck-btn" onClick={checkForUpdates}>
            Volver a buscar
          </button>
        </div>
      )}
      {status === "available" && (
        <div className="update-available">
          <div className="update-available-title">La versión {latestVersion} está disponible</div>
          {notes && <div className="update-notes">{notes}</div>}
          <button className="confirm-btn confirm-btn-danger update-install-btn" onClick={installUpdate}>
            Instalar y reiniciar
          </button>
        </div>
      )}
      {status === "downloading" && (
        <div className="update-status">
          <div className="update-progress-track">
            <div className="update-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          Descargando… {progress}%
        </div>
      )}
      {status === "ready" && <div className="update-status">Instalada. Reiniciando…</div>}
      {status === "error" && (
        <div className="update-status update-error">
          No se pudo buscar actualizaciones{errorMessage ? `: ${errorMessage}` : "."}
          <button className="text-btn update-recheck-btn" onClick={checkForUpdates}>
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
