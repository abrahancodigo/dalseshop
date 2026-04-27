"use client";

import { useState, useEffect } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminLayout } from "../layout";
import { useStore } from "@/context/StoreContext";
import { getStoreNavigation, saveStoreNavigation } from "@/lib/firestore";
import {
  HiOutlinePlusCircle,
  HiOutlineTrash,
  HiOutlineChevronUp,
  HiOutlineChevronDown,
} from "react-icons/hi2";
import adminStyles from "../admin.module.css";
import styles from "./navegacion.module.css";

export default function NavegacionPage() {
  const { toggleSidebar } = useAdminLayout();
  const { defaultNavigation } = useStore();
  const [form, setForm] = useState(defaultNavigation);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadNavigation();
  }, []);

  const loadNavigation = async () => {
    try {
      const data = await getStoreNavigation();
      if (data) setForm({ ...defaultNavigation, ...data });
    } catch (err) {
      console.error("Error:", err);
    }
  };

  // ─── Header Menu ───
  const addMenuItem = () => {
    setForm((prev) => ({
      ...prev,
      header: {
        ...prev.header,
        menuItems: [...(prev.header?.menuItems || []), { label: "", href: "/", order: prev.header?.menuItems?.length || 0 }],
      },
    }));
    setSaved(false);
  };

  const updateMenuItem = (index, field, value) => {
    setForm((prev) => {
      const items = [...(prev.header?.menuItems || [])];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, header: { ...prev.header, menuItems: items } };
    });
    setSaved(false);
  };

  const removeMenuItem = (index) => {
    setForm((prev) => ({
      ...prev,
      header: {
        ...prev.header,
        menuItems: prev.header.menuItems.filter((_, i) => i !== index),
      },
    }));
    setSaved(false);
  };

  const moveMenuItem = (index, direction) => {
    setForm((prev) => {
      const items = [...(prev.header?.menuItems || [])];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= items.length) return prev;
      [items[index], items[newIndex]] = [items[newIndex], items[index]];
      return { ...prev, header: { ...prev.header, menuItems: items } };
    });
    setSaved(false);
  };

  // ─── Footer Columns ───
  const addFooterColumn = () => {
    setForm((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        columns: [...(prev.footer?.columns || []), { title: "", links: [{ label: "", href: "/" }] }],
      },
    }));
    setSaved(false);
  };

  const updateFooterColumn = (colIndex, field, value) => {
    setForm((prev) => {
      const columns = [...(prev.footer?.columns || [])];
      columns[colIndex] = { ...columns[colIndex], [field]: value };
      return { ...prev, footer: { ...prev.footer, columns } };
    });
    setSaved(false);
  };

  const removeFooterColumn = (colIndex) => {
    setForm((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        columns: prev.footer.columns.filter((_, i) => i !== colIndex),
      },
    }));
    setSaved(false);
  };

  const addFooterLink = (colIndex) => {
    setForm((prev) => {
      const columns = [...(prev.footer?.columns || [])];
      columns[colIndex] = {
        ...columns[colIndex],
        links: [...(columns[colIndex].links || []), { label: "", href: "/" }],
      };
      return { ...prev, footer: { ...prev.footer, columns } };
    });
    setSaved(false);
  };

  const updateFooterLink = (colIndex, linkIndex, field, value) => {
    setForm((prev) => {
      const columns = [...(prev.footer?.columns || [])];
      const links = [...(columns[colIndex].links || [])];
      links[linkIndex] = { ...links[linkIndex], [field]: value };
      columns[colIndex] = { ...columns[colIndex], links };
      return { ...prev, footer: { ...prev.footer, columns } };
    });
    setSaved(false);
  };

  const removeFooterLink = (colIndex, linkIndex) => {
    setForm((prev) => {
      const columns = [...(prev.footer?.columns || [])];
      columns[colIndex] = {
        ...columns[colIndex],
        links: columns[colIndex].links.filter((_, i) => i !== linkIndex),
      };
      return { ...prev, footer: { ...prev.footer, columns } };
    });
    setSaved(false);
  };

  const handleFooterChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      footer: { ...prev.footer, [field]: value },
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveStoreNavigation(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AdminHeader
        title="Navegación"
        subtitle="Configura el menú y el pie de página"
        onMenuToggle={toggleSidebar}
      />

      <div className={adminStyles.pageContent}>
        <div className={adminStyles.twoColumns}>
          {/* Header Menu */}
          <div>
            <div className="admin-card">
              <div className="admin-card-header">
                <h3 className="admin-card-title">Menú Principal (Header)</h3>
                <button className="btn btn-primary btn-sm" onClick={addMenuItem}>
                  <HiOutlinePlusCircle /> Agregar
                </button>
              </div>

              {(form.header?.menuItems || []).length === 0 ? (
                <p style={{ color: "var(--admin-text-muted)", textAlign: "center", padding: "1rem" }}>
                  Sin elementos de menú
                </p>
              ) : (
                <div className={styles.menuList}>
                  {form.header.menuItems.map((item, index) => (
                    <div key={index} className={styles.menuItem}>
                      <div className={styles.menuInputs}>
                        <input
                          className="admin-form-input"
                          value={item.label}
                          onChange={(e) => updateMenuItem(index, "label", e.target.value)}
                          placeholder="Texto"
                          style={{ flex: 1 }}
                        />
                        <input
                          className="admin-form-input"
                          value={item.href}
                          onChange={(e) => updateMenuItem(index, "href", e.target.value)}
                          placeholder="/ruta"
                          style={{ flex: 1 }}
                        />
                      </div>
                      <div className={styles.menuActions}>
                        <button onClick={() => moveMenuItem(index, -1)} disabled={index === 0} className={styles.moveBtn}>
                          <HiOutlineChevronUp />
                        </button>
                        <button onClick={() => moveMenuItem(index, 1)} disabled={index === form.header.menuItems.length - 1} className={styles.moveBtn}>
                          <HiOutlineChevronDown />
                        </button>
                        <button onClick={() => removeMenuItem(index)} className={styles.deleteBtn}>
                          <HiOutlineTrash />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div>
            <div className="admin-card" style={{ marginBottom: "1.5rem" }}>
              <div className="admin-card-header">
                <h3 className="admin-card-title">Pie de Página (Footer)</h3>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Texto de Copyright</label>
                <input
                  className="admin-form-input"
                  value={form.footer?.copyright || ""}
                  onChange={(e) => handleFooterChange("copyright", e.target.value)}
                  placeholder="© 2026 Mi Tienda"
                />
              </div>

              <div className={styles.toggleRow}>
                <label className="admin-form-label" style={{ marginBottom: 0 }}>
                  Mostrar Redes Sociales
                </label>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={form.footer?.showSocialLinks || false}
                    onChange={(e) => handleFooterChange("showSocialLinks", e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>

            {/* Footer Columns */}
            <div className="admin-card">
              <div className="admin-card-header">
                <h3 className="admin-card-title">Columnas del Footer</h3>
                <button className="btn btn-primary btn-sm" onClick={addFooterColumn}>
                  <HiOutlinePlusCircle /> Columna
                </button>
              </div>

              {(form.footer?.columns || []).map((col, colIndex) => (
                <div key={colIndex} className={styles.footerColumn}>
                  <div className={styles.footerColumnHeader}>
                    <input
                      className="admin-form-input"
                      value={col.title}
                      onChange={(e) => updateFooterColumn(colIndex, "title", e.target.value)}
                      placeholder="Título de columna"
                      style={{ flex: 1 }}
                    />
                    <button onClick={() => removeFooterColumn(colIndex)} className={styles.deleteBtn}>
                      <HiOutlineTrash />
                    </button>
                  </div>

                  {(col.links || []).map((link, linkIndex) => (
                    <div key={linkIndex} className={styles.footerLink}>
                      <input
                        className="admin-form-input"
                        value={link.label}
                        onChange={(e) => updateFooterLink(colIndex, linkIndex, "label", e.target.value)}
                        placeholder="Texto"
                        style={{ flex: 1, fontSize: "0.8125rem" }}
                      />
                      <input
                        className="admin-form-input"
                        value={link.href}
                        onChange={(e) => updateFooterLink(colIndex, linkIndex, "href", e.target.value)}
                        placeholder="/ruta"
                        style={{ flex: 1, fontSize: "0.8125rem" }}
                      />
                      <button onClick={() => removeFooterLink(colIndex, linkIndex)} className={styles.deleteBtnSm}>
                        <HiOutlineTrash />
                      </button>
                    </div>
                  ))}

                  <button className="btn btn-ghost btn-sm" onClick={() => addFooterLink(colIndex)} style={{ marginTop: "0.375rem" }}>
                    <HiOutlinePlusCircle /> Link
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Save Bar */}
      <div className={adminStyles.saveBar}>
        {saved && <span className={adminStyles.saveBarMessage}>✓ Navegación guardada</span>}
        <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar Navegación"}
        </button>
      </div>
    </>
  );
}
