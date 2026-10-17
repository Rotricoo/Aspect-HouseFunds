import { useEffect, useRef, useState } from "react";
import { getErrorMessage } from "../errors/application-error";

export type PersistenceFeedback = { status: "saving" | "saved" | "error"; message: string } | null;

export function usePersistenceFeedback() {
  const [feedback, setFeedback] = useState<PersistenceFeedback>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  async function runPersistedOperation<T>(message: string, operation: () => Promise<T>): Promise<T> {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setFeedback({ status: "saving", message });
    try {
      const result = await operation();
      window.dispatchEvent(new Event("housefund-audit-updated"));
      setFeedback({ status: "saved", message: "Saved" });
      timerRef.current = window.setTimeout(() => setFeedback(null), 1800);
      return result;
    } catch (error) {
      setFeedback({ status: "error", message: getErrorMessage(error, "The change could not be saved.") });
      throw error;
    }
  }

  async function persistInTauri(operation: () => Promise<void>, message = "Saving changes"): Promise<void> {
    if ("__TAURI_INTERNALS__" in window) await runPersistedOperation(message, operation);
  }

  return { feedback, setFeedback, runPersistedOperation, persistInTauri };
}
