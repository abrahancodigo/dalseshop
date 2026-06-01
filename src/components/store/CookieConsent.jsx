"use client";

import { useState, useEffect } from "react";
import styles from "./CookieConsent.module.css";
import { Link } from "react-router-dom";

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("dalseshop_cookie_consent");
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("dalseshop_cookie_consent", "true");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className={styles.bar}>
      <p className={styles.text}>
        Este sitio usa cookies.{" "}
        <Link to="/terminos-y-condiciones" className={styles.link}>
          Más info
        </Link>
      </p>
      <button onClick={handleAccept} className={styles.btn}>
        Aceptar
      </button>
    </div>
  );
}
