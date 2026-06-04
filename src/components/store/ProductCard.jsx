"use client";

import { Link } from "react-router-dom";
import { useStore } from "@/context/StoreContext";
import { formatPrice } from "@/lib/format";
import styles from "./ProductCard.module.css";
import { HiOutlineShoppingCart } from "react-icons/hi2";

export default function ProductCard({ product, onAddToCart }) {
  const { features } = useStore();
  const showPrices = features.showPrices !== false;
  const hasDiscount = showPrices && product.comparePrice > 0 && product.comparePrice > product.price;
  const rating = product.avgRating != null ? Number(product.avgRating) : null;
  const showRating = rating != null && (product.reviewCount ?? 0) > 0;

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

        {showRating && (
          <div className={styles.rating}>
            {[...Array(5)].map((_, i) => (
              <span key={i} className={i < Math.round(rating) ? styles.filledStar : styles.star}>
                {i < Math.round(rating) ? "★" : "☆"}
              </span>
            ))}
          </div>
        )}

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
