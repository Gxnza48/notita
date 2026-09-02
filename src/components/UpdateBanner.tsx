import { useState } from "react";
import { useUpdaterStore } from "../lib/updaterStore";

/**
 * Updates only ever get checked when something calls `checkForUpdates` —
 * App.tsx does that once on boot, but the result was otherwise buried in
 * Settings, so a user could sit on a stale/broken build indefinitely
 * without any signal. This surfaces it without forcing a modal.
 */
export function UpdateBanner() {
  const status = useUpdaterStore((s) => s.status);
  const latestVersion = useUpdaterStore((s) => s.latestVersion);
  const progress = useUpdaterStore((s) => s.progress);
  const installUpdate = useUpdaterStore((s) => s.installUpdate);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (status !== "available" && status !== "downloading" && status !== "ready") return null;

  return (
    <div className="update-banner">
      {status === "available" && (
        <>
          <span>notita {latestVersion} is available.</span>
          <div className="update-banner-actions">
            <button className="text-btn" onClick={installUpdate}>
              Install &amp; Restart
            </button>
            <button className="text-btn update-banner-dismiss" onClick={() => setDismissed(true)}>
              Later
            </button>
          </div>
        </>
      )}
      {status === "downloading" && <span>Downloading update… {progress}%</span>}
      {status === "ready" && <span>Installed. Restarting…</span>}
    </div>
  );
}
