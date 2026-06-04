import DOMPurify from "dompurify";

const SANITIZE_CONFIG = {
  ALLOW_DATA_ATTR: false,
};

export function sanitizeHtml(dirty, options = {}) {
  return DOMPurify.sanitize(dirty, { ...SANITIZE_CONFIG, ...options });
}

/**
 * Convierte texto plano con saltos de línea a HTML.
 * Si el texto ya contiene etiquetas HTML, lo deja intacto.
 * Útil para contenido de textarea donde el usuario usa Enter.
 */
export function formatDescription(text) {
  if (!text) return "";
  // Si ya contiene etiquetas HTML, se renderiza tal cual (usó la toolbar)
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return text;
  }
  // Texto plano: convertir saltos de línea a HTML
  return text
    .split(/\n{2,}/) // doble salto = nuevo párrafo
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`) // salto simple = <br>
    .join("");
}

export default DOMPurify;
