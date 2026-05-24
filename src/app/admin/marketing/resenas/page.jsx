"use client";

import { useState, useEffect } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminLayout } from "../../layout";
import { useAuth } from "@/context/AuthContext";
import { getReviews, deleteReview, saveReview } from "@/lib/supabase-queries";
import { HiOutlineStar, HiOutlineTrash, HiOutlineCheckCircle, HiOutlineXCircle } from "react-icons/hi2";
import adminStyles from "../../admin.module.css";
import styles from "./resenas.module.css";

export default function ResenasPage() {
  const { toggleSidebar } = useAdminLayout();
  const { canManage } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => { loadReviews(); }, []);

  const loadReviews = async () => {
    try { setReviews(await getReviews()); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const toggleApprove = async (review) => {
    if (!canManage("reviews")) { alert("Usted no tiene los permisos para realizar esta accion"); return; }
    try {
      await saveReview(review.id, { isApproved: !review.isApproved });
      loadReviews();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if (!canManage("reviews")) { alert("Usted no tiene los permisos para realizar esta accion"); return; }
    try { await deleteReview(id); loadReviews(); }
    catch (err) { console.error(err); }
  };

  const filtered = filter === "all" ? reviews : filter === "approved" ? reviews.filter(r => r.isApproved) : reviews.filter(r => !r.isApproved);

  const formatDate = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  };

  return (
    <>
      <AdminHeader title="Reseñas" subtitle={`${reviews.length} reseña${reviews.length !== 1 ? "s" : ""}`} onMenuToggle={toggleSidebar} />
      <div className={adminStyles.pageContent}>
        <div className={styles.filterBar}>
          {["all", "approved", "pending"].map((f) => (
            <button key={f} className={`${styles.filterBtn} ${filter === f ? styles.active : ""}`} onClick={() => setFilter(f)}>
              {f === "all" ? `Todas (${reviews.length})` : f === "approved" ? `Aprobadas (${reviews.filter(r => r.isApproved).length})` : `Pendientes (${reviews.filter(r => !r.isApproved).length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-screen" style={{ minHeight: 300 }}><div className="spinner" /></div>
        ) : reviews.length === 0 ? (
          <div className={adminStyles.emptyState}>
            <div className={adminStyles.emptyIcon}><HiOutlineStar /></div>
            <h3 className={adminStyles.emptyTitle}>Sin reseñas</h3>
            <p className={adminStyles.emptyText}>Las reseñas aparecerán cuando los clientes las escriban.</p>
          </div>
        ) : (
          <div className={styles.list}>
            {filtered.map((review) => (
              <div key={review.id} className={`${styles.card} ${review.isApproved ? "" : styles.pending}`}>
                <div className={styles.cardTop}>
                  <div>
                    <strong className={styles.reviewerName}>{review.name}</strong>
                    <span className={styles.stars}>{"★".repeat(review.rating || 5)}{"☆".repeat(5 - (review.rating || 5))}</span>
                  </div>
                  <span className={styles.date}>{formatDate(review.createdAt)}</span>
                </div>
                <p className={styles.comment}>{review.comment}</p>
                <div className={styles.productName}>{review.productName || "Producto"}</div>
                <div className={styles.actions}>
                  <button className={`btn btn-sm ${review.isApproved ? "btn-ghost" : "btn-success"}`} onClick={() => toggleApprove(review)}>
                    {review.isApproved ? <><HiOutlineXCircle /> Desaprobar</> : <><HiOutlineCheckCircle /> Aprobar</>}
                  </button>
                  <button className="btn btn-ghost btn-sm" style={{ color: "var(--color-danger)" }} onClick={() => handleDelete(review.id)}><HiOutlineTrash /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
