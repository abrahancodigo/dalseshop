"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";
import ImageUploader from "@/components/admin/ImageUploader";
import { useAdminLayout } from "../../layout";
import { getPageById, savePage, getCategories } from "@/lib/firestore";
import {
  HiOutlineArrowLeft,
  HiOutlinePlusCircle,
  HiOutlineTrash,
  HiOutlineChevronUp,
  HiOutlineChevronDown,
  HiOutlinePencilSquare,
  HiOutlineXMark,
  HiOutlinePhoto,
  HiOutlineShoppingBag,
  HiOutlineChatBubbleLeftRight,
  HiOutlineDocumentText,
  HiOutlinePlayCircle,
  HiOutlineQuestionMarkCircle,
  HiOutlineEnvelope,
  HiOutlineCodeBracket,
  HiOutlineMegaphone,
  HiOutlineSquares2X2,
  HiOutlineMinusSmall,
} from "react-icons/hi2";
import adminStyles from "../../admin.module.css";
import styles from "./editor.module.css";

const SECTION_TYPES = [
  { type: "hero", label: "Hero / Banner", icon: HiOutlinePhoto, color: "#6C5CE7" },
  { type: "featuredProducts", label: "Productos Destacados", icon: HiOutlineShoppingBag, color: "#00CEC9" },
  { type: "productGrid", label: "Grid de Productos", icon: HiOutlineSquares2X2, color: "#0984E3" },
  { type: "textBlock", label: "Bloque de Texto", icon: HiOutlineDocumentText, color: "#FDCB6E" },
  { type: "imageGallery", label: "Galería de Imágenes", icon: HiOutlinePhoto, color: "#E17055" },
  { type: "testimonials", label: "Testimonios", icon: HiOutlineChatBubbleLeftRight, color: "#00B894" },
  { type: "video", label: "Video", icon: HiOutlinePlayCircle, color: "#E84393" },
  { type: "faq", label: "FAQ / Preguntas", icon: HiOutlineQuestionMarkCircle, color: "#FDCB6E" },
  { type: "newsletter", label: "Newsletter", icon: HiOutlineEnvelope, color: "#0984E3" },
  { type: "banner", label: "Banner Promocional", icon: HiOutlineMegaphone, color: "#E17055" },
  { type: "separator", label: "Separador", icon: HiOutlineMinusSmall, color: "#94A3B8" },
  { type: "customHtml", label: "HTML Personalizado", icon: HiOutlineCodeBracket, color: "#6C5CE7" },
];

const DEFAULT_SECTION_CONFIG = {
  hero: { slides: [], transition: "fade", autoplaySpeed: 5, overlayOpacity: 40, height: "500", title: "", subtitle: "", buttonText: "", buttonLink: "", image: "" },
  featuredProducts: { title: "Productos Destacados", count: 4, columns: 4 },
  productGrid: { title: "Nuestros Productos", category: "", count: 8, columns: 4 },
  textBlock: { title: "", content: "", alignment: "center", backgroundColor: "" },
  imageGallery: { title: "", images: [], columns: 3 },
  testimonials: { title: "Lo que dicen nuestros clientes", items: [{ name: "", text: "", rating: 5 }] },
  video: { title: "", url: "", autoplay: false },
  faq: { title: "Preguntas Frecuentes", items: [{ question: "", answer: "" }] },
  newsletter: { title: "Suscríbete", subtitle: "Recibe noticias y ofertas exclusivas", buttonText: "Suscribir" },
  banner: { title: "", subtitle: "", image: "", buttonText: "", buttonLink: "", backgroundColor: "#6C5CE7", height: "400", textAlign: "center", titleSize: "large", overlayOpacity: 0, overlayColor: "#000000", padding: "60px" },
  separator: { height: 40, style: "line" },
  customHtml: { code: "" },
};

export default function PageEditorPage({ params }) {
  const resolvedParams = use(params);
  const { toggleSidebar } = useAdminLayout();
  const router = useRouter();
  const pageId = resolvedParams.id;

  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [editingSection, setEditingSection] = useState(null);

  useEffect(() => {
    loadPage();
  }, []);

  const loadPage = async () => {
    try {
      const data = await getPageById(pageId);
      if (data) setPage(data);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (field, value) => {
    setPage((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const addSection = (type) => {
    const newSection = {
      id: `section_${Date.now()}`,
      type,
      config: { ...DEFAULT_SECTION_CONFIG[type] },
    };
    setPage((prev) => ({
      ...prev,
      sections: [...(prev.sections || []), newSection],
    }));
    setShowAddSection(false);
    setEditingSection(newSection.id);
    setSaved(false);
  };

  const updateSection = (sectionId, config) => {
    setPage((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, config: { ...s.config, ...config } } : s
      ),
    }));
    setSaved(false);
  };

  const removeSection = (sectionId) => {
    setPage((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== sectionId),
    }));
    if (editingSection === sectionId) setEditingSection(null);
    setSaved(false);
  };

  const moveSection = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= page.sections.length) return;
    const sections = [...page.sections];
    [sections[index], sections[newIndex]] = [sections[newIndex], sections[index]];
    setPage((prev) => ({ ...prev, sections }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Usamos el helper savePage de firestore.js que ya normaliza los datos
      await savePage(pageId, {
        title: page.title,
        slug: page.slug,
        sections: page.sections || [],
        isPublished: page.isPublished,
        isHomePage: page.isHomePage,
        order: page.order || 0,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Error saving:", err);
      alert("Error al guardar la página. Revisa la consola.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !page) {
    return (
      <>
        <AdminHeader title="Editor de Página" onMenuToggle={toggleSidebar} />
        <div className="loading-screen" style={{ minHeight: 400 }}>
          <div className="spinner" />
        </div>
      </>
    );
  }

  const sectionBeingEdited = page.sections?.find((s) => s.id === editingSection);

  return (
    <>
      <AdminHeader
        title="Editor de Página"
        subtitle={page.title}
        onMenuToggle={toggleSidebar}
      />

      <div className={adminStyles.pageContent}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => router.push("/admin/paginas")}
          >
            <HiOutlineArrowLeft /> Volver a páginas
          </button>
          
          {page.isPublished && (
            <a 
              href={page.isHomePage ? "/" : `/${page.slug}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm"
            >
              <HiOutlinePlusCircle style={{ transform: "rotate(45deg)" }} /> Ver Página
            </a>
          )}
        </div>

        <div className={styles.editorLayout}>
          {/* Left: Page settings + sections list */}
          <div className={styles.editorMain}>
            {/* Page Settings */}
            <div className="admin-card" style={{ marginBottom: "1rem" }}>
              <div className="admin-card-header">
                <h3 className="admin-card-title">Configuración de Página</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="admin-form-group">
                  <label className="admin-form-label">Título</label>
                  <input
                    type="text"
                    className="admin-form-input"
                    value={page.title}
                    onChange={(e) => handlePageChange("title", e.target.value)}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">Slug</label>
                  <input
                    type="text"
                    className="admin-form-input"
                    value={page.slug}
                    onChange={(e) => handlePageChange("slug", e.target.value)}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: "2rem", marginTop: "0.5rem" }}>
                <div className={styles.toggleRow}>
                  <label className="admin-form-label" style={{ marginBottom: 0, marginRight: "0.5rem" }}>
                    Publicada
                  </label>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={page.isPublished}
                      onChange={(e) => handlePageChange("isPublished", e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <div className={styles.toggleRow}>
                  <label className="admin-form-label" style={{ marginBottom: 0, marginRight: "0.5rem" }}>
                    Página de Inicio
                  </label>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={page.isHomePage}
                      onChange={(e) => handlePageChange("isHomePage", e.target.checked)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>
            </div>

            {/* Sections List */}
            <div className="admin-card">
              <div className="admin-card-header">
                <h3 className="admin-card-title">
                  Secciones ({page.sections?.length || 0})
                </h3>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowAddSection(true)}
                >
                  <HiOutlinePlusCircle /> Agregar
                </button>
              </div>

              {(!page.sections || page.sections.length === 0) ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--admin-text-muted)" }}>
                  <p>No hay secciones aún. Agrega tu primera sección.</p>
                </div>
              ) : (
                <div className={styles.sectionsList}>
                  {page.sections.map((section, index) => {
                    const typeInfo = SECTION_TYPES.find((t) => t.type === section.type);
                    const Icon = typeInfo?.icon || HiOutlineDocumentText;
                    return (
                      <div
                        key={section.id}
                        className={`${styles.sectionItem} ${editingSection === section.id ? styles.sectionActive : ""}`}
                        onClick={() => setEditingSection(section.id)}
                      >
                        <div
                          className={styles.sectionIcon}
                          style={{ background: `${typeInfo?.color || "#6C5CE7"}20`, color: typeInfo?.color }}
                        >
                          <Icon />
                        </div>
                        <div className={styles.sectionInfo}>
                          <span className={styles.sectionLabel}>
                            {typeInfo?.label || section.type}
                          </span>
                          <span className={styles.sectionSubLabel}>
                            {section.config?.title || "Sin título"}
                          </span>
                        </div>
                        <div className={styles.sectionActions}>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveSection(index, -1); }}
                            disabled={index === 0}
                            className={styles.moveBtn}
                          >
                            <HiOutlineChevronUp />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveSection(index, 1); }}
                            disabled={index === page.sections.length - 1}
                            className={styles.moveBtn}
                          >
                            <HiOutlineChevronDown />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeSection(section.id); }}
                            className={styles.deleteBtn}
                          >
                            <HiOutlineTrash />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Section Editor */}
          <div className={styles.editorSide}>
            {sectionBeingEdited ? (
              <div className="admin-card">
                <div className="admin-card-header">
                  <h3 className="admin-card-title">
                    Editar: {SECTION_TYPES.find((t) => t.type === sectionBeingEdited.type)?.label}
                  </h3>
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={() => setEditingSection(null)}
                    style={{ color: "var(--admin-text-muted)" }}
                  >
                    <HiOutlineXMark />
                  </button>
                </div>
                <SectionConfigEditor
                  section={sectionBeingEdited}
                  onUpdate={(config) => updateSection(sectionBeingEdited.id, config)}
                />
              </div>
            ) : (
              <div className="admin-card" style={{ textAlign: "center", padding: "3rem 1.5rem", color: "var(--admin-text-muted)" }}>
                <HiOutlinePencilSquare style={{ fontSize: "2rem", marginBottom: "0.75rem", opacity: 0.5 }} />
                <p>Selecciona una sección para editarla</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Bar */}
      <div className={adminStyles.saveBar}>
        {saved && <span className={adminStyles.saveBarMessage}>✓ Página guardada</span>}
        <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
          {saving ? "Guardando..." : "Guardar Página"}
        </button>
      </div>

      {/* Add Section Modal */}
      {showAddSection && (
        <div className={styles.modalOverlay} onClick={() => setShowAddSection(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Agregar Sección</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAddSection(false)}>
                <HiOutlineXMark />
              </button>
            </div>
            <div className={styles.sectionTypesGrid}>
              {SECTION_TYPES.map((st) => {
                const Icon = st.icon;
                return (
                  <button
                    key={st.type}
                    className={styles.sectionTypeBtn}
                    onClick={() => addSection(st.type)}
                  >
                    <div className={styles.sectionTypeIcon} style={{ background: `${st.color}20`, color: st.color }}>
                      <Icon />
                    </div>
                    <span>{st.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// Section Config Editor (renders different fields per section type)
// ============================================================
function SectionConfigEditor({ section, onUpdate }) {
  const { type, config } = section;
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  const handleChange = (field, value) => onUpdate({ [field]: value });

  switch (type) {
    case "hero":
      const heroSlides = config.slides || [];
      const addSlide = () => {
        onUpdate({ slides: [...heroSlides, { image: "", title: "", subtitle: "", buttonText: "", buttonLink: "" }] });
      };
      const updateSlide = (i, field, value) => {
        const slides = [...heroSlides];
        slides[i] = { ...slides[i], [field]: value };
        onUpdate({ slides });
      };
      const removeSlide = (i) => {
        onUpdate({ slides: heroSlides.filter((_, idx) => idx !== i) });
      };
      return (
        <div>
          {/* Global Settings */}
          <div className="admin-form-group">
            <label className="admin-form-label">Efecto de Transición</label>
            <select className="admin-form-select" value={config.transition || "fade"} onChange={(e) => handleChange("transition", e.target.value)}>
              <option value="fade">✨ Desvanecer (Fade)</option>
              <option value="slide">➡️ Deslizar (Slide)</option>
              <option value="zoom">🔍 Zoom</option>
              <option value="blur">🌫️ Desenfoque (Blur)</option>
              <option value="flip">🔄 Voltear (Flip)</option>
              <option value="kenburn">🎬 Ken Burns (Cine)</option>
            </select>
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Velocidad de Autoplay: {config.autoplaySpeed || 5}s</label>
            <input type="range" min="2" max="15" value={config.autoplaySpeed || 5} onChange={(e) => handleChange("autoplaySpeed", parseInt(e.target.value))} style={{ width: "100%" }} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Altura (px): {config.height}</label>
            <input type="range" min="300" max="800" value={config.height || 500} onChange={(e) => handleChange("height", e.target.value)} style={{ width: "100%" }} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Opacidad del Overlay: {config.overlayOpacity}%</label>
            <input type="range" min="0" max="80" value={config.overlayOpacity || 40} onChange={(e) => handleChange("overlayOpacity", e.target.value)} style={{ width: "100%" }} />
          </div>

          {/* Slides */}
          <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: "1rem", marginTop: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <label className="admin-form-label" style={{ marginBottom: 0 }}>Slides ({heroSlides.length})</label>
              <button className="btn btn-primary btn-sm" onClick={addSlide}>
                <HiOutlinePlusCircle /> Agregar Slide
              </button>
            </div>
            {heroSlides.length === 0 && (
              <p style={{ color: "var(--admin-text-muted)", fontSize: "0.8125rem", textAlign: "center", padding: "1rem 0" }}>
                No hay slides. Agrega al menos uno para que el hero se vea correctamente.
              </p>
            )}
            {heroSlides.map((slide, i) => (
              <div key={i} style={{ padding: "0.75rem", background: "var(--admin-bg)", borderRadius: 10, marginBottom: "0.75rem", border: "1px solid var(--admin-border)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.8125rem", color: "var(--admin-text)" }}>Slide {i + 1}</span>
                  <button className="btn btn-ghost btn-sm" style={{ color: "var(--color-danger)" }} onClick={() => removeSlide(i)}>
                    <HiOutlineTrash />
                  </button>
                </div>
                <ImageUploader label="Imagen" value={slide.image} onChange={(url) => updateSlide(i, "image", url)} folder="pages" />
                <input className="admin-form-input" value={slide.title || ""} placeholder="Título del slide" style={{ marginBottom: "0.5rem", marginTop: "0.5rem" }}
                  onChange={(e) => updateSlide(i, "title", e.target.value)} />
                <input className="admin-form-input" value={slide.subtitle || ""} placeholder="Subtítulo" style={{ marginBottom: "0.5rem" }}
                  onChange={(e) => updateSlide(i, "subtitle", e.target.value)} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <input className="admin-form-input" value={slide.buttonText || ""} placeholder="Texto botón"
                    onChange={(e) => updateSlide(i, "buttonText", e.target.value)} />
                  <input className="admin-form-input" value={slide.buttonLink || ""} placeholder="Link (/productos)"
                    onChange={(e) => updateSlide(i, "buttonLink", e.target.value)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "featuredProducts":
      return (
        <div>
          <div className="admin-form-group">
            <label className="admin-form-label">Título</label>
            <input className="admin-form-input" value={config.title || ""} onChange={(e) => handleChange("title", e.target.value)} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Cantidad</label>
            <input type="number" className="admin-form-input" value={config.count || 4} onChange={(e) => handleChange("count", parseInt(e.target.value))} min={1} max={20} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Columnas</label>
            <select className="admin-form-select" value={config.columns || 4} onChange={(e) => handleChange("columns", parseInt(e.target.value))}>
              <option value={2}>2 columnas</option>
              <option value={3}>3 columnas</option>
              <option value={4}>4 columnas</option>
            </select>
          </div>
        </div>
      );

    case "productGrid":
      return (
        <div>
          <div className="admin-form-group">
            <label className="admin-form-label">Título</label>
            <input className="admin-form-input" value={config.title || ""} onChange={(e) => handleChange("title", e.target.value)} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Categoría</label>
            <select className="admin-form-select" value={config.category || ""} onChange={(e) => handleChange("category", e.target.value)}>
              <option value="">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <span className="admin-form-hint">Filtra los productos por categoría</span>
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Cantidad</label>
            <input type="number" className="admin-form-input" value={config.count || 8} onChange={(e) => handleChange("count", parseInt(e.target.value))} min={1} max={20} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Columnas</label>
            <select className="admin-form-select" value={config.columns || 4} onChange={(e) => handleChange("columns", parseInt(e.target.value))}>
              <option value={2}>2 columnas</option>
              <option value={3}>3 columnas</option>
              <option value={4}>4 columnas</option>
            </select>
          </div>
        </div>
      );

    case "textBlock":
      return (
        <div>
          <div className="admin-form-group">
            <label className="admin-form-label">Título</label>
            <input className="admin-form-input" value={config.title || ""} onChange={(e) => handleChange("title", e.target.value)} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Contenido</label>
            <textarea className="admin-form-textarea" value={config.content || ""} onChange={(e) => handleChange("content", e.target.value)} rows={6} placeholder="Escribe el contenido aquí..." />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Alineación</label>
            <select className="admin-form-select" value={config.alignment || "center"} onChange={(e) => handleChange("alignment", e.target.value)}>
              <option value="left">Izquierda</option>
              <option value="center">Centro</option>
              <option value="right">Derecha</option>
            </select>
          </div>
        </div>
      );

    case "imageGallery":
      return (
        <div>
          <div className="admin-form-group">
            <label className="admin-form-label">Título</label>
            <input className="admin-form-input" value={config.title || ""} onChange={(e) => handleChange("title", e.target.value)} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Columnas</label>
            <select className="admin-form-select" value={config.columns || 3} onChange={(e) => handleChange("columns", parseInt(e.target.value))}>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>
          <ImageUploader
            label="Agregar Imagen"
            value=""
            onChange={(url) => {
              if (url) onUpdate({ images: [...(config.images || []), url] });
            }}
            folder="pages"
          />
          {config.images?.length > 0 && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
              {config.images.map((img, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <img src={img} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8 }} />
                  <button
                    type="button"
                    onClick={() => onUpdate({ images: config.images.filter((_, idx) => idx !== i) })}
                    style={{ position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: "50%", background: "var(--color-danger)", color: "white", border: "none", fontSize: "0.6rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      );

    case "testimonials":
      return (
        <div>
          <div className="admin-form-group">
            <label className="admin-form-label">Título</label>
            <input className="admin-form-input" value={config.title || ""} onChange={(e) => handleChange("title", e.target.value)} />
          </div>
          {(config.items || []).map((item, i) => (
            <div key={i} style={{ padding: "0.75rem", background: "var(--admin-bg)", borderRadius: 10, marginBottom: "0.5rem" }}>
              <input className="admin-form-input" value={item.name || ""} placeholder="Nombre" style={{ marginBottom: "0.5rem" }}
                onChange={(e) => { const items = [...config.items]; items[i] = { ...items[i], name: e.target.value }; onUpdate({ items }); }} />
              <textarea className="admin-form-textarea" value={item.text || ""} placeholder="Testimonio" rows={2}
                onChange={(e) => { const items = [...config.items]; items[i] = { ...items[i], text: e.target.value }; onUpdate({ items }); }} />
              <button className="btn btn-ghost btn-sm" style={{ color: "var(--color-danger)", marginTop: "0.25rem" }}
                onClick={() => onUpdate({ items: config.items.filter((_, idx) => idx !== i) })}>
                <HiOutlineTrash /> Eliminar
              </button>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={() => onUpdate({ items: [...(config.items || []), { name: "", text: "", rating: 5 }] })}>
            <HiOutlinePlusCircle /> Agregar Testimonio
          </button>
        </div>
      );

    case "video":
      return (
        <div>
          <div className="admin-form-group">
            <label className="admin-form-label">Título</label>
            <input className="admin-form-input" value={config.title || ""} onChange={(e) => handleChange("title", e.target.value)} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">URL del Video</label>
            <input className="admin-form-input" value={config.url || ""} onChange={(e) => handleChange("url", e.target.value)} placeholder="https://youtube.com/watch?v=..." />
            <span className="admin-form-hint">YouTube o Vimeo</span>
          </div>
        </div>
      );

    case "faq":
      return (
        <div>
          <div className="admin-form-group">
            <label className="admin-form-label">Título</label>
            <input className="admin-form-input" value={config.title || ""} onChange={(e) => handleChange("title", e.target.value)} />
          </div>
          {(config.items || []).map((item, i) => (
            <div key={i} style={{ padding: "0.75rem", background: "var(--admin-bg)", borderRadius: 10, marginBottom: "0.5rem" }}>
              <input className="admin-form-input" value={item.question || ""} placeholder="Pregunta" style={{ marginBottom: "0.5rem" }}
                onChange={(e) => { const items = [...config.items]; items[i] = { ...items[i], question: e.target.value }; onUpdate({ items }); }} />
              <textarea className="admin-form-textarea" value={item.answer || ""} placeholder="Respuesta" rows={2}
                onChange={(e) => { const items = [...config.items]; items[i] = { ...items[i], answer: e.target.value }; onUpdate({ items }); }} />
              <button className="btn btn-ghost btn-sm" style={{ color: "var(--color-danger)", marginTop: "0.25rem" }}
                onClick={() => onUpdate({ items: config.items.filter((_, idx) => idx !== i) })}>
                <HiOutlineTrash /> Eliminar
              </button>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={() => onUpdate({ items: [...(config.items || []), { question: "", answer: "" }] })}>
            <HiOutlinePlusCircle /> Agregar Pregunta
          </button>
        </div>
      );

    case "newsletter":
      return (
        <div>
          <div className="admin-form-group">
            <label className="admin-form-label">Título</label>
            <input className="admin-form-input" value={config.title || ""} onChange={(e) => handleChange("title", e.target.value)} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Subtítulo</label>
            <input className="admin-form-input" value={config.subtitle || ""} onChange={(e) => handleChange("subtitle", e.target.value)} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Texto del Botón</label>
            <input className="admin-form-input" value={config.buttonText || ""} onChange={(e) => handleChange("buttonText", e.target.value)} />
          </div>
        </div>
      );

    case "banner":
      return (
        <div>
          <div className="admin-form-group">
            <label className="admin-form-label">Título</label>
            <input className="admin-form-input" value={config.title || ""} onChange={(e) => handleChange("title", e.target.value)} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Subtítulo</label>
            <input className="admin-form-input" value={config.subtitle || ""} onChange={(e) => handleChange("subtitle", e.target.value)} />
          </div>
          <ImageUploader label="Imagen" value={config.image} onChange={(url) => handleChange("image", url)} folder="pages" />
          <div className="admin-form-group">
            <label className="admin-form-label">Color de Fondo</label>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input type="color" value={config.backgroundColor || "#6C5CE7"} onChange={(e) => handleChange("backgroundColor", e.target.value)} style={{ width: 40, height: 40, border: "none", cursor: "pointer", borderRadius: 8, padding: 0 }} />
              <input className="admin-form-input" value={config.backgroundColor || "#6C5CE7"} onChange={(e) => handleChange("backgroundColor", e.target.value)} placeholder="#6C5CE7" style={{ flex: 1 }} />
            </div>
            <span className="admin-form-hint">Color de fondo cuando no hay imagen</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="admin-form-group">
              <label className="admin-form-label">Altura (px)</label>
              <input type="number" className="admin-form-input" value={config.height || "400"} onChange={(e) => handleChange("height", e.target.value)} min="200" max="800" step="10" />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Padding</label>
              <input type="text" className="admin-form-input" value={config.padding || "60px"} onChange={(e) => handleChange("padding", e.target.value)} placeholder="60px" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="admin-form-group">
              <label className="admin-form-label">Alineación del Texto</label>
              <select className="admin-form-select" value={config.textAlign || "center"} onChange={(e) => handleChange("textAlign", e.target.value)}>
                <option value="left">Izquierda</option>
                <option value="center">Centro</option>
                <option value="right">Derecha</option>
              </select>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Tamaño del Título</label>
              <select className="admin-form-select" value={config.titleSize || "large"} onChange={(e) => handleChange("titleSize", e.target.value)}>
                <option value="small">Pequeño</option>
                <option value="medium">Mediano</option>
                <option value="large">Grande</option>
                <option value="xlarge">Extra Grande</option>
              </select>
            </div>
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Overlay de Imagen</label>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input type="color" value={config.overlayColor || "#000000"} onChange={(e) => handleChange("overlayColor", e.target.value)} style={{ width: 40, height: 40, border: "none", cursor: "pointer", borderRadius: 8, padding: 0 }} />
              <input className="admin-form-input" value={config.overlayColor || "#000000"} onChange={(e) => handleChange("overlayColor", e.target.value)} placeholder="#000000" style={{ flex: 1 }} />
            </div>
            <label className="admin-form-label" style={{ marginTop: "0.5rem" }}>Opacidad del Overlay: {config.overlayOpacity || 0}%</label>
            <input type="range" min="0" max="100" value={config.overlayOpacity || 0} onChange={(e) => handleChange("overlayOpacity", parseInt(e.target.value))} style={{ width: "100%" }} />
            <span className="admin-form-hint">Overlay oscurece la imagen para mejorar legibilidad del texto</span>
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Texto del Botón</label>
            <input className="admin-form-input" value={config.buttonText || ""} onChange={(e) => handleChange("buttonText", e.target.value)} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Link del Botón</label>
            <input className="admin-form-input" value={config.buttonLink || ""} onChange={(e) => handleChange("buttonLink", e.target.value)} />
          </div>
        </div>
      );

    case "separator":
      return (
        <div>
          <div className="admin-form-group">
            <label className="admin-form-label">Altura (px): {config.height}</label>
            <input type="range" min="10" max="100" value={config.height || 40} onChange={(e) => handleChange("height", e.target.value)} style={{ width: "100%" }} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Estilo</label>
            <select className="admin-form-select" value={config.style || "line"} onChange={(e) => handleChange("style", e.target.value)}>
              <option value="line">Línea</option>
              <option value="space">Espacio</option>
              <option value="dots">Puntos</option>
            </select>
          </div>
        </div>
      );

    case "customHtml":
      return (
        <div>
          <div className="admin-form-group">
            <label className="admin-form-label">Código HTML</label>
            <textarea className="admin-form-textarea" value={config.code || ""} onChange={(e) => handleChange("code", e.target.value)}
              rows={10} placeholder="<div>Tu HTML aquí...</div>" style={{ fontFamily: "monospace", fontSize: "0.8125rem" }} />
          </div>
        </div>
      );

    default:
      return <p style={{ color: "var(--admin-text-muted)" }}>Editor no disponible para este tipo de sección.</p>;
  }
}
