"use client";

import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import { useStore } from "@/context/StoreContext";
import styles from "./terminos.module.css";

export default function TerminosPage() {
  const { settings, loading } = useStore();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  const storeName = settings?.name || "Nuestra Tienda";

  return (
    <div className="page-container">
      <StoreHeader />
      <main className={styles.main}>
        <div className="container">
          <div className={`glass-panel ${styles.contentWrapper}`}>
            <h1 className={styles.title}>Términos y Condiciones</h1>
            <p className={styles.lastUpdated}>Última actualización: {new Date().toLocaleDateString()}</p>

            <div className={styles.textBody}>
              <section className={styles.section}>
                <h2>1. Aspectos Generales</h2>
                <p>
                  Bienvenido a {storeName}. Los presentes Términos y Condiciones regulan el uso de nuestro sitio web
                  y la adquisición de productos en nuestra tienda en línea, en cumplimiento con la Ley de Comercio
                  Electrónico y la Ley de Protección al Consumidor de la República de El Salvador. Al navegar o 
                  comprar en este sitio, usted acepta sujetarse a estos términos.
                </p>
              </section>

              <section className={styles.section}>
                <h2>2. Compras y Pagos</h2>
                <p>
                  Todas las compras están sujetas a la disponibilidad de los productos. {storeName} se reserva
                  el derecho de cancelar cualquier pedido por falta de inventario, errores en el precio publicado o 
                  sospecha de fraude, notificando oportunamente al cliente.
                </p>
              </section>

              <section className={styles.section}>
                <h2>3. Política de Devoluciones y Cambios</h2>
                <p>
                  En {storeName} nos esforzamos por ofrecer productos de la más alta calidad. Nuestras políticas 
                  de devolución se rigen por las siguientes condiciones:
                </p>
                <ul>
                  <li>
                    <strong>Autorización previa:</strong> Todas las devoluciones deben ser previamente autorizadas 
                    bajo mutuo acuerdo entre el cliente y {storeName}.
                  </li>
                  <li>
                    <strong>Motivo de devolución:</strong> Prácticamente las devoluciones se realizan <strong>únicamente por desperfectos de fábrica</strong>. No se aceptan cambios por arrepentimiento de compra.
                  </li>
                  <li>
                    <strong>Estado del producto:</strong> El producto debe encontrarse sin usar, en perfecto estado, 
                    con todas sus etiquetas originales y en su empaque de fábrica.
                  </li>
                  <li>
                    <strong>Plazo máximo:</strong> El cliente cuenta con un plazo máximo de <strong>48 horas</strong> a 
                    partir de la recepción del pedido para reportar cualquier desperfecto y solicitar la devolución.
                  </li>
                </ul>
              </section>

              <section className={styles.section}>
                <h2>4. Privacidad y Protección de Datos</h2>
                <p>
                  Sus datos personales son utilizados exclusivamente para el procesamiento de sus pedidos, facturación 
                  y envío de información relacionada con {storeName}. Nos comprometemos a no compartir ni vender
                  su información a terceros, garantizando su confidencialidad según lo establecido en las leyes aplicables.
                </p>
              </section>

              <section className={styles.section}>
                <h2>5. Contacto</h2>
                <p>
                  Para cualquier consulta, queja o reclamo relacionado con sus compras o estos términos, puede 
                  comunicarse con nosotros a través de nuestra página de Contacto, enviándonos un mensaje directo.
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>
      <StoreFooter />
    </div>
  );
}
