"use client";

import { useState, useEffect } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminLayout } from "../layout";
import { useAuth } from "@/context/AuthContext";
import { getShippingConfig, saveShippingConfig } from "@/lib/supabase-queries";
import { HiOutlineTruck, HiOutlinePlusCircle, HiOutlineTrash } from "react-icons/hi2";
import adminStyles from "../admin.module.css";

const defaultShipping = {
  freeShipping: true,
  freeShippingMin: 0,
  flatRate: 0,
  zones: [],
};

export default function EnviosPage() {
  const { toggleSidebar } = useAdminLayout();
  const { canManage } = useAuth();
  const [form, setForm] = useState(defaultShipping);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    try {
      const data = await getShippingConfig();
      if (data) setForm({ ...defaultShipping, ...data });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleChange = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
    setSaved(false);
  };

  const addZone = () => {
    setForm((p) => ({ ...p, zones: [...(p.zones || []), { name: "", cost: 0 }] }));
    setSaved(false);
  };

  const updateZone = (i, field, value) => {
    setForm((p) => {
      const z = [...(p.zones || [])];
      z[i] = { ...z[i], [field]: value };
      return { ...p, zones: z };
    });
    setSaved(false);
  };

  const removeZone = (i) => {
    setForm((p) => ({ ...p, zones: p.zones.filter((_, idx) => idx !== i) }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!canManage("shipping")) {
      alert("Usted no tiene los permisos para realizar esta accion");
      return;
    }
    setSaving(true);
    try {
      await saveShippingConfig({ ...form, flatRate: parseFloat(form.flatRate) || 0, freeShippingMin: parseFloat(form.freeShippingMin) || 0, zones: (form.zones || []).map((z) => ({ ...z, cost: parseFloat(z.cost) || 0 })) });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  if (loading) return (<><AdminHeader title="Envíos" onMenuToggle={toggleSidebar} /><div className="loading-screen" style={{ minHeight: 400 }}><div className="spinner" /></div></>);

  return (
    <>
      <AdminHeader title="Envíos" subtitle="Configuración de costos de envío" onMenuToggle={toggleSidebar} />
      <div className={adminStyles.pageContent}>
        <div style={{ maxWidth: 700 }}>
          <div className="admin-card" style={{ marginBottom: "1.5rem" }}>
            <div className="admin-card-header"><h3 className="admin-card-title"><HiOutlineTruck style={{ marginRight: 8 }} /> Envío General</h3></div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <label className="admin-form-label" style={{ marginBottom: 0 }}>Envío gratuito</label>
              <label className="toggle-switch"><input type="checkbox" checked={form.freeShipping} onChange={(e) => handleChange("freeShipping", e.target.checked)} /><span className="toggle-slider" /></label>
            </div>
            {form.freeShipping && (
              <div className="admin-form-group">
                <label className="admin-form-label">Compra mínima para envío gratis</label>
                <input type="number" className="admin-form-input" value={form.freeShippingMin} onChange={(e) => handleChange("freeShippingMin", e.target.value)} min={0} />
                <span className="admin-form-hint">0 = siempre gratis</span>
              </div>
            )}
            {!form.freeShipping && (
              <div className="admin-form-group">
                <label className="admin-form-label">Tarifa plana de envío ($)</label>
                <input type="number" className="admin-form-input" value={form.flatRate} onChange={(e) => handleChange("flatRate", e.target.value)} min={0} />
              </div>
            )}
          </div>

          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">Zonas de Envío</h3>
              <button className="btn btn-primary btn-sm" onClick={addZone}><HiOutlinePlusCircle /> Zona</button>
            </div>
            {(form.zones || []).length === 0 ? (
              <p style={{ color: "var(--admin-text-muted)", textAlign: "center", padding: "1rem" }}>Sin zonas. Se usará la tarifa general.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {form.zones.map((zone, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "center", padding: "0.5rem", background: "var(--admin-bg)", borderRadius: 10 }}>
                    <input className="admin-form-input" value={zone.name} onChange={(e) => updateZone(i, "name", e.target.value)} placeholder="Nombre de zona (ej: CDMX)" style={{ flex: 1 }} />
                    <input type="number" className="admin-form-input" value={zone.cost} onChange={(e) => updateZone(i, "cost", e.target.value)} placeholder="Costo" style={{ width: 100 }} min={0} />
                    <button onClick={() => removeZone(i)} style={{ width: 32, height: 32, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--admin-text-muted)", cursor: "pointer", border: "none", background: "none" }}><HiOutlineTrash /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className={adminStyles.saveBar}>
        {saved && <span className={adminStyles.saveBarMessage}>✓ Configuración guardada</span>}
        <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "Guardar Envíos"}</button>
      </div>
    </>
  );
}
