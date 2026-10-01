"use client";

import { useImage } from "@/context/ImageContext";
import { useEffect, useRef } from 'react';
import { HiOutlineXMark } from "react-icons/hi2";
import styles from "./ModalImage.module.css";

export default function ModalImage() {
  const { imageSrc, closeImage } = useImage();
  const closeRef = useRef(null);
  const closeAction = useRef(closeImage);
  closeAction.current = closeImage;
  useEffect(() => {
    if (!imageSrc) return;
    const previous = document.activeElement;
    closeRef.current?.focus();
    const handleKey = (event) => {
      if (event.key === 'Escape') closeAction.current();
      if (event.key === 'Tab') { event.preventDefault(); closeRef.current?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, [imageSrc]);

  if (!imageSrc) return null;

  return (
    <div className={styles.overlay} onClick={closeImage}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Vista ampliada de imagen" onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} className={styles.closeBtn} onClick={closeImage} aria-label="Cerrar">
          <HiOutlineXMark size={24} />
        </button>
        
        <img 
          src={imageSrc} 
          alt="Imagen full-size" 
          className={styles.image}
        />
      </div>
    </div>
  );
}
