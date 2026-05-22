import DOMPurify from "dompurify";

const SANITIZE_CONFIG = {
  ALLOW_DATA_ATTR: false,
};

export function sanitizeHtml(dirty, options = {}) {
  return DOMPurify.sanitize(dirty, { ...SANITIZE_CONFIG, ...options });
}

export default DOMPurify;
