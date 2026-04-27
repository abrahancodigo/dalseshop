"use client";

import Link from "next/link";
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
        {/* Brand + Description */}
        <div className={styles.brandCol}>
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
        </div>

        {/* Dynamic Columns */}
        {(footer.columns || []).map((col, i) => (
          <div key={i} className={styles.column}>
            <h4 className={styles.columnTitle}>{col.title}</h4>
            <ul className={styles.linkList}>
              {(col.links || []).map((link, j) => (
                <li key={j}>
                  <Link href={link.href} className={styles.link}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Contact */}
        {(settings.email || settings.phone || settings.address) && (
          <div className={styles.column}>
            <h4 className={styles.columnTitle}>Contacto</h4>
            <ul className={styles.linkList}>
              {settings.email && <li className={styles.contactItem}>{settings.email}</li>}
              {settings.phone && <li className={styles.contactItem}>{settings.phone}</li>}
              {settings.address && <li className={styles.contactItem}>{settings.address}</li>}
            </ul>
          </div>
        )}
      </div>

      {/* Copyright */}
      <div className={styles.copyright}>
        <div className={`container ${styles.copyrightInner}`}>
          <p>{footer.copyright || `© ${new Date().getFullYear()} ${settings.name || "DalseShop"}. Todos los derechos reservados.`}</p>
          <div className={styles.legalLinks}>
             <Link href="/terminos-y-condiciones" className={styles.legalLink}>Términos y Condiciones</Link>
             <span className={styles.legalSeparator}>|</span>
             <Link href="/contacto" className={styles.legalLink}>Contacto</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
