"use client";

import { Link, useLocation } from "react-router-dom";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import { hasPermission } from "@/lib/permissions";
import {
  HiOutlineHome,
  HiOutlineCog6Tooth,
  HiOutlinePaintBrush,
  HiOutlineDocumentText,
  HiOutlineShoppingBag,
  HiOutlineSquares2X2,
  HiOutlineClipboardDocumentList,
  HiOutlineUsers,
  HiOutlineTicket,
  HiOutlineBars3,
  HiOutlineWrenchScrewdriver,
  HiOutlineArrowLeftOnRectangle,
  HiOutlineGlobeAlt,
  HiOutlineStar,
  HiOutlineEnvelope,
  HiOutlineTruck,
  HiOutlineNewspaper,
  HiOutlineTag,
  HiOutlineShieldCheck,
} from "react-icons/hi2";
import styles from "./Sidebar.module.css";

const menuItems = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: HiOutlineHome,
    permission: "dashboard",
  },
  {
    label: "Configuración",
    href: "/admin/configuracion",
    icon: HiOutlineCog6Tooth,
    permission: "settings",
  },
  {
    label: "Tema / Diseño",
    href: "/admin/tema",
    icon: HiOutlinePaintBrush,
    permission: "theme",
  },
  {
    label: "Páginas",
    href: "/admin/paginas",
    icon: HiOutlineDocumentText,
    permission: "pages",
  },
  {
    label: "Navegación",
    href: "/admin/navegacion",
    icon: HiOutlineBars3,
    permission: "navigation",
  },
  { type: "divider" },
  {
    label: "Productos",
    href: "/admin/productos",
    icon: HiOutlineShoppingBag,
    permission: "products",
  },
  {
    label: "Categorías",
    href: "/admin/categorias",
    icon: HiOutlineSquares2X2,
    permission: "categories",
  },
  {
    label: "Marcas",
    href: "/admin/marcas",
    icon: HiOutlineTag,
    permission: "brands",
  },
  { type: "divider" },
  {
    label: "Pedidos",
    href: "/admin/pedidos",
    icon: HiOutlineClipboardDocumentList,
    permission: "orders",
    feature: "orders",
  },
  {
    label: "Clientes",
    href: "/admin/clientes",
    icon: HiOutlineUsers,
    permission: "customers",
    feature: "customers",
  },
  {
    label: "Cupones",
    href: "/admin/cupones",
    icon: HiOutlineTicket,
    permission: "coupons",
    feature: "coupons",
  },
  { type: "divider" },
  {
    label: "Blog",
    href: "/admin/blog/posts",
    icon: HiOutlineNewspaper,
    permission: "blog",
    feature: "blog",
  },
  {
    label: "Blog Config",
    href: "/admin/blog/configuracion",
    icon: HiOutlineCog6Tooth,
    permission: "blog",
    feature: "blog",
  },
  {
    label: "Newsletter",
    href: "/admin/marketing/newsletter",
    icon: HiOutlineEnvelope,
    permission: "newsletter",
    feature: "newsletter",
  },
  {
    label: "Reseñas",
    href: "/admin/marketing/resenas",
    icon: HiOutlineStar,
    permission: "reviews",
    feature: "reviews",
  },
  {
    label: "Envíos",
    href: "/admin/envios",
    icon: HiOutlineTruck,
    permission: "shipping",
  },
  { type: "divider" },
  {
    label: "Funcionalidades",
    href: "/admin/funcionalidades",
    icon: HiOutlineWrenchScrewdriver,
    permission: "features",
  },
  {
    label: "Inventario",
    href: "/inventario",
    icon: HiOutlineClipboardDocumentList,
    permission: "inventory",
    external: true,
  },
  {
    label: "Usuarios",
    href: "/admin/usuarios",
    icon: HiOutlineShieldCheck,
    permission: "users",
  },
];

export default function Sidebar({ isOpen, onClose }) {
  const { pathname } = useLocation();
  const { settings, features } = useStore();
  const { permissions: userPerms } = useAuth();

  const isActive = (href) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const filteredItems = menuItems.filter((item) => {
    if (item.type === "divider") return true;
    if (item.permission && !hasPermission(userPerms, item.permission)) return false;
    if (item.feature && !features[item.feature]) return false;
    return true;
  });

  return (
    <>
      {isOpen && <div className={styles.overlay} onClick={onClose} />}
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ""}`}>
        <div className={styles.brand}>
          {settings.logo ? (
            <img src={settings.logo} alt={settings.name} className={styles.logo} />
          ) : (
            <div className={styles.logoPlaceholder}>
              {(settings.name || "DS").substring(0, 2).toUpperCase()}
            </div>
          )}
          <div className={styles.brandText}>
            <span className={styles.brandName}>
              {settings.name || "DalseShop"}
            </span>
            <span className={styles.brandLabel}>Admin Panel</span>
          </div>
        </div>

        <nav className={styles.nav}>
          {filteredItems.map((item, idx) => {
            if (item.type === "divider") {
              return <div key={`div-${idx}`} className={styles.divider} />;
            }
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`${styles.navItem} ${!item.external && isActive(item.href) ? styles.active : ""}`}
                onClick={onClose}
              >
                <Icon className={styles.navIcon} />
                <span>{item.label}</span>
                {!item.external && isActive(item.href) && <div className={styles.activeIndicator} />}
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <a href="/" className={styles.navItem} target="_blank" rel="noopener noreferrer">
            <HiOutlineGlobeAlt className={styles.navIcon} />
            <span>Ver Tienda</span>
          </a>
        </div>
      </aside>
    </>
  );
}
