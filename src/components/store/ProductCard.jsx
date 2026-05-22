"use client";

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useImage } from "@/context/ImageContext";
import { useStore } from "@/context/StoreContext";
import { getReviews } from "@/lib/firestore";
import { formatPrice } from "@/lib/format";
import styles from "./ProductCard.module.css";
import { HiOutlineShoppingCart } from "react-icons/hi2";

export default function ProductCard({ product, onAddToCart }) {
  const { openImage } = useImage();
  const { brands, features } = useStore();
  const showPrices = features.showPrices !== false;
  const hasDiscount = showPrices && product.comparePrice > 0 && product.comparePrice > product.price;
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
        to={`/productos/${product.slug}`}
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
        <Link to={`/productos/${product.slug}`} className={styles.name}>
          {product.name}
        </Link>

        <div className={styles.rating}>
          {[...Array(5)].map((_, i) => (
            <span key={i} className={i < Math.round(rating ?? 0) ? styles.filledStar : styles.star}>
              {i < Math.round(rating ?? 0) ? "★" : "☆"}
            </span>
          ))}
        </div>

        <div className={styles.priceRow}>
          {showPrices ? (
            <>
              <span className={styles.price}>${formatPrice(product.price)}</span>
              {hasDiscount && (
                <span className={styles.comparePrice}>
                  ${formatPrice(product.comparePrice)}
                </span>
              )}
            </>
          ) : (
            <span className={styles.consultPrice}>Consultar precio</span>
          )}
        </div>

        {onAddToCart && (
          <button className={styles.addBtn} onClick={() => onAddToCart(product)}>
            Añadir al carrito
          </button>
        )}
      </div>
    </div>
  );
}
