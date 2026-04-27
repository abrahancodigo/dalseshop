"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useImage } from "@/context/ImageContext";
import { useStore } from "@/context/StoreContext";
import { getReviews } from "@/lib/firestore";
import styles from "./ProductCard.module.css";
import { HiOutlineShoppingCart } from "react-icons/hi2";

export default function ProductCard({ product, onAddToCart }) {
  const { openImage } = useImage();
  const { brands } = useStore();
  const hasDiscount = product.comparePrice > 0 && product.comparePrice > product.price;
  const [rating, setRating] = useState(null);
  useEffect(() => {
    if (!product.id) return;
    let cancelled = false;
    getReviews(product.id)
      .then((revs) => {
        if (cancelled) return;
        const approved = revs.filter(r => r.isApproved !== false);
        if (approved.length) {
          const avg = approved.reduce((s, r) => s + (r.rating || 5), 0) / approved.length;
          setRating(avg);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [product.id]);

  const brandName = brands.find(b => b.id === product.brand)?.name;

  const discountPercent = hasDiscount
    ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
    : 0;

  return (
    <div className={styles.card}>
      <Link 
        href={`/productos/${product.slug}`}
        className={styles.imageWrapper} 
      >
        {product.images?.[0] ? (
          <img src={product.images[0]} alt={product.name} className={styles.image} />
        ) : (
          <div className={styles.imagePlaceholder}>
            <HiOutlineShoppingCart />
          </div>
        )}
        {hasDiscount && (
          <span className={styles.discountBadge}>-{discountPercent}%</span>
        )}
      </Link>

      <div className={styles.body}>
        {brandName && (
          <span className={styles.brandTag}>{brandName}</span>
        )}
        <Link href={`/productos/${product.slug}`} className={styles.name}>
          {product.name}
        </Link>
...
        <div className={styles.priceRow}>
          <span className={styles.price}>${product.price?.toLocaleString()}</span>
          {hasDiscount && (
            <span className={styles.comparePrice}>
              ${product.comparePrice?.toLocaleString()}
            </span>
          )}
        </div>

        <div className={styles.rating}>
          {[...Array(5)].map((_, i) => (
            <span key={i} className={i < Math.round(rating ?? 0) ? styles.filledStar : styles.star}>★</span>
          ))}
          {rating !== null && (
            <span style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginLeft: "4px" }}>
              ({rating.toFixed(1)})
            </span>
          )}
        </div>
        {onAddToCart && (
          <button className={styles.addBtn} onClick={() => onAddToCart(product)}>
            <HiOutlineShoppingCart />
            Agregar
          </button>
        )}
      </div>
    </div>
  );
}
