"use client";

import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import { useStore } from "@/context/StoreContext";
import styles from "./nosotros.module.css";

export default function SobreNosotrosPage() {
  const { settings, loading } = useStore();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  const storeName = settings?.name || "DalseShop";
  const description = settings?.description || "Tienda en línea comprometida con ofrecer productos de calidad a nuestros clientes en El Salvador.";

  return (
    <div className="page-container">
      <StoreHeader />
      <main className={styles.main}>
        <div className="container">
          <div className={`glass-panel ${styles.contentWrapper}`}>
            <h1 className={styles.title}>Sobre Nosotros</h1>

            <div className={styles.textBody}>
              <section className={styles.section}>
                <h2>Nuestra Historia</h2>
                <p>
                  {storeName} nació con la misión de ofrecer una experiencia de compra
                  en línea fácil, segura y confiable para todos los salvadoreños. Desde
                  nuestros inicios, nos hemos enfocado en brindar productos de calidad
                  con un servicio al cliente excepcional.
                </p>
              </section>

              <section className={styles.section}>
                <h2>Misión</h2>
                <p>
                  Ofrecer a nuestros clientes una plataforma de comercio electrónico
                  confiable, con productos de calidad, precios justos y un servicio
                  de entrega eficiente en todo El Salvador.
                </p>
              </section>

              <section className={styles.section}>
                <h2>Visión</h2>
                <p>
                  Ser la tienda en línea de referencia en El Salvador, reconocida por
                  nuestra calidad, transparencia y compromiso con la satisfacción del
                  cliente.
                </p>
              </section>

              <section className={styles.section}>
                <h2>Nuestros Valores</h2>
                <ul>
                  <li><strong>Confianza:</strong> Nos esforzamos por generar relaciones transparentes con nuestros clientes.</li>
                  <li><strong>Calidad:</strong> Seleccionamos cuidadosamente los productos que ofrecemos.</li>
                  <li><strong>Compromiso:</strong> Estamos dedicados a la satisfacción de nuestros clientes.</li>
                  <li><strong>Innovación:</strong> Buscamos mejorar constantemente nuestra plataforma y servicios.</li>
                </ul>
              </section>

              <section className={styles.section}>
                <h2>Contacto</h2>
                <p>
                  {description}
                </p>
                <p>
                  Puedes encontrarnos en nuestra página de <a href="/contacto" style={{ color: "var(--color-primary)" }}>Contacto</a>.
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
