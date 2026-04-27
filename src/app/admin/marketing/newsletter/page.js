"use client";

import { useState, useEffect } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminLayout } from "../../layout";
import { getSubscribers, deleteSubscriber } from "@/lib/firestore";
import { HiOutlineEnvelope, HiOutlineTrash, HiOutlineClipboard } from "react-icons/hi2";
import adminStyles from "../../admin.module.css";
import styles from "./newsletter.module.css";

export default function NewsletterAdminPage() {
  const { toggleSidebar } = useAdminLayout();
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try { setSubscribers(await getSubscribers()); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    try { await deleteSubscriber(id); loadData(); }
    catch (err) { console.error(err); }
  };

  const copyEmails = () => {
    const emails = subscribers.map((s) => s.email).join(", ");
    navigator.clipboard.writeText(emails);
    alert("Emails copiados al portapapeles");
  };

  const formatDate = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <>
      <AdminHeader title="Newsletter" subtitle={`${subscribers.length} suscriptor${subscribers.length !== 1 ? "es" : ""}`} onMenuToggle={toggleSidebar} />
      <div className={adminStyles.pageContent}>
        {subscribers.length > 0 && (
          <div className={styles.actionBar}>
            <button className="btn btn-primary btn-sm" onClick={copyEmails}><HiOutlineClipboard /> Copiar todos los emails</button>
          </div>
        )}

        {loading ? (
          <div className="loading-screen" style={{ minHeight: 300 }}><div className="spinner" /></div>
        ) : subscribers.length === 0 ? (
          <div className={adminStyles.emptyState}>
            <div className={adminStyles.emptyIcon}><HiOutlineEnvelope /></div>
            <h3 className={adminStyles.emptyTitle}>Sin suscriptores</h3>
            <p className={adminStyles.emptyText}>Los suscriptores aparecerán cuando se registren desde la tienda.</p>
          </div>
        ) : (
          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span style={{ flex: 2 }}>Email</span>
              <span style={{ flex: 1 }}>Fecha</span>
              <span style={{ flex: 0, width: 60 }}></span>
            </div>
            {subscribers.map((sub) => (
              <div key={sub.id} className={styles.tableRow}>
                <span style={{ flex: 2, color: "white", fontWeight: 500 }}>{sub.email}</span>
                <span style={{ flex: 1, color: "var(--admin-text-muted)", fontSize: "0.8125rem" }}>{formatDate(sub.createdAt)}</span>
                <button onClick={() => handleDelete(sub.id)} className={styles.deleteBtn}><HiOutlineTrash /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
