"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/context/StoreContext";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import SectionRenderer from "@/components/sections/SectionRenderer";
import { onPagesChange } from "@/lib/firestore";
import Link from "next/link";
import { HiOutlineRocketLaunch, HiOutlineCog6Tooth } from "react-icons/hi2";
import styles from "./home.module.css";

export default function HomePage() {
  const { settings, loading: storeLoading } = useStore();
  const [homePage, setHomePage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("Setting up pages listener...");
    const unsub = onPagesChange((pages) => {
      console.log(`Received ${pages.length} pages from Firestore`);
      
      // Filtrar páginas que son de inicio y están publicadas
      // Usamos Boolean() para manejar casos donde el valor sea string "true" o "false"
      const homePages = pages.filter((p) => {
        const isHP = p.isHomePage === true || p.isHomePage === "true";
        const isPub = p.isPublished === true || p.isPublished === "true";
        return isHP && isPub;
      });
      
      console.log(`Found ${homePages.length} active homepages`);
      
      if (homePages.length > 0) {
        // Ordenamos por fecha de actualización (más reciente primero)
        const sortedHomePages = [...homePages].sort((a, b) => {
          const timeA = a.updatedAt?.seconds || a.updatedAt?._seconds || 0;
          const timeB = b.updatedAt?.seconds || b.updatedAt?._seconds || 0;
          return timeB - timeA;
        });
        
        console.log("Selected homepage:", sortedHomePages[0].title, "with", sortedHomePages[0].sections?.length || 0, "sections");
        setHomePage(sortedHomePages[0]);
      } else {
        console.log("No active homepage found, using default landing.");
        setHomePage(null);
      }
      
      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (storeLoading || loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  // If there's a published homepage, render it dynamically
  if (homePage && homePage.sections?.length > 0) {
    return (
      <div className={styles.page}>
        <StoreHeader />
        <main style={{ flex: 1 }}>
          <SectionRenderer sections={homePage.sections} />
        </main>
        <StoreFooter />
      </div>
    );
  }

  // Default landing page (no homepage configured yet)
  return (
    <div className={styles.page}>
      <StoreHeader />
      <section className={styles.hero}>
        <div className={styles.heroBg}>
          <div className={styles.heroOrb1} />
          <div className={styles.heroOrb2} />
        </div>
        <div className={`container ${styles.heroContent}`}>
          <div className={styles.heroIconWrapper}>
            <HiOutlineRocketLaunch className={styles.heroIcon} />
          </div>
          <h1 className={styles.heroTitle}>{settings.name || "DalseShop"}</h1>
          {settings.slogan && <p className={styles.heroSlogan}>{settings.slogan}</p>}
          <p className={styles.heroDescription}>
            {settings.description || "Tu tienda en línea está en construcción. Pronto podrás ver nuestros increíbles productos."}
          </p>
          <div className={styles.heroActions}>
            <Link href="/auth/login" className={styles.heroBtn}>
              <HiOutlineCog6Tooth />
              <span>Configurar Tienda</span>
            </Link>
          </div>
        </div>
      </section>
      <StoreFooter />
    </div>
  );
}
