"use client";

import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { HiEnvelope, HiLockClosed, HiOutlineEye, HiOutlineEyeSlash } from "react-icons/hi2";
import styles from "./login.module.css";

export default function LoginPage() {
  const { user, isAdmin, loginWithGoogle, registerWithEmail, loginWithEmail, resetPassword, loading, redirecting } = useAuth();
  const { settings } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (!loading && !redirecting && user) {
      const from = location.state?.from || (isAdmin ? "/admin" : "/facturacion");
      navigate(from, { replace: true });
    }
  }, [user, isAdmin, loading, redirecting, navigate, location.state?.from]);

  const resetForm = () => {
    setError("");
    setEmail("");
    setPassword("");
    setDisplayName("");
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError("");
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Completa todos los campos");
      return;
    }
    if (mode === "register" && password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "register") {
        await registerWithEmail(email, password, displayName);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err) {
      const map = {
        "auth/email-already-in-use": "Este correo ya está registrado",
        "auth/invalid-email": "Correo inválido",
        "auth/user-not-found": "No hay cuenta con este correo",
        "auth/wrong-password": "Contraseña incorrecta",
        "auth/invalid-credential": "Correo o contraseña incorrectos",
        "auth/weak-password": "La contraseña debe tener al menos 6 caracteres",
        "auth/too-many-requests": "Demasiados intentos. Intenta más tarde",
      };
      setError(map[err.code] || err.message || "Error al procesar la solicitud");
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    setError("");
    if (!email) {
      setError("Ingresa tu correo electrónico primero");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(email);
      setResetSent(true);
      setSubmitting(false);
    } catch (err) {
      const map = {
        "auth/user-not-found": "No hay cuenta con este correo",
        "auth/invalid-email": "Correo inválido",
      };
      setError(map[err.code] || "Error al enviar el correo de recuperación");
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(err.message || "Error al iniciar sesión con Google");
      setSubmitting(false);
    }
  };

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
        <div className={styles.logoWrapper}>
          {settings.logo ? (
            <img src={settings.logo} alt={settings.name} className={styles.logo} />
          ) : (
            <div className={styles.logoPlaceholder}>
              {(settings.name || "DS").substring(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <h1 className={styles.title}>
          {settings.name || "DalseShop"}
        </h1>
        <p className={styles.subtitle}>Bienvenido</p>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${mode === "login" ? styles.tabActive : ""}`}
            onClick={() => switchMode("login")}
          >
            Iniciar Sesión
          </button>
          <button
            className={`${styles.tab} ${mode === "register" ? styles.tabActive : ""}`}
            onClick={() => switchMode("register")}
          >
            Crear Cuenta
          </button>
        </div>

        {error && (
          <div className={styles.error}>
            <span>⚠️</span> {error}
          </div>
        )}

        {resetSent ? (
          <div className={styles.resetSent}>
            <div className={styles.resetSentIcon}>✓</div>
            <p className={styles.resetSentText}>
              Te enviamos un correo a <strong>{email}</strong> para restablecer tu contraseña.
            </p>
            <button
              className={styles.resetSentBack}
              onClick={() => { setResetSent(false); setError(""); setSubmitting(false); }}
            >
              Volver a iniciar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={handleEmailSubmit} className={styles.form}>
            {mode === "register" && (
              <div className={styles.field}>
                <HiEnvelope className={styles.fieldIcon} />
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Nombre completo"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}
            <div className={styles.field}>
              <HiEnvelope className={styles.fieldIcon} />
              <input
                className={styles.input}
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete={mode === "login" ? "email" : "username"}
              />
            </div>
            <div className={styles.field}>
              <HiLockClosed className={styles.fieldIcon} />
              <input
                className={`${styles.input} ${styles.inputPassword}`}
                type={showPassword ? "text" : "password"}
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <HiOutlineEyeSlash size={20} /> : <HiOutlineEye size={20} />}
              </button>
            </div>
            {mode === "login" && (
              <button
                type="button"
                className={styles.forgotLink}
                onClick={handleResetPassword}
                disabled={submitting}
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className={styles.submitBtn}
            >
              {submitting ? (
                <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
              ) : (
                mode === "login" ? "Iniciar Sesión" : "Crear Cuenta"
              )}
            </button>
          </form>
        )}

        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerText}>O</span>
          <span className={styles.dividerLine} />
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={submitting}
          className={styles.googleBtn}
        >
          <FcGoogle size={22} />
          <span>Continuar con Google</span>
        </button>
      </div>
    </div>
  );
}
