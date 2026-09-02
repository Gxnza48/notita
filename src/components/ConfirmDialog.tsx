import { useEffect, useRef } from "react";
import { Modal } from "./Modal";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Eliminar",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  return (
    <Modal onClose={onCancel} panelClassName="confirm-panel" centered>
      <div className="confirm-panel-title">{title}</div>
      <div className="confirm-panel-message">{message}</div>
      <div className="confirm-panel-actions">
        <button className="confirm-btn confirm-btn-cancel" onClick={onCancel}>
          Cancelar
        </button>
        <button ref={confirmRef} className="confirm-btn confirm-btn-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
