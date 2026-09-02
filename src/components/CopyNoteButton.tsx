import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { CheckIcon, CopyIcon } from "./icons";
import { Tooltip } from "./Tooltip";
import { useToastStore } from "../lib/toastStore";

export function CopyNoteButton({ editor }: { editor: Editor | null }) {
  const [copied, setCopied] = useState(false);
  const showToast = useToastStore((s) => s.showToast);

  const handleCopy = async () => {
    if (!editor) return;
    try {
      await navigator.clipboard.writeText(editor.getText());
      setCopied(true);
      showToast("Copiado al portapapeles");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — nothing more we can do
    }
  };

  return (
    <Tooltip label={copied ? "Copiado" : "Copiar nota"}>
      <button
        type="button"
        className={"icon-btn tiny" + (copied ? " copied" : "")}
        onClick={handleCopy}
        aria-label={copied ? "Copiado" : "Copiar nota"}
      >
        {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
      </button>
    </Tooltip>
  );
}
