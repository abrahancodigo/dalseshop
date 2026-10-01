import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "./firebase";

import { createImageVariants } from "./imageVariants.mjs";
import { readResponsiveImage, imageURLWithoutMetadata, withResponsiveMetadata } from "./responsiveImage.mjs";

async function uploadRaw(file, path) {
  const snapshot = await uploadBytes(ref(storage, path), file, { contentType: file.type, cacheControl: "public,max-age=31536000,immutable" });
  return getDownloadURL(snapshot.ref);
}

/**
 * Upload a file to Firebase Storage
 * @param {File} file - The file to upload
 * @param {string} path - Storage path (e.g., "logos/logo.png")
 * @returns {Promise<string>} Download URL
 */
export async function uploadFile(file, path) {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(file.type)) {
    throw new Error('Usa imágenes JPG, PNG, WebP, GIF o AVIF.');
  }
  if (file.size > 20 * 1024 * 1024) throw new Error('La imagen debe pesar como máximo 20 MB.');
  let prepared = null;
  try { prepared = await createImageVariants(file); }
  catch (error) { console.warn("No se pudieron crear variantes; se utilizará la imagen original.", error); }
  const original = file.size < 10 * 1024 * 1024 ? file : prepared?.variants.at(-1)?.blob;
  if (!original || original.size >= 10 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 10 MB después de optimizarla.');
  const url = await uploadRaw(original, path);
  if (!prepared) return url;
  const uploaded = [];
  try {
    for (const variant of prepared.variants) {
      const variantPath = `${path}.responsive/${variant.width}.webp`;
      const variantURL = await uploadRaw(variant.blob, variantPath);
      uploaded.push({ width: variant.width, url: variantURL });
    }
    return withResponsiveMetadata(url, prepared.width, prepared.height, uploaded);
  } catch (error) {
    await Promise.allSettled(uploaded.map((variant) => deleteObject(ref(storage, variant.url))));
    console.warn("Variantes no disponibles; se conserva el original.", error);
    return url;
  }
}

/**
 * Delete a file from Firebase Storage
 * @param {string} url - The download URL of the file to delete
 */
export async function deleteFile(url) {
  if (!url || typeof url !== "string") return;
  try {
    const storageRef = ref(storage, imageURLWithoutMetadata(url));
    if (storageRef.bucket !== storage.app.options.storageBucket) return;
    const responsive = readResponsiveImage(url);
    await Promise.allSettled((responsive?.variants || []).map((variant) => deleteObject(ref(storage, variant.src))));
    await deleteObject(storageRef);
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
  const timestamp = `${Date.now()}_${crypto.randomUUID()}`;
  const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
  const path = `${folder}/${timestamp}_${safeName}`;
  return uploadFile(file, path);
}
