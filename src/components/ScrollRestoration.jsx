import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const positions = new Map();
const readPosition = (key) => {
  try { return positions.get(key) ?? (Number(sessionStorage.getItem(`dalse_scroll_${key}`)) || 0); }
  catch { return positions.get(key) || 0; }
};

export default function ScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousPath = useRef(location.pathname);
  useLayoutEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = "manual";
    return () => { history.scrollRestoration = previous; };
  }, []);

  useLayoutEffect(() => {
    const keepPosition = navigationType === "REPLACE" && previousPath.current === location.pathname;
    previousPath.current = location.pathname;
    const target = navigationType === "POP" ? readPosition(location.key) : keepPosition ? window.scrollY : 0;
    let lastPosition = target;
    let restoring = true;
    let frame;
    const stop = () => { restoring = false; observer.disconnect(); cancelAnimationFrame(frame); };
    const restore = () => {
      if (!restoring) return;
      window.scrollTo({ top: target, behavior: "instant" });
      if (Math.abs(window.scrollY - target) < 2) stop();
    };
    const observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(restore); });
    observer.observe(document.body);
    frame = requestAnimationFrame(restore);
    const timeout = setTimeout(stop, 10000);
    const save = () => { if (!restoring) lastPosition = window.scrollY; };
    window.addEventListener("scroll", save, { passive: true });
    for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) window.addEventListener(event, stop, { passive: true });
    return () => {
      stop(); clearTimeout(timeout);
      positions.set(location.key, lastPosition);
      if (positions.size > 50) positions.delete(positions.keys().next().value);
      try { sessionStorage.setItem(`dalse_scroll_${location.key}`, String(lastPosition)); } catch { /* Optional persistence. */ }
      window.removeEventListener("scroll", save);
      for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) window.removeEventListener(event, stop);
    };
  }, [location.key, location.pathname, navigationType]);
  return null;
}
