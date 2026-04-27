"use client";

import { useState, useEffect } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminLayout } from "../layout";
import { getOrders } from "@/lib/firestore";
import { HiOutlineUsers, HiOutlineMagnifyingGlass, HiOutlineEnvelope, HiOutlinePhone, HiOutlineMapPin } from "react-icons/hi2";
import adminStyles from "../admin.module.css";
import styles from "./clientes.module.css";

export default function ClientesPage() {
  const { toggleSidebar } = useAdminLayout();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = async () => {
    try {
      const orders = await getOrders();
      const customerMap = {};
      orders.forEach((order) => {
        const email = order.customer?.email;
        if (!email) return;
        if (!customerMap[email]) {
          customerMap[email] = {
            ...order.customer,
            totalOrders: 0,
            totalSpent: 0,
            lastOrder: order.createdAt,
            orders: [],
          };
        }
        customerMap[email].totalOrders++;
        customerMap[email].totalSpent += order.total || 0;
        customerMap[email].orders.push(order);
      });
      setCustomers(Object.values(customerMap).sort((a, b) => b.totalSpent - a.totalSpent));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const filtered = customers.filter((c) =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <>
      <AdminHeader title="Clientes" subtitle={`${customers.length} cliente${customers.length !== 1 ? "s" : ""}`} onMenuToggle={toggleSidebar} />
      <div className={adminStyles.pageContent}>
        <div className={styles.searchBar}>
          <HiOutlineMagnifyingGlass className={styles.searchIcon} />
          <input className={styles.searchInput} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o email..." />
        </div>

        {loading ? (
          <div className="loading-screen" style={{ minHeight: 300 }}><div className="spinner" /></div>
        ) : customers.length === 0 ? (
          <div className={adminStyles.emptyState}>
            <div className={adminStyles.emptyIcon}><HiOutlineUsers /></div>
            <h3 className={adminStyles.emptyTitle}>Sin clientes aún</h3>
            <p className={adminStyles.emptyText}>Los clientes aparecerán automáticamente cuando realicen pedidos.</p>
          </div>
        ) : (
          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span style={{ flex: 2 }}>Cliente</span>
              <span style={{ flex: 1 }}>Pedidos</span>
              <span style={{ flex: 1 }}>Total Gastado</span>
              <span style={{ flex: 1 }}>Último Pedido</span>
            </div>
            {filtered.map((customer, i) => (
              <div key={i} className={styles.tableRow} onClick={() => setSelectedCustomer(customer)}>
                <div style={{ flex: 2 }}>
                  <span className={styles.customerName}>{customer.name}</span>
                  <span className={styles.customerEmail}>{customer.email}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <span className={styles.orderCount}>{customer.totalOrders}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <span className={styles.totalSpent}>${customer.totalSpent?.toLocaleString()}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <span className={styles.lastDate}>{formatDate(customer.lastOrder)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedCustomer && (
        <div className={styles.modalOverlay} onClick={() => setSelectedCustomer(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{selectedCustomer.name}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelectedCustomer(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.contactInfo}>
                {selectedCustomer.email && <div className={styles.infoRow}><HiOutlineEnvelope /> {selectedCustomer.email}</div>}
                {selectedCustomer.phone && <div className={styles.infoRow}><HiOutlinePhone /> {selectedCustomer.phone}</div>}
                {selectedCustomer.address && <div className={styles.infoRow}><HiOutlineMapPin /> {selectedCustomer.address}{selectedCustomer.city ? `, ${selectedCustomer.city}` : ""}</div>}
              </div>
              <div className={styles.statsRow}>
                <div className={styles.statBox}><span className={styles.statVal}>{selectedCustomer.totalOrders}</span><span className={styles.statLbl}>Pedidos</span></div>
                <div className={styles.statBox}><span className={styles.statVal}>${selectedCustomer.totalSpent?.toLocaleString()}</span><span className={styles.statLbl}>Total Gastado</span></div>
              </div>
              <h4 style={{ color: "var(--admin-accent)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>Historial de Pedidos</h4>
              {selectedCustomer.orders.map((o) => (
                <div key={o.id} className={styles.orderRow}>
                  <span style={{ fontFamily: "monospace", fontWeight: 700 }}>#{o.id.substring(0, 8).toUpperCase()}</span>
                  <span style={{ color: "var(--admin-text-muted)", fontSize: "0.75rem" }}>{formatDate(o.createdAt)}</span>
                  <span style={{ fontWeight: 700, color: "var(--color-success)" }}>${o.total?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
