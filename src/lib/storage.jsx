import { supabase } from "./supabase";

async function compressImage(file) {
  if (!file.type.startsWith("image/")) return file;
  const MAX_BYTES = 1 * 1024 * 1024;
  if (file.size <= MAX_BYTES) return file;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const tryCompress = (maxDim, quality, outputType) => {
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (!blob) return resolve(file);
              if (blob.size <= MAX_BYTES || (maxDim <= 800 && quality <= 0.6)) {
                const ext = outputType === "image/png" ? ".png" : ".jpg";
                const result = new File([blob], file.name.replace(/\.[^.]+$/, ext), { type: outputType, lastModified: Date.now() });
                return resolve(result);
              }
              const next = qualitySteps.find((s) => (s.quality < quality || s.maxDim < maxDim) && s.outputType === outputType) || qualitySteps.find((s) => s.outputType !== outputType);
              if (next) return tryCompress(next.maxDim, next.quality, next.outputType);
              const ext = outputType === "image/png" ? ".png" : ".jpg";
              const result = new File([blob], file.name.replace(/\.[^.]+$/, ext), { type: outputType, lastModified: Date.now() });
              resolve(result);
            },
            outputType,
            quality
          );
        };
        const maxOriginalDim = Math.max(img.width, img.height);
        const isOriginallyPng = file.type === "image/png";
        const qualitySteps = isOriginallyPng
          ? [
              { maxDim: Math.min(1920, maxOriginalDim), quality: 0.9, outputType: "image/png" },
              { maxDim: Math.min(1600, maxOriginalDim), quality: 0.85, outputType: "image/png" },
              { maxDim: Math.min(1920, maxOriginalDim), quality: 0.85, outputType: "image/jpeg" },
              { maxDim: Math.min(1600, maxOriginalDim), quality: 0.8, outputType: "image/jpeg" },
              { maxDim: Math.min(1200, maxOriginalDim), quality: 0.75, outputType: "image/jpeg" },
            ]
          : [
              { maxDim: Math.min(1920, maxOriginalDim), quality: 0.85 },
              { maxDim: Math.min(1600, maxOriginalDim), quality: 0.8 },
              { maxDim: Math.min(1200, maxOriginalDim), quality: 0.75 },
              { maxDim: Math.min(1000, maxOriginalDim), quality: 0.7 },
            ].map((s) => ({ ...s, outputType: "image/jpeg" }));
        tryCompress(qualitySteps[0].maxDim, qualitySteps[0].quality, qualitySteps[0].outputType);
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}

export async function uploadFile(file, path) {
  const { data, error } = await supabase.storage.from("dalseshop").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from("dalseshop").getPublicUrl(path);
  return urlData.publicUrl;
}

export async function deleteFile(url) {
  if (!url || typeof url !== "string") return;
  if (!url.includes("supabase.co")) {
    console.warn("Attempted to delete non-Supabase URL:", url);
    return;
  }
  try {
    const path = url.split("/storage/v1/object/public/dalseshop/")[1];
    if (path) {
      const { error } = await supabase.storage.from("dalseshop").remove([path]);
      if (error) throw error;
      console.log("File deleted from Storage:", url);
    }
  } catch (error) {
    console.error("Error deleting file from Supabase Storage:", error);
  }
}

export async function uploadImage(file, folder = "images") {
  const processedFile = await compressImage(file);
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
  const path = `${folder}/${timestamp}_${safeName}`;
  return uploadFile(processedFile, path);
}
