"use client";

import { useState, useEffect } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminLayout } from "../layout";
import { useAuth } from "@/context/AuthContext";
import { getPages, deletePage, savePage } from "@/lib/supabase-queries";
import { Link, useNavigate } from "react-router-dom";
import {
  HiOutlineDocumentText,
  HiOutlinePlusCircle,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineGlobeAlt,
  HiOutlineEyeSlash,
  HiOutlineStar,
} from "react-icons/hi2";
import adminStyles from "../admin.module.css";
import styles from "./paginas.module.css";

export default function PaginasPage() {
  const { toggleSidebar } = useAdminLayout();
  const { canManage } = useAuth();
  const navigate = useNavigate();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    setLoadError(false);
    try {
      const data = await getPages();
      setPages(data);
      if (data.length === 0) {
        // Double-check: try without order to detect index issues
      }
    } catch (err) {
      console.error("Error:", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePage = async () => {
    if (!canManage("pages")) {
      alert("Usted no tiene los permisos para realizar esta accion");
      return;
    }
    try {
      const id = await savePage(null, {
        title: "Nueva Página",
        slug: `pagina-${Date.now()}`,
        sections: [],
        isPublished: false,
        isHomePage: false,
        order: pages.length,
      });
      navigate(`/admin/paginas/${id}`);
    } catch (err) {
      console.error("Error creating page:", err);
    }
  };

  const handleDelete = async (id) => {
    if (!canManage("pages")) {
      alert("Usted no tiene los permisos para realizar esta accion");
      return;
    }
    try {
      await deletePage(id);
      setDeleteConfirm(null);
      loadPages();
    } catch (err) {
      console.error("Error:", err);
    }
  };

  return (
    <>
      <AdminHeader
        title="Páginas"
        subtitle={`${pages.length} página${pages.length !== 1 ? "s" : ""}`}
        onMenuToggle={toggleSidebar}
      />

      <div className={adminStyles.pageContent}>
        <div className={styles.actionBar}>
          {canManage("pages") ? (
            <button className="btn btn-primary" onClick={handleCreatePage}>
              <HiOutlinePlusCircle />
              Nueva Página
            </button>
          ) : (
            <span className="btn btn-primary" style={{ opacity: 0.5, cursor: "not-allowed" }} title="No tienes permisos para crear páginas">
              <HiOutlinePlusCircle />
              Nueva Página
            </span>
          )}
        </div>

        {loading ? (
          <div className="loading-screen" style={{ minHeight: 300 }}>
            <div className="spinner" />
          </div>
        ) : pages.length === 0 ? (
          <div className={adminStyles.emptyState}>
            <div className={adminStyles.emptyIcon}>
              <HiOutlineDocumentText />
            </div>
            <h3 className={adminStyles.emptyTitle}>Sin páginas</h3>
            <p className={adminStyles.emptyText}>
              Crea tu primera página y comienza a agregar secciones como banners, 
              productos destacados, textos y más.
            </p>
            {canManage("pages") ? (
              <button className="btn btn-primary" onClick={handleCreatePage}>
                <HiOutlinePlusCircle />
                Crear Primera Página
              </button>
            ) : (
              <span className="btn btn-primary" style={{ opacity: 0.5, cursor: "not-allowed" }}>
                <HiOutlinePlusCircle />
                Sin acceso para crear
              </span>
            )}
          </div>
        ) : (
          <div className={styles.pagesList}>
            {pages.map((page) => (
              <div key={page.id} className={styles.pageCard}>
                <div className={styles.pageInfo}>
                  <div className={styles.pageIconWrapper}>
                    {page.isHomePage ? (
                      <HiOutlineStar style={{ color: "#FDCB6E" }} />
                    ) : (
                      <HiOutlineDocumentText />
                    )}
                  </div>
                  <div>
                    <div className={styles.pageTitle}>
                      {page.title}
                      {page.isHomePage && (
                        <span className={styles.homeBadge}>Inicio</span>
                      )}
                    </div>
                    <div className={styles.pageMeta}>
                      <span className={styles.pageSlug}>/{page.slug}</span>
                      <span className={styles.pageSections}>
                        {page.sections?.length || 0} secciones
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.pageStatus}>
                  {page.isPublished ? (
                    <span className="badge badge-success">
                      <HiOutlineGlobeAlt style={{ marginRight: 4 }} />
                      Publicada
                    </span>
                  ) : (
                    <span className="badge badge-warning">
                      <HiOutlineEyeSlash style={{ marginRight: 4 }} />
                      Borrador
                    </span>
                  )}
                </div>

                <div className={styles.pageActions}>
                  <Link
                    to={`/admin/paginas/${page.id}`}
                    className="btn btn-ghost btn-sm"
                  >
                    <HiOutlinePencilSquare />
                    Editar
                  </Link>
                  {canManage("pages") && deleteConfirm === page.id ? (
                    <div className={styles.deleteConfirm}>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(page.id)}
                      >
                        Sí
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setDeleteConfirm(null)}
                      >
                        No
                      </button>
                    </div>
                  ) : canManage("pages") ? (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setDeleteConfirm(page.id)}
                      style={{ color: "var(--color-danger)" }}
                    >
                      <HiOutlineTrash />
                    </button>
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
