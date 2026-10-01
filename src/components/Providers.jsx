"use client";

import { AuthProvider } from "@/context/AuthContext";
import { StoreProvider } from "@/context/StoreContext";
import { CartProvider } from "@/context/CartContext";
import { useCart } from "@/context/CartContext";
import { ImageProvider, useImage } from "@/context/ImageContext";
import { lazy, Suspense, useEffect, useState } from "react";
import CookieConsent from "@/components/store/CookieConsent";
const CartDrawer = lazy(() => import("@/components/store/CartDrawer"));
const ModalImage = lazy(() => import("./ModalImage"));

function DeferredOverlays() {
  const { isOpen, setIsOpen } = useCart();
  const { imageSrc, closeImage } = useImage();
  const [cartOpened, setCartOpened] = useState(false);
  useEffect(() => { if (isOpen) setCartOpened(true); }, [isOpen]);
  return <>
    <Suspense fallback={<div role="status" style={{ position: "fixed", right: 16, top: 80, zIndex: 9999, background: "white", padding: 16 }}>Cargando carrito… <button onClick={() => setIsOpen(false)}>Cerrar</button></div>}>
      {(isOpen || cartOpened) && <CartDrawer />}
    </Suspense>
    <Suspense fallback={<div role="status" style={{ position: "fixed", right: 16, top: 80, zIndex: 9999, background: "white", padding: 16 }}>Cargando imagen… <button onClick={closeImage}>Cerrar</button></div>}>
      {imageSrc && <ModalImage />}
    </Suspense>
  </>;
}

export default function Providers({ children }) {
  return (
    <ImageProvider>
      <AuthProvider>
        <StoreProvider>
          <CartProvider>
            {children}
            <DeferredOverlays />
          </CartProvider>
          <CookieConsent />
        </StoreProvider>
      </AuthProvider>
    </ImageProvider>
  );
}
