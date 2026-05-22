"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import { formatPrice } from "@/lib/format";
import { saveOrder, getShippingConfig } from "@/lib/firestore";
import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { generateOrderInvoice, prepareLogoForPDF } from "@/lib/invoice";
import {
  HiOutlineShoppingCart, HiOutlineTruck, HiOutlineBanknotes,
  HiOutlineCheckCircle, HiOutlineArrowLeft,
} from "react-icons/hi2";
import { Link } from "react-router-dom";
import styles from "./checkout.module.css";
import PriceNoticeBanner from "@/components/store/PriceNoticeBanner";

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart();
  const { settings, features } = useStore();
  const showPricesVal = features.showPrices !== false;
  const { user, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState("form");
  const [saving, setSaving] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [orderNumber, setOrderNumber] = useState(null);
  const [form, setForm] = useState({
    name: user?.displayName || "", 
    email: user?.email || "", 
    phone: "", address: "", city: "", state: "", zipCode: "", notes: "",
    wantsInvoice: false, businessName: "", taxId: "", nrc: "", businessType: "",
  });

  // Shipping
  const [shippingConfig, setShippingConfig] = useState(null);
  const [selectedZone, setSelectedZone] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginRedirecting, setLoginRedirecting] = useState(false);

  useEffect(() => {
    loadShipping();
  }, []);

  useEffect(() => {
    if (user && showLoginModal) {
      setShowLoginModal(false);
      setLoginRedirecting(false);
    }
  }, [user, showLoginModal]);

  const loadShipping = async () => {
    try {
      const config = await getShippingConfig();
      if (config) setShippingConfig(config);
    } catch (err) { console.error(err); }
  };

  // Calculate shipping
  const getShippingCost = () => {
    if (!shippingConfig) return 0;
    if (shippingConfig.freeShipping) {
      if (shippingConfig.freeShippingMin > 0 && totalPrice < shippingConfig.freeShippingMin) {
        return shippingConfig.flatRate || 0;
      }
      return 0;
    }
    if (selectedZone && shippingConfig.zones?.length > 0) {
      const zone = shippingConfig.zones.find((z) => z.name === selectedZone);
      if (zone) return zone.cost;
    }
    return shippingConfig.flatRate || 0;
  };

  const shippingCost = getShippingCost();
  const grandTotal = Math.max(0, totalPrice + shippingCost);

  const handleChange = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) return;
    if (!acceptTerms) return;

    if (!user) {
      setShowLoginModal(true);
      return;
    }

    setSaving(true);
    try {
      const orderData = {
        items: items.map((item) => ({
          productId: item.productId, 
          name: item.name, 
          price: item.price,
          quantity: item.quantity, 
          variant: item.variant || null, 
          image: item.image || "",
          barcode: item.barcode || "",
          sku: item.sku || "",
        })),
        subtotal: totalPrice, shipping: shippingCost, discount: 0, total: grandTotal,
        customer: { name: form.name, email: form.email, phone: form.phone, address: form.address, city: form.city, state: form.state, zipCode: form.zipCode },
        userId: user ? user.uid : null,
        notes: form.notes, status: "pending", paymentMethod: "cashOnDelivery", paymentStatus: "pending",
        invoice: form.wantsInvoice ? {
          wantsInvoice: true,
          businessName: form.businessName,
          taxId: form.taxId,
          nrc: form.nrc,
          businessType: form.businessType,
        } : null,
      };

      const { id, orderNumber } = await saveOrder(null, orderData);
      setOrderId(id);
      setOrderNumber(orderNumber);
      
      // Intentar enviar correo
      try {
        let pdfBase64 = null;
        try {
          const logoBase64 = await prepareLogoForPDF(settings?.logoBase64 || settings?.logo);
          const origin = window.location.origin;
          const doc = await generateOrderInvoice({ ...orderData, id }, { ...settings, logo: logoBase64 }, origin, { showPrices: showPricesVal });
          pdfBase64 = doc.output("datauristring").split(",")[1];
        } catch (pdfErr) {
          console.error("Error al generar PDF de factura:", pdfErr);
        }

        // Read fresh settings from Firestore to ensure notifications are up to date
        const freshSettings = settings;

        console.log("Checkout: notifications:", JSON.stringify(freshSettings?.notifications));

        try {
          console.log("Calling sendOrderEmail function...");
          console.log("Payload:", JSON.stringify({
            orderId: orderData.id,
            customerEmail: orderData.customer?.email,
            notifications: freshSettings?.notifications,
            hasPdf: !!pdfBase64,
          }));

          const sendOrderEmail = httpsCallable(functions, "sendOrderEmail");
          const result = await sendOrderEmail({
            order: { ...orderData, id },
            storeSettings: freshSettings,
            pdfBase64: pdfBase64 || "",
            showPrices: showPricesVal,
          });
          console.log("Email sent successfully to:", result.data.recipients);
        } catch (callErr) {
          console.error("Email function failed:", callErr);
          console.error("Error code:", callErr.code);
          console.error("Error message:", callErr.message);
          console.error("Error details:", callErr.details);
        }
      } catch (mailErr) {
        console.error("Error in email process:", mailErr);
      }

      clearCart();
      setStep("success");
    } catch (err) { console.error(err); alert("Error al procesar el pedido."); }
    finally { setSaving(false); }
  };

  if (items.length === 0 && step !== "success") {
    return (
      <div className={styles.pageWrapper}>
        <StoreHeader />
        <main className={styles.flexCenter}>
          <div className={styles.emptyCart}>
            <HiOutlineShoppingCart className={styles.emptyCartIcon} />
            <h2 className={styles.emptyCartTitle}>Carrito Vacío</h2>
            <p className={styles.emptyCartText}>Agrega productos antes de realizar un pedido.</p>
            <Link to="/productos" className="btn btn-primary">Ver Productos</Link>
          </div>
        </main>
        <StoreFooter />
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className={styles.pageWrapper}>
        <StoreHeader />
        <main className={styles.successMain}>
          <div className={styles.successCard}>
            <div className={styles.successIcon}><HiOutlineCheckCircle /></div>
            <h1 className={styles.successTitle}>¡Pedido Realizado!</h1>
            <p className={styles.successText}>Tu pedido ha sido registrado exitosamente. Próximamente nos pondremos en contacto contigo.</p>
            <PriceNoticeBanner variant="success" />
            {orderNumber && <p className={styles.orderId}>Número de pedido: <strong>#{String(orderNumber).padStart(4, "0")}</strong></p>}
            <div className={styles.paymentNote}><HiOutlineBanknotes /><span>Pago contra entrega — pagarás al recibir tu pedido</span></div>
            <div className={styles.successActions}>
              <Link to="/productos" className="btn btn-primary btn-lg">Seguir Comprando</Link>
              <Link to="/" className="btn btn-ghost btn-lg">Ir al Inicio</Link>
            </div>
          </div>
        </main>
        <StoreFooter />
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      <StoreHeader />
      <main className={styles.main}>
        <div className="container">
          <Link to="/productos" className={styles.backLink}><HiOutlineArrowLeft /> Seguir comprando</Link>
          <h1 className={styles.pageTitle}>Finalizar Compra</h1>

          <form onSubmit={handleSubmit} className={styles.checkoutGrid}>
            {/* Left - Form */}
            <div className={styles.formSection}>
              {/* Contact */}
              <div className={styles.formCard}>
                <h2 className={styles.formCardTitle}>Información de Contacto</h2>
                <div className={styles.formRow}>
                  <div className={`form-group ${styles.formFlex1}`}>
                    <label className="form-label">Nombre Completo *</label>
                    <input type="text" className="form-input" value={form.name} onChange={(e) => handleChange("name", e.target.value)} required placeholder="Tu nombre completo" />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className={`form-group ${styles.formFlex1}`}>
                    <label className="form-label">Email *</label>
                    <input type="email" className="form-input" value={form.email} onChange={(e) => handleChange("email", e.target.value)} required placeholder="tu@email.com" />
                  </div>
                  <div className={`form-group ${styles.formFlex1}`}>
                    <label className="form-label">Teléfono *</label>
                    <input type="tel" className="form-input" value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} required placeholder="+52 123 456 7890" />
                  </div>
                </div>
                
                {/* Requiere Crédito Fiscal - Integrado en Información de Contacto */}
                <div className={styles.invoiceCheckbox}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={form.wantsInvoice}
                      onChange={(e) => handleChange("wantsInvoice", e.target.checked)}
                    />
                    <span>Requiere crédito fiscal (factura)</span>
                  </label>
                </div>
                
                {form.wantsInvoice && (
                  <div className={styles.invoiceFields}>
                    <div className="form-group">
                      <label className="form-label">Razón Social</label>
                      <input
                        type="text"
                        className="form-input"
                        value={form.businessName}
                        onChange={(e) => handleChange("businessName", e.target.value)}
                        placeholder="Nombre o razón social de la empresa"
                      />
                    </div>
                    <div className={styles.formFlexRow}>
                      <div className={`form-group ${styles.formFlex1}`}>
                        <label className="form-label">NIT</label>
                        <input
                          type="text"
                          className="form-input"
                          value={form.taxId}
                          onChange={(e) => handleChange("taxId", e.target.value)}
                          placeholder="Ej: 0614-123456-001-0"
                        />
                      </div>
                      <div className={`form-group ${styles.formFlex1}`}>
                        <label className="form-label">Registro (NRC)</label>
                        <input
                          type="text"
                          className="form-input"
                          value={form.nrc}
                          onChange={(e) => handleChange("nrc", e.target.value)}
                          placeholder="Número de Registro"
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Giro de la Empresa</label>
                      <input
                        type="text"
                        className="form-input"
                        value={form.businessType}
                        onChange={(e) => handleChange("businessType", e.target.value)}
                        placeholder="Actividad o giro comercial"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Shipping */}
              <div className={styles.formCard}>
                <h2 className={styles.formCardTitle}><HiOutlineTruck /> Dirección de Envío</h2>
                <div className="form-group">
                  <label className="form-label">Dirección *</label>
                  <input type="text" className="form-input" value={form.address} onChange={(e) => handleChange("address", e.target.value)} required placeholder="Calle, número, colonia" />
                </div>
                <div className={styles.formRow}>
                  <div className={`form-group ${styles.formFlex1}`}>
                    <label className="form-label">Ciudad</label>
                    <input type="text" className="form-input" value={form.city} onChange={(e) => handleChange("city", e.target.value)} placeholder="Ciudad" />
                  </div>
                  <div className={`form-group ${styles.formFlex1}`}>
                    <label className="form-label">Estado</label>
                    <input type="text" className="form-input" value={form.state} onChange={(e) => handleChange("state", e.target.value)} placeholder="Estado" />
                  </div>
                  <div className={`form-group ${styles.formFlex06}`}>
                    <label className="form-label">C.P.</label>
                    <input type="text" className="form-input" value={form.zipCode} onChange={(e) => handleChange("zipCode", e.target.value)} placeholder="12345" />
                  </div>
                </div>
                {shippingConfig?.zones?.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Zona de envío</label>
                    <select className="form-select" value={selectedZone} onChange={(e) => setSelectedZone(e.target.value)}>
                      <option value="">— Selecciona tu zona —</option>
                      {shippingConfig.zones.map((z, i) => (
                        <option key={i} value={z.name}>{z.name} ({showPricesVal ? `$${formatPrice(z.cost)}` : "Consultar precio"})</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Notas del pedido</label>
                  <textarea className="form-textarea" value={form.notes} onChange={(e) => handleChange("notes", e.target.value)} placeholder="Instrucciones especiales, referencias, etc." rows={3} />
                </div>
              </div>

              {/* Payment */}
              <div className={styles.formCard}>
                <h2 className={styles.formCardTitle}><HiOutlineBanknotes /> Método de Pago</h2>
                <div className={styles.paymentOption}>
                  <div className={styles.paymentRadio}><input type="radio" checked readOnly /></div>
                  <div>
                    <span className={styles.paymentLabel}>Pago contra entrega</span>
                    <span className={styles.paymentDesc}>Paga en efectivo al recibir tu pedido</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right - Summary */}
            <div className={styles.summarySection}>
              <div className={styles.summaryCard}>
                <h2 className={styles.summaryTitle}>Resumen del Pedido</h2>
                <div className={styles.summaryItems}>
                  {items.map((item) => (
                    <div key={item.key} className={styles.summaryItem}>
                      {item.image && <img src={item.image} alt={item.name} className={styles.summaryItemImg} />}
                      <div className={styles.summaryItemInfo}>
                        <span className={styles.summaryItemName}>{item.name}</span>
                        <span className={styles.summaryItemQty}>x{item.quantity}</span>
                      </div>
                      <span className={styles.summaryItemPrice}>{showPricesVal ? `$${formatPrice(item.price * item.quantity)}` : "—"}</span>
                    </div>
                  ))}
                </div>

                <div className={styles.summaryDivider} />
                <div className={styles.summaryRow}><span>Subtotal</span><span>{showPricesVal ? `$${formatPrice(totalPrice)}` : "—"}</span></div>
                <div className={styles.summaryRow}><span>Envío</span><span>{showPricesVal ? (shippingCost === 0 ? "Gratis" : `$${formatPrice(shippingCost)}`) : "—"}</span></div>
                {shippingConfig?.freeShipping && shippingConfig?.freeShippingMin > 0 && totalPrice < shippingConfig.freeShippingMin && showPricesVal && (
                  <p className={styles.freeShippingHint}>Envío gratis a partir de ${formatPrice(shippingConfig.freeShippingMin)}</p>
                )}
                <div className={styles.summaryDivider} />
                <div className={styles.summaryTotal}><span>Total</span><span>{showPricesVal ? `$${formatPrice(grandTotal)}` : "Consultar precio"}</span></div>
                <PriceNoticeBanner variant="checkout" />
                <div className={styles.termsCheckbox}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                    />
                    <span>Acepto los <Link to="/terminos-y-condiciones" target="_blank" className={styles.termsLink}>Términos y Condiciones</Link> y la <Link to="/politica-de-privacidad" target="_blank" className={styles.termsLink}>Política de Privacidad</Link></span>
                  </label>
                </div>
                <button type="submit" className={styles.submitBtn} disabled={saving || !acceptTerms}>{saving ? "Procesando..." : "Confirmar Pedido"}</button>
              </div>
            </div>
          </form>
        </div>
      </main>

      {/* Login Required Modal */}
      {showLoginModal && (
        <div className={styles.modalOverlay} onClick={() => setShowLoginModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setShowLoginModal(false)}>&times;</button>
            <div className={styles.modalIcon}><HiOutlineShoppingCart /></div>
            <h2 className={styles.modalTitle}>Inicia sesión para confirmar tu pedido</h2>
            <p className={styles.modalText}>
              Para poder procesar y dar seguimiento a tu compra, es necesario que inicies sesión o te registres con tu cuenta de Google.
            </p>
            <p className={styles.modalSubtext}>
              Esto nos permite asignarte un número de pedido correlativo y enviarte la confirmación por correo electrónico.
            </p>
            {loginRedirecting ? (
              <div className={styles.modalLoading}>
                <div className={styles.spinner} />
                <p>Redirigiendo...</p>
              </div>
            ) : (
              <button
                className={styles.modalLoginBtn}
                onClick={async () => {
                  setLoginRedirecting(true);
                  try {
                    await loginWithGoogle();
                  } catch (err) {
                    console.error("Login failed:", err);
                    setLoginRedirecting(false);
                  }
                }}
              >
                Continuar con Google
              </button>
            )}
            <p className={styles.modalHint}>
              Al iniciar sesión aceptas nuestros <Link to="/terminos-y-condiciones" target="_blank" className={styles.termsLink}>Términos y Condiciones</Link>.
            </p>
          </div>
        </div>
      )}

      <StoreFooter />
    </div>
  );
}
