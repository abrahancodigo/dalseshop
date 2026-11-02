/**
 * Scroll lock compartido.
 *
 * Varios overlays (carrito, búsqueda, modal de imagen, modal de secciones,
 * menú de navegación) necesitan bloquear el scroll del documento mientras
 * están abiertos. Si cada uno hace `document.body.style.overflow = ''` al
 * cerrarse, uno puede desbloquear la página mientras otro overlay sigue
 * abierto, o dejar el scroll bloqueado para siempre.
 *
 * Este utility usa un contador: el scroll solo se restaura cuando el último
 * overlay se cierra. Además, al cerrar, si el scroll había quedado "colgado"
 * (p. ej. abierto el keyboard en iOS mientras el body tenía overflow:hidden),
 * se restaura la posición al valor guardado para evitar el clásico salto que
 * deja la app "travada" visualmente.
 */

let lockCount = 0;
let previousOverflow = null;
let lockTopOffsetY = null;
let onScrollRestored = null;

function isReadableHeight() {
  return typeof document.documentElement.scrollHeight === "number";
}

export function lockScroll() {
  if (typeof document === "undefined") return;

  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    // En iOS, al poner overflow:hidden el docsent puede recortar el current
    // scrollingOffset. Lo guardamos para restaurarlo.
    lockTopOffsetY = window.scrollY;
    document.body.style.overflow = "hidden";
    // Si el body se hizo overflow:hidden al tener un scroll activo, se
    // necesita forzar un reflow para que iOS no "congele" la barra de scroll.
    // (See: https://github.com/woocommerce/woocommerce-android/issues/9815)
    requestAnimationFrame(() => {
      document.body.offsetHeight; // force reflow
    });
  }
  lockCount += 1;
}

export function unlockScroll() {
  if (typeof document === "undefined") return;
  if (lockCount === 0) return;

  lockCount -= 1;
  if (lockCount === 0) {
    const prevOverflow = previousOverflow ?? "";
    const prevY = lockTopOffsetY;
    document.body.style.overflow = prevOverflow;
    previousOverflow = null;
    lockTopOffsetY = null;

    if (prevY != null && isReadableHeight()) {
      // Si durante la apertura el scroll se quedó en otra posición (iOS con
      // keyboard, overscroll-behavior), hacemos snap a la posición original.
      const current = window.scrollY;
      if (Math.abs(current - prevY) > 1) {
        // Usamos requestAnimationFrame para que el restore pase después del
        // repaint del body overflow=auto y así iOS no "rebota" al final.
        requestAnimationFrame(() => {
          if (Math.abs(window.scrollY - prevY) > 1) {
            window.scrollTo({ top: prevY, left: 0, behavior: "auto" });
          }
        });
      }
    }
  }
}

/** Fuerza la liberación de todos los bloqueos (seguridad ante desmontajes). */
export function resetScrollLock() {
  if (typeof document === "undefined") return;
  lockCount = 0;
  document.body.style.overflow = "";
  previousOverflow = null;
  lockTopOffsetY = null;
}
