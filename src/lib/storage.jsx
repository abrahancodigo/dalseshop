import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "./firebase";

/**
 * Compress an image before upload using Canvas.
 * Iteratively reduces quality and dimensions until the result is ≤1MB.
 * @param {File} file - The original image file
 * @returns {Promise<File>} Compressed file
 */
async function compressImage(file) {
  // Skip if not an image or if already small enough
  if (!file.type.startsWith("image/")) return file;

  const MAX_BYTES = 1 * 1024 * 1024; // 1MB
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
                const result = new File([blob], file.name.replace(/\.[^.]+$/, ext), {
                  type: outputType,
                  lastModified: Date.now(),
                });
                return resolve(result);
              }
              // Still too large — try next tier
              const next = qualitySteps.find(
                (s) => (s.quality < quality || s.maxDim < maxDim) && s.outputType === outputType
              ) || qualitySteps.find((s) => s.outputType !== outputType); // Fallback to JPEG if PNG fails
              
              if (next) return tryCompress(next.maxDim, next.quality, next.outputType);
              
              // Nothing left to try
              const ext = outputType === "image/png" ? ".png" : ".jpg";
              const result = new File([blob], file.name.replace(/\.[^.]+$/, ext), {
                type: outputType,
                lastModified: Date.now(),
              });
              resolve(result);
            },
            outputType,
            quality
          );
        };

        const maxOriginalDim = Math.max(img.width, img.height);
        // Steps: try PNG first (if originally PNG), then fallback to JPEG for guaranteed compression
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

/**
 * Upload a file to Firebase Storage
 * @param {File} file - The file to upload
 * @param {string} path - Storage path (e.g., "logos/logo.png")
 * @returns {Promise<string>} Download URL
 */
export async function uploadFile(file, path) {
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  const url = await getDownloadURL(snapshot.ref);
  return url;
}

/**
 * Delete a file from Firebase Storage
 * @param {string} url - The download URL of the file to delete
 */
export async function deleteFile(url) {
  if (!url || typeof url !== "string") return;
  // Basic check if it's a firebase storage URL
  if (!url.includes("firebasestorage.googleapis.com")) {
    console.warn("Attempted to delete non-storage URL:", url);
    return;
  }
  
  try {
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
    console.log("File deleted from Storage:", url);
  } catch (error) {
    if (error.code === 'storage/object-not-found') {
      console.warn("File already deleted or not found in Storage:", url);
    } else {
      console.error("Error deleting file from Firebase Storage:", error);
    }
  }
}

/**
 * Upload an image with auto-generated path and compression
 * @param {File} file - Image file
 * @param {string} folder - Folder name (e.g., "products", "logos")
 * @returns {Promise<string>} Download URL
 */
export async function uploadImage(file, folder = "images") {
  // Compress before upload
  const processedFile = await compressImage(file);
  
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
  const path = `${folder}/${timestamp}_${safeName}`;
  return uploadFile(processedFile, path);
}
