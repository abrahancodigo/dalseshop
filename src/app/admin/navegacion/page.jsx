"use client";

import { useState, useEffect, useRef } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminLayout } from "../layout";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { getStoreNavigation, saveStoreNavigation } from "@/lib/supabase-queries";
import { uploadImage } from "@/lib/storage";
import { sanitizeHtml } from "@/lib/sanitize";
import {
  HiOutlinePlusCircle, HiOutlineChevronUp, HiOutlineChevronDown, HiOutlineTrash,
  HiOutlineBold, HiOutlineItalic, HiOutlineLink, HiOutlinePhoto,
  HiOutlineListBullet, HiOutlineQueueList,
} from "react-icons/hi2";
import adminStyles from "../admin.module.css";
import styles from "./navegacion.module.css";

export default function NavegacionPage() {
  const { toggleSidebar } = useAdminLayout();
  const { canManage } = useAuth();
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
        columns: [...(prev.footer?.columns || []), { title: "", content: "" }],
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

  // ─── Rich Text Helpers ───
  const fileInputRefs = useRef({});
  const [uploadingCol, setUploadingCol] = useState(null);

  const insertAtCursor = (textarea, text, wrapSelection) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    let replacement;
    if (wrapSelection) {
      const [before, after] = wrapSelection;
      replacement = before + selected + after;
    } else {
      replacement = text;
    }
    const newValue = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
    const newCursor = start + replacement.length;
    return { value: newValue, cursor: newCursor };
  };

  const applyFormat = (colIndex, textareaEl, [openTag, closeTag]) => {
    const result = insertAtCursor(textareaEl, "", [openTag, closeTag]);
    updateFooterColumn(colIndex, "content", result.value);
    setTimeout(() => {
      textareaEl.focus();
      textareaEl.selectionStart = result.cursor;
      textareaEl.selectionEnd = result.cursor;
    }, 0);
  };

  const handleToolbarAction = (colIndex, action) => {
    const ta = document.getElementById(`footer-col-${colIndex}`);
    if (!ta) return;
    switch (action) {
      case "bold": return applyFormat(colIndex, ta, ["<strong>", "</strong>"]);
      case "italic": return applyFormat(colIndex, ta, ["<em>", "</em>"]);
      case "ul": return applyFormat(colIndex, ta, ["\n<ul>\n  <li>", "</li>\n</ul>"]);
      case "ol": return applyFormat(colIndex, ta, ["\n<ol>\n  <li>", "</li>\n</ol>"]);
      case "p": return applyFormat(colIndex, ta, ["<p>", "</p>"]);
      case "link": {
        const url = prompt("URL del enlace:", "https://");
        if (url) applyFormat(colIndex, ta, [`<a href="${url}">`, "</a>"]);
        return;
      }
      case "image": {
        fileInputRefs.current[colIndex]?.click();
        return;
      }
    }
  };

  const handleImageUpload = async (colIndex, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCol(colIndex);
    try {
      const url = await uploadImage(file, "footer");
      const ta = document.getElementById(`footer-col-${colIndex}`);
      if (ta) {
        const result = insertAtCursor(ta, `<img src="${url}" alt="Imagen" style="max-width:100%;height:auto;border-radius:8px;margin:0.5rem 0" />`);
        updateFooterColumn(colIndex, "content", result.value);
        setTimeout(() => { ta.focus(); ta.selectionStart = result.cursor; ta.selectionEnd = result.cursor; }, 0);
      }
    } catch (err) {
      console.error("Error uploading image:", err);
      alert("Error al subir imagen");
    } finally {
      setUploadingCol(null);
      e.target.value = "";
    }
  };

  const handleFooterChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      footer: { ...prev.footer, [field]: value },
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!canManage("navigation")) {
      alert("Usted no tiene los permisos para realizar esta accion");
      return;
    }
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
                      value={col.title || ""}
                      onChange={(e) => updateFooterColumn(colIndex, "title", e.target.value)}
                      placeholder="Título de columna"
                      style={{ flex: 1, fontWeight: 600 }}
                    />
                    <button onClick={() => removeFooterColumn(colIndex)} className={styles.deleteBtn}>
                      <HiOutlineTrash />
                    </button>
                  </div>

                  {/* Toolbar */}
                  <div className={styles.editorToolbar}>
                    <button type="button" className={styles.toolbarBtn} title="Negrita" onClick={() => handleToolbarAction(colIndex, "bold")}>
                      <HiOutlineBold />
                    </button>
                    <button type="button" className={styles.toolbarBtn} title="Cursiva" onClick={() => handleToolbarAction(colIndex, "italic")}>
                      <HiOutlineItalic />
                    </button>
                    <button type="button" className={styles.toolbarBtn} title="Enlace" onClick={() => handleToolbarAction(colIndex, "link")}>
                      <HiOutlineLink />
                    </button>
                    <span className={styles.toolbarSeparator} />
                    <button type="button" className={styles.toolbarBtn} title="Lista" onClick={() => handleToolbarAction(colIndex, "ul")}>
                      <HiOutlineListBullet />
                    </button>
                    <button type="button" className={styles.toolbarBtn} title="Lista numerada" onClick={() => handleToolbarAction(colIndex, "ol")}>
                      <HiOutlineQueueList />
                    </button>
                    <button type="button" className={styles.toolbarBtn} title="Párrafo" onClick={() => handleToolbarAction(colIndex, "p")}>
                      P
                    </button>
                    <span className={styles.toolbarSeparator} />
                    <button
                      type="button"
                      className={`${styles.toolbarBtn} ${uploadingCol === colIndex ? styles.toolbarBtnUploading : ""}`}
                      title="Subir imagen"
                      onClick={() => handleToolbarAction(colIndex, "image")}
                      disabled={uploadingCol === colIndex}
                    >
                      <HiOutlinePhoto />
                    </button>
                    <input
                      ref={(el) => { fileInputRefs.current[colIndex] = el; }}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => handleImageUpload(colIndex, e)}
                    />
                    {uploadingCol === colIndex && (
                      <span style={{ fontSize: "0.7rem", color: "var(--admin-text-muted)", marginLeft: "0.25rem" }}>Subiendo...</span>
                    )}
                  </div>

                  <textarea
                    id={`footer-col-${colIndex}`}
                    className="admin-form-input"
                    value={col.content || ""}
                    onChange={(e) => updateFooterColumn(colIndex, "content", e.target.value)}
                    placeholder='<p>Escribe tu contenido aquí o usa la barra de herramientas...</p>'
                    rows={8}
                    style={{ width: "100%", resize: "vertical", fontFamily: "monospace", fontSize: "0.8125rem", lineHeight: 1.6, marginTop: "0.5rem" }}
                  />

                  {/* Preview */}
                  {(col.content || col.links) && (
                    <details style={{ marginTop: "0.5rem", fontSize: "0.8125rem" }}>
                      <summary style={{ cursor: "pointer", color: "var(--admin-text-muted)" }}>Vista previa</summary>
                      <div
                        style={{
                          marginTop: "0.5rem",
                          padding: "0.75rem",
                          background: "var(--admin-card-bg, #fff)",
                          border: "1px solid var(--admin-border-color, #e2e8f0)",
                          borderRadius: "6px",
                          fontSize: "0.8125rem",
                          lineHeight: 1.6,
                          maxHeight: 300,
                          overflow: "auto",
                        }}
                      >
                        {col.content ? (
                          <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(col.content) }} />
                        ) : col.links ? (
                          <ul style={{ paddingLeft: "1.25rem", margin: 0 }}>
                            {col.links.map((l, i) => (
                              <li key={i}>{l.label} &rarr; {l.href}</li>
                            ))}
                          </ul>
                        ) : (
                          <span style={{ color: "var(--admin-text-muted)", fontStyle: "italic" }}>Sin contenido</span>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Save Bar */}
      <div className={adminStyles.saveBar}>
        {saved && <span className={adminStyles.saveBarMessage}>✓ Navegación guardada</span>}
        {canManage("navigation") ? (
          <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar Navegación"}
          </button>
        ) : (
          <span className="btn btn-primary btn-lg" style={{ opacity: 0.5, cursor: "not-allowed" }} title="No tienes permisos para guardar navegación">
            Solo lectura
          </span>
        )}
      </div>
    </>
  );
}
