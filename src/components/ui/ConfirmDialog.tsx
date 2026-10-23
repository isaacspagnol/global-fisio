"use client";

import BottomSheet from "./BottomSheet";
import { Button } from "./Button";

/**
 * Confirmação só para ações destrutivas e irreversíveis (excluir paciente,
 * documento, agendamento). Ações rotineiras usam toast com "Desfazer".
 * Botões com rótulos específicos ("Excluir" / "Manter"), nunca "OK/Cancelar".
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Excluir",
  cancelLabel = "Manter",
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {description && (
        <p className="text-sm text-fg-muted mb-5 leading-relaxed">
          {description}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 pb-2">
        <Button variant="secondary" onClick={onClose} autoFocus>
          {cancelLabel}
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </BottomSheet>
  );
}
