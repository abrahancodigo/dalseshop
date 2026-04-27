"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getOrderById } from "@/lib/firestore";
import { generateOrderInvoice } from "@/lib/invoice";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import { useStore } from "@/context/StoreContext";
import { HiOutlineArrowDownTray, HiOutlineArrowLeft } from "react-icons/hi2";
import Link from "next/link";
import styles from "./detalle.module.css";

function DetalleContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const { settings } = useStore();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (orderId) {
      loadOrder();
    } else {
      setLoading(false);
      setError("No se especificó un número de pedido.");
    }
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const data = await getOrderById(orderId);
      if (data) {
        setOrder(data);
      } else {
        setError("Pedido no encontrado.");
      }
    } catch (err) {
      setError("Error al cargar el pedido.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!order) return;
    try {
      const origin = window.location.origin;
      const doc = await generateOrderInvoice(order, settings, origin);
      doc.save(`Factura_${(order.id || "0000").substring(0, 8).toUpperCase()}.pdf`);
    } catch (err) {
      alert("Error al generar el PDF.");
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <StoreHeader />
        <main className={styles.main}>
          <div className="loading-screen"><div className="spinner" /><p>Cargando factura...</p></div>
        </main>
        <StoreFooter />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className={styles.page}>
        <StoreHeader />
        <main className={styles.main}>
          <div className={styles.errorState}>
            <div className={styles.errorIcon}>⚠️</div>
            <h2>{error || "Factura no disponible"}</h2>
            <Link href="/" className="btn btn-primary">Volver al inicio</Link>
          </div>
        </main>
        <StoreFooter />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <StoreHeader />
      <main className={styles.main}>
        <div className={`container ${styles.container}`}>
          <div className={styles.topBar}>
            <Link href="/facturacion" className={styles.backLink}>
              <HiOutlineArrowLeft /> Volver a Facturación
            </Link>
            <button onClick={handleDownload} className={styles.downloadBtn}>
              <HiOutlineArrowDownTray size={20} />
              Descargar PDF
            </button>
          </div>

          <div className={styles.invoiceCard}>
            <div className={styles.invoiceHeader}>
              <div className={styles.storeInfo}>
                {settings?.logo && <img src={settings.logo} alt="Logo" className={styles.storeLogo} />}
                <h1 className={styles.storeName}>{(settings?.name || "Nuestra Tienda").toUpperCase()}</h1>
                {settings?.address && <p>{settings.address}</p>}
                {settings?.phone && <p>Tel: {settings.phone}</p>}
                {settings?.email && <p>Email: {settings.email}</p>}
              </div>
              <div className={styles.invoiceMeta}>
                <h2 className={styles.invoiceTitle}>NOTA DE PEDIDO</h2>
                <p className={styles.invoiceId}>#{(order.id || "0000").substring(0, 8).toUpperCase()}</p>
                <p>Fecha: {order.createdAt?.toDate
                  ? order.createdAt.toDate().toLocaleDateString("es-MX")
                  : new Date().toLocaleDateString()}</p>
                <span className={`${styles.statusBadge} ${styles[`status_${order.status || "pending"}`]}`}>
                  {order.status === "completed" ? "Completado" :
                   order.status === "shipped" ? "Enviado" :
                   order.status === "cancelled" ? "Cancelado" : "Pendiente"}
                </span>
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.section}>
              <h3>Datos del Cliente</h3>
              <div className={styles.infoGrid}>
                <div><strong>Nombre:</strong> {order.customer?.name || ""}</div>
                <div><strong>Email:</strong> {order.customer?.email || ""}</div>
                <div><strong>Teléfono:</strong> {order.customer?.phone || ""}</div>
                <div><strong>Dirección:</strong> {order.customer?.address || ""}, {order.customer?.city || ""}</div>
              </div>
            </div>

            {order.invoice?.wantsInvoice && (
              <div className={styles.section}>
                <h3>Datos Fiscales</h3>
                <div className={styles.infoGrid}>
                  <div><strong>Razón Social:</strong> {order.invoice.businessName}</div>
                  <div><strong>NIT:</strong> {order.invoice.taxId}</div>
                  <div><strong>NRC:</strong> {order.invoice.nrc || ""}</div>
                  <div><strong>Giro:</strong> {order.invoice.businessType}</div>
                </div>
              </div>
            )}

            <div className={styles.section}>
              <h3>Artículos</h3>
              <div className={styles.tableWrap}>
                <table className={styles.itemsTable}>
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Producto</th>
                      <th>Cant.</th>
                      <th>Precio Unit.</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(order.items || []).map((item, i) => (
                      <tr key={i}>
                        <td>{item.barcode || item.sku || "-"}</td>
                        <td>{item.name}{item.variant ? ` (${item.variant})` : ""}</td>
                        <td>{item.quantity}</td>
                        <td>${(item.price || 0).toLocaleString()}</td>
                        <td>${((item.price || 0) * (item.quantity || 1)).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.totals}>
              <div className={styles.totalRow}><span>Subtotal</span><span>${(order.subtotal || 0).toLocaleString()}</span></div>
              {order.discount > 0 && <div className={styles.totalRow}><span>Descuento</span><span>-${(order.discount || 0).toLocaleString()}</span></div>}
              <div className={styles.totalRow}><span>Envío</span><span>{order.shipping === 0 ? "Gratis" : `$${(order.shipping || 0).toLocaleString()}`}</span></div>
              <div className={`${styles.totalRow} ${styles.grandTotal}`}><span>Total</span><span>${(order.total || 0).toLocaleString()}</span></div>
            </div>

            <div className={styles.footer}>{settings?.name || "DalseShop"} — ¡Gracias por tu preferencia!</div>
          </div>
        </div>
      </main>
      <StoreFooter />
    </div>
  );
}

export default function DetalleFacturaPage() {
  return (
    <Suspense fallback={<div className="loading-screen"><div className="spinner" /><p>Cargando...</p></div>}>
      <DetalleContent />
    </Suspense>
  );
}
