"use client";

import { Link } from "react-router-dom";
import { useStore } from "@/context/StoreContext";
import {
  FaFacebookF,
  FaInstagram,
  FaTwitter,
  FaYoutube,
  FaTiktok,
  FaWhatsapp,
} from "react-icons/fa";
import styles from "./Footer.module.css";

const SOCIAL_ICONS = {
  facebook: FaFacebookF,
  instagram: FaInstagram,
  twitter: FaTwitter,
  youtube: FaYoutube,
  tiktok: FaTiktok,
  whatsapp: FaWhatsapp,
};

export default function StoreFooter() {
  const { settings, navigation } = useStore();
  const footer = navigation?.footer || {};
  const socialEntries = Object.entries(settings.socialMedia || {}).filter(
    ([, v]) => v
  );

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.column}>
          <div className={styles.brand}>
            {settings.logo ? (
              <img src={settings.logo} alt={settings.name} className={styles.logo} />
            ) : (
              <div className={styles.logoPlaceholder}>
                {(settings.name || "DS").substring(0, 2).toUpperCase()}
              </div>
            )}
            <span className={styles.brandName}>{settings.name || "DalseShop"}</span>
          </div>
          {settings.description && (
            <p className={styles.description}>{settings.description}</p>
          )}
          {footer.showSocialLinks && socialEntries.length > 0 && (
            <div className={styles.socialLinks}>
              {socialEntries.map(([key, url]) => {
                const Icon = SOCIAL_ICONS[key];
                if (!Icon) return null;
                const href = key === "whatsapp" ? `https://wa.me/${url.replace(/\D/g, "")}` : url;
                return (
                  <a key={key} href={href} target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                    <Icon />
                  </a>
                );
              })}
            </div>
          )}

          <h4 className={styles.columnTitle} style={{ marginTop: "1.5rem" }}>Información Legal</h4>
          <ul className={styles.linkList}>
            <li className={styles.contactItem}><strong>{settings.name || "DalseShop"}</strong></li>
            {settings.legalInfo?.businessName && <li className={styles.contactItem}>{settings.legalInfo.businessName}</li>}
            {settings.legalInfo?.nit && <li className={styles.contactItem}>NIT: {settings.legalInfo.nit}</li>}
            {settings.address && <li className={styles.contactItem}>{settings.address}</li>}
            {(settings.legalInfo?.phone || settings.phone) && <li className={styles.contactItem}>Tel: {settings.legalInfo?.phone || settings.phone}</li>}
            {(settings.legalInfo?.email || settings.email) && <li className={styles.contactItem}>{settings.legalInfo?.email || settings.email}</li>}
          </ul>
        </div>

        <div />

        <div className={styles.column}>
          <h4 className={styles.columnTitle}>Enlaces Legales</h4>
          <ul className={styles.linkList}>
            <li><Link to="/terminos-y-condiciones" className={styles.link}>Términos y Condiciones</Link></li>
            <li><Link to="/politica-de-privacidad" className={styles.link}>Política de Privacidad</Link></li>
            <li><Link to="/politica-de-envios-y-devoluciones" className={styles.link}>Envíos y Devoluciones</Link></li>
            <li><Link to="/sobre-nosotros" className={styles.link}>Sobre Nosotros</Link></li>
            <li><Link to="/contacto" className={styles.link}>Contacto</Link></li>
          </ul>
        </div>
      </div>

      <div className={styles.copyright}>
        <div className={`container ${styles.copyrightInner}`}>
          <p>{footer.copyright || `© ${new Date().getFullYear()} ${settings.name || "DalseShop"}. Todos los derechos reservados.`}</p>
        </div>
      </div>
    </footer>
  );
}
