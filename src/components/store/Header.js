"use client";

import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import { useCart } from "@/context/CartContext";
import { HiOutlineShoppingCart, HiOutlineBars3, HiOutlineXMark } from "react-icons/hi2";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { HiOutlineUserCircle, HiOutlineChevronDown, HiOutlineArrowRightOnRectangle, HiOutlineMagnifyingGlass } from "react-icons/hi2";
import styles from "./Header.module.css";
import SearchBar from "./SearchBar";

export function AuthButtons() {
  const { user, isAdmin, logout } = useAuth();
  const router = useRouter();
  const [authDropdown, setAuthDropdown] = useState(false);

  if (!user) {
    return (
      <Link href="/auth/login" className={styles.loginBtn}>
        <HiOutlineUserCircle size={22} />
        <span>Entrar</span>
      </Link>
    );
  }

  return (
    <div className={styles.authContainer}>
      <button 
        className={styles.userBtn} 
        onClick={() => setAuthDropdown(!authDropdown)}
      >
        <HiOutlineUserCircle size={22} />
        <span>{user.displayName || user.email.split('@')[0]}</span>
        {isAdmin && <span className={styles.adminBadge}>Admin</span>}
        <HiOutlineChevronDown size={14} />
      </button>
      
      {authDropdown && (
        <div className={styles.authDropdown}>
          {isAdmin ? (
            <Link href="/admin" className={styles.dropdownItem} onClick={() => setAuthDropdown(false)}>
              Panel Admin
            </Link>
          ) : (
            <Link href="/mis-pedidos" className={styles.dropdownItem} onClick={() => setAuthDropdown(false)}>
              Mis Pedidos
            </Link>
          )}
          <button 
            className={styles.dropdownItem} 
            onClick={async () => {
              await logout();
              setAuthDropdown(false);
            }}
          >
            <HiOutlineArrowRightOnRectangle size={18} />
            <span>Salir</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default function StoreHeader() {
  const { settings, navigation, features, categories } = useStore();
  const { totalItems, setIsOpen } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const menuItems = navigation?.header?.menuItems || [];

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.brand}>
          {settings.logo ? (
            <img src={settings.logo} alt={settings.name} className={styles.logo} />
          ) : (
            <div className={styles.logoPlaceholder}>
              {(settings.name || "DS").substring(0, 2).toUpperCase()}
            </div>
          )}
        </Link>

        <nav className={`${styles.nav} ${menuOpen ? styles.navOpen : ""}`}>
          <div className={styles.mobileDrawerHeader}>
            <Link href="/" className={styles.brand} onClick={() => setMenuOpen(false)}>
              {settings.logo ? (
                <img src={settings.logo} alt={settings.name} className={styles.logo} />
              ) : (
                <span className={styles.drawerBrandName}>{settings.name}</span>
              )}
            </Link>
            <button className={styles.closeBtn} onClick={() => setMenuOpen(false)}>
              <HiOutlineXMark />
            </button>
          </div>

          <div className={styles.navLinks}>
            <Link href="/" className={styles.navLink} onClick={() => setMenuOpen(false)}>
               Inicio
            </Link>
            <Link href="/productos" className={styles.navLink} onClick={() => setMenuOpen(false)}>
               Catálogo
            </Link>
            {menuItems.filter(i => i.href !== '/' && i.href !== '/productos' && i.href !== '/contacto' && i.href !== '/mis-pedidos').map((item, i) => (
              <Link
                key={i}
                href={item.href}
                className={styles.navLink}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link href="/mis-pedidos" className={styles.navLink} onClick={() => setMenuOpen(false)}>
               Mi Cuenta
            </Link>
            <Link href="/contacto" className={styles.navLink} onClick={() => setMenuOpen(false)}>
               Contacto
            </Link>
          </div>

          {/* Removed mobile categories section as requested */}

          <div className={styles.mobileAuth}>
            <AuthButtons />
          </div>
        </nav>

        <div className={styles.actions}>
          {features.cart && (
            <button className={styles.cartBtn} onClick={() => setIsOpen(true)}>
              <HiOutlineShoppingCart />
              {totalItems > 0 && (
                <span className={styles.cartBadge}>{totalItems}</span>
              )}
            </button>
          )}

          <div className={styles.desktopAuth}>
            <AuthButtons />
          </div>

          <button className={styles.menuBtn} onClick={() => setMenuOpen(true)}>
            <HiOutlineBars3 />
          </button>
        </div>
      </div>

      {/* Second Row: Search Bar */}
      <div className={styles.searchRow}>
        <div className="container">
          <SearchBar />
        </div>
      </div>

      {menuOpen && <div className={styles.overlay} onClick={() => setMenuOpen(false)} />}
    </header>
  );
}
