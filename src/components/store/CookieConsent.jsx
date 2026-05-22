"use client";

import { useState, useEffect } from "react";
import styles from "./CookieConsent.module.css";
import { Link } from "react-router-dom";

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if the user has already accepted cookies
    const consent = localStorage.getItem("dalseshop_cookie_consent");
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("dalseshop_cookie_consent", "true");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className={`${styles.overlay} fade-in`}>
      <div className={`glass-panel ${styles.popup}`}>
        <div className={styles.content}>
          <h3 className={styles.title}>Uso de Cookies</h3>
          <p className={styles.text}>
            Utilizamos cookies para mejorar su experiencia de navegación, ofrecer funcionalidades 
            esenciales y analizar nuestro tráfico. Al continuar navegando, usted acepta nuestra{" "}
            <Link to="/terminos-y-condiciones" className={styles.link}>
              política de cookies y términos
            </Link>.
          </p>
        </div>
        <div className={styles.actions}>
          <button onClick={handleAccept} className={`btn btn-primary ${styles.btn}`}>
            Aceptar Cookies
          </button>
        </div>
      </div>
    </div>
  );
}
