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
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return sanitizeHtml(text);
  }
  return text
    .split(/\n{2,}/)
    .map((p) => sanitizeHtml(`<p>${p.replace(/\n/g, "<br>")}</p>`))
    .join("");
}

export default DOMPurify;
