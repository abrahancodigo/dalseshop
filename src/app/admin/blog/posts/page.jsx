"use client";

import { useState, useEffect } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminLayout } from "../../layout";
import { useAuth } from "@/context/AuthContext";
import { getBlogPosts, saveBlogPost, deleteBlogPost } from "@/lib/firestore";
import { Link, useNavigate } from "react-router-dom";
import { HiOutlineDocumentText, HiOutlinePlusCircle, HiOutlinePencilSquare, HiOutlineTrash, HiOutlineGlobeAlt, HiOutlineEyeSlash } from "react-icons/hi2";
import adminStyles from "../../admin.module.css";
import styles from "./blog.module.css";

export default function BlogAdminPage() {
  const { toggleSidebar } = useAdminLayout();
  const { canManage } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { loadPosts(); }, []);

  const loadPosts = async () => {
    try { setPosts(await getBlogPosts()); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!canManage("blog")) {
      alert("Usted no tiene los permisos para realizar esta accion");
      return;
    }
    try {
      const id = await saveBlogPost(null, { title: "Nuevo Artículo", slug: `articulo-${Date.now()}`, content: "", excerpt: "", image: "", isPublished: true, author: "Admin" });
      navigate(`/admin/blog/posts/${id}`);
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if (!canManage("blog")) {
      alert("Usted no tiene los permisos para realizar esta accion");
      return;
    }
    try { await deleteBlogPost(id); setDeleteConfirm(null); loadPosts(); }
    catch (err) { console.error(err); }
  };

  const formatDate = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <>
      <AdminHeader title="Blog" subtitle={`${posts.length} artículo${posts.length !== 1 ? "s" : ""}`} onMenuToggle={toggleSidebar} />
      <div className={adminStyles.pageContent}>
        <div className={styles.actionBar}>
          {canManage("blog") ? (
            <button className="btn btn-primary" onClick={handleCreate}><HiOutlinePlusCircle /> Nuevo Artículo</button>
          ) : (
            <span className="btn btn-primary" style={{ opacity: 0.5, cursor: "not-allowed" }} title="No tienes permisos para crear artículos">
              <HiOutlinePlusCircle /> Nuevo Artículo
            </span>
          )}
        </div>

        {loading ? (
          <div className="loading-screen" style={{ minHeight: 300 }}><div className="spinner" /></div>
        ) : posts.length === 0 ? (
          <div className={adminStyles.emptyState}>
            <div className={adminStyles.emptyIcon}><HiOutlineDocumentText /></div>
            <h3 className={adminStyles.emptyTitle}>Sin artículos</h3>
            <p className={adminStyles.emptyText}>Crea tu primer artículo para el blog.</p>
            {canManage("blog") ? (
              <button className="btn btn-primary" onClick={handleCreate}><HiOutlinePlusCircle /> Crear Artículo</button>
            ) : (
              <span className="btn btn-primary" style={{ opacity: 0.5, cursor: "not-allowed" }}>
                <HiOutlinePlusCircle /> Sin acceso para crear
              </span>
            )}
          </div>
        ) : (
          <div className={styles.list}>
            {posts.map((post) => (
              <div key={post.id} className={styles.postCard}>
                {post.image && <img src={post.image} alt={post.title} className={styles.postImage} />}
                <div className={styles.postInfo}>
                  <div className={styles.postTitle}>{post.title}</div>
                  <div className={styles.postMeta}>
                    <span>/{post.slug}</span>
                    <span>{formatDate(post.createdAt)}</span>
                    <span>{post.author || "Admin"}</span>
                  </div>
                </div>
                <div className={styles.postStatus}>
                  {post.isPublished ? <span className="badge badge-success"><HiOutlineGlobeAlt style={{ marginRight: 4 }} />Publicado</span> : <span className="badge badge-warning"><HiOutlineEyeSlash style={{ marginRight: 4 }} />Borrador</span>}
                </div>
                <div className={styles.postActions}>
                  <Link to={`/admin/blog/posts/${post.id}`} className="btn btn-ghost btn-sm"><HiOutlinePencilSquare /> Editar</Link>
                  {canManage("blog") && deleteConfirm === post.id ? (
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(post.id)}>Sí</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(null)}>No</button>
                    </div>
                  ) : canManage("blog") ? (
                    <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(post.id)} style={{ color: "var(--color-danger)" }}><HiOutlineTrash /></button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
