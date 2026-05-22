"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/context/StoreContext";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import SectionRenderer from "@/components/sections/SectionRenderer";
import { getHomePage } from "@/lib/firestore";
import { Link } from "react-router-dom";
import { HiOutlineRocketLaunch, HiOutlineCog6Tooth } from "react-icons/hi2";
import styles from "./home.module.css";

export default function HomePage() {
  const { settings, loading: storeLoading } = useStore();
  const [homePage, setHomePage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use efficient one-shot query instead of a realtime listener on ALL pages
    getHomePage()
      .then((page) => {
        if (page && page.sections?.length > 0) {
          setHomePage(page);
        } else {
          setHomePage(null);
        }
      })
      .catch((err) => {
        console.error("Error loading homepage:", err);
      })
      .finally(() => {
        setLoading(false);
      });
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
          <div className={styles.heroOrb3} />
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
            <Link to="/auth/login" className={styles.heroBtn}>
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
