"use client";

import { useState, useEffect } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminLayout } from "../layout";
import { getCoupons, saveCoupon, deleteCoupon } from "@/lib/firestore";
import {
  HiOutlineTicket, HiOutlinePlusCircle, HiOutlinePencilSquare,
  HiOutlineTrash, HiOutlineXMark,
} from "react-icons/hi2";
import adminStyles from "../admin.module.css";
import styles from "./cupones.module.css";

const emptyCoupon = { code: "", type: "percentage", value: 10, minPurchase: 0, maxUses: 0, usedCount: 0, expiresAt: "", isActive: true, description: "" };

export default function CuponesPage() {
  const { toggleSidebar } = useAdminLayout();
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyCoupon);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { loadCoupons(); }, []);

  const loadCoupons = async () => {
    try { const data = await getCoupons(); setCoupons(data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditId(null); setForm(emptyCoupon); setShowModal(true); };
  const openEdit = (c) => { setEditId(c.id); setForm({ code: c.code || "", type: c.type || "percentage", value: c.value || 0, minPurchase: c.minPurchase || 0, maxUses: c.maxUses || 0, usedCount: c.usedCount || 0, expiresAt: c.expiresAt || "", isActive: c.isActive !== false, description: c.description || "" }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.code.trim()) return;
    setSaving(true);
    try {
      await saveCoupon(editId, { ...form, code: form.code.toUpperCase(), value: parseFloat(form.value) || 0, minPurchase: parseFloat(form.minPurchase) || 0, maxUses: parseInt(form.maxUses) || 0 });
      setShowModal(false); loadCoupons();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try { await deleteCoupon(id); setDeleteConfirm(null); loadCoupons(); }
    catch (err) { console.error(err); }
  };

  const formatDate = (d) => { if (!d) return "Sin expiración"; return new Date(d).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }); };

  return (
    <>
      <AdminHeader title="Cupones" subtitle={`${coupons.length} cupón${coupons.length !== 1 ? "es" : ""}`} onMenuToggle={toggleSidebar} />
      <div className={adminStyles.pageContent}>
        <div className={styles.actionBar}>
          <button className="btn btn-primary" onClick={openCreate}><HiOutlinePlusCircle /> Nuevo Cupón</button>
        </div>

        {loading ? (
          <div className="loading-screen" style={{ minHeight: 300 }}><div className="spinner" /></div>
        ) : coupons.length === 0 ? (
          <div className={adminStyles.emptyState}>
            <div className={adminStyles.emptyIcon}><HiOutlineTicket /></div>
            <h3 className={adminStyles.emptyTitle}>Sin cupones</h3>
            <p className={adminStyles.emptyText}>Crea cupones de descuento para tus clientes.</p>
            <button className="btn btn-primary" onClick={openCreate}><HiOutlinePlusCircle /> Crear Cupón</button>
          </div>
        ) : (
          <div className={styles.grid}>
            {coupons.map((c) => (
              <div key={c.id} className={`${styles.card} ${!c.isActive ? styles.inactive : ""}`}>
                <div className={styles.cardTop}>
                  <span className={styles.couponCode}>{c.code}</span>
                  {!c.isActive && <span className={styles.inactiveBadge}>Inactivo</span>}
                </div>
                <div className={styles.couponValue}>
                  {c.type === "percentage" ? `${c.value}%` : `$${c.value?.toLocaleString()}`}
                  <span className={styles.couponType}>{c.type === "percentage" ? "descuento" : "monto fijo"}</span>
                </div>
                {c.description && <p className={styles.couponDesc}>{c.description}</p>}
                <div className={styles.couponMeta}>
                  <span>Usado: {c.usedCount || 0}{c.maxUses > 0 ? `/${c.maxUses}` : ""}</span>
                  <span>{formatDate(c.expiresAt)}</span>
                </div>
                {c.minPurchase > 0 && <span className={styles.couponMin}>Mín: ${c.minPurchase?.toLocaleString()}</span>}
                <div className={styles.cardActions}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}><HiOutlinePencilSquare /> Editar</button>
                  {deleteConfirm === c.id ? (
                    <div className={styles.deleteConfirm}>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>Sí</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(null)}>No</button>
                    </div>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(c.id)} style={{ color: "var(--color-danger)" }}><HiOutlineTrash /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editId ? "Editar Cupón" : "Nuevo Cupón"}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><HiOutlineXMark /></button>
            </div>
            <div className={styles.modalBody}>
              <div className="admin-form-group">
                <label className="admin-form-label">Código *</label>
                <input className="admin-form-input" value={form.code} onChange={(e) => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="DESCUENTO20" style={{ fontFamily: "monospace", letterSpacing: "0.1em", fontWeight: 700 }} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Descripción</label>
                <input className="admin-form-input" value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} placeholder="20% de descuento en toda la tienda" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="admin-form-group">
                  <label className="admin-form-label">Tipo</label>
                  <select className="admin-form-select" value={form.type} onChange={(e) => setForm(p => ({ ...p, type: e.target.value }))}>
                    <option value="percentage">Porcentaje (%)</option>
                    <option value="fixed">Monto fijo ($)</option>
                  </select>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Valor</label>
                  <input type="number" className="admin-form-input" value={form.value} onChange={(e) => setForm(p => ({ ...p, value: e.target.value }))} min={0} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="admin-form-group">
                  <label className="admin-form-label">Compra mínima</label>
                  <input type="number" className="admin-form-input" value={form.minPurchase} onChange={(e) => setForm(p => ({ ...p, minPurchase: e.target.value }))} min={0} placeholder="0 = sin mínimo" />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Usos máximos</label>
                  <input type="number" className="admin-form-input" value={form.maxUses} onChange={(e) => setForm(p => ({ ...p, maxUses: e.target.value }))} min={0} placeholder="0 = ilimitado" />
                </div>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Fecha de expiración</label>
                <input type="date" className="admin-form-input" value={form.expiresAt} onChange={(e) => setForm(p => ({ ...p, expiresAt: e.target.value }))} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label className="admin-form-label" style={{ marginBottom: 0 }}>Activo</label>
                <label className="toggle-switch"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm(p => ({ ...p, isActive: e.target.checked }))} /><span className="toggle-slider" /></label>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.code.trim()}>{saving ? "Guardando..." : editId ? "Guardar" : "Crear Cupón"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
