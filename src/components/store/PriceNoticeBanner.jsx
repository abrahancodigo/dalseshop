import { useStore } from "@/context/StoreContext";
import { HiOutlineInformationCircle } from "react-icons/hi2";
import styles from "./PriceNoticeBanner.module.css";

export default function PriceNoticeBanner({ variant = "default", className = "" }) {
  const { features } = useStore();
  const showPrices = features.showPrices !== false;

  if (showPrices) return null;

  const messages = {
    default: "Los precios se acordarán directamente con la tienda. Al confirmar tu pedido, solo estás registrando una orden de compra. El documento generado no es una factura.",
    checkout: "Al confirmar este pedido, solo estás registrando una orden de compra. El documento generado no es una factura. Nuestro equipo se comunicará contigo para concretar los detalles de la compra.",
    success: "Tu pedido ha sido registrado exitosamente como orden de compra. Este documento no es una factura. Nuestro equipo se comunicará contigo pronto para concretar los detalles de la compra.",
    cart: "Los precios se acordarán directamente con la tienda. Al continuar, solo estás registrando una orden de compra.",
  };

  return (
    <div className={`${styles.banner} ${styles[variant] || styles.default} ${className}`}>
      <HiOutlineInformationCircle className={styles.bannerIcon} />
      <p className={styles.bannerText}>{messages[variant]}</p>
    </div>
  );
}
