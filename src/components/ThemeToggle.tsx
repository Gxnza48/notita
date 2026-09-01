import { useUiStore } from "../lib/uiStore";
import { resolveTheme } from "../lib/theme";
import { SunIcon, MoonIcon } from "./icons";
import { Tooltip } from "./Tooltip";

export function ThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const resolved = resolveTheme(theme);

  return (
    <Tooltip label={resolved === "dark" ? "Switch to Light mode" : "Switch to Dark mode"}>
      <button
        className="theme-toggle"
        onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
        aria-label="Toggle theme"
      >
        <span className={"theme-toggle-thumb" + (resolved === "dark" ? " dark" : "")} />
        <SunIcon />
        <MoonIcon />
      </button>
    </Tooltip>
  );
}
