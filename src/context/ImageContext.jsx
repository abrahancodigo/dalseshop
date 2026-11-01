"use client";

import { createContext, useContext, useState } from "react";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";

const ImageContext = createContext(null);

export function ImageProvider({ children }) {
  const [imageSrc, setImageSrc] = useState(null);

  const openImage = (src) => {
    setImageSrc(src);
    lockScroll(); // Prevenir scroll mientras el modal está abierto
  };

  const closeImage = () => {
    setImageSrc(null);
    unlockScroll();
  };

  return (
    <ImageContext.Provider value={{ imageSrc, openImage, closeImage }}>
      {children}
    </ImageContext.Provider>
  );
}

export function useImage() {
  const context = useContext(ImageContext);
  if (!context) {
    throw new Error("useImage debe usarse dentro de un ImageProvider");
  }
  return context;
}

export default ImageContext;
