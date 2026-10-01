"use client";

import { useState, useEffect } from "react";
import styles from "./CookieConsent.module.css";
import { Link } from "react-router-dom";

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let consent;
    try { consent = localStorage.getItem("dalseshop_cookie_consent"); } catch { /* Storage may be disabled. */ }
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    try { localStorage.setItem("dalseshop_cookie_consent", "true"); } catch { /* Dismiss for this session. */ }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className={styles.bar} role="status" aria-live="polite">
      <p className={styles.text}>
        Usamos almacenamiento local para mantener tu sesión y carrito.{" "}
        <Link to="/politica-de-privacidad" className={styles.link}>
          Política de privacidad
        </Link>
      </p>
      <button onClick={handleAccept} className={styles.btn}>
        Entendido
      </button>
    </div>
  );
}
