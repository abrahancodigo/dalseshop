"use client";

import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import { useStore } from "@/context/StoreContext";
import { getLocalDateString } from "@/lib/dates";
import styles from "./terminos.module.css";

export default function TerminosPage() {
  const { settings, loading } = useStore();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  const storeName = settings?.name || "DalseShop";
  const legal = settings?.legalInfo || {};
  const displayEmail = legal.email || settings?.email || "correo@dalseshop.com";
  const displayPhone = legal.phone || settings?.phone || "(503) 1234-5678";
  const displayAddress = settings?.address || "San Salvador, El Salvador";

  return (
    <div className="page-container">
      <StoreHeader />
      <main className={styles.main}>
        <div className="container">
          <div className={`glass-panel ${styles.contentWrapper}`}>
            <h1 className={styles.title}>Términos y Condiciones</h1>
            <p className={styles.lastUpdated}>Última actualización: {getLocalDateString()}</p>

            <div className={styles.textBody}>
              <section className={styles.section}>
                <h2>1. Identidad del Proveedor</h2>
                <p>
                  <strong>Nombre Comercial:</strong> {storeName}<br />
                  {legal.businessName && <><strong>Razón Social:</strong> {legal.businessName}<br /></>}
                  {legal.nit && <><strong>NIT:</strong> {legal.nit}<br /></>}
                  <strong>Dirección:</strong> {displayAddress}<br />
                  <strong>Teléfono:</strong> {displayPhone}<br />
                  <strong>Correo Electrónico:</strong> {displayEmail}
                </p>
                <p>
                  Estos Términos y Condiciones regulan el uso del sitio web {storeName} y la
                  compra de productos a través del mismo, en cumplimiento con la Ley de Protección
                  al Consumidor y demás normativa aplicable de la República de El Salvador.
                </p>
              </section>

              <section className={styles.section}>
                <h2>2. Descripción del Servicio</h2>
                <p>
                  {storeName} es una tienda en línea dedicada a la venta de productos. A través de
                  nuestro sitio web, los usuarios pueden navegar, seleccionar y adquirir productos,
                  los cuales serán entregados en la dirección indicada por el cliente dentro de los
                  plazos establecidos en nuestra Política de Envíos.
                </p>
              </section>

              <section className={styles.section}>
                <h2>3. Precios, Impuestos y Gastos de Envío</h2>
                <p>
                  Todos los precios publicados en el sitio web están expresados en dólares
                  estadounidenses (USD), moneda de curso legal en El Salvador, e incluyen el
                  Impuesto a la Transferencia de Bienes Muebles y a la Prestación de Servicios
                  (IVA) cuando corresponda, salvo que se indique expresamente lo contrario.
                  Los gastos de envío se calculan según la zona de entrega y se muestran
                  claramente en el resumen del pedido antes de finalizar la compra.
                </p>
              </section>

              <section className={styles.section}>
                <h2>4. Formas de Pago</h2>
                <p>
                  Actualmente aceptamos las siguientes formas de pago:
                </p>
                <ul>
                  <li><strong>Pago contra entrega:</strong> Pagas en efectivo al momento de recibir tu pedido.</li>
                  <li>Podrán habilitarse otros métodos de pago en el futuro, los cuales serán informados oportunamente.</li>
                </ul>
              </section>

              <section className={styles.section}>
                <h2>5. Plazos y Condiciones de Entrega</h2>
                <p>
                  Realizamos entregas en todo el territorio de El Salvador. El plazo de entrega
                  varía según la zona y la disponibilidad del producto. El tiempo estimado de
                  entrega es de <strong>3 a 8 días hábiles</strong> después de la confirmación
                  del pedido.
                </p>
              </section>

              <section className={styles.section}>
                <h2>6. Derecho de Retracto (Desistimiento)</h2>
                <p>
                  De conformidad con la Ley de Protección al Consumidor de El Salvador, el
                  cliente tiene derecho a retractarse de la compra dentro de un plazo máximo de
                  <strong> tres (3) días hábiles</strong> contados a partir de la recepción del
                  producto, siempre que este se encuentre en su estado original, sin usar y con
                  todas sus etiquetas y empaques.
                </p>
                <p>
                  Para ejercer este derecho, el cliente debe notificarnos por escrito a través
                  de nuestro correo electrónico {displayEmail} dentro del plazo indicado.
                  El reembolso se realizará contra la devolución del producto y se acreditará
                  en un plazo no mayor a quince (15) días hábiles.
                </p>
              </section>

              <section className={styles.section}>
                <h2>7. Garantías</h2>
                <p>
                  Todos los productos comercializados por {storeName} cuentan con la garantía
                  legal establecida en la Ley de Protección al Consumidor. Si el producto
                  presenta defectos de fabricación, el cliente deberá reportarlo dentro de los
                  plazos establecidos por la ley para hacer efectiva la garantía.
                </p>
              </section>

              <section className={styles.section}>
                <h2>8. Responsabilidad por Fallos Técnicos</h2>
                <p>
                  {storeName} se compromete a mantener el sitio web operativo y disponible.
                  Sin embargo, no nos hacemos responsables por fallos técnicos, interrupciones
                  del servicio, errores en la plataforma o cualquier daño derivado del uso del
                  sitio que esté fuera de nuestro control razonable, incluyendo casos de fuerza
                  mayor o mantenimiento programado.
                </p>
              </section>

              <section className={styles.section}>
                <h2>9. Ley Aplicable y Jurisdicción</h2>
                <p>
                  Estos Términos y Condiciones se rigen por las leyes de la República de
                  El Salvador. Cualquier controversia derivada del uso del sitio web o de
                  las compras realizadas a través del mismo será sometida a la jurisdicción
                  de los tribunales de la ciudad de San Salvador, El Salvador.
                </p>
              </section>

              <section className={styles.section}>
                <h2>10. Contacto</h2>
                <p>
                  Para cualquier consulta, queja o reclamo relacionado con estos términos o
                  con tus compras, puedes comunicarte con nosotros a través de los siguientes
                  medios:
                </p>
                <ul>
                  <li><strong>Correo:</strong> {displayEmail}</li>
                  <li><strong>Teléfono:</strong> {displayPhone}</li>
                  <li><strong>Dirección:</strong> {displayAddress}</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      </main>
      <StoreFooter />
    </div>
  );
}
