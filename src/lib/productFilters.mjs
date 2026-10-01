export function normalizeProductOptions(options = {}) {
  const normalized = {};
  if (options.isActive !== undefined) normalized.isActive = options.isActive;
  if (options.category) normalized.category = options.category;
  if (options.brand) normalized.brand = options.brand;
  if (Array.isArray(options.productCodes) && options.productCodes.length) {
    const codes = [...new Set(options.productCodes.map((code) => String(code).trim().toLowerCase()).filter(Boolean))].sort();
    if (codes.length) normalized.productCodes = codes;
  }
  const count = Math.floor(Number(options.limitCount));
  if (Number.isFinite(count) && count > 0) normalized.limitCount = count;
  return normalized;
}

export function filterProducts(products, options = {}) {
  const normalized = normalizeProductOptions(options);
  const result = products.filter((product) => {
    if (normalized.isActive !== undefined && String(product.isActive) !== String(normalized.isActive)) return false;
    if (normalized.category && product.category !== normalized.category) return false;
    if (normalized.brand && product.brand !== normalized.brand) return false;
    if (normalized.productCodes) {
      const sku = String(product.sku || "").toLowerCase();
      const barcode = String(product.barcode || "").toLowerCase();
      return normalized.productCodes.some((code) => sku.includes(code) || barcode.includes(code));
    }
    return true;
  });
  return normalized.limitCount ? result.slice(0, normalized.limitCount) : result;
}
