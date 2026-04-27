"use client";

import { useState, useEffect } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminLayout } from "../layout";
import { getPages, deletePage, savePage } from "@/lib/firestore";
import Link from "next/link";
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
    try {
      const id = await savePage(null, {
        title: "Nueva Página",
        slug: `pagina-${Date.now()}`,
        sections: [],
        isPublished: false,
        isHomePage: false,
        order: pages.length,
      });
      window.location.href = `/admin/paginas/${id}`;
    } catch (err) {
      console.error("Error creating page:", err);
    }
  };

  const handleDelete = async (id) => {
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
          <button className="btn btn-primary" onClick={handleCreatePage}>
            <HiOutlinePlusCircle />
            Nueva Página
          </button>
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
            <button className="btn btn-primary" onClick={handleCreatePage}>
              <HiOutlinePlusCircle />
              Crear Primera Página
            </button>
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
                    href={`/admin/paginas/${page.id}`}
                    className="btn btn-ghost btn-sm"
                  >
                    <HiOutlinePencilSquare />
                    Editar
                  </Link>
                  {deleteConfirm === page.id ? (
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
                  ) : (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setDeleteConfirm(page.id)}
                      style={{ color: "var(--color-danger)" }}
                    >
                      <HiOutlineTrash />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
