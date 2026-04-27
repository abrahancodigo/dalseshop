"use client";

import { useState, useEffect } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminLayout } from "../layout";
import { useStore } from "@/context/StoreContext";
import { getStoreTheme, saveStoreTheme } from "@/lib/firestore";
import adminStyles from "../admin.module.css";
import styles from "./tema.module.css";

const GOOGLE_FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Montserrat",
  "Poppins",
  "Lato",
  "Outfit",
  "Nunito",
  "Raleway",
  "Playfair Display",
  "Merriweather",
  "DM Sans",
  "Space Grotesk",
  "Archivo",
  "Sora",
];

const PRESET_PALETTES = [
  {
    name: "Violeta Moderno",
    primary: "#6C5CE7",
    secondary: "#0D1B2A",
    accent: "#00CEC9",
  },
  {
    name: "Azul Elegante",
    primary: "#0984E3",
    secondary: "#1A1A2E",
    accent: "#FDCB6E",
  },
  {
    name: "Rosa Vibrante",
    primary: "#E84393",
    secondary: "#2D1B33",
    accent: "#00CEC9",
  },
  {
    name: "Verde Natural",
    primary: "#00B894",
    secondary: "#1A2E1D",
    accent: "#FDCB6E",
  },
  {
    name: "Naranja Cálido",
    primary: "#E17055",
    secondary: "#2A1B0D",
    accent: "#0984E3",
  },
  {
    name: "Negro Premium",
    primary: "#2D3436",
    secondary: "#0A0A0A",
    accent: "#DFE6E9",
    bg: "#121212",
    text: "#FFFFFF"
  },
  {
    name: "Nieve Limpia (Claro)",
    primary: "#0984E3",
    secondary: "#F1F2F6",
    accent: "#6C5CE7",
    bg: "#FFFFFF",
    text: "#2F3542"
  },
  {
    name: "Menta Fresca (Claro)",
    primary: "#00B894",
    secondary: "#E8F8F5",
    accent: "#0984E3",
    bg: "#FFFFFF",
    text: "#2D3436"
  },
  {
    name: "Oro & Blanco (Claro)",
    primary: "#D4AF37",
    secondary: "#FAF9F6",
    accent: "#2D3436",
    bg: "#FFFFFF",
    text: "#1A1A1A"
  },
];

export default function TemaPage() {
  const { toggleSidebar } = useAdminLayout();
  const { defaultTheme } = useStore();
  const [form, setForm] = useState(defaultTheme);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    const data = await getStoreTheme();
    if (data) {
      setForm({ ...defaultTheme, ...data });
    }
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const applyPalette = (palette) => {
    setForm((prev) => ({
      ...prev,
      primaryColor: palette.primary,
      secondaryColor: palette.secondary,
      accentColor: palette.accent,
      ...(palette.bg && { backgroundColor: palette.bg }),
      ...(palette.text && { textColor: palette.text }),
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveStoreTheme(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Error saving theme:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AdminHeader
        title="Tema / Diseño"
        subtitle="Personaliza la apariencia de tu tienda"
        onMenuToggle={toggleSidebar}
      />

      <div className={adminStyles.pageContent}>
        <div className={adminStyles.twoColumns}>
          {/* Left - Colors */}
          <div>
            {/* Paletas preset */}
            <div className="admin-card" style={{ marginBottom: "1.5rem" }}>
              <div className="admin-card-header">
                <h3 className="admin-card-title">Paletas Predefinidas</h3>
              </div>
              <div className={styles.palettesGrid}>
                {PRESET_PALETTES.map((palette) => (
                  <button
                    key={palette.name}
                    className={styles.paletteBtn}
                    onClick={() => applyPalette(palette)}
                    title={palette.name}
                  >
                    <div className={styles.paletteColors}>
                      <div
                        className={styles.paletteColor}
                        style={{ background: palette.primary }}
                      />
                      <div
                        className={styles.paletteColor}
                        style={{ background: palette.secondary }}
                      />
                      <div
                        className={styles.paletteColor}
                        style={{ background: palette.accent }}
                      />
                    </div>
                    <span className={styles.paletteName}>{palette.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom colors */}
            <div className="admin-card" style={{ marginBottom: "1.5rem" }}>
              <div className="admin-card-header">
                <h3 className="admin-card-title">Colores Personalizados</h3>
              </div>

              {[
                { key: "primaryColor", label: "Color Primario", hint: "Botones, links y elementos principales" },
                { key: "secondaryColor", label: "Color Secundario", hint: "Fondo del header, footer y áreas oscuras" },
                { key: "accentColor", label: "Color de Acento", hint: "Badges, highlighters y elementos decorativos" },
                { key: "backgroundColor", label: "Color de Fondo", hint: "Fondo general de la tienda" },
                { key: "textColor", label: "Color del Texto Principal", hint: "Títulos y párrafos generales" },
                { key: "mutedTextColor", label: "Texto Secundario (Mudo)", hint: "Grisáceos, fechas y textos de apoyo" },
                { key: "primaryContrastColor", label: "Texto sobre Primario", hint: "Color de texto en botones y elementos destacados" },
                { key: "secondaryContrastColor", label: "Texto sobre Secundario", hint: "Color de texto en Header/Footer" },
                { key: "headerTextColor", label: "Texto del Header (Manual)", hint: "Ignora el color contrastante del header" },
                { key: "footerTextColor", label: "Texto del Footer (Manual)", hint: "Ignora el color contrastante del footer" },
              ].map((color) => (
                <div key={color.key} className={styles.colorField}>
                  <div className={styles.colorInfo}>
                    <label className="admin-form-label">{color.label}</label>
                    <span className="admin-form-hint">{color.hint}</span>
                  </div>
                  <div className={styles.colorInputWrapper}>
                    <input
                      type="color"
                      className={styles.colorPicker}
                      value={form[color.key] || "#000000"}
                      onChange={(e) => handleChange(color.key, e.target.value)}
                    />
                    <input
                      type="text"
                      className={styles.colorText}
                      value={form[color.key] || ""}
                      onChange={(e) => handleChange(color.key, e.target.value)}
                      placeholder="Auto (Contraste)"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right - Typography & Layout */}
          <div>
            {/* Typography */}
            <div className="admin-card" style={{ marginBottom: "1.5rem" }}>
              <div className="admin-card-header">
                <h3 className="admin-card-title">Tipografía</h3>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Fuente Principal</label>
                <select
                  className="admin-form-select"
                  value={form.fontFamily}
                  onChange={(e) => handleChange("fontFamily", e.target.value)}
                >
                  {GOOGLE_FONTS.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
                <span className="admin-form-hint">Para textos generales</span>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Fuente de Encabezados</label>
                <select
                  className="admin-form-select"
                  value={form.fontFamilyHeadings}
                  onChange={(e) => handleChange("fontFamilyHeadings", e.target.value)}
                >
                  {GOOGLE_FONTS.map((font) => (
                    <option key={font} value={font}>
                      {font}
                    </option>
                  ))}
                </select>
                <span className="admin-form-hint">Para títulos (h1, h2, h3...)</span>
              </div>

              <div className={styles.fontPreview} style={{ fontFamily: form.fontFamily }}>
                <h3 style={{ fontFamily: form.fontFamilyHeadings, color: "white", marginBottom: "0.5rem" }}>
                  Vista Previa del Texto
                </h3>
                <p style={{ color: "var(--admin-text-muted)", fontSize: "0.875rem" }}>
                  Así se verá el texto en tu tienda con la fuente seleccionada. 
                  Lorem ipsum dolor sit amet consectetur adipiscing elit.
                </p>
              </div>
            </div>

            {/* Layout */}
            <div className="admin-card" style={{ marginBottom: "1.5rem" }}>
              <div className="admin-card-header">
                <h3 className="admin-card-title">Layout</h3>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">
                  Border Radius: {form.borderRadius}px
                </label>
                <input
                  type="range"
                  min="0"
                  max="24"
                  value={form.borderRadius}
                  onChange={(e) => handleChange("borderRadius", e.target.value)}
                  className={styles.rangeInput}
                />
                <div className={styles.rangeLabels}>
                  <span>Cuadrado</span>
                  <span>Redondeado</span>
                </div>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Estilo del Header</label>
                <select
                  className="admin-form-select"
                  value={form.headerStyle}
                  onChange={(e) => handleChange("headerStyle", e.target.value)}
                >
                  <option value="solid">Sólido</option>
                  <option value="transparent">Transparente</option>
                  <option value="glass">Glassmorphism</option>
                </select>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Estilo de Cards</label>
                <select
                  className="admin-form-select"
                  value={form.cardStyle}
                  onChange={(e) => handleChange("cardStyle", e.target.value)}
                >
                  <option value="shadow">Con Sombra</option>
                  <option value="border">Con Borde</option>
                  <option value="flat">Plano</option>
                  <option value="elevated">Elevado</option>
                </select>
              </div>
            </div>

            {/* Preview */}
            <div className="admin-card">
              <div className="admin-card-header">
                <h3 className="admin-card-title">Vista Previa</h3>
              </div>
              <div
                className={styles.themePreview}
                style={{
                  "--preview-primary": form.primaryColor,
                  "--preview-secondary": form.secondaryColor,
                  "--preview-accent": form.accentColor,
                  "--preview-bg": form.backgroundColor,
                  "--preview-text": form.textColor,
                  "--preview-radius": form.borderRadius + "px",
                  fontFamily: form.fontFamily + ", sans-serif",
                }}
              >
                <div className={styles.previewHeader}>
                  <span style={{ fontWeight: 700 }}>Mi Tienda</span>
                  <div className={styles.previewNav}>
                    <span>Inicio</span>
                    <span>Productos</span>
                    <span>Contacto</span>
                  </div>
                </div>
                <div className={styles.previewBody}>
                  <div className={styles.previewCard}>
                    <div className={styles.previewCardImg} />
                    <div className={styles.previewCardContent}>
                      <div className={styles.previewCardTitle}>Producto</div>
                      <div className={styles.previewCardPrice}>$299</div>
                      <button className={styles.previewBtn}>Comprar</button>
                    </div>
                  </div>
                  <div className={styles.previewCard}>
                    <div className={styles.previewCardImg} />
                    <div className={styles.previewCardContent}>
                      <div className={styles.previewCardTitle}>Producto</div>
                      <div className={styles.previewCardPrice}>$199</div>
                      <button className={styles.previewBtn}>Comprar</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Bar */}
      <div className={adminStyles.saveBar}>
        {saved && (
          <span className={adminStyles.saveBarMessage}>✓ Tema guardado</span>
        )}
        <button
          className="btn btn-primary btn-lg"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Guardando..." : "Guardar Tema"}
        </button>
      </div>
    </>
  );
}
