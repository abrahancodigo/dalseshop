"use client";

import { useEffect, useState } from "react";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import ProductCard from "@/components/store/ProductCard";
import { onProductsChange, onCategoriesChange } from "@/lib/firestore";
import { useCart } from "@/context/CartContext";
import { HiOutlineMagnifyingGlass, HiOutlineFunnel } from "react-icons/hi2";
import { useStore } from "@/context/StoreContext";
import styles from "./productos.module.css";

export default function ProductosPage() {
  const { brands } = useStore();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedPrice, setSelectedPrice] = useState("");
  const { addItem } = useCart();

  const PRICE_RANGES = [
    { id: "", label: "Cualquier precio" },
    { id: "0-25", label: "Menos de $25", min: 0, max: 25 },
    { id: "25-50", label: "$25 a $50", min: 25, max: 50 },
    { id: "50-100", label: "$50 a $100", min: 50, max: 100 },
    { id: "100-plus", label: "Más de $100", min: 100, max: Infinity }
  ];

  useEffect(() => {
    // Listen to active categories
    const unsubCats = onCategoriesChange((cats) => {
      setCategories(cats.filter(c => c.isActive));
    });

    // Listen to active products
    const unsubProds = onProductsChange({ isActive: true }, (prods) => {
      setProducts(prods);
      setLoading(false);
    });

    return () => {
      unsubCats();
      unsubProds();
    };
  }, []);

  const filtered = products.filter((p) => {
    const matchesSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase());
    const matchesCat = !selectedCategory || p.category === selectedCategory;
    const matchesBrand = !selectedBrand || p.brand === selectedBrand;
    let matchesPrice = true;
    if (selectedPrice) {
      const range = PRICE_RANGES.find(r => r.id === selectedPrice);
      if (range) {
        matchesPrice = p.price >= range.min && p.price < range.max;
      }
    }
    return matchesSearch && matchesCat && matchesBrand && matchesPrice;
  });

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <StoreHeader />

      <main className={styles.main}>
        <div className="container">
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>Nuestros Productos</h1>
            <p className={styles.pageSubtitle}>
              Explora nuestra colección de productos
            </p>
          </div>

          {/* Filters Bar */}
          <div className={`glass-panel ${styles.filterBar}`}>
            <div className={styles.searchBox}>
              <HiOutlineMagnifyingGlass className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Buscar productos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            <div className={styles.filtersWrapper}>
              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Categoría:</span>
                <select 
                  className={styles.filterSelect}
                  value={selectedCategory} 
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">Todas las categorías</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {brands && brands.length > 0 && (
                <div className={styles.filterGroup}>
                  <span className={styles.filterLabel}>Marca:</span>
                  <select 
                    className={styles.filterSelect}
                    value={selectedBrand} 
                    onChange={(e) => setSelectedBrand(e.target.value)}
                  >
                    <option value="">Todas las marcas</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>{brand.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Precio:</span>
                <select 
                  className={styles.filterSelect}
                  value={selectedPrice} 
                  onChange={(e) => setSelectedPrice(e.target.value)}
                >
                  {PRICE_RANGES.map((range) => (
                    <option key={range.id} value={range.id}>{range.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-screen" style={{ minHeight: 300 }}>
              <div className="spinner" />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--color-muted)" }}>
              <p style={{ fontSize: "1.125rem", fontWeight: 600 }}>No se encontraron productos</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {filtered.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={(p) => addItem(p)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <StoreFooter />
    </div>
  );
}
