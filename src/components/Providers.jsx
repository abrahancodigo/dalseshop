"use client";

import { AuthProvider } from "@/context/AuthContext";
import { StoreProvider } from "@/context/StoreContext";
import { CartProvider } from "@/context/CartContext";
import { ImageProvider } from "@/context/ImageContext";
import CartDrawer from "@/components/store/CartDrawer";
import ModalImage from "./ModalImage";
import CookieConsent from "@/components/store/CookieConsent";
import AuthTimingOverlay from "./AuthTimingOverlay";

export default function Providers({ children }) {
  return (
    <ImageProvider>
      <AuthProvider>
        <StoreProvider>
          <CartProvider>
            {children}
            <CartDrawer />
            <ModalImage />
            <CookieConsent />
            <AuthTimingOverlay />
          </CartProvider>
        </StoreProvider>
      </AuthProvider>
    </ImageProvider>
  );
}
