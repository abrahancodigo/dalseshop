"use client";

import { useState, useEffect } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminLayout } from "../layout";
import { getProducts, deleteProduct, getCategories, getReviews } from "@/lib/firestore";
import Link from "next/link";
import {
  HiOutlineShoppingBag,
  HiOutlinePlusCircle,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineMagnifyingGlass,
  HiOutlinePhoto,
  HiOutlineFunnel,
} from "react-icons/hi2";
import adminStyles from "../admin.module.css";
import styles from "./productos.module.css";

export default function ProductosPage() {
  const { toggleSidebar } = useAdminLayout();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [ratings, setRatings] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [prods, cats] = await Promise.all([getProducts(), getCategories()]);
      console.log("Admin productos loaded:", prods.length, "products");
       setProducts(prods);
       setCategories(cats);
       await loadRatings(prods);
    } catch (err) {
      console.error("Error loading:", err);
    } finally {
      setLoading(false);
    }
};

   const loadRatings = async (prods) => {
      const map = {};
      await Promise.all(
         prods.map(async (p) => {
            const revs = await getReviews(p.id);
            const approved = revs.filter(r => r.isApproved);
            if (approved.length) {
               const avg = approved.reduce((s, r) => s + (r.rating || 5), 0) / approved.length;
               map[p.id] = avg;
            }
         })
      );
      setRatings(map);
   };

   const handleDelete = async (id) => {
    try {
      await deleteProduct(id);
      setDeleteConfirm(null);
      loadData();
    } catch (err) {
      console.error("Error deleting:", err);
    }
  };

  const filtered = products.filter((p) => {
    const matchesSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase());
    const matchesCat = !filterCategory || p.category === filterCategory;
    return matchesSearch && matchesCat;
  });

  const getCategoryName = (catId) => {
    const cat = categories.find((c) => c.id === catId);
    return cat?.name || "";
  };

  return (
    <>
      <AdminHeader
        title="Productos"
        subtitle={`${products.length} producto${products.length !== 1 ? "s" : ""}`}
        onMenuToggle={toggleSidebar}
      />

      <div className={adminStyles.pageContent}>
        {/* Action bar */}
        <div className={styles.actionBar}>
          <div className={styles.filters}>
            <div className={styles.searchBox}>
              <HiOutlineMagnifyingGlass className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Buscar producto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            {categories.length > 0 && (
              <select
                className="admin-form-select"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                style={{ width: "auto", minWidth: 160 }}
              >
                <option value="">Todas las categorías</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <Link href="/admin/productos/nuevo" className="btn btn-primary">
            <HiOutlinePlusCircle />
            Nuevo Producto
          </Link>
        </div>

        {loading ? (
          <div className="loading-screen" style={{ minHeight: 300 }}>
            <div className="spinner" />
          </div>
        ) : products.length === 0 ? (
          <div className={adminStyles.emptyState}>
            <div className={adminStyles.emptyIcon}>
              <HiOutlineShoppingBag />
            </div>
            <h3 className={adminStyles.emptyTitle}>Sin productos</h3>
            <p className={adminStyles.emptyText}>
              Comienza agregando tu primer producto al catálogo.
            </p>
            <Link href="/admin/productos/nuevo" className="btn btn-primary">
              <HiOutlinePlusCircle />
              Agregar Primer Producto
            </Link>
          </div>
        ) : (
          <>
            {filtered.length === 0 ? (
              <div className={adminStyles.emptyState}>
                <div className={adminStyles.emptyIcon}>
                  <HiOutlineMagnifyingGlass />
                </div>
                <h3 className={adminStyles.emptyTitle}>Sin resultados</h3>
                <p className={adminStyles.emptyText}>
                  No se encontraron productos con los filtros aplicados.
                </p>
              </div>
            ) : (
              <div className={styles.table}>
                <div className={styles.tableHeader}>
                  <span className={styles.colImage}>Imagen</span>
                  <span className={styles.colName}>Producto</span>
                  <span className={styles.colCategory}>Categoría</span>
                  <span className={styles.colPrice}>Precio</span>
                  <span className={styles.colStock}>Stock</span>
                  <span className={styles.colRating}>Rating</span>
                      <span className={styles.colStatus}>Estado</span>
                  <span className={styles.colActions}>Acciones</span>
                </div>
                {filtered.map((product) => (
                  <div key={product.id} className={styles.tableRow}>
                    <div className={styles.colImage}>
                      {product.images?.[0] ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className={styles.productThumb}
                        />
                      ) : (
                        <div className={styles.productThumbPlaceholder}>
                          <HiOutlinePhoto />
                        </div>
                      )}
                    </div>
                    <div className={styles.colName}>
                      <span className={styles.productName}>{product.name}</span>
                      <span className={styles.productSlug}>/{product.slug}</span>
                    </div>
                    <div className={styles.colCategory}>
                      {getCategoryName(product.category) || "—"}
                    </div>
                    <div className={styles.colPrice}>
                      <span className={styles.price}>
                        ${product.price?.toLocaleString() || "0"}
                      </span>
                      {product.comparePrice > 0 && (
                        <span className={styles.comparePrice}>
                          ${product.comparePrice?.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className={styles.colStock}>
                      {product.stock ?? "∞"}
</div>
                     <div className={styles.colRating}>
                       {ratings[product.id] ? ratings[product.id].toFixed(1) : "–"}
                     </div>
                     <div className={styles.colStatus}>
                      <span
                        className={`badge ${
                          product.isActive ? "badge-success" : "badge-danger"
                        }`}
                      >
                        {product.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <div className={styles.colActions}>
                      <Link
                        href={`/admin/productos/${product.id}`}
                        className="btn btn-ghost btn-sm"
                      >
                        <HiOutlinePencilSquare />
                      </Link>
                      {deleteConfirm === product.id ? (
                        <div className={styles.deleteConfirm}>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(product.id)}
                          >
                            Sí
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setDeleteConfirm(null)}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setDeleteConfirm(product.id)}
                          style={{ color: "var(--color-danger)" }}
                        >
                          <HiOutlineTrash />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
