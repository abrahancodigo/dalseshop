"use client";

import { useStore } from "@/context/StoreContext";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import styles from "./contacto.module.css";
import { FaMapMarkerAlt, FaEnvelope, FaPhoneAlt, FaCheckCircle } from "react-icons/fa";
import { useState } from "react";

export default function ContactoPage() {
  const { settings, loading } = useStore();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    
    const formData = new FormData(e.target);
    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      message: formData.get("message"),
      storeSettings: settings
    };

    try {
      const res = await fetch("/api/send-contact-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        setSent(true);
        e.target.reset();
        setTimeout(() => setSent(false), 5000);
      } else {
        const error = await res.json();
        alert("Error al enviar: " + (error.error || "Inténtalo de nuevo"));
      }
    } catch (err) {
      alert("Error de conexión. Revisa tu internet.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page-container">
      <StoreHeader />
      <main className={styles.main}>
        <div className="container">
          <div className={styles.header}>
            <h1 className={styles.title}>Contáctanos</h1>
            <p className={styles.subtitle}>
              Estamos aquí para ayudarte. Déjanos un mensaje o encuéntranos a través de nuestros canales oficiales.
            </p>
          </div>

          <div className={styles.grid}>
            {/* Contact Form */}
            <div className={`glass-panel ${styles.formContainer}`}>
              <h2 className={styles.sectionTitle}>Envíanos un Mensaje</h2>
              
              {sent ? (
                <div className={styles.successMessage}>
                  <FaCheckCircle size={48} color="var(--color-primary)" />
                  <h3>¡Mensaje Enviado!</h3>
                  <p>Gracias por contactarnos. Te responderemos lo antes posible.</p>
                  <button className="btn btn-ghost" onClick={() => setSent(false)}>Enviar otro mensaje</button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className={styles.form}>
                  <div className="form-group">
                    <label className="form-label">Nombre</label>
                    <input name="name" type="text" className="form-input" required placeholder="Tu nombre completo" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Correo Electrónico</label>
                    <input name="email" type="email" className="form-input" required placeholder="tu@correo.com" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mensaje</label>
                    <textarea name="message" className="form-textarea" required placeholder="¿En qué te podemos ayudar?"></textarea>
                  </div>
                  <button type="submit" className={`btn btn-primary ${styles.submitBtn}`} disabled={sending}>
                    {sending ? "Enviando..." : "Enviar Mensaje"}
                  </button>
                </form>
              )}
            </div>

            {/* Contact Info */}
            <div className={styles.infoContainer}>
              <h2 className={styles.sectionTitle}>Información de la Tienda</h2>
              
              <div className={styles.infoCards}>
                {settings.address && (
                  <div className={`glass-panel ${styles.infoCard}`}>
                    <div className={styles.iconWrapper}>
                      <FaMapMarkerAlt />
                    </div>
                    <div>
                      <h3>Dirección</h3>
                      <p>{settings.address}</p>
                    </div>
                  </div>
                )}
                
                {settings.email && (
                  <div className={`glass-panel ${styles.infoCard}`}>
                    <div className={styles.iconWrapper}>
                      <FaEnvelope />
                    </div>
                    <div>
                      <h3>Correo</h3>
                      <p>{settings.email}</p>
                    </div>
                  </div>
                )}
                
                {settings.phone && (
                  <div className={`glass-panel ${styles.infoCard}`}>
                    <div className={styles.iconWrapper}>
                      <FaPhoneAlt />
                    </div>
                    <div>
                      <h3>Teléfono</h3>
                      <p>{settings.phone}</p>
                    </div>
                  </div>
                )}
              </div>

              {(!settings.address && !settings.email && !settings.phone) && (
                <div className={`glass-panel ${styles.infoCard}`}>
                   <p>La información de contacto se actualizará pronto.</p>
                </div>
              )}

              {/* Map embedded */}
              <div className={`glass-panel ${styles.mapContainer}`}>
                 <iframe 
                    src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d15505.4121!2d-89.21804577490371!3d13.69247306955584!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sus!4v1713919012345!5m2!1sen!2sus" 
                    width="100%" 
                    height="100%" 
                    style={{ border: 0 }} 
                    allowFullScreen="" 
                    loading="lazy" 
                    referrerPolicy="no-referrer-when-downgrade"
                 ></iframe>
              </div>
            </div>
          </div>
        </div>
      </main>
      <StoreFooter />
    </div>
  );
}
