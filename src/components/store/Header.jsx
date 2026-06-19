"use client";

import { Link, useNavigate } from "react-router-dom";
import { useStore } from "@/context/StoreContext";
import { useCart } from "@/context/CartContext";
import { 
  HiOutlineShoppingCart, 
  HiOutlineBars3, 
  HiOutlineXMark, 
  HiOutlineHome, 
  HiOutlineShoppingBag, 
  HiOutlineChatBubbleLeftRight, 
  HiOutlineDocumentText, 
  HiOutlineNewspaper,
  HiOutlineUserCircle, 
  HiOutlineChevronDown, 
  HiOutlineArrowRightOnRectangle, 
  HiOutlineMagnifyingGlass 
} from "react-icons/hi2";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { getMenuPages } from "@/lib/firestore";
import styles from "./Header.module.css";
import SearchBar from "./SearchBar";
import BrandTicker from "./BrandTicker";

export function AuthButtons() {
  const { user, isAdmin, hasPermission, logout } = useAuth();
  const navigate = useNavigate();
  const [authDropdown, setAuthDropdown] = useState(false);

  if (!user) {
    return (
      <Link to="/auth/login" className={styles.loginBtn}>
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
          {isAdmin && (
            <Link to="/admin" className={styles.dropdownItem} onClick={() => setAuthDropdown(false)}>
              Panel Admin
            </Link>
          )}
          {hasPermission("inventory") && (
            <Link to="/inventario" className={styles.dropdownItem} onClick={() => setAuthDropdown(false)}>
              Inventario
            </Link>
          )}
          {hasPermission("payroll") && (
            <Link to="/control-asistencia" className={styles.dropdownItem} onClick={() => setAuthDropdown(false)}>
              Control Asistencia
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
  const { settings, navigation, features } = useStore();
  const { totalItems, setIsOpen } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [badgeKey, setBadgeKey] = useState(0);
  const [menuPages, setMenuPages] = useState([]);
  const prevTotalRef = useRef(totalItems);

  useEffect(() => {
    getMenuPages()
      .then(setMenuPages)
      .catch(() => setMenuPages([]));
  }, []);

  useEffect(() => {
    if (totalItems !== prevTotalRef.current) {
      setBadgeKey((k) => k + 1);
      prevTotalRef.current = totalItems;
    }
  }, [totalItems]);

  // Close modal on Escape key
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && searchModalOpen) {
      setSearchModalOpen(false);
    }
  }, [searchModalOpen]);

  useEffect(() => {
    if (searchModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [searchModalOpen, handleKeyDown]);

  const menuItems = navigation?.header?.menuItems || [];

  const builtInPaths = ['/', '/productos', '/contacto', '/facturacion', '/blog'];

  const dynamicMenuPages = menuPages
    .filter(p => !menuItems.some(mi => mi.href === `/${p.slug}`))
    .filter(p => !builtInPaths.includes(`/${p.slug}`))
    .map(p => ({ label: p.title, href: `/${p.slug}` }));

  return (
    <header className={styles.header}>
        <div className={`container ${styles.inner}`}>
          <Link to="/" className={styles.brand}>
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
              <Link to="/" className={styles.brand} onClick={() => setMenuOpen(false)}>
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
              <Link to="/" className={styles.navLink} onClick={() => setMenuOpen(false)}>
                <HiOutlineHome size={20} />
                Inicio
              </Link>
              <Link to="/productos" className={styles.navLink} onClick={() => setMenuOpen(false)}>
                <HiOutlineShoppingBag size={20} />
                Catálogo
              </Link>
              {features.blog && (
                <Link to="/blog" className={styles.navLink} onClick={() => setMenuOpen(false)}>
                  <HiOutlineNewspaper size={20} />
                  Blog
                </Link>
              )}
              <Link to="/contacto" className={styles.navLink} onClick={() => setMenuOpen(false)}>
                <HiOutlineChatBubbleLeftRight size={20} />
                Contacto
              </Link>
              <div className={styles.navLinkGroup}>
                <Link to="/facturacion" className={styles.navLink} onClick={() => setMenuOpen(false)}>
                  <HiOutlineDocumentText size={20} />
                  Facturación
                </Link>
              </div>
              {menuItems.filter(i => i.href !== '/' && i.href !== '/productos' && i.href !== '/contacto' && i.href !== '/facturacion' && i.href !== '/blog').map((item, i) => (
                <Link
                  key={i}
                  to={item.href}
                  className={styles.navLink}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              {dynamicMenuPages.map((item, i) => (
                <Link
                  key={`page-${i}`}
                  to={item.href}
                  className={styles.navLink}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className={styles.mobileAuth}>
              <AuthButtons />
            </div>
          </nav>

          <div className={styles.actions}>
            {features.search && (
              <button
                className={styles.cartBtn}
                onClick={() => {
                  setMenuOpen(false);
                  setSearchModalOpen(true);
                }}
                aria-label="Buscar productos"
                title="Buscar productos"
              >
                <HiOutlineMagnifyingGlass />
              </button>
            )}
            {features.cart && (
              <button className={styles.cartBtn} onClick={() => setIsOpen(true)}>
                <HiOutlineShoppingCart />
                {totalItems > 0 && (
                  <span key={badgeKey} className={`${styles.cartBadge} ${styles.cartBadgeBounce}`}>{totalItems}</span>
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

        {searchModalOpen && (
          <div className={styles.searchModalOverlay} onClick={() => setSearchModalOpen(false)}>
            <div className={styles.searchModalContent} onClick={(e) => e.stopPropagation()}>
              <button className={styles.searchModalClose} onClick={() => setSearchModalOpen(false)} aria-label="Cerrar búsqueda">
                <HiOutlineXMark size={22} />
                <span>Cerrar</span>
              </button>
              <SearchBar onResultClick={() => setSearchModalOpen(false)} autoFocus />
            </div>
          </div>
        )}

        {menuOpen && <div className={styles.overlay} onClick={() => setMenuOpen(false)} />}
        <BrandTicker />
      </header>
  );
}
