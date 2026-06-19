"use client";

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import SectionRenderer from "@/components/sections/SectionRenderer";
import { getPageById } from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";
import { HiOutlineEye, HiOutlinePencilSquare, HiOutlineGlobeAlt, HiOutlineArrowLeft } from "react-icons/hi2";

export default function PreviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setAuthorized(true);
    getPageById(id)
      .then((p) => {
        setPage(p || null);
      })
      .catch((err) => {
        console.error("Error loading preview:", err);
        setPage(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, user, isAdmin]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <StoreHeader />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "1rem" }}>Acceso no autorizado</h1>
            <p style={{ color: "var(--color-muted)", marginBottom: "1.5rem" }}>
              Necesitas iniciar sesión como administrador para previsualizar páginas.
            </p>
            <button onClick={() => navigate("/auth/login")} className="btn btn-primary">
              Iniciar sesión
            </button>
          </div>
        </main>
        <StoreFooter />
      </div>
    );
  }

  if (!page) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <StoreHeader />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "1rem" }}>Página no encontrada</h1>
            <p style={{ color: "var(--color-muted)", marginBottom: "1.5rem" }}>
              La página que intentas previsualizar no existe.
            </p>
            <button onClick={() => navigate("/admin/paginas")} className="btn btn-primary">
              Volver a páginas
            </button>
          </div>
        </main>
        <StoreFooter />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 9999,
        background: page.isPublished ? "#059669" : "#D97706",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.6rem 1.5rem",
        fontSize: "0.875rem",
        fontWeight: 600,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <HiOutlineEye style={{ fontSize: "1.1rem" }} />
          <span>
            {page.isPublished ? "Vista previa (página publicada)" : "Vista previa — Borrador no publicado"}
          </span>
          {page.isHomePage && (
            <span style={{
              background: "rgba(255,255,255,0.25)",
              padding: "0.15rem 0.5rem",
              borderRadius: 4,
              fontSize: "0.75rem",
              marginLeft: "0.5rem",
            }}>
              Página de inicio
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={() => navigate(`/admin/paginas/${page.id}`)}
            style={{
              background: "rgba(255,255,255,0.2)",
              color: "white",
              border: "none",
              borderRadius: 6,
              padding: "0.35rem 0.75rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <HiOutlinePencilSquare /> Editar
          </button>
          {page.isPublished && (
            <a
              href={page.isHomePage ? "/" : `/${page.slug}`}
              style={{
                background: "rgba(255,255,255,0.2)",
                color: "white",
                border: "none",
                borderRadius: 6,
                padding: "0.35rem 0.75rem",
                fontSize: "0.8125rem",
                fontWeight: 600,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              <HiOutlineGlobeAlt /> Ver página pública
            </a>
          )}
        </div>
      </div>

      <main style={{ flex: 1 }}>
        {page.sections?.length > 0 ? (
          <SectionRenderer sections={page.sections} />
        ) : (
          <div className="container" style={{ padding: "4rem 0", textAlign: "center" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>{page.title}</h1>
            <p style={{ color: "var(--color-muted)", marginTop: "1rem" }}>
              Esta página no tiene secciones aún.
            </p>
          </div>
        )}
      </main>

      <StoreFooter />
    </div>
  );
}
