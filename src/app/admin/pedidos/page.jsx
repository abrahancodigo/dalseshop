"use client";

import { useState, useEffect } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminLayout } from "../layout";
import { useAuth } from "@/context/AuthContext";
import { formatPrice } from "@/lib/format";
import { getOrders, saveOrder, getOrderById, deleteOrder } from "@/lib/supabase-queries";
import {
  HiOutlineClipboardDocumentList,
  HiOutlineEye,
  HiOutlineXMark,
  HiOutlineTruck,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineXCircle,
  HiOutlineBanknotes,
} from "react-icons/hi2";
import adminStyles from "../admin.module.css";
import styles from "./pedidos.module.css";

const STATUS_MAP = {
  pending: { label: "Pendiente", color: "#FDCB6E", icon: HiOutlineClock },
  confirmed: { label: "Confirmado", color: "#0984E3", icon: HiOutlineCheckCircle },
  shipped: { label: "Enviado", color: "#6C5CE7", icon: HiOutlineTruck },
  delivered: { label: "Entregado", color: "#00B894", icon: HiOutlineCheckCircle },
  cancelled: { label: "Cancelado", color: "#E17055", icon: HiOutlineXCircle },
};

const PAYMENT_STATUS_MAP = {
  pending: { label: "Pendiente", color: "#FDCB6E" },
  paid: { label: "Pagado", color: "#00B894" },
  refunded: { label: "Reembolsado", color: "#E17055" },
};

export default function PedidosPage() {
  const { toggleSidebar } = useAdminLayout();
  const { canManage } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const data = await getOrders({ limitCount: 50 });
      setOrders(data);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    if (!canManage("orders")) { alert("Usted no tiene los permisos para realizar esta accion"); return; }
    setUpdatingStatus(true);
    try {
      await saveOrder(orderId, { status: newStatus });
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => ({ ...prev, status: newStatus }));
      }
      loadOrders();
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePaymentStatusChange = async (orderId, paymentStatus) => {
    if (!canManage("orders")) { alert("Usted no tiene los permisos para realizar esta accion"); return; }
    try {
      await saveOrder(orderId, { paymentStatus });
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => ({ ...prev, paymentStatus }));
      }
      loadOrders();
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!canManage("orders")) { alert("Usted no tiene los permisos para realizar esta accion"); return; }
    if (!window.confirm("¿Estás seguro de que deseas eliminar este pedido? Esta acción no se puede deshacer.")) return;
    
    try {
      await deleteOrder(orderId);
      if (selectedOrder?.id === orderId) setSelectedOrder(null);
      loadOrders();
    } catch (err) {
      alert("Error al eliminar el pedido");
      console.error(err);
    }
  };

  const filtered = filterStatus
    ? orders.filter((o) => o.status === filterStatus)
    : orders;

  const formatDate = (timestamp) => {
    if (!timestamp) return "—";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <AdminHeader
        title="Pedidos"
        subtitle={`${orders.length} pedido${orders.length !== 1 ? "s" : ""}`}
        onMenuToggle={toggleSidebar}
      />

      <div className={adminStyles.pageContent}>
        {/* Filter Tabs */}
        <div className={styles.filterTabs}>
          <button
            className={`${styles.filterTab} ${!filterStatus ? styles.active : ""}`}
            onClick={() => setFilterStatus("")}
          >
            Todos ({orders.length})
          </button>
          {Object.entries(STATUS_MAP).map(([key, val]) => {
            const count = orders.filter((o) => o.status === key).length;
            return (
              <button
                key={key}
                className={`${styles.filterTab} ${filterStatus === key ? styles.active : ""}`}
                onClick={() => setFilterStatus(key)}
                style={{ "--tab-color": val.color }}
              >
                {val.label} ({count})
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="loading-screen" style={{ minHeight: 300 }}>
            <div className="spinner" />
          </div>
        ) : orders.length === 0 ? (
          <div className={adminStyles.emptyState}>
            <div className={adminStyles.emptyIcon}>
              <HiOutlineClipboardDocumentList />
            </div>
            <h3 className={adminStyles.emptyTitle}>Sin pedidos aún</h3>
            <p className={adminStyles.emptyText}>
              Cuando tus clientes realicen compras, los pedidos aparecerán aquí.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={adminStyles.emptyState}>
            <h3 className={adminStyles.emptyTitle}>Sin pedidos con este estado</h3>
          </div>
        ) : (
          <div className={styles.ordersList}>
            {filtered.map((order) => {
              const status = STATUS_MAP[order.status] || STATUS_MAP.pending;
              const StatusIcon = status.icon;
              return (
                <div key={order.id} className={styles.orderCard}>
                  <div className={styles.orderTop}>
                    <div className={styles.orderIdRow}>
                      <span className={styles.orderId}>
                        {order.orderNumber ? `#${String(order.orderNumber).padStart(4, "0")}` : `#${order.id.substring(0, 8).toUpperCase()}`}
                      </span>
                      <span className={styles.orderDate}>
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                    <div
                      className={styles.statusBadge}
                      style={{ background: `${status.color}20`, color: status.color }}
                    >
                      <StatusIcon />
                      {status.label}
                    </div>
                  </div>

                  <div className={styles.orderBody}>
                    <div className={styles.orderCustomer}>
                      <strong>{order.customer?.name || "Cliente"}</strong>
                      <span>{order.customer?.email}</span>
                      <span>{order.customer?.phone}</span>
                    </div>
                    <div className={styles.orderSummary}>
                      <span className={styles.orderItems}>
                        {order.items?.length || 0} producto{(order.items?.length || 0) !== 1 ? "s" : ""}
                      </span>
                      <span className={styles.orderTotal}>
                        ${formatPrice(order.total)}
                      </span>
                    </div>
                  </div>

                  <div className={styles.orderActions}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <HiOutlineEye /> Ver Detalle
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleDeleteOrder(order.id)}
                      style={{ color: "var(--color-danger)" }}
                      title="Eliminar pedido"
                    >
                      <HiOutlineXMark /> Borrar
                    </button>
                    <select
                      className={styles.statusSelect}
                      value={order.status}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      disabled={updatingStatus}
                    >
                      {Object.entries(STATUS_MAP).map(([key, val]) => (
                        <option key={key} value={key}>
                          {val.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className={styles.modalOverlay} onClick={() => setSelectedOrder(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                Pedido {selectedOrder.orderNumber ? `#${String(selectedOrder.orderNumber).padStart(4, "0")}` : `#${selectedOrder.id.substring(0, 8).toUpperCase()}`}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelectedOrder(null)}>
                <HiOutlineXMark />
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Status + Payment */}
              <div className={styles.modalStatusRow}>
                <div>
                  <label className="admin-form-label">Estado del Pedido</label>
                  <select
                    className="admin-form-select"
                    value={selectedOrder.status}
                    onChange={(e) => handleStatusChange(selectedOrder.id, e.target.value)}
                    style={{ width: "auto" }}
                  >
                    {Object.entries(STATUS_MAP).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="admin-form-label">Estado del Pago</label>
                  <select
                    className="admin-form-select"
                    value={selectedOrder.paymentStatus || "pending"}
                    onChange={(e) => handlePaymentStatusChange(selectedOrder.id, e.target.value)}
                    style={{ width: "auto" }}
                  >
                    {Object.entries(PAYMENT_STATUS_MAP).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Customer */}
              <div className={styles.modalSection}>
                <h4 className={styles.modalSectionTitle}>Cliente</h4>
                <div className={styles.infoGrid}>
                  <div><strong>Nombre:</strong> {selectedOrder.customer?.name}</div>
                  <div><strong>Email:</strong> {selectedOrder.customer?.email}</div>
                  <div><strong>Teléfono:</strong> {selectedOrder.customer?.phone}</div>
                  <div><strong>Dirección:</strong> {selectedOrder.customer?.address}</div>
                  <div><strong>Ciudad:</strong> {selectedOrder.customer?.city}</div>
                  <div><strong>Estado:</strong> {selectedOrder.customer?.state}</div>
                </div>
                {selectedOrder.notes && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <strong>Notas:</strong> <span style={{ color: "var(--admin-text-muted)" }}>{selectedOrder.notes}</span>
                  </div>
                )}
              </div>

              {/* Invoice Data */}
              {selectedOrder.invoice?.wantsInvoice && (
                <div className={styles.modalSection}>
                  <h4 className={styles.modalSectionTitle}>Información Fiscal</h4>
                  <div className={styles.infoGrid}>
                    <div><strong>Razón Social:</strong> {selectedOrder.invoice.businessName || "—"}</div>
                    <div><strong>NIT:</strong> {selectedOrder.invoice.taxId || "—"}</div>
                    <div><strong>NRC:</strong> {selectedOrder.invoice.nrc || "—"}</div>
                    <div><strong>Giro:</strong> {selectedOrder.invoice.businessType || "—"}</div>
                  </div>
                </div>
              )}

              {/* Products */}
              <div className={styles.modalSection}>
                <h4 className={styles.modalSectionTitle}>Productos</h4>
                <div className={styles.modalProducts}>
                  {(selectedOrder.items || []).map((item, i) => (
                    <div key={i} className={styles.modalProduct}>
                      {item.image && (
                        <img src={item.image} alt={item.name} className={styles.modalProductImg} />
                      )}
                      <div style={{ flex: 1 }}>
                        <strong>{item.name}</strong>
                        <span style={{ display: "block", fontSize: "0.8125rem", color: "var(--admin-text-muted)" }}>
                          x{item.quantity} • ${formatPrice(item.price)}
                        </span>
                      </div>
                      <span style={{ fontWeight: 700 }}>
                        ${formatPrice(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className={styles.modalTotals}>
                <div className={styles.modalTotalRow}>
                  <span>Subtotal</span>
                  <span>${formatPrice(selectedOrder.subtotal)}</span>
                </div>
                <div className={styles.modalTotalRow}>
                  <span>Envío</span>
                  <span>{selectedOrder.shipping === 0 ? "Gratis" : `$${formatPrice(selectedOrder.shipping)}`}</span>
                </div>
                <div className={styles.modalTotalFinal}>
                  <span>Total</span>
                  <span>${formatPrice(selectedOrder.total)}</span>
                </div>
              </div>

              <div className={styles.paymentMethodNote}>
                <HiOutlineBanknotes />
                <span>Método: Pago contra entrega</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
