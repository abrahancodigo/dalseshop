"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import ProductCard from "@/components/store/ProductCard";
import { getProducts } from "@/lib/firestore";
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
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState(
    () => {
      const catParam = searchParams.get("categoria");
      return catParam ? [catParam] : [];
    }
  );
  const [selectedBrands, setSelectedBrands] = useState(
    () => {
      const brandParam = searchParams.get("marca");
      return brandParam ? [brandParam] : [];
    }
  );
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(500);
  const [sortBy, setSortBy] = useState("relevance");
  const [displayedCount, setDisplayedCount] = useState(INITIAL_COUNT);
  const { addItem } = useCart();
  const prevMarcaRef = useRef(searchParams.get("marca"));

  // Use categories from StoreContext (already loaded globally), no need for a separate listener
  const categories = useMemo(() => allCategories.filter(c => c.isActive), [allCategories]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prods = await getProducts({ isActive: true });
        if (!cancelled) setProducts(prods);
      } catch (err) {
        console.error("Error loading products:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (selectedCategories.length === 1) {
      params.set("categoria", selectedCategories[0]);
    } else {
      params.delete("categoria");
    }
    setSearchParams(params, { replace: true });
  }, [selectedCategories]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (selectedBrands.length === 1) {
      params.set("marca", selectedBrands[0]);
    } else {
      params.delete("marca");
    }
    setSearchParams(params, { replace: true });
  }, [selectedBrands]);

  // Sync URL → state when marca param changes externally (e.g. brand logo click)
  useEffect(() => {
    const brandParam = searchParams.get("marca");
    if (brandParam !== prevMarcaRef.current) {
      prevMarcaRef.current = brandParam;
      setSelectedBrands(brandParam ? [brandParam] : []);
    }
  }, [searchParams]);

  const maxPrice = useMemo(() => {
    if (products.length === 0) return 500;
    const max = Math.max(...products.map((p) => p.price));
    return max || 500;
  }, [products]);

  useEffect(() => {
    if (priceMax === 0 || priceMax > maxPrice) {
      setPriceMax(maxPrice);
    }
  }, [maxPrice, priceMax]);

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
          (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
      );
    return result;
  }, [products, search, selectedCategories, selectedBrands, priceMin, priceMax, sortBy]);

  const activeFilterCount =
    selectedCategories.length +
    selectedBrands.length +
    (priceMin > 0 ? 1 : 0) +
    (priceMax < maxPrice ? 1 : 0);

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedBrands([]);
    setPriceMin(0);
    setPriceMax(maxPrice);
    setSearch("");
    setSortBy("relevance");
    setDisplayedCount(INITIAL_COUNT);
  };

  const toggleCategory = (id) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleBrand = (id) => {
    setSelectedBrands((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  };

  const priceRangeValue = useMemo(() => {
    if (priceMin === 0 && priceMax === maxPrice) return "";
    if (priceMin === 0 && priceMax === 50) return "0-50";
    if (priceMin === 50 && priceMax === 100) return "50-100";
    if (priceMin === 100 && priceMax === 200) return "100-200";
    if (priceMin === 200 && priceMax === maxPrice) return `200-${maxPrice}`;
    return "";
  }, [priceMin, priceMax, maxPrice]);

  const handlePriceChange = (val) => {
    if (!val) {
      setPriceMin(0);
      setPriceMax(maxPrice);
    } else {
      const [min, max] = val.split("-").map(Number);
      setPriceMin(min);
      setPriceMax(max || maxPrice);
    }
  };

  const handleBrandChange = (val) => {
    setSelectedBrands(val ? [val] : []);
  };

  const handleCategoryChange = (val) => {
    setSelectedCategories(val ? [val] : []);
  };

  const loadMore = () => {
    setDisplayedCount((prev) => prev + LOAD_MORE_COUNT);
  };

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
        {/* Brand banner — full width, outside container */}
        {selectedBrands.length === 1 && (() => {
          const brand = brands.find(b => b.id === selectedBrands[0]);
          if (!brand || !brand.bannerImage) return null;
          return (
            <div className={styles.brandBanner}>
              <img src={brand.bannerImage} alt="" className={styles.brandBannerBlur} aria-hidden="true" />
              <img src={brand.bannerImage} alt={brand.name} className={styles.brandBannerBg} />
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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            <div className={styles.filtersRow}>
              {brands && brands.length > 0 && (
                <select
                  className={styles.filterSelect}
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