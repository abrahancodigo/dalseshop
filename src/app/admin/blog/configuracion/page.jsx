"use client";

import { useState, useEffect } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminLayout } from "../../layout";
import { useAuth } from "@/context/AuthContext";
import { getBlogConfig, saveBlogConfig } from "@/lib/supabase-queries";
import adminStyles from "../../admin.module.css";

export default function BlogConfigPage() {
  const { toggleSidebar } = useAdminLayout();
  const { canManage } = useAuth();
  const [form, setForm] = useState({
    heroTitle: "",
    heroSubtitle: "",
    readersCount: "+120K",
    publishedCount: "",
    rating: "4.9",
    newsletterEnabled: true,
    newsletterTitle: "Recibe contenido premium cada semana",
    newsletterText: "Únete a miles de lectores que reciben artículos exclusivos directamente en su correo.",
    bgColor: "#0D1B2A",
    textColor: "#FFFFFF",
    cardBg: "rgba(255,255,255,0.05)",
    accentColor: "",
    gradientFrom: "",
    gradientTo: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    try {
      const data = await getBlogConfig();
      if (data) setForm((p) => ({ ...p, ...data }));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleChange = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!canManage("blog")) {
      alert("Usted no tiene los permisos para realizar esta accion");
      return;
    }
    setSaving(true);
    try {
      await saveBlogConfig(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  if (loading) return (<><AdminHeader title="Blog Config" onMenuToggle={toggleSidebar} /><div className="loading-screen" style={{ minHeight: 400 }}><div className="spinner" /></div></>);

  return (
    <>
      <AdminHeader title="Configuración del Blog" subtitle="Personaliza la página principal del blog" onMenuToggle={toggleSidebar} />
      <div className={adminStyles.pageContent}>
        <div className="admin-card" style={{ marginBottom: "1.5rem" }}>
          <div className="admin-card-header"><h3 className="admin-card-title">Colores del Blog</h3></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="admin-form-group">
              <label className="admin-form-label">Fondo del blog</label>
              <input className="admin-form-input" value={form.bgColor} onChange={(e) => handleChange("bgColor", e.target.value)} placeholder="#0D1B2A" />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Color de texto</label>
              <input className="admin-form-input" value={form.textColor} onChange={(e) => handleChange("textColor", e.target.value)} placeholder="#FFFFFF" />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Fondo de tarjetas</label>
              <input className="admin-form-input" value={form.cardBg} onChange={(e) => handleChange("cardBg", e.target.value)} placeholder="rgba(255,255,255,0.05)" />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Color acento (opcional)</label>
              <input className="admin-form-input" value={form.accentColor} onChange={(e) => handleChange("accentColor", e.target.value)} placeholder="usa el del tema si está vacío" />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Gradiente desde (opcional)</label>
              <input className="admin-form-input" value={form.gradientFrom} onChange={(e) => handleChange("gradientFrom", e.target.value)} placeholder="usa acento del tema" />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Gradiente hasta (opcional)</label>
              <input className="admin-form-input" value={form.gradientTo} onChange={(e) => handleChange("gradientTo", e.target.value)} placeholder="usa primario del tema" />
            </div>
          </div>
          <p style={{ color: "var(--admin-text-muted)", fontSize: "0.8125rem", marginTop: "0.5rem" }}>Si se dejan vacíos, usan los colores definidos en Admin &gt; Tema.</p>
        </div>

        <div className="admin-card" style={{ marginBottom: "1.5rem" }}>
          <div className="admin-card-header"><h3 className="admin-card-title">Hero Section</h3></div>
          <div className="admin-form-group"><label className="admin-form-label">Título del Hero</label><input className="admin-form-input" value={form.heroTitle} onChange={(e) => handleChange("heroTitle", e.target.value)} placeholder="El futuro del blogging digital" /><span className="admin-form-hint">Usa *texto* para resaltar con gradiente</span></div>
          <div className="admin-form-group"><label className="admin-form-label">Subtítulo</label><textarea className="admin-form-textarea" value={form.heroSubtitle} onChange={(e) => handleChange("heroSubtitle", e.target.value)} rows={2} placeholder="Descubre artículos premium sobre tecnología..." /></div>
        </div>

        <div className="admin-card" style={{ marginBottom: "1.5rem" }}>
          <div className="admin-card-header"><h3 className="admin-card-title">Estadísticas</h3></div>
          <div className="admin-form-group"><label className="admin-form-label">Lectores mensuales</label><input className="admin-form-input" value={form.readersCount} onChange={(e) => handleChange("readersCount", e.target.value)} placeholder="+120K" /></div>
          <div className="admin-form-group"><label className="admin-form-label">Valoración promedio</label><input className="admin-form-input" value={form.rating} onChange={(e) => handleChange("rating", e.target.value)} placeholder="4.9" /></div>
          <p style={{ color: "var(--admin-text-muted)", fontSize: "0.8125rem" }}>Los artículos publicados se cuentan automáticamente.</p>
        </div>

        <div className="admin-card">
          <div className="admin-card-header"><h3 className="admin-card-title">Newsletter</h3></div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <label className="admin-form-label" style={{ marginBottom: 0 }}>Mostrar sección de newsletter</label>
            <label className="toggle-switch"><input type="checkbox" checked={form.newsletterEnabled} onChange={(e) => handleChange("newsletterEnabled", e.target.checked)} /><span className="toggle-slider" /></label>
          </div>
          <div className="admin-form-group"><label className="admin-form-label">Título del newsletter</label><input className="admin-form-input" value={form.newsletterTitle} onChange={(e) => handleChange("newsletterTitle", e.target.value)} /></div>
          <div className="admin-form-group"><label className="admin-form-label">Texto del newsletter</label><textarea className="admin-form-textarea" value={form.newsletterText} onChange={(e) => handleChange("newsletterText", e.target.value)} rows={2} /></div>
        </div>
      </div>
      <div className={adminStyles.saveBar}>
        {saved && <span className={adminStyles.saveBarMessage}>✓ Configuración guardada</span>}
        {canManage("blog") ? (
          <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "Guardar Configuración"}</button>
        ) : (
          <span className="btn btn-primary btn-lg" style={{ opacity: 0.5, cursor: "not-allowed" }} title="No tienes permisos para guardar configuración del blog">
            Solo lectura
          </span>
        )}
      </div>
    </>
  );
}
