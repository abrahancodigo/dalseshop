"use client";

import { createContext, useContext, useState } from "react";

const ImageContext = createContext({});

export function ImageProvider({ children }) {
  const [imageSrc, setImageSrc] = useState(null);
  
  const openImage = (src) => {
    setImageSrc(src);
    document.body.style.overflow = "hidden"; // Prevenir scroll
  };
  
  const closeImage = () => {
    setImageSrc(null);
    document.body.style.overflow = "";
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
