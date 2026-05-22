"use client";

import { useState, useEffect } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import ImageUploader from "@/components/admin/ImageUploader";
import { useAdminLayout } from "../layout";
import { useAuth } from "@/context/AuthContext";
import { getCategories, saveCategory, deleteCategory } from "@/lib/firestore";
import {
  HiOutlineSquares2X2,
  HiOutlinePlusCircle,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineXMark,
  HiOutlinePhoto,
} from "react-icons/hi2";
import adminStyles from "../admin.module.css";
import styles from "./categorias.module.css";

const emptyCategory = {
  name: "",
  slug: "",
  description: "",
  image: "",
  order: 0,
  isActive: true,
};

export default function CategoriasPage() {
  const { toggleSidebar } = useAdminLayout();
  const { canManage } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyCategory);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (err) {
      console.error("Error loading categories:", err);
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
      if (field === "name" && !editId) {
        updated.slug = generateSlug(value);
      }
      return updated;
    });
  };

  const openCreate = () => {
    if (!canManage("categories")) {
      alert("Usted no tiene los permisos para realizar esta accion");
      return;
    }
    setEditId(null);
    setForm({ ...emptyCategory, order: categories.length });
    setShowModal(true);
  };

  const openEdit = (cat) => {
    setEditId(cat.id);
    setForm({
      name: cat.name || "",
      slug: cat.slug || "",
      description: cat.description || "",
      image: cat.image || "",
      order: cat.order || 0,
      isActive: cat.isActive !== undefined ? cat.isActive : true,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!canManage("categories")) {
      alert("Usted no tiene los permisos para realizar esta accion");
      return;
    }
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await saveCategory(editId, form);
      setShowModal(false);
      loadCategories();
    } catch (err) {
      console.error("Error saving category:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!canManage("categories")) {
      alert("Usted no tiene los permisos para realizar esta accion");
      return;
    }
    try {
      await deleteCategory(id);
      setDeleteConfirm(null);
      loadCategories();
    } catch (err) {
      console.error("Error deleting category:", err);
    }
  };

  return (
    <>
      <AdminHeader
        title="Categorías"
        subtitle={`${categories.length} categoría${categories.length !== 1 ? "s" : ""}`}
        onMenuToggle={toggleSidebar}
      />

      <div className={adminStyles.pageContent}>
        {/* Action bar */}
        <div className={styles.actionBar}>
          {canManage("categories") ? (
            <button className="btn btn-primary" onClick={openCreate}>
              <HiOutlinePlusCircle />
              Nueva Categoría
            </button>
          ) : (
            <span className="btn btn-primary" style={{ opacity: 0.5, cursor: "not-allowed" }} title="No tienes permisos para crear categorías">
              <HiOutlinePlusCircle />
              Nueva Categoría
            </span>
          )}
        </div>

        {loading ? (
          <div className="loading-screen" style={{ minHeight: 300 }}>
            <div className="spinner" />
          </div>
        ) : categories.length === 0 ? (
          <div className={adminStyles.emptyState}>
            <div className={adminStyles.emptyIcon}>
              <HiOutlineSquares2X2 />
            </div>
            <h3 className={adminStyles.emptyTitle}>Sin categorías</h3>
            <p className={adminStyles.emptyText}>
              Crea categorías para organizar tus productos.
            </p>
            {canManage("categories") ? (
              <button className="btn btn-primary" onClick={openCreate}>
                <HiOutlinePlusCircle />
                Crear Primera Categoría
              </button>
            ) : (
              <span className="btn btn-primary" style={{ opacity: 0.5, cursor: "not-allowed" }}>
                <HiOutlinePlusCircle />
                Sin acceso para crear
              </span>
            )}
          </div>
        ) : (
          <div className={styles.grid}>
            {categories.map((cat) => (
              <div key={cat.id} className={styles.card}>
                <div className={styles.cardImage}>
                  {cat.image ? (
                    <img src={cat.image} alt={cat.name} />
                  ) : (
                    <div className={styles.cardImagePlaceholder}>
                      <HiOutlinePhoto />
                    </div>
                  )}
                  {!cat.isActive && (
                    <span className={styles.inactiveBadge}>Inactiva</span>
                  )}
                </div>
                <div className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>{cat.name}</h3>
                  {cat.description && (
                    <p className={styles.cardDesc}>{cat.description}</p>
                  )}
                  <span className={styles.cardSlug}>/{cat.slug}</span>
                </div>
                <div className={styles.cardActions}>
                  {canManage("categories") ? (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => openEdit(cat)}
                    >
                      <HiOutlinePencilSquare />
                      Editar
                    </button>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>Solo lectura</span>
                  )}
                  {canManage("categories") && deleteConfirm === cat.id ? (
                    <div className={styles.deleteConfirm}>
                      <span>¿Eliminar?</span>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(cat.id)}
                      >
                        Sí
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setDeleteConfirm(null)}
                      >
                        No
                      </button>
                    </div>
                  ) : canManage("categories") ? (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setDeleteConfirm(cat.id)}
                      style={{ color: "var(--color-danger)" }}
                    >
                      <HiOutlineTrash />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && canManage("categories") && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editId ? "Editar Categoría" : "Nueva Categoría"}
              </h2>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowModal(false)}
              >
                <HiOutlineXMark />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className="admin-form-group">
                <label className="admin-form-label">Nombre *</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Ej: Electrónica"
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
                  placeholder="electronica"
                />
                <span className="admin-form-hint">Se usa en la URL: /categorias/{form.slug || "..."}</span>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Descripción</label>
                <textarea
                  className="admin-form-textarea"
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  placeholder="Descripción opcional de la categoría"
                  rows={3}
                />
              </div>

              <ImageUploader
                label="Imagen"
                value={form.image}
                onChange={(url) => handleChange("image", url)}
                folder="categories"
              />

              <div className="admin-form-group">
                <label className="admin-form-label">Orden</label>
                <input
                  type="number"
                  className="admin-form-input"
                  value={form.order}
                  onChange={(e) => handleChange("order", parseInt(e.target.value) || 0)}
                  min={0}
                />
              </div>

              <div className={styles.toggleRow}>
                <div>
                  <label className="admin-form-label">Activa</label>
                  <span className="admin-form-hint">Las categorías inactivas no se muestran en la tienda</span>
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
            </div>

            <div className={styles.modalFooter}>
              <button
                className="btn btn-ghost"
                onClick={() => setShowModal(false)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
              >
                {saving ? "Guardando..." : editId ? "Guardar Cambios" : "Crear Categoría"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
