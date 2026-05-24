"use client";

import { useEffect, useState } from "react";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import SectionRenderer from "@/components/sections/SectionRenderer";
import { getPublishedPageBySlug } from "@/lib/supabase-queries";
import { Link, useParams } from "react-router-dom";

export default function DynamicPage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use efficient one-shot query by slug instead of a listener on ALL pages
    getPublishedPageBySlug(slug)
      .then((p) => {
        setPage(p || null);
      })
      .catch((err) => {
        console.error(`Error loading page "${slug}":`, err);
        setPage(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (!page) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <StoreHeader />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", padding: "4rem 0" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "1rem" }}>
              Página no encontrada
            </h1>
            <p style={{ color: "var(--color-muted)", marginBottom: "1.5rem" }}>
              La página que buscas no existe o no está publicada.
            </p>
            <Link to="/" className="btn btn-primary">
              Volver al inicio
            </Link>
          </div>
        </main>
        <StoreFooter />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <StoreHeader />
      <main style={{ flex: 1 }}>
        {page.sections?.length > 0 ? (
          <SectionRenderer sections={page.sections} />
        ) : (
          <div className="container" style={{ padding: "4rem 0", textAlign: "center" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>{page.title}</h1>
          </div>
        )}
      </main>
      <StoreFooter />
    </div>
  );
}
