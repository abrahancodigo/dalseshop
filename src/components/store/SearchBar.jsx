"use client";

import { useState, useEffect, useRef } from "react";
import { HiOutlineMagnifyingGlass, HiOutlineXMark } from "react-icons/hi2";
import { searchProducts } from "@/lib/supabase-queries";
import { formatPrice } from "@/lib/format";
import { Link } from "react-router-dom";
import { useStore } from "@/context/StoreContext";
import styles from "./SearchBar.module.css";

export default function SearchBar({ onResultClick, autoFocus = false }) {
  const { features } = useStore();
  const showPrices = features.showPrices !== false;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-focus the input when the component mounts (useful for modal)
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 150);
    }
  }, [autoFocus]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      setHasSearched(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      setIsOpen(true);
      const data = await searchProducts(query);
      setResults(data);
      setLoading(false);
      setHasSearched(true);
      setIsOpen(true);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setHasSearched(false);
    inputRef.current?.focus();
  };

  return (
    <div className={styles.searchWrapper} ref={searchRef}>
      <p className={styles.searchTitle}>¿Qué estás buscando?</p>

      <div className={styles.searchBar}>
        <HiOutlineMagnifyingGlass className={styles.searchIcon} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar productos, marcas, códigos..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && (results.length > 0 || hasSearched) && setIsOpen(true)}
          className={styles.searchInput}
          autoComplete="off"
        />
        {query ? (
          <button className={styles.clearBtn} onClick={handleClear} aria-label="Limpiar búsqueda">
            <HiOutlineXMark size={18} />
          </button>
        ) : (
          <div className={styles.shortcutHint}>
            <span className={styles.shortcutKey}>ESC</span>
            <span className={styles.shortcutKey}>cerrar</span>
          </div>
        )}
      </div>

      {isOpen && (
        <div className={styles.resultsDropdown}>
          {loading ? (
            <div className={styles.statusMsg}>
              <div className={styles.loadingSpinner}></div>
              <span>Buscando productos...</span>
            </div>
          ) : results.length > 0 ? (
            <>
              <div className={styles.resultsHeader}>
                {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
              </div>
              {results.map((product) => (
                <Link
                  key={product.id}
                  to={`/productos/${product.slug}`}
                  className={styles.resultItem}
                  onClick={() => {
                    setIsOpen(false);
                    setQuery("");
                    setHasSearched(false);
                    onResultClick?.();
                  }}
                >
                  <div className={styles.itemImage}>
                    <img 
                      src={product.images?.[0] || product.image || "/placeholder-product.png"} 
                      alt={product.name} 
                    />
                  </div>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{product.name}</span>
                  <div className={styles.itemMeta}>
                    {showPrices ? (
                      <span className={styles.itemPrice}>${formatPrice(product.price)}</span>
                    ) : (
                      <span className={styles.itemConsultPrice}>Consultar precio</span>
                    )}
                    {product.barcode && <span className={styles.itemBrand}>{product.barcode}</span>}
                  </div>
                  </div>
                </Link>
              ))}
              <Link 
                to={`/productos?search=${query}`} 
                className={styles.viewAll}
                onClick={() => {
                  setIsOpen(false);
                  setQuery("");
                  setHasSearched(false);
                  onResultClick?.();
                }}
              >
                Ver todos los resultados →
              </Link>
            </>
          ) : hasSearched ? (
            <div className={styles.noResults}>
              <span className={styles.noResultsIcon}>🔍</span>
              <span className={styles.noResultsTitle}>No encontramos resultados</span>
              <span className={styles.noResultsText}>
                Intenta con otras palabras o revisa la ortografía
              </span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
