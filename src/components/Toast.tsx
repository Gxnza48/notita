import { useToastStore } from "../lib/toastStore";
import { CheckIcon } from "./icons";

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <CheckIcon size={13} />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
