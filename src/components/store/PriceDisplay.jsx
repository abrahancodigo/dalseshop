import { useStore } from "@/context/StoreContext";
import { formatPrice } from "@/lib/format";
import styles from "./PriceDisplay.module.css";

export default function PriceDisplay({ price, comparePrice, className = "" }) {
  const { features } = useStore();
  const showPrices = features.showPrices !== false;
  const hasDiscount = showPrices && comparePrice > 0 && comparePrice > price;

  if (!showPrices) {
    return (
      <span className={`${styles.consultPrice} ${className}`}>
        Consultar precio
      </span>
    );
  }

  return (
    <span className={`${styles.priceWrapper} ${className}`}>
      <span className={styles.price}>${formatPrice(price)}</span>
      {hasDiscount && (
        <span className={styles.comparePrice}>${formatPrice(comparePrice)}</span>
      )}
    </span>
  );
}
