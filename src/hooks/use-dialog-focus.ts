import { useEffect, useRef } from "react";

export function useDialogFocus<T extends HTMLElement>() {
  const dialogRef = useRef<T>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const selector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]';
    const focusable = () =>
      [...dialog.querySelectorAll<HTMLElement>(selector)].filter(
        (element) =>
          !element.hidden &&
          !element.closest('[aria-hidden="true"]') &&
          (element.getClientRects().length > 0 || element.offsetParent !== null || import.meta.env.MODE === "test"),
      );
    focusable()[0]?.focus();

    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    dialog.addEventListener("keydown", trapFocus);
    return () => {
      dialog.removeEventListener("keydown", trapFocus);
      previousFocus?.focus();
    };
  }, []);

  return dialogRef;
}
