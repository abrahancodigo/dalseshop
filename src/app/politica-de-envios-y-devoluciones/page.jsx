"use client";

import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import { useStore } from "@/context/StoreContext";
import { getLocalDateString } from "@/lib/dates";
import styles from "./envios.module.css";

export default function EnviosPage() {
  const { settings, loading } = useStore();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  const storeName = settings?.name || "DalseShop";
  const displayEmail = settings?.legalInfo?.email || settings?.email || "correo@dalseshop.com";
  const displayPhone = settings?.legalInfo?.phone || settings?.phone || "(503) 1234-5678";

  return (
    <div className="page-container">
      <StoreHeader />
      <main className={styles.main}>
        <div className="container">
          <div className={`glass-panel ${styles.contentWrapper}`}>
            <h1 className={styles.title}>Política de Envíos y Devoluciones</h1>
            <p className={styles.lastUpdated}>Última actualización: {getLocalDateString()}</p>

            <div className={styles.textBody}>
              <section className={styles.section}>
                <h2>1. Zonas de Cobertura</h2>
                <p>
                  Realizamos envíos a todo el territorio de la República de El Salvador.
                  Por el momento no realizamos envíos internacionales.
                </p>
              </section>

              <section className={styles.section}>
                <h2>2. Costos de Envío</h2>
                <p>
                  Los costos de envío se calculan según la zona de entrega y se muestran
                  claramente en el resumen del pedido antes de finalizar la compra.
                  El detalle de zonas y tarifas está disponible durante el proceso de
                  checkout.
                </p>
              </section>

              <section className={styles.section}>
                <h2>3. Tiempos de Entrega</h2>
                <p>
                  Los tiempos de entrega estimados son de <strong>3 a 8 días hábiles</strong>
                  después de la confirmación del pedido, dependiendo de la zona de entrega.
                </p>
                <p>
                  Estos plazos son estimados y pueden variar por razones de fuerza mayor
                  o situaciones fuera de nuestro control.
                </p>
              </section>

              <section className={styles.section}>
                <h2>4. Proceso de Devolución</h2>
                <p>
                  Si no estás satisfecho con tu compra o el producto presenta algún
                  inconveniente, puedes solicitar una devolución siguiendo estos pasos:
                </p>
                <ul>
                  <li>Comunícate con nosotros dentro de los <strong>3 días hábiles</strong> siguientes a la recepción del producto a través de nuestro correo {displayEmail} o teléfono {displayPhone}.</li>
                  <li>Indica el número de pedido, el producto y el motivo de la devolución.</li>
                  <li>Te indicaremos los pasos a seguir para la devolución.</li>
                </ul>
              </section>

              <section className={styles.section}>
                <h2>5. Condiciones para Aceptar Devoluciones</h2>
                <p>Para que una devolución sea aceptada, el producto debe cumplir con:</p>
                <ul>
                  <li>Estar en su estado original, sin usar y sin daños adicionales.</li>
                  <li>Conservar todas sus etiquetas, empaques y accesorios originales.</li>
                  <li>Haber sido solicitada dentro del plazo establecido.</li>
                </ul>
                <p>
                  No se aceptarán devoluciones de productos que hayan sido usados,
                  dañados por mal manejo del cliente o que no cumplan con las condiciones
                  anteriores.
                </p>
              </section>

              <section className={styles.section}>
                <h2>6. Reembolsos</h2>
                <p>
                  Una vez recibido y verificado el producto devuelto, procesaremos el
                  reembolso en un plazo máximo de <strong>15 días hábiles</strong>.
                  El reembolso se realizará contra entrega del producto o mediante
                  depósito en la cuenta que el cliente indique.
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
