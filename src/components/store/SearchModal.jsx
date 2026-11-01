"use client";

import {
  HiOutlineMagnifyingGlass,
  HiOutlineXMark,
  HiOutlineSparkles,
} from "react-icons/hi2";
import { useState, useEffect, useRef, useMemo } from "react";
import { useBackToClose } from "@/hooks/useBackToClose";
import { Link, useNavigate } from "react-router-dom";
import { searchProducts } from "@/lib/firestore";
import { formatPrice } from "@/lib/format";
import { useStore } from "@/context/StoreContext";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import styles from "./SearchModal.module.css";

const RECENT_KEY = "dalseshop:search-recents";
const RECENT_MAX = 8;

function getRecents() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveRecents(list) {
  try {
    const arr = [...new Set(list.filter(Boolean))].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(arr));
  } catch {}
}

export default function SearchModal({ onClose, autoFocus = false }) {
  useBackToClose(true, onClose);
  const { features } = useStore();
  const showPrices = features.showPrices !== false;
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recents, setRecents] = useState([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [dragY, setDragY] = useState(0);

  const inputRef = useRef(null);
  const cacheRef = useRef({ query: "", data: [] });
  const dragStartY = useRef(null);

  const isMobile = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches,
    []
  );

  // auto-focus + recents on mount
  useEffect(() => {
    setRecents(getRecents());
    if (autoFocus) {
      const id = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(id);
    }
  }, [autoFocus]);

  // ESC to close + body scroll lock + swipe-from-edge (hacia atrás) a close
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    let edgeTouch = null; // { x, y, id }

    const onTouchStart = (e) => {
      const t = e.touches[0];
      if (!t) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Solo consideramos swipes que empiezan cerca de un LADO (no de un punto al margen).
      // En el modal mobile (full-screen) el "swipe-to-back" iOS va de la derecha
      // al centro; el de AX (edge nav partido) también se puede hacer de la izquierda.
      if (
        (t.clientX < w * 0.12 && t.clientY > 0 && t.clientY < h) ||
        (t.clientX > w * 0.88 && t.clientY > 0 && t.clientY < h)
      ) {
        edgeTouch = { x: t.clientX, y: t.clientY, id: t.identifier, side: t.clientX < w / 2 ? "left" : "right" };
      }
    };

    const onTouchMove = (e) => {
      if (!edgeTouch) return;
      const t = Array.from(e.touches).find((tt) => tt.identifier === edgeTouch.id);
      if (!t) return;
      const moved = Math.abs(t.clientX - edgeTouch.x);
      const dy = Math.abs(t.clientY - edgeTouch.y);
      // Umbral de distancia horizontal + movimiento claramente horizontal
      const isHorizontal =
        edgeTouch.side === "right" && t.clientX < edgeTouch.x - 12 ||
        edgeTouch.side === "left" && t.clientX > edgeTouch.x + 12;
      if (isHorizontal && dy < moved * 1.4 && moved > 80) {
        edgeTouch = null;
        onClose();
      }
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    lockScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      unlockScroll();
    };
  }, [onClose]);

  // Debounced search
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      setActiveCategory("");
      cacheRef.current = { query: trimmed, data: [] };
      return;
    }

    if (cacheRef.current.query === trimmed && cacheRef.current.data.length > 0) {
      setResults(cacheRef.current.data);
      setHasSearched(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setActiveCategory("");
    const id = setTimeout(async () => {
      try {
        const data = await searchProducts(trimmed);
        cacheRef.current = { query: trimmed, data };
        setResults(data);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  const pickRecents = (next) => {
    setRecents(next);
    saveRecents(next);
  };

  const handlePick = (term) => {
    setQuery(term);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    setActiveCategory("");
    inputRef.current?.focus();
  };

  const handleRemoveRecent = (term) =>
    pickRecents(recents.filter((t) => t !== term));
  const clearRecents = () => pickRecents([]);

  const rememberQuery = () => {
    const t = query.trim();
    if (!t) return;
    pickRecents([t, ...recents.filter((r) => r !== t)]);
  };

  const categories = useMemo(() => {
    const map = new Map();
    for (const p of results) {
      const c = (p.category || "Otros").toString().trim() || "Otros";
      map.set(c, (map.get(c) || 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [results]);

  const filtered = useMemo(
    () =>
      activeCategory
        ? results.filter((p) => (p.category || "Otros") === activeCategory)
        : results,
    [results, activeCategory]
  );

  // Drag-to-close — SOLO sobre el dragHandle (no intercepta el resto del card)
  const dragProps = isMobile
    ? {
        onPointerDown: (e) => {
          dragStartY.current = e.clientY;
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
          e.currentTarget.style.transition = "none";
        },
        onPointerMove: (e) => {
          if (dragStartY.current == null) return;
          const dy = Math.max(0, e.clientY - dragStartY.current);
          setDragY(dy);
        },
        onPointerUp: (e) => {
          const dy = dragY;
          dragStartY.current = null;
          setDragY(0);
          try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
          e.currentTarget.style.transition = "";
          if (dy > 100) onClose();
        },
      }
    : {};

  const dragHandleStyle = isMobile
    ? { transform: `translateX(-50%) translateY(${Math.min(dragY, 240)}px)`, transition: dragStartY.current != null ? "none" : undefined }
    : undefined;
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Buscar productos">
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />

      <div className={styles.card}>
        <div className={styles.stickyHeader}>
          <div className={styles.inputRow}>
            <HiOutlineMagnifyingGlass className={styles.icon} />
            <input
              ref={inputRef}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Buscar productos, marcas, códigos…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar productos"
            />
            {query ? (
              <button type="button" className={styles.clearBtn} onClick={handleClear} aria-label="Limpiar búsqueda">
                <HiOutlineXMark size={16} />
              </button>
            ) : (
              <kbd className={styles.kbd} aria-hidden="true">ESC</kbd>
            )}
          </div>

          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar buscador">
            <HiOutlineXMark size={18} />
            <span>Cerrar</span>
          </button>

          {isMobile && (
            <div
              className={styles.dragHandle}
              style={dragHandleStyle}
              {...dragProps}
              aria-hidden="true"
              role="button"
              aria-label="Arrastra hacia abajo para cerrar"
            />
          )}
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.state} role="status" aria-live="polite">
              <div className={styles.spinner} aria-hidden="true" />
              <p>Buscando…</p>
            </div>
          ) : query.trim().length < 2 ? (
            <RecentsPanel recents={recents} onPick={handlePick} onRemove={handleRemoveRecent} onClear={clearRecents} />
          ) : filtered.length > 0 ? (
            <>
              {categories.length > 1 && (
                <div className={styles.filterRow} role="tablist" aria-label="Filtrar por categoría">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeCategory === ""}
                    className={`${styles.chip} ${activeCategory === "" ? styles.chipActive : ""}`}
                    onClick={() => setActiveCategory("")}
                  >
                    <span className={styles.chipDot} aria-hidden="true" />
                    Todo
                    <span className={styles.chipCount}>{results.length}</span>
                  </button>
                  {categories.map(({ name, count }) => (
                    <button
                      key={name}
                      type="button"
                      role="tab"
                      aria-selected={activeCategory === name}
                      className={`${styles.chip} ${activeCategory === name ? styles.chipActive : ""}`}
                      onClick={() => setActiveCategory((c) => (c === name ? "" : name))}
                    >
                      {name}
                      <span className={styles.chipCount}>{count}</span>
                    </button>
                  ))}
                </div>
              )}

              <ul className={styles.list} role="list">
                {filtered.map((p, i) => (
                  <li key={p.id}>
                    <Link
                      to={`/productos/${p.slug}`}
                      className={styles.item}
                      style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
                      onClick={() => { rememberQuery(); onClose(); }}
                    >
                      <div className={styles.thumb}>
                        <img src={p.images?.[0] || p.image || "/placeholder-product.png"} alt="" loading="lazy" />
                      </div>
                      <div className={styles.itemInfo}>
                        <span className={styles.itemName}>{p.name}</span>
                        <span className={styles.itemMeta}>
                          {showPrices ? (
                            <strong>${formatPrice(p.price)}</strong>
                          ) : (
                            <strong className={styles.consult}>Consultar precio</strong>
                          )}
                          {p.category && <span className={styles.itemCat}>{p.category}</span>}
                          {p.barcode && <span className={styles.itemCode}>#{p.barcode}</span>}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>

              {!activeCategory && (
                <button
                  type="button"
                  className={styles.viewAll}
                  onClick={() => {
                    rememberQuery();
                    navigate(`/productos?search=${encodeURIComponent(query.trim() || query)}`);
                  }}
                >
                  Ver todos los resultados
                  <span aria-hidden="true">→</span>
                </button>
              )}
            </>
          ) : hasSearched ? (
            <div className={styles.state}>
              <span className={styles.stateEmoji} aria-hidden="true">🔍</span>
              <h3>Sin resultados para “{query.trim()}”</h3>
              <p>Revisa la ortografía o prueba con otra palabra.</p>
              <button type="button" className={styles.tryLink} onClick={() => handlePick("zapatilla")}>
                Ver “zapatilla”
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}


/* ── Recents panel ── */
function RecentsPanel({ recents, onPick, onRemove, onClear }) {
  return (
    <div className={styles.recentPanel} role="region" aria-label="Búsquedas recientes">
      {recents.length === 0 ? (
        <div className={styles.state}>
          <span className={styles.stateEmoji} aria-hidden="true">👋</span>
          <h3>Comienza a buscar</h3>
          <p>
            Escribe el nombre de un producto, su marca, SKU o código de barras
            para encontrarlo en segundos.
          </p>
        </div>
      ) : (
        <>
          <div className={styles.recentRow}>
            <span className={styles.recentLabel}>
              <HiOutlineSparkles size={14} />
              Recientes
            </span>
            <button type="button" className={styles.recentClear} onClick={onClear}>
              Borrar todo
            </button>
          </div>
          <ul className={styles.recentList} role="list">
            {recents.map((t, i) => (
              <li key={`${t}-${i}`} className={styles.recentItem}>
                <button type="button" className={styles.recentPick} onClick={() => onPick(t)}>
                  <HiOutlineMagnifyingGlass size={14} />
                  <span>{t}</span>
                </button>
                <button
                  type="button"
                  className={styles.recentRemove}
                  onClick={() => onRemove(t)}
                  aria-label={`Quitar ${t} de recientes`}
                >
                  <HiOutlineXMark size={14} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
