"use client";

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";

const ImageContext = createContext(null);

export function ImageProvider({ children }) {
  const [imageSrc, setImageSrc] = useState(null);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);
  
  const openImage = useCallback((src) => {
    setImageSrc(src);
    document.body.style.overflow = "hidden";
  }, []);
  
  const closeImage = useCallback(() => {
    setImageSrc(null);
    document.body.style.overflow = "";
  }, []);

  const value = useMemo(() => ({ imageSrc, openImage, closeImage }), [imageSrc, openImage, closeImage]);

  return (
    <ImageContext.Provider value={value}>
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
