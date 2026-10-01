const memory = new Map();
const TTL = 5 * 60 * 1000;
export function readCatalogSession(scope) {
  try {
    const value = memory.get(scope) || JSON.parse(sessionStorage.getItem(`dalse_catalog_${scope}`));
    return value?.expires > Date.now() && Array.isArray(value.products) ? value.products : null;
  } catch { return null; }
}
export function saveCatalogSession(scope, products) {
  const value = { products, expires: Date.now() + TTL };
  memory.set(scope, value);
  try { sessionStorage.setItem(`dalse_catalog_${scope}`, JSON.stringify(value)); } catch { /* Memory cache still works. */ }
}
