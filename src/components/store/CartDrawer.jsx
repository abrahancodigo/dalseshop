"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { formatPrice } from "@/lib/format";
import { Link } from "react-router-dom";
import {
  HiOutlineXMark,
  HiOutlineMinus,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineShoppingCart,
} from "react-icons/hi2";
import styles from "./CartDrawer.module.css";
import PriceNoticeBanner from "./PriceNoticeBanner";

export default function CartDrawer() {
  const {
    items,
    isOpen,
    setIsOpen,
    removeItem,
    updateQuantity,
    clearCart,
    totalItems,
    totalPrice,
  } = useCart();
  const { features } = useStore();
  const showPrices = features.showPrices !== false;

  const [shouldRender, setShouldRender] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, shouldRender]);

  if (!shouldRender) return null;

  return (
    <>
      <div
        className={`${styles.overlay} ${isClosing ? styles.closing : ""}`}
        onClick={() => setIsOpen(false)}
      />
      <div className={`${styles.drawer} ${isClosing ? styles.closing : ""}`}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>
            <HiOutlineShoppingCart />
            Carrito ({totalItems})
          </h2>
          <button
            className={styles.closeBtn}
            onClick={() => setIsOpen(false)}
          >
            <HiOutlineXMark />
          </button>
        </div>

        {/* Items */}
        {items.length === 0 ? (
          <div className={styles.empty}>
            <HiOutlineShoppingCart className={styles.emptyIcon} />
            <p className={styles.emptyText}>Tu carrito está vacío</p>
            <button
              className="btn btn-primary"
              onClick={() => setIsOpen(false)}
            >
              Seguir comprando
            </button>
          </div>
        ) : (
          <>
            <div className={styles.items}>
              {items.map((item) => (
                <div key={item.key} className={styles.item}>
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      className={styles.itemImage}
                    />
                  )}
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{item.name}</span>
                    {item.variant && (
                      <span className={styles.itemVariant}>{item.variant}</span>
                    )}
                    <span className={styles.itemPrice}>
                      {showPrices ? `$${formatPrice(item.price)}` : "Consultar precio"}
                    </span>
                    <div className={styles.itemQuantity}>
                      <button
                        onClick={() =>
                          updateQuantity(item.key, item.quantity - 1)
                        }
                      >
                        <HiOutlineMinus />
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        onClick={() =>
                          updateQuantity(item.key, item.quantity + 1)
                        }
                      >
                        <HiOutlinePlus />
                      </button>
                    </div>
                  </div>
                  <div className={styles.itemActions}>
                    <span className={styles.itemTotal}>
                      {showPrices ? `$${formatPrice(item.price * item.quantity)}` : "—"}
                    </span>
                    <button
                      className={styles.removeBtn}
                      onClick={() => removeItem(item.key)}
                    >
                      <HiOutlineTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className={styles.footer}>
              <button
                className={styles.clearBtn}
                onClick={clearCart}
              >
                Vaciar carrito
              </button>

              <div className={styles.totalRow}>
                <span className={styles.totalLabel}>Total</span>
                <span className={styles.totalValue}>
                  {showPrices ? `$${formatPrice(totalPrice)}` : "Consultar precio"}
                </span>
              </div>

              <PriceNoticeBanner variant="cart" />

              <Link
                to="/checkout"
                className={styles.checkoutBtn}
                onClick={() => setIsOpen(false)}
              >
                Proceder al Checkout
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}
