"use client";

import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import { generateOrderInvoice } from "@/lib/invoice";
import { HiOutlineArrowDownTray, HiOutlineXMark } from "react-icons/hi2";
import styles from "./pedidos.module.css";

export default function MisPedidosPage() {
  const { user, loading: authLoading } = useAuth();
  const { settings } = useStore();
  const router = useRouter();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadPedidos();
    }
  }, [user]);

  const loadPedidos = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    
    try {
      // Strategy: fetch ALL orders and filter client-side.
      // This avoids Firestore composite index requirements entirely.
      // The orders collection is small enough for this approach.
      const ordersRef = collection(db, "orders");
      const snapshot = await getDocs(ordersRef);
      
      const uid = user.uid;
      const email = (user.email || "").toLowerCase();
      
      const myOrders = [];
      snapshot.docs.forEach(docSnap => {
        const d = docSnap.data();
        const orderId = docSnap.id;
        
        // Match by userId
        if (d.userId && d.userId === uid) {
          myOrders.push({ id: orderId, ...d });
          return;
        }
        
        // Match by customerEmail (top-level)
        if (d.customerEmail && d.customerEmail.toLowerCase() === email) {
          myOrders.push({ id: orderId, ...d });
          return;
        }
        
        // Match by customer.email (nested)
        if (d.customer?.email && d.customer.email.toLowerCase() === email) {
          myOrders.push({ id: orderId, ...d });
          return;
        }
      });

      // Sort descending by date (newest first)
      myOrders.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return dateB - dateA;
      });

      setPedidos(myOrders);
    } catch (err) {
      console.error("Error loading orders:", err);
      setError("No se pudieron cargar los pedidos. Intenta de nuevo más tarde.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (order) => {
    try {
      const origin = window.location.origin;
      const doc = await generateOrderInvoice(order, settings, origin);
      doc.save(`Pedido_${(order.id || "0000").substring(0, 8).toUpperCase()}.pdf`);
    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("Hubo un error al generar el PDF. Por favor, intenta de nuevo.");
    }
  };

  if (authLoading || !user) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <StoreHeader />
      <main className={styles.main}>
        <div className={`container ${styles.container}`}>
          <div className={styles.header}>
            <div className={styles.headerContent}>
              <h1 className={styles.title}>Mi Cuenta</h1>
              <p className={styles.subtitle}>
                Hola, {user.displayName || user.email?.split("@")[0] || "Usuario"}. Aquí puedes ver el historial de tus compras.
              </p>
            </div>
            <button 
              className={styles.refreshBtn} 
              onClick={loadPedidos}
              disabled={loading}
              title="Actualizar pedidos"
            >
              {loading ? "..." : "🔄 Actualizar"}
            </button>
          </div>

          {error ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>⚠️</div>
              <h2>Error al cargar pedidos</h2>
              <p>{error}</p>
              <button onClick={loadPedidos} className={styles.shopBtn}>
                Reintentar
              </button>
            </div>
          ) : loading ? (
            <div className={styles.loadingState}>
              <div className="spinner" />
              <p>Cargando pedidos...</p>
            </div>
          ) : pedidos.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🛍️</div>
              <h2>Aún no tienes pedidos</h2>
              <p>Cuando realices tu primera compra, aparecerá aquí.</p>
              <a href="/productos" className={styles.shopBtn}>
                Ver Productos
              </a>
            </div>
          ) : (
            <div className={styles.ordersList}>
              {pedidos.map((pedido) => (
                <div key={pedido.id} className={styles.orderCard}>
                  <div className={styles.orderHeader}>
                    <span className={styles.orderId}>Pedido #{pedido.id.slice(-6).toUpperCase()}</span>
                    <span className={`${styles.orderStatus} ${styles[`status_${pedido.status || "pending"}`]}`}>
                      {pedido.status === "completed" ? "Completado" :
                       pedido.status === "shipped" ? "Enviado" :
                       pedido.status === "cancelled" ? "Cancelado" : "Pendiente"}
                    </span>
                  </div>
                  <div className={styles.orderBody}>
                    {pedido.items && pedido.items.map((item, idx) => (
                      <div key={idx} className={styles.orderItem}>
                        <span className={styles.itemName}>{item.name || item.title}</span>
                        <span className={styles.itemQty}>x{item.quantity || 1}</span>
                        <span className={styles.itemPrice}>
                          ${(item.price || 0).toLocaleString("es-MX")}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className={styles.orderFooter}>
                    <span className={styles.orderDate}>
                      {pedido.createdAt?.toDate
                        ? pedido.createdAt.toDate().toLocaleDateString("es-MX", {
                            year: "numeric", month: "long", day: "numeric",
                          })
                        : "—"}
                    </span>
                    <span className={styles.orderTotal}>
                      Total: ${(pedido.total || 0).toLocaleString("es-MX")}
                    </span>
                  </div>
                  <div className={styles.orderActions}>
                    <button 
                      className={styles.detailsBtn}
                      onClick={() => setSelectedOrder(pedido)}
                    >
                      Ver Detalle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal Detalles */}
      {selectedOrder && (
        <div className={styles.modalOverlay} onClick={() => setSelectedOrder(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Pedido #{selectedOrder.id.slice(-6).toUpperCase()}</h2>
              <button className={styles.closeBtn} onClick={() => setSelectedOrder(null)}>
                <HiOutlineXMark />
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.modalSection}>
                <h3>Estado del Pedido</h3>
                <span className={`${styles.orderStatus} ${styles[`status_${selectedOrder.status || "pending"}`]}`}>
                  {selectedOrder.status === "completed" ? "Completado" :
                   selectedOrder.status === "shipped" ? "Enviado" :
                   selectedOrder.status === "cancelled" ? "Cancelado" : "Pendiente"}
                </span>
                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--color-muted)' }}>
                  Fecha: {selectedOrder.createdAt?.toDate
                        ? selectedOrder.createdAt.toDate().toLocaleDateString("es-MX", {
                            year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
                          })
                        : "—"}
                </p>
              </div>

              <div className={styles.modalSection}>
                <h3>Artículos</h3>
                <div className={styles.ordersList}>
                  {selectedOrder.items && selectedOrder.items.map((item, idx) => (
                    <div key={idx} className={styles.orderItem}>
                      <span className={styles.itemName}>{item.name || item.title}</span>
                      <span className={styles.itemQty}>x{item.quantity || 1}</span>
                      <span className={styles.itemPrice}>
                        ${(item.price || 0).toLocaleString("es-MX")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.modalSection}>
                <h3>Resumen</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                  <span>Subtotal:</span>
                  <span>${(selectedOrder.subtotal || 0).toLocaleString("es-MX")}</span>
                </div>
                {(selectedOrder.discount > 0) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.9rem', color: 'var(--color-danger)' }}>
                    <span>Descuento:</span>
                    <span>-${(selectedOrder.discount || 0).toLocaleString("es-MX")}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                  <span>Envío:</span>
                  <span>{selectedOrder.shipping === 0 ? "Gratis" : `$${(selectedOrder.shipping || 0).toLocaleString("es-MX")}`}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.1rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.5rem' }}>
                  <span>Total:</span>
                  <span>${(selectedOrder.total || 0).toLocaleString("es-MX")}</span>
                </div>
              </div>
              
              <div className={styles.modalSection}>
                <h3>Información de Envío</h3>
                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>
                  {selectedOrder.customer?.name}<br/>
                  {selectedOrder.customer?.address}<br/>
                  {selectedOrder.customer?.city}<br/>
                  Tel: {selectedOrder.customer?.phone}
                </p>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button 
                className={styles.downloadBtn}
                onClick={() => handleDownloadPDF(selectedOrder)}
              >
                <HiOutlineArrowDownTray size={20} />
                Descargar Comprobante PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <StoreFooter />
    </div>
  );
}
