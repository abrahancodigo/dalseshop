"use client";

import { useEffect, useState, use } from "react";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import SectionRenderer from "@/components/sections/SectionRenderer";
import { onPagesChange } from "@/lib/firestore";
import Link from "next/link";

export default function DynamicPage({ params }) {
  const resolvedParams = use(params);
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log(`Setting up listener for slug: ${resolvedParams.slug}`);
    const unsub = onPagesChange((pages) => {
      const p = pages.find((pg) => pg.slug === resolvedParams.slug);
      
      if (p) {
        const isPub = p.isPublished === true || p.isPublished === "true";
        if (isPub) {
          console.log(`Page found and published: ${p.title}`);
          setPage(p);
        } else {
          console.log(`Page found but NOT published: ${p.title}`);
          setPage(null);
        }
      } else {
        console.log(`No page found with slug: ${resolvedParams.slug}`);
        setPage(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [resolvedParams.slug]);

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
            <Link href="/" className="btn btn-primary">
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
