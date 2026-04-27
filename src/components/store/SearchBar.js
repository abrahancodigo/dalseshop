"use client";

import { useState, useEffect, useRef } from "react";
import { HiOutlineMagnifyingGlass, HiOutlineXMark } from "react-icons/hi2";
import { searchProducts } from "@/lib/firestore";
import Link from "next/link";
import styles from "./SearchBar.module.css";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef(null);

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
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setLoading(true);
      const data = await searchProducts(query);
      setResults(data);
      setLoading(false);
      setIsOpen(data.length > 0);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return (
    <div className={styles.searchWrapper} ref={searchRef}>
      <div className={styles.searchBar}>
        <HiOutlineMagnifyingGlass className={styles.searchIcon} />
        <input
          type="text"
          placeholder="Buscar productos, marcas, códigos..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && results.length > 0 && setIsOpen(true)}
          className={styles.searchInput}
        />
        {query && (
          <button className={styles.clearBtn} onClick={() => setQuery("")}>
            <HiOutlineXMark />
          </button>
        )}
      </div>

      {isOpen && (
        <div className={styles.resultsDropdown}>
          {loading ? (
            <div className={styles.statusMsg}>Buscando...</div>
          ) : (
            <>
              {results.map((product) => (
                <Link
                  key={product.id}
                  href={`/productos/${product.slug}`}
                  className={styles.resultItem}
                  onClick={() => {
                    setIsOpen(false);
                    setQuery("");
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
                      <span className={styles.itemPrice}>${(product.price || 0).toLocaleString()}</span>
                      {product.barcode && <span className={styles.itemBrand}>{product.barcode}</span>}
                    </div>
                  </div>
                </Link>
              ))}
              <Link 
                href={`/productos?search=${query}`} 
                className={styles.viewAll}
                onClick={() => {
                  setIsOpen(false);
                  setQuery("");
                }}
              >
                Ver todos los resultados
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
