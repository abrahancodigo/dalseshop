"use client";

import { useImage } from "@/context/ImageContext";
import { HiOutlineXMark } from "react-icons/hi2";
import styles from "./ModalImage.module.css";

export default function ModalImage() {
  const { imageSrc, closeImage } = useImage();

  if (!imageSrc) return null;

  return (
    <div className={styles.overlay} onClick={closeImage}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={closeImage} aria-label="Cerrar">
          <HiOutlineXMark size={24} />
        </button>
        
        <img 
          src={imageSrc} 
          alt="Imagen full-size" 
          className={styles.image}
          onClick={closeImage}
        />
      </div>
    </div>
  );
}
