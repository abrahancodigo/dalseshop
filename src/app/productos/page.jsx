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
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>Nuestros Productos</h1>
            <p className={styles.pageSubtitle}>
              Explora nuestra colección de productos
            </p>
          </div>

          <div className={`glass-panel ${styles.topBar}`}>
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

            <div className={styles.topBarRight}>
              <select
                className={styles.sortSelect}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="relevance">Más relevantes</option>
                <option value="price-asc">Precio: menor a mayor</option>
                <option value="price-desc">Precio: mayor a menor</option>
                <option value="name">Nombre A-Z</option>
                <option value="newest">Novedades</option>
              </select>

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
            <aside className={styles.sidebar}>
              <div className={styles.sidebarHeader}>
                <span className={styles.sidebarTitle}>Filtros</span>
              </div>

              <div className={styles.sidebarContent}>
                {brands && brands.length > 0 && (
                  <div className={styles.filterBlock}>
                    <span className={styles.filterBlockTitle}>Marca</span>
                    <div className={styles.checkboxGroup}>
                      {brands.map((brand) => (
                        <label key={brand.id} className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={selectedBrands.includes(brand.id)}
                            onChange={() => toggleBrand(brand.id)}
                            className={styles.checkboxInput}
                          />
                          <span className={styles.checkboxBox}>
                            <svg viewBox="0 0 12 12" className={styles.checkIcon}>
                              <path d="M1 6l3 3 7-7" />
                            </svg>
                          </span>
                          <span className={styles.checkboxText}>{brand.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className={styles.filterBlock}>
                  <span className={styles.filterBlockTitle}>Categoría</span>
                  <div className={styles.checkboxGroup}>
                    {categories.length === 0 ? (
                      <span className={styles.filterEmpty}>Sin categorías</span>
                    ) : (
                      categories.map((cat) => (
                        <label key={cat.id} className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(cat.id)}
                            onChange={() => toggleCategory(cat.id)}
                            className={styles.checkboxInput}
                          />
                          <span className={styles.checkboxBox}>
                            <svg viewBox="0 0 12 12" className={styles.checkIcon}>
                              <path d="M1 6l3 3 7-7" />
                            </svg>
                          </span>
                          <span className={styles.checkboxText}>{cat.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {showPrices && (
                <div className={styles.filterBlock}>
                  <span className={styles.filterBlockTitle}>Precio</span>
                  <div className={styles.priceSlider}>
                    <input
                      type="range"
                      min={0}
                      max={maxPrice}
                      step={1}
                      value={priceMin}
                      onChange={(e) =>
                        setPriceMin(Math.min(Number(e.target.value), priceMax - 1))
                      }
                      className={styles.rangeInput}
                      style={{ zIndex: priceMin > maxPrice / 2 ? 5 : 3 }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={maxPrice}
                      step={1}
                      value={priceMax}
                      onChange={(e) =>
                        setPriceMax(Math.max(Number(e.target.value), priceMin + 1))
                      }
                      className={styles.rangeInput}
                      style={{ zIndex: priceMax > maxPrice / 2 ? 3 : 5 }}
                    />
                    <div className={styles.sliderTrack}>
                      <div
                        className={styles.sliderRange}
                        style={{
                          left: `${(priceMin / maxPrice) * 100}%`,
                          width: `${((priceMax - priceMin) / maxPrice) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className={styles.priceValues}>
                    <span>${formatPrice(priceMin)}</span>
                    <span>${formatPrice(priceMax)}</span>
                  </div>
                </div>
                )}

                {activeFilterCount > 0 && (
                  <button
                    className={styles.sidebarClearBtn}
                    onClick={clearFilters}
                  >
                    <HiOutlineXMark size={16} /> Limpiar todos los filtros
                  </button>
                )}
              </div>
            </aside>

            <div className={styles.gridWrapper}>
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
        </div>
      </main>

      <StoreFooter />
    </div>
  );
}