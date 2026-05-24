"use client";

import { useState, useEffect } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import ImageUploader from "@/components/admin/ImageUploader";
import { useAdminLayout } from "../layout";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { getStoreSettings, saveStoreSettings } from "@/lib/supabase-queries";
import { supabase } from "@/lib/supabase";
import adminStyles from "../admin.module.css";

export default function ConfiguracionPage() {
  const { toggleSidebar } = useAdminLayout();
  const { canManage } = useAuth();
  const { defaultSettings } = useStore();
  const [form, setForm] = useState(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const data = await getStoreSettings();
    if (data) {
      setForm({ ...defaultSettings, ...data });
    }
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleNestedChange = (parent, field, value) => {
    setForm((prev) => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value },
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!canManage("settings")) {
      alert("Usted no tiene los permisos para realizar esta accion");
      return;
    }
    setSaving(true);
    try {
      await saveStoreSettings(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Error saving:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AdminHeader
        title="Configuración"
        subtitle="Datos generales de tu tienda"
        onMenuToggle={toggleSidebar}
      />

      <div className={adminStyles.pageContent}>
        <div className={adminStyles.twoColumns}>
          {/* Left column */}
          <div>
            {/* Datos básicos */}
            <div className="admin-card" style={{ marginBottom: "1.5rem" }}>
              <div className="admin-card-header">
                <h3 className="admin-card-title">Datos de la Tienda</h3>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Nombre de la Tienda</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Ej: Mi Tienda Online"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Slogan</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={form.slogan}
                  onChange={(e) => handleChange("slogan", e.target.value)}
                  placeholder="Ej: Los mejores productos al mejor precio"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Descripción</label>
                <textarea
                  className="admin-form-textarea"
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  placeholder="Describe brevemente tu tienda..."
                  rows={3}
                />
              </div>
            </div>

            {/* Notificaciones de Pedidos */}
            <div className="admin-card" style={{ marginBottom: "1.5rem" }}>
              <div className="admin-card-header">
                <h3 className="admin-card-title">Notificaciones de Pedidos</h3>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Email Principal del Propietario</label>
                <input
                  type="email"
                  className="admin-form-input"
                  value={form.notifications?.ownerEmail || ""}
                  onChange={(e) => handleNestedChange("notifications", "ownerEmail", e.target.value)}
                  placeholder="admin@tutienda.com"
                />
                <span className="admin-form-hint">Donde recibirás los avisos de nuevos pedidos</span>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Email Adicional 1</label>
                <input
                  type="email"
                  className="admin-form-input"
                  value={form.notifications?.extraEmail1 || ""}
                  onChange={(e) => handleNestedChange("notifications", "extraEmail1", e.target.value)}
                  placeholder="socio1@tutienda.com"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Email Adicional 2</label>
                <input
                  type="email"
                  className="admin-form-input"
                  value={form.notifications?.extraEmail2 || ""}
                  onChange={(e) => handleNestedChange("notifications", "extraEmail2", e.target.value)}
                  placeholder="socio2@tutienda.com"
                />
              </div>

              <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--admin-border)" }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    const email = form.notifications?.ownerEmail;
                    if (!email) return alert("Ingresa un email principal primero");
                    try {
                      await supabase.functions.invoke("send-order-email", {
                        body: {
                          order: {
                            id: "TEST-123",
                            total: 0,
                            subtotal: 0,
                            discount: 0,
                            shipping: 0,
                            items: [{ name: "Producto de Prueba", quantity: 1, price: 0 }],
                            customer: { name: "Prueba de Sistema", email: email, phone: "000", address: "Calle Prueba", city: "Ciudad" }
                          },
                          storeSettings: form,
                          pdfBase64: ""
                        }
                      });
                      alert("¡Correo de prueba enviado con éxito! Revisa tu bandeja de entrada (y spam).");
                    } catch (e) {
                      alert("Error: " + (e.message || e.details || "Error desconocido"));
                    }
                  }}
                >
                  Enviar Correo de Prueba (Pedido)
                </button>
              </div>
            </div>

            {/* Notificaciones de Contacto */}
            <div className="admin-card" style={{ marginBottom: "1.5rem" }}>
              <div className="admin-card-header">
                <h3 className="admin-card-title">Notificaciones de Contacto</h3>
              </div>

              <p className="admin-form-hint" style={{ marginBottom: "1rem" }}>
                Configura hasta 3 correos para recibir los mensajes del formulario de contacto.
              </p>

              <div className="admin-form-group">
                <label className="admin-form-label">Email Receptor 1</label>
                <input
                  type="email"
                  className="admin-form-input"
                  value={form.contactNotifications?.email1 || ""}
                  onChange={(e) => handleNestedChange("contactNotifications", "email1", e.target.value)}
                  placeholder="admin@tutienda.com"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Email Receptor 2</label>
                <input
                  type="email"
                  className="admin-form-input"
                  value={form.contactNotifications?.email2 || ""}
                  onChange={(e) => handleNestedChange("contactNotifications", "email2", e.target.value)}
                  placeholder="ventas@tutienda.com"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Email Receptor 3</label>
                <input
                  type="email"
                  className="admin-form-input"
                  value={form.contactNotifications?.email3 || ""}
                  onChange={(e) => handleNestedChange("contactNotifications", "email3", e.target.value)}
                  placeholder="soporte@tutienda.com"
                />
              </div>

              <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--admin-border)" }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    const emails = [
                      form.contactNotifications?.email1,
                      form.contactNotifications?.email2,
                      form.contactNotifications?.email3,
                    ].filter(e => e && e.includes("@"));

                    if (emails.length === 0) return alert("Ingresa al menos un email de contacto primero");
                    
                    try {
                      await supabase.functions.invoke("send-contact-email", {
                        body: {
                          name: "Usuario de Prueba",
                          email: "prueba@cliente.com",
                          message: "Este es un mensaje de prueba desde el panel de administración.",
                          storeSettings: form
                        }
                      });
                      alert("¡Correo de contacto enviado con éxito!");
                    } catch (e) {
                      alert("Error: " + (e.message || e.details || "Error desconocido"));
                    }
                  }}
                >
                  Probar Envío de Contacto
                </button>
              </div>
            </div>

            {/* Contacto */}
            <div className="admin-card" style={{ marginBottom: "1.5rem" }}>
              <div className="admin-card-header">
                <h3 className="admin-card-title">Información de Contacto</h3>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Email</label>
                <input
                  type="email"
                  className="admin-form-input"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="contacto@tutienda.com"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Teléfono</label>
                <input
                  type="tel"
                  className="admin-form-input"
                  value={form.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="+52 123 456 7890"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Dirección</label>
                <textarea
                  className="admin-form-textarea"
                  value={form.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="Dirección física de tu negocio"
                  rows={2}
                />
              </div>
            </div>


            {/* SEO */}
            <div className="admin-card">
              <div className="admin-card-header">
                <h3 className="admin-card-title">SEO</h3>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Meta Título</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={form.seo?.metaTitle || ""}
                  onChange={(e) =>
                    handleNestedChange("seo", "metaTitle", e.target.value)
                  }
                  placeholder="Título para buscadores"
                />
                <span className="admin-form-hint">
                  Se muestra en la pestaña del navegador y en Google
                </span>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Meta Descripción</label>
                <textarea
                  className="admin-form-textarea"
                  value={form.seo?.metaDescription || ""}
                  onChange={(e) =>
                    handleNestedChange("seo", "metaDescription", e.target.value)
                  }
                  placeholder="Descripción para buscadores (máx. 160 caracteres)"
                  rows={3}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Palabras Clave</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={form.seo?.keywords || ""}
                  onChange={(e) =>
                    handleNestedChange("seo", "keywords", e.target.value)
                  }
                  placeholder="tienda, productos, comprar (separadas por coma)"
                />
              </div>
            </div>
          </div>

          {/* Right column */}
          <div>
            {/* Logo y Favicon */}
            <div className="admin-card" style={{ marginBottom: "1.5rem" }}>
              <div className="admin-card-header">
                <h3 className="admin-card-title">Logo y Favicon</h3>
              </div>

              <ImageUploader
                label="Logo"
                value={form.logo}
                onChange={(url, file) => {
                  handleChange("logo", url);
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      const img = new Image();
                      img.onload = () => {
                        const maxW = 300;
                        const scale = Math.min(maxW / img.width, 1);
                        const canvas = document.createElement("canvas");
                        canvas.width = img.width * scale;
                        canvas.height = img.height * scale;
                        const ctx = canvas.getContext("2d");
                        ctx.fillStyle = "#FFFFFF";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        handleChange("logoBase64", canvas.toDataURL("image/jpeg", 0.9));
                      };
                      img.src = e.target.result;
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                folder="branding"
                placeholder="Sube el logo de tu tienda"
              />

              <ImageUploader
                label="Favicon"
                value={form.favicon}
                onChange={(url) => handleChange("favicon", url)}
                folder="branding"
                placeholder="Sube el favicon (icono del navegador)"
              />
            </div>

            {/* Redes sociales */}
            <div className="admin-card">
              <div className="admin-card-header">
                <h3 className="admin-card-title">Redes Sociales</h3>
              </div>

              {[
                { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/tutienda" },
                { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/tutienda" },
                { key: "twitter", label: "Twitter / X", placeholder: "https://x.com/tutienda" },
                { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@tutienda" },
                { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@tutienda" },
                { key: "whatsapp", label: "WhatsApp", placeholder: "+52 123 456 7890" },
              ].map((social) => (
                <div key={social.key} className="admin-form-group">
                  <label className="admin-form-label">{social.label}</label>
                  <input
                    type="text"
                    className="admin-form-input"
                    value={form.socialMedia?.[social.key] || ""}
                    onChange={(e) =>
                      handleNestedChange("socialMedia", social.key, e.target.value)
                    }
                    placeholder={social.placeholder}
                  />
                </div>
              ))}
            </div>

            {/* Información Legal */}
            <div className="admin-card" style={{ marginTop: "1.5rem" }}>
              <div className="admin-card-header">
                <h3 className="admin-card-title">Información Legal</h3>
              </div>
              <div className="admin-form-hint" style={{ marginBottom: "1rem" }}>
                Datos requeridos para cumplir con la Ley de Protección al Consumidor de El Salvador. Se mostrarán en el footer y en las páginas legales.
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Razón Social</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={form.legalInfo?.businessName || ""}
                  onChange={(e) => handleNestedChange("legalInfo", "businessName", e.target.value)}
                  placeholder="Ej: DalseShop, S.A. de C.V."
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">NIT (Número de Identificación Tributaria)</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={form.legalInfo?.nit || ""}
                  onChange={(e) => handleNestedChange("legalInfo", "nit", e.target.value)}
                  placeholder="Ej: 0614-123456-001-0"
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Teléfono Oficial</label>
                <input
                  type="tel"
                  className="admin-form-input"
                  value={form.legalInfo?.phone || ""}
                  onChange={(e) => handleNestedChange("legalInfo", "phone", e.target.value)}
                  placeholder="+503 1234 5678"
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Correo Electrónico Oficial</label>
                <input
                  type="email"
                  className="admin-form-input"
                  value={form.legalInfo?.email || ""}
                  onChange={(e) => handleNestedChange("legalInfo", "email", e.target.value)}
                  placeholder="legal@dalseshop.com"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Bar */}
      <div className={adminStyles.saveBar}>
        {saved && (
          <span className={adminStyles.saveBarMessage}>✓ Cambios guardados</span>
        )}
        {canManage("settings") ? (
          <button
            className="btn btn-primary btn-lg"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar Cambios"}
          </button>
        ) : (
          <span className="btn btn-primary btn-lg" style={{ opacity: 0.5, cursor: "not-allowed" }} title="No tienes permisos para guardar configuración">
            Solo lectura
          </span>
        )}
      </div>
    </>
  );
}
