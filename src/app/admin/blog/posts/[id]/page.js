"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";
import ImageUploader from "@/components/admin/ImageUploader";
import { useAdminLayout } from "../../../layout";
import { getBlogPostById, saveBlogPost } from "@/lib/firestore";
import { HiOutlineArrowLeft } from "react-icons/hi2";
import adminStyles from "../../../admin.module.css";

export default function BlogPostEditorPage({ params }) {
  const resolvedParams = use(params);
  const { toggleSidebar } = useAdminLayout();
  const router = useRouter();
  const [form, setForm] = useState({ title: "", slug: "", content: "", excerpt: "", image: "", isPublished: false, author: "Admin", tags: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadPost(); }, []);

  const loadPost = async () => {
    try {
      const post = await getBlogPostById(resolvedParams.id);
      if (post) setForm({ title: post.title || "", slug: post.slug || "", content: post.content || "", excerpt: post.excerpt || "", image: post.image || "", isPublished: post.isPublished || false, author: post.author || "Admin", tags: (post.tags || []).join(", ") });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const generateSlug = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleChange = (field, value) => {
    setForm((p) => {
      const u = { ...p, [field]: value };
      if (field === "title") u.slug = generateSlug(value);
      return u;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveBlogPost(resolvedParams.id, { ...form, tags: form.tags.split(",").map(t => t.trim()).filter(Boolean) });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  if (loading) return (<><AdminHeader title="Blog" onMenuToggle={toggleSidebar} /><div className="loading-screen" style={{ minHeight: 400 }}><div className="spinner" /></div></>);

  return (
    <>
      <AdminHeader title="Editor de Artículo" subtitle={form.title} onMenuToggle={toggleSidebar} />
      <div className={adminStyles.pageContent}>
        <button className="btn btn-ghost btn-sm" onClick={() => router.push("/admin/blog/posts")} style={{ marginBottom: "1rem" }}><HiOutlineArrowLeft /> Volver</button>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.5rem", alignItems: "start" }}>
          <div>
            <div className="admin-card" style={{ marginBottom: "1.5rem" }}>
              <div className="admin-card-header"><h3 className="admin-card-title">Contenido</h3></div>
              <div className="admin-form-group"><label className="admin-form-label">Título</label><input className="admin-form-input" value={form.title} onChange={(e) => handleChange("title", e.target.value)} placeholder="Título del artículo" /></div>
              <div className="admin-form-group"><label className="admin-form-label">Slug</label><input className="admin-form-input" value={form.slug} onChange={(e) => handleChange("slug", e.target.value)} /><span className="admin-form-hint">/blog/{form.slug || "..."}</span></div>
              <div className="admin-form-group"><label className="admin-form-label">Extracto</label><textarea className="admin-form-textarea" value={form.excerpt} onChange={(e) => handleChange("excerpt", e.target.value)} rows={2} placeholder="Resumen corto del artículo" /></div>
              <div className="admin-form-group"><label className="admin-form-label">Contenido</label><textarea className="admin-form-textarea" value={form.content} onChange={(e) => handleChange("content", e.target.value)} rows={15} placeholder="Escribe el contenido del artículo..." style={{ minHeight: 300 }} /></div>
            </div>
          </div>
          <div>
            <div className="admin-card" style={{ marginBottom: "1.5rem" }}>
              <div className="admin-card-header"><h3 className="admin-card-title">Publicación</h3></div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                <label className="admin-form-label" style={{ marginBottom: 0 }}>Publicado</label>
                <label className="toggle-switch"><input type="checkbox" checked={form.isPublished} onChange={(e) => handleChange("isPublished", e.target.checked)} /><span className="toggle-slider" /></label>
              </div>
              <div className="admin-form-group"><label className="admin-form-label">Autor</label><input className="admin-form-input" value={form.author} onChange={(e) => handleChange("author", e.target.value)} /></div>
              <div className="admin-form-group"><label className="admin-form-label">Etiquetas</label><input className="admin-form-input" value={form.tags} onChange={(e) => handleChange("tags", e.target.value)} placeholder="tag1, tag2, tag3" /><span className="admin-form-hint">Separadas por coma</span></div>
            </div>
            <ImageUploader label="Imagen de Portada" value={form.image} onChange={(url) => handleChange("image", url)} folder="blog" />
          </div>
        </div>
      </div>
      <div className={adminStyles.saveBar}>
        {saved && <span className={adminStyles.saveBarMessage}>✓ Artículo guardado</span>}
        <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "Guardar Artículo"}</button>
      </div>
    </>
  );
}
