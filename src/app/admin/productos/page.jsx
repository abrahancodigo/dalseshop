"use client";

import { useState, useEffect } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminLayout } from "../layout";
import { formatPrice } from "@/lib/format";
import { getProducts, deleteProduct, getCategories, getReviews } from "@/lib/firestore";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
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
  const { canManage } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [ratings, setRatings] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [pageSize, setPageSize] = useState(5);
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
      try {
        const allReviews = await getReviews();
        allReviews.forEach((r) => {
          if (!r.isApproved) return;
          if (!map[r.productId]) map[r.productId] = { sum: 0, count: 0 };
          map[r.productId].sum += r.rating || 5;
          map[r.productId].count++;
        });
        const ratings = {};
        Object.entries(map).forEach(([productId, { sum, count }]) => {
          ratings[productId] = sum / count;
        });
        setRatings(ratings);
      } catch (e) {
        console.error("Error loading ratings:", e);
      }
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

  const filteredBase = products.filter((p) => {
    const matchesSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase());
    const matchesCat = !filterCategory || p.category === filterCategory;
    return matchesSearch && matchesCat;
  });

  const filtered = search ? filteredBase : filteredBase.slice(0, pageSize);

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
            <select
              className="admin-form-select"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              style={{ width: "auto", minWidth: 80 }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={0}>Todos</option>
            </select>
            {!search && (
              <span style={{ fontSize: "0.8rem", color: "var(--admin-text-muted)", whiteSpace: "nowrap" }}>
                {filtered.length} de {filteredBase.length}
              </span>
            )}
            {search && (
              <span style={{ fontSize: "0.8rem", color: "var(--admin-text-muted)", whiteSpace: "nowrap" }}>
                {filtered.length} resultado(s)
              </span>
            )}
          </div>
          {canManage("products") ? (
            <Link to="/admin/productos/nuevo" className="btn btn-primary">
              <HiOutlinePlusCircle />
              Nuevo Producto
            </Link>
          ) : (
            <span className="btn btn-primary" style={{ opacity: 0.5, cursor: "not-allowed" }} title="No tienes permisos para crear productos">
              <HiOutlinePlusCircle />
              Nuevo Producto
            </span>
          )}
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
            {canManage("products") ? (
              <Link to="/admin/productos/nuevo" className="btn btn-primary">
                <HiOutlinePlusCircle />
                Agregar Primer Producto
              </Link>
            ) : (
              <span className="btn btn-primary" style={{ opacity: 0.5, cursor: "not-allowed" }}>
                <HiOutlinePlusCircle />
                Sin acceso para crear
              </span>
            )}
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
                        ${formatPrice(product.price)}
                      </span>
                      {product.comparePrice > 0 && (
                        <span className={styles.comparePrice}>
                          ${formatPrice(product.comparePrice)}
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
                        to={`/admin/productos/${product.id}`}
                        className="btn btn-ghost btn-sm"
                      >
                        <HiOutlinePencilSquare />
                      </Link>
                      {canManage("products") && deleteConfirm === product.id ? (
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
                      ) : canManage("products") ? (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setDeleteConfirm(product.id)}
                          style={{ color: "var(--color-danger)" }}
                        >
                          <HiOutlineTrash />
                        </button>
                      ) : (
                        <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>Solo lectura</span>
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
