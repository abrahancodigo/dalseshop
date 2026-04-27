"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminLayout } from "../../layout";
import { getProductById, saveProduct, getCategories, getBrands } from "@/lib/firestore";
import { uploadImage, deleteFile } from "@/lib/storage";
import {
  HiOutlineArrowLeft,
  HiOutlineCloudArrowUp,
  HiOutlineXMark,
  HiOutlinePhoto,
  HiOutlinePlusCircle,
  HiOutlineTrash,
} from "react-icons/hi2";
import adminStyles from "../../admin.module.css";
import styles from "./editor.module.css";
import ImageEditor from "@/components/admin/ImageEditor";

const emptyProduct = {
  name: "",
  slug: "",
  description: "",
  price: 0,
  comparePrice: 0,
  images: [],
  category: "",
  brand: "",
  tags: [],
  stock: 0,
  sku: "",
  barcode: "",
  isActive: true,
  isFeatured: false,
  variants: [],
};

export default function ProductEditorPage({ params }) {
  const resolvedParams = use(params);
  const { toggleSidebar } = useAdminLayout();
  const router = useRouter();
  const fileRef = useRef(null);
  const isNew = resolvedParams.id === "nuevo";
  const productId = isNew ? null : resolvedParams.id;

  const [form, setForm] = useState(emptyProduct);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [editingQueue, setEditingQueue] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [cats, brandsList] = await Promise.all([getCategories(), getBrands()]);
      setCategories(cats);
      setBrands(brandsList);

      if (productId) {
        const product = await getProductById(productId);
        if (product) {
          setForm({ ...emptyProduct, ...product });
        }
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name) =>
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const handleChange = (field, value) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === "name" && isNew) {
        updated.slug = generateSlug(value);
      }
      return updated;
    });
    setSaved(false);
  };

  const handleImageUpload = async (files) => {
    if (!files?.length) return;
    // Add all files to the editing queue
    setEditingQueue(Array.from(files));
  };

  const handleEditorSave = async (editedFile) => {
    setUploading(true);
    try {
      const url = await uploadImage(editedFile, "products");
      setForm((prev) => ({ ...prev, images: [...prev.images, url] }));
      setSaved(false);
      
      // Move to next file in queue
      setEditingQueue((prev) => prev.slice(1));
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleEditorCancel = () => {
    // Skip current file and move to next
    setEditingQueue((prev) => prev.slice(1));
  };

  const removeImage = async (index) => {
    const imageUrl = form.images[index];
    if (imageUrl) {
      await deleteFile(imageUrl);
    }
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
    setSaved(false);
  };

  const addTag = () => {
    if (!tagInput.trim()) return;
    if (!form.tags.includes(tagInput.trim())) {
      setForm((prev) => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
      setSaved(false);
    }
    setTagInput("");
  };

  const removeTag = (tag) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    console.log("Saving product, form data:", form);
    console.log("isActive value:", form.isActive, "type:", typeof form.isActive);
    setSaving(true);
    try {
      const id = await saveProduct(productId, form);
      console.log("Product saved with ID:", id);
      setSaved(true);
      if (isNew) {
        router.replace(`/admin/productos/${id}`);
      }
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Error saving:", err);
      window.alert("Error al guardar el producto: " + (err.message || "Error desconocido"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <AdminHeader title="Producto" onMenuToggle={toggleSidebar} />
        <div className="loading-screen" style={{ minHeight: 400 }}>
          <div className="spinner" />
        </div>
      </>
    );
  }

  return (
    <>
      <AdminHeader
        title={isNew ? "Nuevo Producto" : "Editar Producto"}
        subtitle={isNew ? "Agrega un producto a tu catálogo" : form.name}
        onMenuToggle={toggleSidebar}
      />

      <div className={adminStyles.pageContent}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => router.push("/admin/productos")}
          style={{ marginBottom: "1rem" }}
        >
          <HiOutlineArrowLeft />
          Volver a productos
        </button>

        <div className={styles.editorGrid}>
          {/* Left */}
          <div className={styles.editorMain}>
            {/* Basic Info */}
            <div className="admin-card" style={{ marginBottom: "1.5rem" }}>
              <div className="admin-card-header">
                <h3 className="admin-card-title">Información Básica</h3>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Nombre del Producto *</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Ej: Camiseta Premium"
                  autoFocus
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Slug (URL)</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={form.slug}
                  onChange={(e) => handleChange("slug", e.target.value)}
                  placeholder="camiseta-premium"
                />
                <span className="admin-form-hint">/productos/{form.slug || "..."}</span>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Descripción</label>
                <textarea
                  className="admin-form-textarea"
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  placeholder="Describe tu producto en detalle..."
                  rows={5}
                />
              </div>
            </div>

            {/* Images */}
            <div className="admin-card" style={{ marginBottom: "1.5rem" }}>
              <div className="admin-card-header">
                <h3 className="admin-card-title">Imágenes</h3>
              </div>

              <div className={styles.imagesGrid}>
                {form.images.map((url, index) => (
                  <div key={index} className={styles.imageItem}>
                    <img src={url} alt={`Imagen ${index + 1}`} />
                    <button
                      className={styles.imageRemoveBtn}
                      onClick={() => removeImage(index)}
                      type="button"
                    >
                      <HiOutlineXMark />
                    </button>
                    {index === 0 && (
                      <span className={styles.mainImageBadge}>Principal</span>
                    )}
                  </div>
                ))}
                <div
                  className={styles.imageUploadBtn}
                  onClick={() => !uploading && fileRef.current?.click()}
                >
                  {uploading ? (
                    <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
                  ) : (
                    <>
                      <HiOutlineCloudArrowUp className={styles.uploadIcon} />
                      <span>Subir</span>
                    </>
                  )}
                </div>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleImageUpload(e.target.files)}
                style={{ display: "none" }}
              />
            </div>

            {/* Tags */}
            <div className="admin-card">
              <div className="admin-card-header">
                <h3 className="admin-card-title">Etiquetas</h3>
              </div>

              <div className={styles.tagsInput}>
                <input
                  type="text"
                  className="admin-form-input"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  placeholder="Agregar etiqueta y presionar Enter"
                />
              </div>
              {form.tags.length > 0 && (
                <div className={styles.tagsList}>
                  {form.tags.map((tag) => (
                    <span key={tag} className={styles.tag}>
                      {tag}
                      <button onClick={() => removeTag(tag)} type="button">
                        <HiOutlineXMark />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className={styles.editorSide}>
            {/* Pricing */}
            <div className="admin-card" style={{ marginBottom: "1.5rem" }}>
              <div className="admin-card-header">
                <h3 className="admin-card-title">Precios</h3>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Precio *</label>
                <input
                  type="number"
                  className="admin-form-input"
                  value={form.price}
                  onChange={(e) => handleChange("price", e.target.value)}
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Precio Comparación</label>
                <input
                  type="number"
                  className="admin-form-input"
                  value={form.comparePrice}
                  onChange={(e) => handleChange("comparePrice", e.target.value)}
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                />
                <span className="admin-form-hint">Se muestra tachado (precio anterior)</span>
              </div>
            </div>

            {/* Organization */}
            <div className="admin-card" style={{ marginBottom: "1.5rem" }}>
              <div className="admin-card-header">
                <h3 className="admin-card-title">Organización</h3>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Categoría</label>
                <select
                  className="admin-form-select"
                  value={form.category}
                  onChange={(e) => handleChange("category", e.target.value)}
                >
                  <option value="">Sin categoría</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Marca</label>
                <select
                  className="admin-form-select"
                  value={form.brand}
                  onChange={(e) => handleChange("brand", e.target.value)}
                >
                  <option value="">Sin marca</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">SKU</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={form.sku}
                  onChange={(e) => handleChange("sku", e.target.value)}
                  placeholder="Código de referencia"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Código de Barras</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={form.barcode}
                  onChange={(e) => handleChange("barcode", e.target.value)}
                  placeholder="123456789012"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Stock</label>
                <input
                  type="number"
                  className="admin-form-input"
                  value={form.stock}
                  onChange={(e) => handleChange("stock", e.target.value)}
                  min={0}
                  placeholder="0 = ilimitado"
                />
              </div>
            </div>

            {/* Status */}
            <div className="admin-card">
              <div className="admin-card-header">
                <h3 className="admin-card-title">Estado</h3>
              </div>

              <div className={styles.toggleRow}>
                <div>
                  <label className="admin-form-label">Producto Activo</label>
                  <span className="admin-form-hint">Visible en la tienda</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => handleChange("isActive", e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>

              <div className={styles.toggleRow} style={{ marginTop: "0.75rem" }}>
                <div>
                  <label className="admin-form-label">Destacado</label>
                  <span className="admin-form-hint">Aparece en secciones destacadas</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={(e) => handleChange("isFeatured", e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Bar */}
      <div className={adminStyles.saveBar}>
        {saved && (
          <span className={adminStyles.saveBarMessage}>✓ Producto guardado</span>
        )}
        <button className="btn btn-ghost" onClick={() => router.push("/admin/productos")}>
          Cancelar
        </button>
        <button
          className="btn btn-primary btn-lg"
          onClick={handleSave}
          disabled={saving || !form.name.trim()}
        >
          {saving ? "Guardando..." : isNew ? "Crear Producto" : "Guardar Cambios"}
        </button>
      </div>

      {/* Image Editor Modal for queue */}
      {editingQueue.length > 0 && (
        <ImageEditor
          file={editingQueue[0]}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
          key={editingQueue[0].name + editingQueue[0].lastModified}
        />
      )}
    </>
  );
}
