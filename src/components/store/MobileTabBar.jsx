"use client";

import { Link, useLocation } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import {
  HiOutlineHome,
  HiOutlineSquares2X2,
  HiOutlineShoppingBag,
  HiOutlineUserCircle,
} from "react-icons/hi2";
import styles from "./MobileTabBar.module.css";

/**
 * Barra de pestañas inferior, solo en móvil.
 *
 * Es el patrón que hace que una web se sienta app: navegación siempre al
 * alcance del pulgar, indicador de sección activa y contador del carrito.
 * En escritorio no se renderiza (display: none por media query), así que no
 * afecta al layout de escritorio.
 */
export default function MobileTabBar() {
  const location = useLocation();
  const { totalItems, setIsOpen } = useCart();
  const { user } = useAuth();

  const isActive = (path) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  // El panel de administración y el login tienen su propio layout y su propia
  // navegación; la barra de tienda ahí solo estorbaría.
  const isAdminArea =
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/auth");

  if (isAdminArea) return null;

  const accountPath = user ? "/admin" : "/auth/login";

  return (
    <nav className={styles.tabBar} aria-label="Navegación principal">
      <Link
        to="/"
        className={`${styles.tab} ${isActive("/") ? styles.tabActive : ""}`}
        aria-current={isActive("/") ? "page" : undefined}
      >
        <HiOutlineHome className={styles.icon} />
        <span className={styles.label}>Inicio</span>
      </Link>

      <Link
        to="/productos"
        className={`${styles.tab} ${isActive("/productos") ? styles.tabActive : ""}`}
        aria-current={isActive("/productos") ? "page" : undefined}
      >
        <HiOutlineSquares2X2 className={styles.icon} />
        <span className={styles.label}>Catálogo</span>
      </Link>

      <button
        type="button"
        className={styles.tab}
        onClick={() => setIsOpen(true)}
        aria-label={`Abrir carrito${totalItems > 0 ? `, ${totalItems} artículos` : ""}`}
      >
        <span className={styles.cartWrap}>
          <HiOutlineShoppingBag className={styles.icon} />
          {totalItems > 0 && (
            <span className={styles.badge}>{totalItems > 99 ? "99+" : totalItems}</span>
          )}
        </span>
        <span className={styles.label}>Carrito</span>
      </button>

      <Link
        to={accountPath}
        className={`${styles.tab} ${isActive("/admin") || isActive("/auth") ? styles.tabActive : ""}`}
        aria-current={isActive("/admin") || isActive("/auth") ? "page" : undefined}
      >
        <HiOutlineUserCircle className={styles.icon} />
        <span className={styles.label}>{user ? "Cuenta" : "Entrar"}</span>
      </Link>
    </nav>
  );
}
