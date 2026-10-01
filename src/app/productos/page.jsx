"use client";

import { useEffect, useState, useMemo } from "react";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import ProductCard from "@/components/store/ProductCard";
import { getProducts } from "@/lib/firestore";
import StoreImage from "@/components/store/StoreImage";
import { readCatalogSession, saveCatalogSession } from "@/lib/catalogSession.mjs";
import { storefrontCacheScope } from "@/lib/storefrontEnvironment.mjs";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { formatPrice } from "@/lib/format";
import { HiOutlineMagnifyingGlass, HiOutlineXMark } from "react-icons/hi2";
import { useSearchParams } from "react-router-dom";
import styles from "./productos.module.css";

const INITIAL_COUNT = 24;
const LOAD_MORE_COUNT = 20;

export default function ProductosPage() {
  const { brands, categories: allCategories, features } = useStore();
  const showPrices = features.showPrices !== false;
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState(() => readCatalogSession(storefrontCacheScope) || []);
  const [loading, setLoading] = useState(() => !readCatalogSession(storefrontCacheScope));
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const search = searchParams.get("q") || "";
  const selectedCategories = searchParams.getAll("categoria");
  const selectedBrands = searchParams.getAll("marca");
  const priceMin = Math.max(0, Number(searchParams.get("min")) || 0);
  const priceMax = Math.max(0, Number(searchParams.get("max")) || 0);
  const sortBy = searchParams.get("orden") || "relevance";
  const displayedCount = Math.min(10000, Math.max(INITIAL_COUNT, Number(searchParams.get("cantidad")) || INITIAL_COUNT));
  const { addItem } = useCart();
  const categories = useMemo(() => allCategories.filter(c => c.isActive), [allCategories]);
  const updateFilters = (values, resetCount = true) => {
    const params = new URLSearchParams(searchParams);
    if (resetCount) params.delete("cantidad");
    for (const [name, value] of Object.entries(values)) {
      params.delete(name);
      for (const entry of Array.isArray(value) ? value : [value]) if (entry) params.append(name, String(entry));
    }
    setSearchParams(params, { replace: true });
  };
  const setSearch = (value) => updateFilters({ q: value });
  const setSortBy = (value) => updateFilters({ orden: value === "relevance" ? null : value });

  useEffect(() => {
    let cancelled = false;
    setError(false);
    getProducts({ isActive: true }).then((prods) => {
      if (cancelled) return;
      saveCatalogSession(storefrontCacheScope, prods);
      setProducts(prods);
    }).catch((err) => { if (!cancelled) { setError(true); console.error("Error loading products:", err); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retry]);

  const maxPrice = useMemo(() => Math.max(500, ...products.map((product) => Number(product.price) || 0)), [products]);

  const filtered = useMemo(() => {
    let result = products.filter((p) => {
      const matchesSearch =
        !search || p.name?.toLowerCase().includes(search.toLowerCase());
      const matchesCat =
        selectedCategories.length === 0 ||
        selectedCategories.includes(p.category);
      const matchesBrand =
        selectedBrands.length === 0 || selectedBrands.includes(p.brand);
      const matchesPrice =
        p.price >= priceMin && (priceMax === 0 || p.price <= priceMax);
      return matchesSearch && matchesCat && matchesBrand && matchesPrice;
    });

    if (sortBy === "price-asc") result.sort((a, b) => a.price - b.price);
    else if (sortBy === "price-desc") result.sort((a, b) => b.price - a.price);
    else if (sortBy === "name")
      result.sort((a, b) => a.name?.localeCompare(b.name));
    else if (sortBy === "newest")
      result.sort(
        (a, b) =>
          (b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0) - (a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0)
      );
    return result;
  }, [products, search, selectedCategories, selectedBrands, priceMin, priceMax, sortBy]);

  const activeFilterCount =
    selectedCategories.length +
    selectedBrands.length +
    (priceMin > 0 ? 1 : 0) +
    (priceMax > 0 && priceMax < maxPrice ? 1 : 0);

  const clearFilters = () => updateFilters({ categoria: null, marca: null, min: null, max: null, q: null, orden: null });

  const priceRangeValue = useMemo(() => {
    if (priceMin === 0 && (priceMax === 0 || priceMax === maxPrice)) return "";
    if (priceMin === 0 && priceMax === 50) return "0-50";
    if (priceMin === 50 && priceMax === 100) return "50-100";
    if (priceMin === 100 && priceMax === 200) return "100-200";
    if (priceMin === 200 && priceMax === maxPrice) return `200-${maxPrice}`;
    return "";
  }, [priceMin, priceMax, maxPrice]);

  const handlePriceChange = (value) => {
    const [min, max] = value ? value.split("-").map(Number) : [0, 0];
    updateFilters({ min, max });
  };
  const handleBrandChange = (value) => updateFilters({ marca: value });
  const handleCategoryChange = (value) => updateFilters({ categoria: value });
  const loadMore = () => updateFilters({ cantidad: displayedCount + LOAD_MORE_COUNT }, false);

  const displayedProducts = filtered.slice(0, displayedCount);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <StoreHeader />

      <main className={styles.main}>
        {error && <div className="container" role="status"><p>No pudimos actualizar los productos.</p><button className="btn btn-outline" onClick={() => setRetry((value) => value + 1)}>Volver a intentar</button></div>}
        {/* Brand banner — full width, outside container */}
        {selectedBrands.length === 1 && (() => {
          const brand = brands.find(b => b.id === selectedBrands[0]);
          if (!brand || !brand.bannerImage) return null;
          return (
            <div className={styles.brandBanner}>
              <StoreImage src={brand.bannerImage} sizes="100vw" alt="" className={styles.brandBannerBlur} aria-hidden="true" />
              <StoreImage src={brand.bannerImage} sizes="100vw" loading="eager" alt={brand.name} className={styles.brandBannerBg} />
            </div>
          );
        })()}

          <div className="container">

          <div className={styles.topBar}>
            <div className={styles.searchBox}>
              <HiOutlineMagnifyingGlass className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Buscar..."
                aria-label="Buscar en el catálogo"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            <div className={styles.filtersRow}>
              {brands && brands.length > 0 && (
                <select
                  className={styles.filterSelect}
                  aria-label="Marca"
                  value={selectedBrands.length === 1 ? selectedBrands[0] : ""}
                  onChange={(e) => handleBrandChange(e.target.value)}
                >
                  <option value="">Marcas</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}

              <select
                className={styles.filterSelect}
                aria-label="Categoría"
                value={selectedCategories.length === 1 ? selectedCategories[0] : ""}
                onChange={(e) => handleCategoryChange(e.target.value)}
              >
                <option value="">Categorías</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {showPrices && (
                <select
                  className={styles.filterSelect}
                  value={priceRangeValue}
                  onChange={(e) => handlePriceChange(e.target.value)}
                >
                  <option value="">Precios</option>
                  <option value="0-50">$0 - $50</option>
                  <option value="50-100">$50 - $100</option>
                  <option value="100-200">$100 - $200</option>
                  <option value={`200-${maxPrice}`}>$200+</option>
                </select>
              )}

              <select
                className={styles.filterSelect}
                aria-label="Ordenar productos"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="relevance">Más relevantes</option>
                <option value="price-asc">Menor precio</option>
                <option value="price-desc">Mayor precio</option>
                <option value="name">A-Z</option>
                <option value="newest">Novedades</option>
              </select>
            </div>

            <div className={styles.topBarRight}>
              <span className={styles.resultCount}>
                {filtered.length} producto{filtered.length !== 1 ? "s" : ""}
              </span>

              {activeFilterCount > 0 && (
                <button className={styles.clearAllBtn} onClick={clearFilters}>
                  <HiOutlineXMark size={14} /> Limpiar
                </button>
              )}
            </div>
          </div>

          <div className={styles.layout}>
              {loading ? (
                <div className="loading-screen" style={{ minHeight: 300 }}>
                  <div className="spinner" />
                </div>
              ) : filtered.length === 0 ? (
                <div className={styles.emptyState}>
                  <p className={styles.emptyTitle}>No se encontraron productos</p>
                  <p className={styles.emptyDesc}>
                    Intenta ajustar los filtros o realizar una búsqueda diferente
                  </p>
                  <button className={styles.clearAllBtn} onClick={clearFilters}>
                    Limpiar filtros
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.grid}>
                    {displayedProducts.map((product, i) => (
                      <div
                        key={product.id}
                        className={styles.gridItem}
                        style={{
                          animationDelay: `${(i % LOAD_MORE_COUNT) * 0.03}s`,
                        }}
                      >
                        <ProductCard
                          product={product}
                          onAddToCart={(p) => addItem(p)}
                        />
                      </div>
                    ))}
                  </div>

                  {displayedCount < filtered.length && (
                    <div className={styles.loadMoreWrapper}>
                      <button className={styles.loadMoreBtn} onClick={loadMore}>
                        Cargar más productos
                      </button>
                      <span className={styles.loadMoreInfo}>
                        Mostrando {displayedCount} de {filtered.length} productos
                      </span>
                    </div>
                  )}
                </>
              )}
          </div>
        </div>
      </main>

      <StoreFooter />
    </div>
  );
}