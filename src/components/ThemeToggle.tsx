import { useUiStore } from "../lib/uiStore";
import { resolveTheme } from "../lib/theme";
import { SunIcon, MoonIcon } from "./icons";
import { Tooltip } from "./Tooltip";

export function ThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const resolved = resolveTheme(theme);

  return (
    <Tooltip label={resolved === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}>
      <button
        className="theme-toggle"
        onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
        aria-label="Alternar tema"
      >
        <span className={"theme-toggle-thumb" + (resolved === "dark" ? " dark" : "")} />
        <SunIcon />
        <MoonIcon />
      </button>
    </Tooltip>
  );
}
