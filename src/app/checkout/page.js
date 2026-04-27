"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import { useCart } from "@/context/CartContext";
import { useStore } from "@/context/StoreContext";
import { useAuth } from "@/context/AuthContext";
import { saveOrder, getCouponByCode, saveCoupon, getShippingConfig } from "@/lib/firestore";
import {
  HiOutlineShoppingCart, HiOutlineTruck, HiOutlineBanknotes,
  HiOutlineCheckCircle, HiOutlineArrowLeft, HiOutlineTicket,
} from "react-icons/hi2";
import Link from "next/link";
import styles from "./checkout.module.css";

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCart();
  const { settings, features } = useStore();
  const { user } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState("form");
  const [saving, setSaving] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [form, setForm] = useState({
    name: user?.displayName || "", 
    email: user?.email || "", 
    phone: "", address: "", city: "", state: "", zipCode: "", notes: "",
    // Factura fiscal
    wantsInvoice: false, businessName: "", taxId: "", nrc: "", businessType: "",
  });

  // Coupon
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  // Shipping
  const [shippingConfig, setShippingConfig] = useState(null);
  const [selectedZone, setSelectedZone] = useState("");

  useEffect(() => {
    loadShipping();
  }, []);

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

  // Calculate discount
  const getDiscount = () => {
    if (!coupon) return 0;
    if (coupon.type === "percentage") return Math.round(totalPrice * (coupon.value / 100));
    return Math.min(coupon.value, totalPrice);
  };

  const shippingCost = getShippingCost();
  const discount = getDiscount();
  const grandTotal = Math.max(0, totalPrice - discount + shippingCost);

  const handleChange = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setApplyingCoupon(true);
    setCouponError("");
    try {
      const c = await getCouponByCode(couponCode.trim());
      if (!c) { setCouponError("Cupón no válido"); setCoupon(null); return; }
      if (!c.isActive) { setCouponError("Este cupón ya no está activo"); setCoupon(null); return; }
      if (c.expiresAt && new Date(c.expiresAt) < new Date()) { setCouponError("Este cupón ha expirado"); setCoupon(null); return; }
      if (c.maxUses > 0 && (c.usedCount || 0) >= c.maxUses) { setCouponError("Este cupón ha alcanzado su límite de uso"); setCoupon(null); return; }
      if (c.minPurchase > 0 && totalPrice < c.minPurchase) { setCouponError(`Compra mínima de $${c.minPurchase.toLocaleString()}`); setCoupon(null); return; }
      setCoupon(c);
    } catch (err) { setCouponError("Error al verificar el cupón"); }
    finally { setApplyingCoupon(false); }
  };

  const handleRemoveCoupon = () => { setCoupon(null); setCouponCode(""); setCouponError(""); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) return;

    // Validación de factura fiscal - Campos ahora opcionales según solicitud
    if (form.wantsInvoice) {
      // Solo se validan si el usuario lo requiere, pero se permiten vacíos por ahora
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
        subtotal: totalPrice, shipping: shippingCost, discount, total: grandTotal,
        coupon: coupon ? { code: coupon.code, type: coupon.type, value: coupon.value } : null,
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
      // Increment coupon usage
      if (coupon) {
        await saveCoupon(coupon.id, { usedCount: (coupon.usedCount || 0) + 1 });
      }
      const id = await saveOrder(null, orderData);
      setOrderId(id);
      
      // Intentar enviar correo
      try {
        let pdfBase64 = null;
        try {
          // Convert logo URL to Base64 for the PDF
          let logoBase64 = null;
          if (settings?.logo) {
            console.log("Checkout: Fetching logo for PDF:", settings.logo);
            try {
              const logores = await fetch(settings.logo);
              if (!logores.ok) throw new Error("Fetch failed: " + logores.status);
              const blob = await logores.blob();
              
              // Use an Image and Canvas to ensure it's a PNG for the PDF
              const img = new Image();
              img.crossOrigin = "anonymous"; // Essential for CORS
              const url = URL.createObjectURL(blob);
              
              logoBase64 = await new Promise((resolve, reject) => {
                img.onload = () => {
                  const canvas = document.createElement("canvas");
                  canvas.width = img.width;
                  canvas.height = img.height;
                  const ctx = canvas.getContext("2d");
                  ctx.drawImage(img, 0, 0);
                  const dataUrl = canvas.toDataURL("image/png");
                  URL.revokeObjectURL(url);
                  resolve(dataUrl);
                };
                img.onerror = () => {
                  URL.revokeObjectURL(url);
                  reject(new Error("Image load failed"));
                };
                img.src = url;
              });
              
              console.log("Checkout: Logo converted to PNG base64, length:", logoBase64?.length);
            } catch (e) { 
              console.error("Checkout: Failed to load/convert logo for PDF", e);
              // Fallback: if it's already a data URI or we failed conversion
              if (settings.logo?.startsWith("data:image")) {
                logoBase64 = settings.logo;
              }
            }
          } else {
            console.warn("Checkout: No logo URL in settings");
          }

          const { generateOrderInvoice } = await import("@/lib/invoice");
          const doc = generateOrderInvoice({ ...orderData, id }, { ...settings, logo: logoBase64 });
          pdfBase64 = doc.output("datauristring").split(",")[1];
        } catch (pdfErr) {
          console.error("Error al generar PDF de factura:", pdfErr);
        }

        // Read fresh settings from Firestore to ensure notifications are up to date
        const { getStoreSettings } = await import("@/lib/firestore");
        let freshSettings = settings;
        try {
          const firestoreSettings = await getStoreSettings();
          if (firestoreSettings) freshSettings = firestoreSettings;
        } catch (e) {
          console.warn("Could not fetch fresh settings, using context settings");
        }

        console.log("Checkout: notifications:", JSON.stringify(freshSettings?.notifications));

        const response = await fetch("/api/send-order-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order: { ...orderData, id },
            storeSettings: freshSettings,
            pdfBase64: pdfBase64 || ""
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          console.error("Email API failed:", errData);
        } else {
          const result = await response.json();
          console.log("Email sent to:", result.recipients);
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
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <StoreHeader />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", padding: "4rem 1.5rem" }}>
            <HiOutlineShoppingCart style={{ fontSize: "3rem", color: "var(--color-border)", marginBottom: "1rem" }} />
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>Carrito Vacío</h2>
            <p style={{ color: "var(--color-muted)", marginBottom: "1.5rem" }}>Agrega productos antes de realizar un pedido.</p>
            <Link href="/productos" className="btn btn-primary">Ver Productos</Link>
          </div>
        </main>
        <StoreFooter />
      </div>
    );
  }

  if (step === "success") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <StoreHeader />
        <main className={styles.successMain}>
          <div className={styles.successCard}>
            <div className={styles.successIcon}><HiOutlineCheckCircle /></div>
            <h1 className={styles.successTitle}>¡Pedido Realizado!</h1>
            <p className={styles.successText}>Tu pedido ha sido registrado exitosamente. Próximamente nos pondremos en contacto contigo.</p>
            {orderId && <p className={styles.orderId}>Número de pedido: <strong>{orderId.substring(0, 8).toUpperCase()}</strong></p>}
            <div className={styles.paymentNote}><HiOutlineBanknotes /><span>Pago contra entrega — pagarás al recibir tu pedido</span></div>
            <div className={styles.successActions}>
              <Link href="/productos" className="btn btn-primary btn-lg">Seguir Comprando</Link>
              <Link href="/" className="btn btn-ghost btn-lg">Ir al Inicio</Link>
            </div>
          </div>
        </main>
        <StoreFooter />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <StoreHeader />
      <main className={styles.main}>
        <div className="container">
          <Link href="/productos" className={styles.backLink}><HiOutlineArrowLeft /> Seguir comprando</Link>
          <h1 className={styles.pageTitle}>Finalizar Compra</h1>

          <form onSubmit={handleSubmit} className={styles.checkoutGrid}>
            {/* Left - Form */}
            <div className={styles.formSection}>
              {/* Contact */}
              <div className={styles.formCard}>
                <h2 className={styles.formCardTitle}>Información de Contacto</h2>
                <div className={styles.formRow}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Nombre Completo *</label>
                    <input type="text" className="form-input" value={form.name} onChange={(e) => handleChange("name", e.target.value)} required placeholder="Tu nombre completo" />
                  </div>
                </div>
                <div className={styles.formRow}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Email *</label>
                    <input type="email" className="form-input" value={form.email} onChange={(e) => handleChange("email", e.target.value)} required placeholder="tu@email.com" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
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
                    <div className="form-row">
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">NIT</label>
                        <input
                          type="text"
                          className="form-input"
                          value={form.taxId}
                          onChange={(e) => handleChange("taxId", e.target.value)}
                          placeholder="Ej: 0614-123456-001-0"
                        />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
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
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Ciudad</label>
                    <input type="text" className="form-input" value={form.city} onChange={(e) => handleChange("city", e.target.value)} placeholder="Ciudad" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Estado</label>
                    <input type="text" className="form-input" value={form.state} onChange={(e) => handleChange("state", e.target.value)} placeholder="Estado" />
                  </div>
                  <div className="form-group" style={{ flex: 0.6 }}>
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
                        <option key={i} value={z.name}>{z.name} (${z.cost?.toLocaleString()})</option>
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
                      <span className={styles.summaryItemPrice}>${(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                {/* Coupon */}
                {features.coupons && (
                  <div className={styles.couponSection}>
                    {coupon ? (
                      <div className={styles.couponApplied}>
                        <div><HiOutlineTicket /> <strong>{coupon.code}</strong> <span>-${discount.toLocaleString()}</span></div>
                        <button type="button" onClick={handleRemoveCoupon} className={styles.couponRemove}>✕</button>
                      </div>
                    ) : (
                      <div className={styles.couponInput}>
                        <input type="text" placeholder="Código de cupón" value={couponCode} onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }} className={styles.couponField} />
                        <button type="button" onClick={handleApplyCoupon} disabled={applyingCoupon || !couponCode.trim()} className={styles.couponBtn}>
                          {applyingCoupon ? "..." : "Aplicar"}
                        </button>
                      </div>
                    )}
                    {couponError && <p className={styles.couponError}>{couponError}</p>}
                  </div>
                )}

                <div className={styles.summaryDivider} />
                <div className={styles.summaryRow}><span>Subtotal</span><span>${totalPrice.toLocaleString()}</span></div>
                {discount > 0 && <div className={styles.summaryRow} style={{ color: "var(--color-success)" }}><span>Descuento</span><span>-${discount.toLocaleString()}</span></div>}
                <div className={styles.summaryRow}><span>Envío</span><span>{shippingCost === 0 ? "Gratis" : `$${shippingCost.toLocaleString()}`}</span></div>
                {shippingConfig?.freeShipping && shippingConfig?.freeShippingMin > 0 && totalPrice < shippingConfig.freeShippingMin && (
                  <p className={styles.freeShippingHint}>Envío gratis a partir de ${shippingConfig.freeShippingMin.toLocaleString()}</p>
                )}
                <div className={styles.summaryDivider} />
                <div className={styles.summaryTotal}><span>Total</span><span>${grandTotal.toLocaleString()}</span></div>
                <button type="submit" className={styles.submitBtn} disabled={saving}>{saving ? "Procesando..." : "Confirmar Pedido"}</button>
              </div>
            </div>
          </form>
        </div>
      </main>
      <StoreFooter />
    </div>
  );
}
