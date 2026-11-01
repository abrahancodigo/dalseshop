import { useEffect, useRef } from "react";

/**
 * Makes the browser back button close an overlay on mobile instead of
 * navigating away. Pushes a history entry while open; on `popstate`
 * (back press) calls `onClose`. Cleans up the entry on programmatic close.
 */
export function useBackToClose(isOpen, onClose) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const pushedRef = useRef(false);
  const fromPopRef = useRef(false);
  const pushedPathRef = useRef("");

  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === "undefined") return;

    window.history.pushState({ __overlay: true }, "");
    pushedRef.current = true;
    fromPopRef.current = false;
    pushedPathRef.current = window.location.pathname + window.location.search + window.location.hash;

    const onPopState = () => {
      fromPopRef.current = true;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
      if (pushedRef.current && !fromPopRef.current) {
        const currentPath = window.location.pathname + window.location.search + window.location.hash;
        // Only remove the pushed entry if no navigation happened while open;
        // otherwise let the router's history change stand.
        if (currentPath === pushedPathRef.current) {
          window.history.back();
        }
      }
      pushedRef.current = false;
      fromPopRef.current = false;
    };
  }, [isOpen]);
}