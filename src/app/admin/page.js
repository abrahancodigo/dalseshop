"use client";

import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminLayout } from "./layout";
import { useStore } from "@/context/StoreContext";
import { useEffect, useState } from "react";
import { getProducts, getOrders, getCategories } from "@/lib/firestore";
import {
  HiOutlineShoppingBag,
  HiOutlineClipboardDocumentList,
  HiOutlineCurrencyDollar,
  HiOutlineUsers,
  HiOutlineRocketLaunch,
  HiOutlineCog6Tooth,
  HiOutlinePaintBrush,
  HiOutlineDocumentText,
  HiOutlineSquares2X2,
} from "react-icons/hi2";
import Link from "next/link";
import adminStyles from "./admin.module.css";
import styles from "./dashboard.module.css";

export default function DashboardPage() {
  const { toggleSidebar } = useAdminLayout();
  const { settings, features } = useStore();
  const [stats, setStats] = useState({
    products: 0,
    categories: 0,
    orders: 0,
    revenue: 0,
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [products, categories] = await Promise.all([
        getProducts(),
        getCategories(),
      ]);

      let orders = [];
      let revenue = 0;

      if (features.orders) {
        orders = await getOrders({ limitCount: 5 });
        revenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
      }

      setStats({
        products: products.length,
        categories: categories.length,
        orders: orders.length,
        revenue,
      });
      setRecentOrders(orders);
    } catch (err) {
      console.error("Error loading stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const quickLinks = [
    {
      label: "Configuración",
      description: "Nombre, logo y datos de contacto",
      href: "/admin/configuracion",
      icon: HiOutlineCog6Tooth,
      color: "#6C5CE7",
    },
    {
      label: "Tema / Diseño",
      description: "Colores, fuentes y estilos",
      href: "/admin/tema",
      icon: HiOutlinePaintBrush,
      color: "#00CEC9",
    },
    {
      label: "Páginas",
      description: "Crear y editar páginas",
      href: "/admin/paginas",
      icon: HiOutlineDocumentText,
      color: "#FDCB6E",
    },
    {
      label: "Productos",
      description: "Gestionar catálogo",
      href: "/admin/productos",
      icon: HiOutlineShoppingBag,
      color: "#E17055",
    },
    {
      label: "Categorías",
      description: "Organizar productos",
      href: "/admin/categorias",
      icon: HiOutlineSquares2X2,
      color: "#0984E3",
    },
  ];

  return (
    <>
      <AdminHeader
        title="Dashboard"
        subtitle={`Bienvenido a ${settings.name || "tu tienda"}`}
        onMenuToggle={toggleSidebar}
      />

      <div className={adminStyles.pageContent}>
        {/* Welcome Banner */}
        <div className={styles.welcomeBanner}>
          <div className={styles.welcomeContent}>
            <div className={styles.welcomeIcon}>
              <HiOutlineRocketLaunch />
            </div>
            <div>
              <h2 className={styles.welcomeTitle}>
                ¡Bienvenido a {settings.name || "DalseShop"}!
              </h2>
              <p className={styles.welcomeText}>
                Construye tu tienda en línea desde cero. Configura tu marca, diseña tus 
                páginas, agrega productos y empieza a vender.
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className={adminStyles.statsGrid}>
          <div className={adminStyles.statCard}>
            <div
              className={adminStyles.statIcon}
              style={{ background: "rgba(108, 92, 231, 0.15)", color: "#6C5CE7" }}
            >
              <HiOutlineShoppingBag />
            </div>
            <div className={adminStyles.statInfo}>
              <div className={adminStyles.statValue}>{stats.products}</div>
              <div className={adminStyles.statLabel}>Productos</div>
            </div>
          </div>

          <div className={adminStyles.statCard}>
            <div
              className={adminStyles.statIcon}
              style={{ background: "rgba(0, 206, 201, 0.15)", color: "#00CEC9" }}
            >
              <HiOutlineSquares2X2 />
            </div>
            <div className={adminStyles.statInfo}>
              <div className={adminStyles.statValue}>{stats.categories}</div>
              <div className={adminStyles.statLabel}>Categorías</div>
            </div>
          </div>

          {features.orders && (
            <>
              <div className={adminStyles.statCard}>
                <div
                  className={adminStyles.statIcon}
                  style={{ background: "rgba(253, 203, 110, 0.15)", color: "#FDCB6E" }}
                >
                  <HiOutlineClipboardDocumentList />
                </div>
                <div className={adminStyles.statInfo}>
                  <div className={adminStyles.statValue}>{stats.orders}</div>
                  <div className={adminStyles.statLabel}>Pedidos</div>
                </div>
              </div>

              <div className={adminStyles.statCard}>
                <div
                  className={adminStyles.statIcon}
                  style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10B981" }}
                >
                  <HiOutlineCurrencyDollar />
                </div>
                <div className={adminStyles.statInfo}>
                  <div className={adminStyles.statValue}>
                    ${stats.revenue.toLocaleString()}
                  </div>
                  <div className={adminStyles.statLabel}>Ingresos</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Quick Links */}
        <div className={adminStyles.sectionHeader}>
          <h3 className={adminStyles.sectionTitle}>Acceso Rápido</h3>
        </div>
        <div className={styles.quickLinksGrid}>
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href} className={styles.quickLink}>
                <div
                  className={styles.quickLinkIcon}
                  style={{ background: `${link.color}20`, color: link.color }}
                >
                  <Icon />
                </div>
                <div>
                  <div className={styles.quickLinkLabel}>{link.label}</div>
                  <div className={styles.quickLinkDesc}>{link.description}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
