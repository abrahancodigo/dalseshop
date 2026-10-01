"use client";

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('dalseshop_cart') || '[]');
      return Array.isArray(saved) ? saved.filter((item) => item && typeof item.productId === 'string'
        && typeof item.key === 'string' && Number.isSafeInteger(item.quantity) && item.quantity > 0
        && Number.isFinite(item.price) && item.price >= 0) : [];
    } catch { return []; }
  });
  const [isOpen, setIsOpen] = useState(false);

  // Save cart to localStorage on change
  useEffect(() => {
    try { localStorage.setItem("dalseshop_cart", JSON.stringify(items)); }
    catch (error) { console.warn('No se pudo guardar el carrito en este navegador.', error); }
  }, [items]);

  const addItem = useCallback((product, quantity = 1, variant = null) => {
    if (!Number.isSafeInteger(quantity) || quantity <= 0) return;
    setItems((prev) => {
      const key = variant ? `${product.id}_${variant}` : product.id;
      const existingIndex = prev.findIndex((item) => item.key === key);

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + quantity,
        };
        return updated;
      }

      return [
        ...prev,
        {
          key,
          productId: product.id,
          name: product.name,
          price: product.price,
          image: product.images?.[0] || "",
          variant,
          quantity,
          barcode: product.barcode || "",
          sku: product.sku || "",
        },
      ];
    });
  }, []);

  const removeItem = useCallback((key) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }, []);

  const updateQuantity = useCallback((key, quantity) => {
    if (!Number.isSafeInteger(quantity)) return;
    if (quantity <= 0) {
      setItems((prev) => prev.filter((item) => item.key !== key));
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, quantity } : item))
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );
  const totalPrice = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      isOpen,
      setIsOpen,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      totalItems,
      totalPrice,
    }),
    [items, isOpen, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

export default CartContext;
