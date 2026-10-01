export async function createImageVariants(file) {
  if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  // Preserve animated PNG/WebP/AVIF uploads instead of turning them into a still image.
  const header = new TextDecoder("latin1").decode(bytes);
  if ((file.type === "image/png" && header.includes("acTL"))
    || (file.type === "image/webp" && header.includes("ANIM"))
    || (file.type === "image/avif" && header.slice(0, 128).includes("avis"))) return null;
  const objectURL = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = objectURL; });
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context || !width || !height) return null;
    const widths = [...new Set([160, 480, 960, 1440, 1920].map((target) => Math.min(target, width)))];
    const variants = [];
    for (const target of widths) {
      canvas.width = target;
      canvas.height = Math.max(1, Math.round(height * target / width));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.88));
      if (!blob || blob.type !== "image/webp") return null;
      variants.push({ width: target, blob });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    canvas.width = canvas.height = 1;
    return { width, height, variants };
  } finally { URL.revokeObjectURL(objectURL); }
}
