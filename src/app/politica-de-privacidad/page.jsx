"use client";

import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import { useStore } from "@/context/StoreContext";
import { getLocalDateString } from "@/lib/dates";
import styles from "./privacidad.module.css";

export default function PrivacidadPage() {
  const { settings, loading } = useStore();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  const storeName = settings?.name || "DalseShop";
  const legal = settings?.legalInfo || {};
  const displayEmail = legal.email || settings?.email || "correo@dalseshop.com";
  const displayAddress = settings?.address || "San Salvador, El Salvador";

  return (
    <div className="page-container">
      <StoreHeader />
      <main className={styles.main}>
        <div className="container">
          <div className={`glass-panel ${styles.contentWrapper}`}>
            <h1 className={styles.title}>Política de Privacidad</h1>
            <p className={styles.lastUpdated}>Última actualización: {getLocalDateString()}</p>

            <div className={styles.textBody}>
              <section className={styles.section}>
                <h2>1. Introducción</h2>
                <p>
                  En {storeName} nos tomamos muy en serio tu privacidad. Esta Política de
                  Privacidad explica qué datos personales recopilamos, cómo los usamos,
                  con quién los compartimos y cuáles son tus derechos como titular de los
                  datos, en cumplimiento con la Ley de Protección al Consumidor de la
                  República de El Salvador.
                </p>
              </section>

              <section className={styles.section}>
                <h2>2. Datos que Recopilamos</h2>
                <p>Podemos recopilar la siguiente información personal cuando utilizas nuestro sitio web o realizas una compra:</p>
                <ul>
                  <li><strong>Nombre completo</strong> — para identificar y contactar al cliente.</li>
                  <li><strong>Correo electrónico</strong> — para enviar confirmaciones de pedido, facturas y comunicaciones relacionadas.</li>
                  <li><strong>Teléfono</strong> — para contactarte si es necesario con respecto a tu pedido.</li>
                  <li><strong>Dirección de envío</strong> — para entregar los productos adquiridos.</li>
                  <li><strong>Datos de facturación</strong> — NIT, razón social y NRC, solo si solicitas crédito fiscal.</li>
                  <li><strong>Información de navegación</strong> — páginas visitadas, tiempo de visita, tipo de dispositivo, dirección IP, a través de cookies y tecnologías similares.</li>
                </ul>
              </section>

              <section className={styles.section}>
                <h2>3. Cómo Usamos tus Datos</h2>
                <p>Utilizamos tus datos personales para los siguientes fines:</p>
                <ul>
                  <li>Procesar y gestionar tus pedidos y compras.</li>
                  <li>Enviarte confirmaciones, facturas y actualizaciones sobre tu pedido.</li>
                  <li>Brindarte atención al cliente y resolver cualquier consulta o reclamo.</li>
                  <li>Cumplir con obligaciones fiscales y legales.</li>
                  <li>Mejorar nuestro sitio web y la experiencia de compra.</li>
                  <li>Enviarte comunicaciones promocionales únicamente si nos has dado tu consentimiento.</li>
                </ul>
              </section>

              <section className={styles.section}>
                <h2>4. Compartición de Datos con Terceros</h2>
                <p>
                  No vendemos, alquilamos ni compartimos tus datos personales con terceros
                  para fines comerciales, excepto en los siguientes casos:
                </p>
                <ul>
                  <li><strong>Proveedores de servicios:</strong> Compartimos datos con servicios de mensajería para la entrega de pedidos y con plataformas de pago cuando estén habilitadas.</li>
                  <li><strong>Obligaciones legales:</strong> Podemos divulgar tus datos si así lo requiere la ley o una autoridad competente.</li>
                </ul>
              </section>

              <section className={styles.section}>
                <h2>5. Cookies y Tecnologías Similares</h2>
                <p>
                  Utilizamos cookies y tecnologías similares para mejorar tu experiencia de
                  navegación, recordar tus preferencias y analizar el tráfico del sitio.
                  Puedes configurar tu navegador para rechazar todas las cookies o para
                  alertarte cuando una cookie esté siendo enviada.
                </p>
              </section>

              <section className={styles.section}>
                <h2>6. Derechos del Usuario (ARCO)</h2>
                <p>
                  De conformidad con la Ley de Protección al Consumidor de El Salvador,
                  tienes los siguientes derechos sobre tus datos personales:
                </p>
                <ul>
                  <li><strong>Acceso:</strong> Solicitar conocer qué datos tenemos tuyos.</li>
                  <li><strong>Rectificación:</strong> Solicitar la corrección de datos inexactos o incompletos.</li>
                  <li><strong>Cancelación:</strong> Solicitar la eliminación de tus datos cuando ya no sean necesarios.</li>
                  <li><strong>Oposición:</strong> Oponerte al tratamiento de tus datos para fines específicos.</li>
                </ul>
              </section>

              <section className={styles.section}>
                <h2>7. Seguridad de los Datos</h2>
                <p>
                  Implementamos medidas de seguridad técnicas, administrativas y físicas
                  para proteger tus datos personales contra acceso no autorizado, pérdida,
                  alteración o divulgación. Todo el sitio web utiliza conexión segura
                  (HTTPS) para proteger la información transmitida.
                </p>
              </section>

              <section className={styles.section}>
                <h2>8. Contacto para Ejercer tus Derechos</h2>
                <p>
                  Para ejercer cualquiera de tus derechos, realizar consultas sobre esta
                  política o presentar una queja, puedes contactarnos a través de:
                </p>
                <ul>
                  <li><strong>Correo:</strong> {displayEmail}</li>
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
