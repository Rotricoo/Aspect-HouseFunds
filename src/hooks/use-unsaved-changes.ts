import { useCallback, useEffect } from "react";

export function useUnsavedChanges(isDirty: boolean, onClose: () => void, isSaving = false) {
  const requestClose = useCallback(() => {
    if (isSaving) return;
    if (!isDirty || window.confirm("Discard your unsaved changes?")) onClose();
  }, [isDirty, isSaving, onClose]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty || isSaving) return;
      event.preventDefault();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isDirty, isSaving, requestClose]);

  return requestClose;
}
