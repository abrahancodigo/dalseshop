"use client";

import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "@/context/StoreContext";
import styles from "./BrandTicker.module.css";

export default function BrandTicker() {
  const { brands } = useStore();
  const trackRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const scrollStart = useRef(0);
  const didDrag = useRef(false);

  if (!brands || brands.length === 0) return null;

  const handleMouseDown = (e) => {
    setIsDragging(true);
    didDrag.current = false;
    startX.current = e.pageX - trackRef.current.offsetLeft;
    scrollStart.current = trackRef.current.scrollLeft;
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - trackRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    trackRef.current.scrollLeft = scrollStart.current - walk;
    if (Math.abs(walk) > 5) didDrag.current = true;
  };

  const handleItemClick = (e) => {
    if (didDrag.current) e.preventDefault();
  };

  return (
    <div
      ref={trackRef}
      className={`${styles.ticker} ${isDragging ? styles.dragging : ''}`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseUp}
    >
      <div className={styles.track}>
        {brands.map((brand) => (
          <Link
            key={brand.id}
            to={`/productos?marca=${brand.id}`}
            className={styles.item}
            title={brand.name}
            onClick={handleItemClick}
          >
            {brand.logo ? (
              <img src={brand.logo} alt={brand.name} className={styles.logo} />
            ) : (
              <span className={styles.name}>{brand.name}</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
