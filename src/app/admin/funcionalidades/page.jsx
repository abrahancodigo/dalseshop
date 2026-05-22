"use client";

import { useState, useEffect } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminLayout } from "../layout";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { getStoreFeatures, saveStoreFeatures } from "@/lib/firestore";
import {
  HiOutlineShoppingCart, HiOutlineClipboardDocumentList, HiOutlineMagnifyingGlass,
  HiOutlineUsers, HiOutlineTicket, HiOutlineStar, HiOutlineHeart,
  HiOutlineEnvelope, HiOutlinePencilSquare, HiOutlineTruck, HiOutlineBanknotes,
} from "react-icons/hi2";
import adminStyles from "../admin.module.css";
import styles from "./funcionalidades.module.css";

const FEATURES_CONFIG = [
  {
    key: "cart",
    label: "Carrito de Compras",
    description: "Permite a los clientes agregar productos al carrito y realizar compras",
    icon: HiOutlineShoppingCart,
    color: "#6C5CE7",
    recommended: true,
  },
  {
    key: "orders",
    label: "Gestión de Pedidos",
    description: "Recibe y gestiona los pedidos de tus clientes con seguimiento de estado",
    icon: HiOutlineClipboardDocumentList,
    color: "#00CEC9",
    recommended: true,
  },
  {
    key: "search",
    label: "Buscador",
    description: "Agrega una barra de búsqueda para que los clientes encuentren productos fácilmente",
    icon: HiOutlineMagnifyingGlass,
    color: "#0984E3",
    recommended: true,
  },
  {
    key: "customers",
    label: "Gestión de Clientes",
    description: "Mantén un registro de tus clientes, su historial de compras y datos de contacto",
    icon: HiOutlineUsers,
    color: "#FDCB6E",
  },
  {
    key: "coupons",
    label: "Cupones de Descuento",
    description: "Crea códigos de descuento por porcentaje o monto fijo con fecha de expiración",
    icon: HiOutlineTicket,
    color: "#E17055",
  },
  {
    key: "reviews",
    label: "Reseñas de Productos",
    description: "Permite a los clientes dejar reseñas y calificaciones en los productos",
    icon: HiOutlineStar,
    color: "#FDCB6E",
  },
  {
    key: "wishlist",
    label: "Lista de Deseos",
    description: "Los clientes pueden guardar productos favoritos para comprarlos después",
    icon: HiOutlineHeart,
    color: "#E84393",
  },
  {
    key: "newsletter",
    label: "Newsletter",
    description: "Captura emails de tus clientes para enviarles novedades y ofertas",
    icon: HiOutlineEnvelope,
    color: "#00B894",
  },
  {
    key: "blog",
    label: "Blog",
    description: "Publica artículos relacionados con tus productos para atraer tráfico",
    icon: HiOutlinePencilSquare,
    color: "#6C5CE7",
  },
  {
    key: "shipping",
    label: "Configuración de Envíos",
    description: "Define zonas de envío, costos y tiempos de entrega estimados",
    icon: HiOutlineTruck,
    color: "#0984E3",
  },
  {
    key: "showPrices",
    label: "Mostrar Precios",
    description: "Oculta los precios de los productos y muestra 'Consultar precio'. Al confirmar el pedido se aclara que es una orden de compra, no una factura.",
    icon: HiOutlineBanknotes,
    color: "#E17055",
  },
];

export default function FuncionalidadesPage() {
  const { toggleSidebar } = useAdminLayout();
  const { canManage } = useAuth();
  const { defaultFeatures } = useStore();
  const [form, setForm] = useState(defaultFeatures);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadFeatures();
  }, []);

  const loadFeatures = async () => {
    const data = await getStoreFeatures();
    if (data) {
      setForm({ ...defaultFeatures, ...data });
    }
  };

  const handleToggle = (key) => {
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!canManage("features")) {
      alert("Usted no tiene los permisos para realizar esta accion");
      return;
    }
    setSaving(true);
    try {
      await saveStoreFeatures(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Error saving features:", err);
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = Object.values(form).filter(Boolean).length;

  return (
    <>
      <AdminHeader
        title="Funcionalidades"
        subtitle="Activa o desactiva las funciones de tu tienda"
        onMenuToggle={toggleSidebar}
      />

      <div className={adminStyles.pageContent}>
        <div className={styles.statusBar}>
          <span className={styles.statusText}>
            <strong>{enabledCount}</strong> de {FEATURES_CONFIG.length} funcionalidades activas
          </span>
          <div className={styles.statusBar__bar}>
            <div
              className={styles.statusBar__fill}
              style={{ width: `${(enabledCount / FEATURES_CONFIG.length) * 100}%` }}
            />
          </div>
        </div>

        <div className={styles.featuresGrid}>
          {FEATURES_CONFIG.map((feature) => {
            const Icon = feature.icon;
            const isActive = form[feature.key];
            return (
              <div
                key={feature.key}
                className={`${styles.featureCard} ${isActive ? styles.active : ""}`}
              >
                <div className={styles.featureTop}>
                  <div
                    className={styles.featureIcon}
                    style={{
                      background: `${feature.color}20`,
                      color: feature.color,
                    }}
                  >
                    <Icon />
                  </div>

                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => handleToggle(feature.key)}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>

                <div className={styles.featureInfo}>
                  <div className={styles.featureLabel}>
                    {feature.label}
                    {feature.recommended && (
                      <span className={styles.recommendedBadge}>Recomendado</span>
                    )}
                  </div>
                  <p className={styles.featureDesc}>{feature.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save Bar */}
      <div className={adminStyles.saveBar}>
        {saved && (
          <span className={adminStyles.saveBarMessage}>
            ✓ Funcionalidades actualizadas
          </span>
        )}
        {canManage("features") ? (
          <button
            className="btn btn-primary btn-lg"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar Cambios"}
          </button>
        ) : (
          <span className="btn btn-primary btn-lg" style={{ opacity: 0.5, cursor: "not-allowed" }} title="No tienes permisos para guardar funcionalidades">
            Solo lectura
          </span>
        )}
      </div>
    </>
  );
}
