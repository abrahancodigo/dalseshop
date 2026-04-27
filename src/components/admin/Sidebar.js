"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/context/StoreContext";
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
} from "react-icons/hi2";
import styles from "./Sidebar.module.css";

const menuItems = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: HiOutlineHome,
    alwaysShow: true,
  },
  {
    label: "Configuración",
    href: "/admin/configuracion",
    icon: HiOutlineCog6Tooth,
    alwaysShow: true,
  },
  {
    label: "Tema / Diseño",
    href: "/admin/tema",
    icon: HiOutlinePaintBrush,
    alwaysShow: true,
  },
  {
    label: "Páginas",
    href: "/admin/paginas",
    icon: HiOutlineDocumentText,
    alwaysShow: true,
  },
  {
    label: "Navegación",
    href: "/admin/navegacion",
    icon: HiOutlineBars3,
    alwaysShow: true,
  },
  { type: "divider" },
  {
    label: "Productos",
    href: "/admin/productos",
    icon: HiOutlineShoppingBag,
    alwaysShow: true,
  },
  {
    label: "Categorías",
    href: "/admin/categorias",
    icon: HiOutlineSquares2X2,
    alwaysShow: true,
  },
  {
    label: "Marcas",
    href: "/admin/marcas",
    icon: HiOutlineTag,
    alwaysShow: true,
  },
  { type: "divider" },
  {
    label: "Pedidos",
    href: "/admin/pedidos",
    icon: HiOutlineClipboardDocumentList,
    feature: "orders",
  },
  {
    label: "Clientes",
    href: "/admin/clientes",
    icon: HiOutlineUsers,
    feature: "customers",
  },
  {
    label: "Cupones",
    href: "/admin/cupones",
    icon: HiOutlineTicket,
    feature: "coupons",
  },
  { type: "divider" },
  {
    label: "Blog",
    href: "/admin/blog/posts",
    icon: HiOutlineNewspaper,
    feature: "blog",
  },
  {
    label: "Newsletter",
    href: "/admin/marketing/newsletter",
    icon: HiOutlineEnvelope,
    feature: "newsletter",
  },
  {
    label: "Reseñas",
    href: "/admin/marketing/resenas",
    icon: HiOutlineStar,
    feature: "reviews",
  },
  {
    label: "Envíos",
    href: "/admin/envios",
    icon: HiOutlineTruck,
    alwaysShow: true,
  },
  { type: "divider" },
  {
    label: "Funcionalidades",
    href: "/admin/funcionalidades",
    icon: HiOutlineWrenchScrewdriver,
    alwaysShow: true,
  },
];

export default function Sidebar({ isOpen, onClose }) {
  const pathname = usePathname();
  const { settings, features } = useStore();

  const isActive = (href) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const filteredItems = menuItems.filter((item) => {
    if (item.type === "divider") return true;
    if (item.alwaysShow) return true;
    if (item.feature) return features[item.feature];
    return true;
  });

  return (
    <>
      {isOpen && <div className={styles.overlay} onClick={onClose} />}
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ""}`}>
        {/* Logo / Brand */}
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

        {/* Navigation */}
        <nav className={styles.nav}>
          {filteredItems.map((item, idx) => {
            if (item.type === "divider") {
              return <div key={`div-${idx}`} className={styles.divider} />;
            }
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive(item.href) ? styles.active : ""}`}
                onClick={onClose}
              >
                <Icon className={styles.navIcon} />
                <span>{item.label}</span>
                {isActive(item.href) && <div className={styles.activeIndicator} />}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={styles.sidebarFooter}>
          <Link href="/" className={styles.navItem} target="_blank">
            <HiOutlineGlobeAlt className={styles.navIcon} />
            <span>Ver Tienda</span>
          </Link>
        </div>
      </aside>
    </>
  );
}
