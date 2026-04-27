import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "./firebase";

/**
 * Compress an image before upload using Canvas
 * @param {File} file - The original image file
 * @param {Object} options - Compression options
 * @returns {Promise<File|Blob>} Compressed file
 */
async function compressImage(file, { maxWidth = 1200, quality = 0.8 } = {}) {
  return new Promise((resolve) => {
    // Skip if not an image or if too small
    if (!file.type.startsWith("image/") || file.size < 100 * 1024) {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Check if image has transparency by examining the original format or canvas data
        const hasTransparency = file.type === "image/png" || file.type === "image/webp";

        // Resize if too large
        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        // If original image has transparency, preserve it
        if (hasTransparency) {
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) return resolve(file);
              const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, ".png"), {
                type: "image/png",
                lastModified: Date.now(),
              });
              resolve(compressedFile.size < file.size ? compressedFile : file);
            },
            "image/png"
          );
        } else {
          // For JPEG/WebP without transparency, compress as JPEG
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) return resolve(file);
              const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile.size < file.size ? compressedFile : file);
            },
            "image/jpeg",
            quality
          );
        }
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
