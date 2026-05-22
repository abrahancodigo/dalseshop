"use client";

import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { HiShoppingBag, HiSparkles } from "react-icons/hi2";
import styles from "./login.module.css";

export default function LoginPage() {
  const { user, isAdmin, loginWithGoogle, loading, redirecting } = useAuth();
  const { settings } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    // Only navigate once auth state is fully resolved (not loading, not in redirect)
    if (!loading && !redirecting && user) {
      const from = location.state?.from || (isAdmin ? "/admin" : "/facturacion");
      navigate(from, { replace: true });
    }
  }, [user, isAdmin, loading, redirecting, navigate, location.state?.from]);

  const handleLogin = async () => {
    setError("");
    setLoggingIn(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(err.message || "Error al iniciar sesión");
      setLoggingIn(false);
    }
  };

  // Show spinner while Firebase initializes OR while processing a Google redirect
  if (loading || redirecting) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        {redirecting && (
          <span style={{ color: "#94A3B8", marginTop: 12, fontSize: 14 }}>
            Iniciando sesión con Google...
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.bgDecoration}>
        <div className={styles.bgOrb1} />
        <div className={styles.bgOrb2} />
        <div className={styles.bgOrb3} />
      </div>

      <div className={styles.card}>
        <div className={styles.iconWrapper}>
          <HiShoppingBag className={styles.icon} />
          <HiSparkles className={styles.sparkle} />
        </div>

        <h1 className={styles.title}>
          {settings.name || "DalseShop"}
        </h1>
        <p className={styles.subtitle}>Bienvenido</p>
        <p className={styles.description}>
          Inicia sesión con tu cuenta de Google para acceder a tu cuenta
          y disfrutar de tu experiencia de compra.
        </p>

        {error && (
          <div className={styles.error}>
            <span>⚠️</span> {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loggingIn}
          className={styles.googleBtn}
        >
          {loggingIn ? (
            <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
          ) : (
            <>
              <FcGoogle size={22} />
              <span>Continuar con Google</span>
            </>
          )}
        </button>

        <p className={styles.footer}>
          Accede con tu cuenta Google. Admin: Panel completo | Cliente: Tus pedidos
        </p>
      </div>
    </div>
  );
}
