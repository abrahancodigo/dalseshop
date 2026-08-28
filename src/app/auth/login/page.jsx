"use client";

import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { HiUser, HiLockClosed, HiOutlineEye, HiOutlineEyeSlash } from "react-icons/hi2";
import { isValidUsername } from "@/lib/authUsername";
import styles from "./login.module.css";

export default function LoginPage() {
  const { user, isAdmin, loginWithGoogle, registerWithUsername, loginWithEmail, resetPassword, loading, redirecting, authError } = useAuth();
  const { settings } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [legacyAccess, setLegacyAccess] = useState(false);

  useEffect(() => {
    if (!loading && !redirecting && user) {
      const from = location.state?.from || (isAdmin ? "/admin" : "/facturacion");
      navigate(from, { replace: true });
    }
  }, [user, isAdmin, loading, redirecting, navigate, location.state?.from]);

  useEffect(() => {
    if (authError) {
      setError(authError);
      setSubmitting(false);
    }
  }, [authError]);

  const resetForm = () => {
    setError("");
    setUsername("");
    setEmail("");
    setPassword("");
    setDisplayName("");
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    if (newMode === "register") setLegacyAccess(false);
    setError("");
  };

  const handleUsernameSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if ((legacyAccess ? !email : !username) || !password) {
      setError("Completa todos los campos");
      return;
    }
    if (!legacyAccess && !isValidUsername(username)) {
      setError("El usuario debe tener 3 a 30 caracteres: letras, números, punto, guion o guion bajo");
      return;
    }
    if (mode === "register" && password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "register") {
        await registerWithUsername(username, password, displayName);
      } else {
        await loginWithEmail(legacyAccess ? email.trim().toLowerCase() : `${username.trim().toLowerCase()}@auth.dalseshop.internal`, password);
      }
    } catch (err) {
      const map = {
        "auth/email-already-in-use": "Este nombre de usuario ya está registrado",
        "auth/invalid-email": legacyAccess ? "Correo inválido" : "Nombre de usuario inválido",
        "auth/user-not-found": legacyAccess ? "Correo o contraseña incorrectos" : "Usuario o contraseña incorrectos",
        "auth/wrong-password": legacyAccess ? "Correo o contraseña incorrectos" : "Usuario o contraseña incorrectos",
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
    if (!email.trim()) {
      setError("Ingresa el correo de tu cuenta existente");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(email.trim().toLowerCase());
      setError("Te enviamos un correo para restablecer tu contraseña");
    } catch (err) {
      setError(err.code === "auth/user-not-found" ? "No hay una cuenta con ese correo" : "No se pudo enviar el correo de recuperación");
    } finally {
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
        <div className={styles.mesh1} />
        <div className={styles.mesh2} />
        <div className={styles.mesh3} />
        <div className={styles.ring1} />
        <div className={styles.ring2} />
        <div className={styles.ring3} />
        <div className={styles.particle1} />
        <div className={styles.particle2} />
        <div className={styles.particle3} />
        <div className={styles.particle4} />
        <div className={styles.particle5} />
        <div className={styles.particle6} />
        <div className={styles.particle7} />
        <div className={styles.particle8} />
      </div>

      <div className={styles.cardGlow} />
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

        <form onSubmit={handleUsernameSubmit} className={styles.form}>
            {mode === "register" && (
              <div className={styles.field}>
                <HiUser className={styles.fieldIcon} />
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
              <HiUser className={styles.fieldIcon} />
              <input
                className={styles.input}
                type={legacyAccess ? "email" : "text"}
                placeholder={legacyAccess ? "Correo de cuenta existente" : "Nombre de usuario"}
                value={legacyAccess ? email : username}
                onChange={(e) => legacyAccess ? setEmail(e.target.value) : setUsername(e.target.value)}
                required
                autoComplete={legacyAccess ? "email" : "username"}
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
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setShowPassword((value) => !value);
                }}
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={showPassword}
              >
                {showPassword ? <HiOutlineEyeSlash size={20} /> : <HiOutlineEye size={20} />}
              </button>
            </div>
            {mode === "login" && (legacyAccess ? <button type="button" className={styles.forgotLink} onClick={handleResetPassword} disabled={submitting}>¿Olvidaste tu contraseña?</button> : <p className={styles.forgotLink}>Si olvidaste tu contraseña, solicita un restablecimiento al administrador.</p>)}
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

        {mode === "login" && <button type="button" className={styles.forgotLink} onClick={() => { setLegacyAccess((value) => !value); setError(""); }}>
          {legacyAccess ? "Usar nombre de usuario" : "Acceder con correo de una cuenta existente"}
        </button>}

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
