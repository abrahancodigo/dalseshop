"use client";

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "@/context/StoreContext";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import SectionRenderer from "@/components/sections/SectionRenderer";
import { storefrontCacheScope } from "@/lib/storefrontEnvironment.mjs";
import { getStorefrontBootstrap } from "@/lib/storefrontBootstrap.mjs";
import styles from "./home.module.css";

const HOME_CACHE_KEY = `dalseshop_home_v2_${storefrontCacheScope}`;

function readCachedHome() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HOME_CACHE_KEY));
    return parsed && Array.isArray(parsed.sections) && parsed.sections.length ? parsed : getStorefrontBootstrap()?.home || null;
  } catch { return getStorefrontBootstrap()?.home || null; }
}

export default function HomePage() {
  const { loading: storeLoading } = useStore();
  const [homePage, setHomePage] = useState(readCachedHome);
  const [loading, setLoading] = useState(!homePage);
  const [showLoader, setShowLoader] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setShowLoader(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    import("@/lib/firestore").then(({ getHomePage }) => getHomePage()).then((page) => {
      if (cancelled) return;
      const published = page?.sections?.length ? page : null;
      setHomePage(published);
      try {
        if (published) localStorage.setItem(HOME_CACHE_KEY, JSON.stringify(published));
        else localStorage.removeItem(HOME_CACHE_KEY);
      } catch { /* Storage can be unavailable; the storefront still works. */ }
    }).catch((err) => {
      if (!cancelled) { setError(true); console.error("Error loading homepage:", err); }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retry]);

  const isLoading = (storeLoading || loading) && !homePage;
  if (isLoading && !showLoader) return null;
  if (isLoading) return (
    <div className={styles.skeleton} aria-busy="true" aria-label="Cargando tienda">
      <div className={styles.skeletonBar} />
      <div className={styles.skeletonHero} />
      <div className={styles.skeletonCards}>
        {Array.from({ length: 4 }, (_, index) => <div key={index} className={styles.skeletonCard} />)}
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      <StoreHeader />
      <main style={{ flex: 1 }}>
        {homePage ? <SectionRenderer sections={homePage.sections} /> : (
          <section className="container" style={{ paddingBlock: "4rem", textAlign: "center" }} role="status">
            <h1>{error ? "No pudimos cargar el inicio" : "El inicio no está disponible"}</h1>
            <p style={{ marginBlock: "1rem" }}>Puedes consultar nuestros productos en el catálogo.</p>
            <div style={{ display: "flex", justifyContent: "center", gap: "1rem", flexWrap: "wrap" }}>
              <Link to="/productos" className="btn btn-primary">Ver catálogo</Link>
              <button className="btn btn-outline" onClick={() => setRetry((value) => value + 1)}>Volver a intentar</button>
            </div>
          </section>
        )}
      </main>
      <StoreFooter />
    </div>
  );
}
