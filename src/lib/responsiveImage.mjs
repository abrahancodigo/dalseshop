// Variants travel with the existing URL field, so newly uploaded images need no rebuild.
export function isReferencedVariant(filename, referencedPaths) {
  const match = filename.match(/^(.*)\.responsive\/\d+\.webp$/);
  return Boolean(match && referencedPaths.has(match[1]));
}

export function imageURLWithoutMetadata(src) {
  return typeof src === "string" ? src.split("#")[0] : src;
}

export function withResponsiveMetadata(src, width, height, variants) {
  const data = { v: 1, w: width, h: height, s: variants.map((variant) => [variant.width, new URL(variant.url).searchParams.get("token")]) };
  return `${imageURLWithoutMetadata(src)}#dsi=${encodeURIComponent(JSON.stringify(data))}`;
}

export function readResponsiveImage(src) {
  try {
    if (typeof src !== "string" || !src.includes("#dsi=")) return null;
    const url = new URL(src);
    const data = JSON.parse(decodeURIComponent(url.hash.slice(5)));
    if (data.v !== 1 || !Number.isInteger(data.w) || !Number.isInteger(data.h) || data.w < 1 || data.h < 1
      || data.w > 100000 || data.h > 100000 || !Array.isArray(data.s) || !data.s.length || data.s.length > 6) return null;
    if (!/^https?:$/.test(url.protocol) || !url.pathname.includes("/o/")) return null;
    const [prefix, encodedPath] = url.pathname.split("/o/");
    const variants = data.s.map(([width, token]) => {
      if (!Number.isInteger(width) || width < 1 || width > data.w || width > 1920 || typeof token !== "string" || !/^[\w-]+$/.test(token)) throw new Error("Invalid variant");
      const variant = new URL(url);
      variant.hash = "";
      variant.pathname = `${prefix}/o/${encodeURIComponent(`${decodeURIComponent(encodedPath)}.responsive/${width}.webp`)}`;
      variant.search = new URLSearchParams({ alt: "media", token }).toString();
      return { width, src: variant.href };
    }).sort((a, b) => a.width - b.width);
    return { width: data.w, height: data.h, src: variants.at(-1).src, variants };
  } catch { return null; }
}
