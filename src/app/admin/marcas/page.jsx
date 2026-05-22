"use client";

import { useState, useEffect } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import ImageUploader from "@/components/admin/ImageUploader";
import { useAdminLayout } from "../layout";
import { useAuth } from "@/context/AuthContext";
import { getBrands, saveBrand, deleteBrand } from "@/lib/firestore";
import { deleteFile } from "@/lib/storage";
import {
  HiOutlineSquares2X2,
  HiOutlinePlusCircle,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineXMark,
  HiOutlinePhoto,
} from "react-icons/hi2";
import adminStyles from "../admin.module.css";
import styles from "./marcas.module.css";

const emptyBrand = {
  name: "",
  logo: "",
  order: 0,
};

export default function MarcasPage() {
  const { toggleSidebar } = useAdminLayout();
  const { canManage } = useAuth();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyBrand);
  const [saving, setSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    try {
      const data = await getBrands();
      setBrands(data);
    } catch (err) {
      console.error("Error loading brands:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const openCreate = () => {
    if (!canManage("brands")) {
      alert("Usted no tiene los permisos para realizar esta accion");
      return;
    }
    setEditId(null);
    setForm({ ...emptyBrand, order: brands.length });
    setShowModal(true);
  };

  const openEdit = (brand) => {
    setEditId(brand.id);
    setForm({
      name: brand.name || "",
      logo: brand.logo || "",
      order: brand.order || 0,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!canManage("brands")) {
      alert("Usted no tiene los permisos para realizar esta accion");
      return;
    }
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await saveBrand(editId, form);
      setShowModal(false);
      loadBrands();
    } catch (err) {
      console.error("Error saving brand:", err);
      window.alert("Error al guardar la marca: " + (err.message || "Error desconocido"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!canManage("brands")) {
      alert("Usted no tiene los permisos para realizar esta accion");
      return;
    }
    try {
      const brandToDelete = brands.find(b => b.id === id);
      if (brandToDelete?.logo) {
        await deleteFile(brandToDelete.logo);
      }
      await deleteBrand(id);
      setDeleteConfirm(null);
      loadBrands();
    } catch (err) {
      console.error("Error deleting brand:", err);
    }
  };

  return (
    <>
      <AdminHeader
        title="Marcas"
        subtitle={`${brands.length} marca${brands.length !== 1 ? "s" : ""}`}
        onMenuToggle={toggleSidebar}
      />

      <div className={adminStyles.pageContent}>
        <div className={styles.actionBar}>
          {canManage("brands") ? (
            <button className="btn btn-primary" onClick={openCreate}>
              <HiOutlinePlusCircle />
              Nueva Marca
            </button>
          ) : (
            <span className="btn btn-primary" style={{ opacity: 0.5, cursor: "not-allowed" }} title="No tienes permisos para crear marcas">
              <HiOutlinePlusCircle />
              Nueva Marca
            </span>
          )}
        </div>

        {loading ? (
          <div className="loading-screen" style={{ minHeight: 300 }}>
            <div className="spinner" />
          </div>
        ) : brands.length === 0 ? (
          <div className={adminStyles.emptyState}>
            <div className={adminStyles.emptyIcon}>
              <HiOutlineSquares2X2 />
            </div>
            <h3 className={adminStyles.emptyTitle}>Sin marcas</h3>
            <p className={adminStyles.emptyText}>
              Crea marcas para asignarlas a tus productos.
            </p>
            {canManage("brands") ? (
              <button className="btn btn-primary" onClick={openCreate}>
                <HiOutlinePlusCircle />
                Crear Primera Marca
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
            {brands.map((brand) => (
              <div key={brand.id} className={styles.card}>
                <div className={styles.cardImage}>
                  {brand.logo ? (
                    <img src={brand.logo} alt={brand.name} />
                  ) : (
                    <div className={styles.cardImagePlaceholder}>
                      <HiOutlinePhoto />
                    </div>
                  )}
                </div>
                <div className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>{brand.name}</h3>
                </div>
                <div className={styles.cardActions}>
                  {canManage("brands") ? (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => openEdit(brand)}
                    >
                      <HiOutlinePencilSquare />
                      Editar
                    </button>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>Solo lectura</span>
                  )}
                  {canManage("brands") && deleteConfirm === brand.id ? (
                    <div className={styles.deleteConfirm}>
                      <span>¿Eliminar?</span>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(brand.id)}
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
                  ) : canManage("brands") ? (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setDeleteConfirm(brand.id)}
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
      {showModal && canManage("brands") && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editId ? "Editar Marca" : "Nueva Marca"}
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
                  placeholder="Ej: Nike, Samsung, Apple..."
                  autoFocus
                />
              </div>

              <ImageUploader
                label="Logo de la Marca"
                value={form.logo}
                onChange={(url) => handleChange("logo", url)}
                onStatusChange={setIsUploading}
                folder="brands"
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
                disabled={saving || isUploading || !form.name.trim()}
              >
                {saving ? "Guardando..." : isUploading ? "Subiendo Logo..." : editId ? "Guardar Cambios" : "Crear Marca"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
