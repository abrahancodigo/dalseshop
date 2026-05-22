"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/lib/storage";
import { HiOutlineCloudArrowUp, HiOutlineXMark } from "react-icons/hi2";
import ImageEditor from "./ImageEditor";
import styles from "./ImageUploader.module.css";

export default function ImageUploader({
  value,
  onChange,
  folder = "images",
  label = "Imagen",
  placeholder = "Arrastra o haz clic para subir",
  accept = "image/*",
  maxSizeMB = 20,
  onStatusChange,
}) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [editingFile, setEditingFile] = useState(null);

  const handleFileSelected = (file) => {
    if (!file) return;

    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`El archivo excede ${maxSizeMB}MB`);
      return;
    }

    setError("");
    // Open the image editor instead of uploading directly
    setEditingFile(file);
  };

  const handleEditorSave = async (editedFile) => {
    setEditingFile(null);
    setUploading(true);
    if (onStatusChange) onStatusChange(true);
    try {
      const url = await uploadImage(editedFile, folder);
      onChange(url, editedFile);
    } catch (err) {
      setError("Error al subir la imagen");
      console.error(err);
    } finally {
      setUploading(false);
      if (onStatusChange) onStatusChange(false);
    }
  };

  const handleEditorCancel = () => {
    setEditingFile(null);
    // Reset file input
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    handleFileSelected(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleRemove = () => {
    onChange("");
  };

  return (
    <div className={styles.wrapper}>
      {label && <label className="admin-form-label">{label}</label>}

      {value ? (
        <div className={styles.preview}>
          <img src={value} alt="Preview" className={styles.previewImg} />
          <button className={styles.removeBtn} onClick={handleRemove} type="button">
            <HiOutlineXMark />
          </button>
        </div>
      ) : (
        <div
          className={`${styles.dropzone} ${dragActive ? styles.active : ""} ${
            uploading ? styles.uploading : ""
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !uploading && fileRef.current?.click()}
        >
          {uploading ? (
            <>
              <div className="spinner" style={{ width: 28, height: 28, borderWidth: 2 }} />
              <span className={styles.dropText}>Subiendo...</span>
            </>
          ) : (
            <>
              <HiOutlineCloudArrowUp className={styles.dropIcon} />
              <span className={styles.dropText}>{placeholder}</span>
              <span className={styles.dropHint}>
                PNG, JPG, WebP (máx. {maxSizeMB}MB)
              </span>
            </>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={accept}
        onChange={(e) => {
          handleFileSelected(e.target.files[0]);
          e.target.value = ""; // Reset so same file can be re-selected
        }}
        style={{ display: "none" }}
      />

      {error && <p className={styles.error}>{error}</p>}

      {/* Image Editor Modal */}
      {editingFile && (
        <ImageEditor
          file={editingFile}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
        />
      )}
    </div>
  );
}
