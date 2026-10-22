import { useCallback, useRef, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";

/**
 * Remplace window.confirm() par une modal stylée cohérente avec le thème.
 * Usage: const { confirm, ConfirmModal } = useConfirm();
 *        if (!(await confirm("Supprimer ?"))) return;
 *        ... puis rendre <ConfirmModal /> une fois dans le JSX du composant.
 */
function useConfirm() {
  const [dialog, setDialog] = useState(null); // { message, resolve }
  const resolveRef = useRef(null);

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialog({ message, ...options });
    });
  }, []);

  const handleConfirm = () => {
    resolveRef.current?.(true);
    setDialog(null);
  };

  const handleCancel = () => {
    resolveRef.current?.(false);
    setDialog(null);
  };

  const ConfirmModal = dialog ? (
    <ConfirmDialog
      message={dialog.message}
      confirmLabel={dialog.confirmLabel}
      cancelLabel={dialog.cancelLabel}
      danger={dialog.danger}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ) : null;

  return { confirm, ConfirmModal };
}

export default useConfirm;
