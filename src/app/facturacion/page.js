"use client";

import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { getOrdersByEmail, saveOrder, getStoreSettings, searchProducts } from "@/lib/firestore";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import { generateOrderInvoice } from "@/lib/invoice";
import {
  HiOutlineArrowDownTray, HiOutlineXMark, HiOutlinePlus,
  HiOutlineMinus, HiOutlineTrash, HiOutlineMagnifyingGlass,
  HiOutlineDocumentText, HiOutlineCheckCircle, HiOutlineExclamationCircle,
} from "react-icons/hi2";
import styles from "./facturacion.module.css";

const STATUS_LABELS = { pending: "Pendiente", confirmed: "Confirmado", shipped: "Enviado", completed: "Completado", cancelled: "Cancelado" };
const STATUS_CLASSES = { pending: "status_pending", confirmed: "status_confirmed", shipped: "status_shipped", completed: "status_completed", cancelled: "status_cancelled" };

function toast(msg, type) {
  const el = document.createElement("div");
  el.className = `toast ${type === "success" ? "toast-success" : "toast-error"}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

export default function FacturacionPage() {
  const { user, loading: authLoading } = useAuth();
  const { settings } = useStore();
  const router = useRouter();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filterTab, setFilterTab] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) loadPedidos();
  }, [user]);

  const loadPedidos = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getOrdersByEmail(user.email);
      setPedidos(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (order) => {
    try {
      const origin = window.location.origin;
      const doc = await generateOrderInvoice(order, settings, origin);
      const name = `Factura_${(order.id || "0000").substring(0, 8).toUpperCase()}.pdf`;
      doc.save(name);
    } catch (err) {
      toast("Error al generar el PDF", "error");
    }
  };

  const filteredPedidos = pedidos.filter(p => filterTab === "all" || p.status === filterTab);

  if (authLoading || !user) {
    return <div className="loading-screen"><div className="spinner" /></div>;
  }

  return (
    <div className={styles.page}>
      <StoreHeader />
      <main className={styles.main}>
        <div className={`container ${styles.container}`}>
          <div className={styles.headerRow}>
            <div>
              <h1 className={styles.title}>Facturación</h1>
              <p className={styles.subtitle}>
                {user.displayName || user.email?.split("@")[0] || "Usuario"}, aquí puedes gestionar tus comprobantes.
              </p>
            </div>
            <button className={styles.newOrderBtn} onClick={() => setModalOpen(true)}>
              <HiOutlinePlus size={20} /> Nuevo Pedido
            </button>
          </div>

          <div className={styles.tabs}>
            {[
              { key: "all", label: "Todos" },
              { key: "pending", label: "Pendientes" },
              { key: "confirmed", label: "Confirmados" },
              { key: "shipped", label: "Enviados" },
              { key: "completed", label: "Completados" },
              { key: "cancelled", label: "Cancelados" },
            ].map(t => (
              <button
                key={t.key}
                className={`${styles.tab} ${filterTab === t.key ? styles.tabActive : ""}`}
                onClick={() => setFilterTab(t.key)}
              >
                {t.label}
                {t.key !== "all" && (
                  <span className={styles.tabCount}>
                    {pedidos.filter(p => p.status === t.key).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div className={styles.centerState}>
              <div className="spinner" />
              <p>Cargando pedidos...</p>
            </div>
          ) : filteredPedidos.length === 0 ? (
            <div className={styles.emptyState}>
              <HiOutlineDocumentText size={48} />
              <h2>{filterTab === "all" ? "Aún no tienes pedidos" : "No hay pedidos en este estado"}</h2>
              <p>{filterTab === "all" ? "Cuando realices tu primera compra, aparecerá aquí." : "Prueba cambiando el filtro."}</p>
              {filterTab === "all" && (
                <button className={styles.shopBtn} onClick={() => setModalOpen(true)}>
                  Crear Nuevo Pedido
                </button>
              )}
            </div>
          ) : (
            <div className={styles.ordersList}>
              {filteredPedidos.map(pedido => (
                <div key={pedido.id} className={styles.orderCard}>
                  <div className={styles.orderCardTop}>
                    <div className={styles.orderCardLeft}>
                      <span className={styles.orderId}>#{(pedido.id || "").slice(-6).toUpperCase()}</span>
                      <span className={`${styles.statusBadge} ${styles[STATUS_CLASSES[pedido.status] || "status_pending"]}`}>
                        {STATUS_LABELS[pedido.status] || "Pendiente"}
                      </span>
                      {pedido.invoice?.wantsInvoice && <span className={styles.invoiceBadge}>Factura</span>}
                    </div>
                    <span className={styles.orderDate}>
                      {pedido.createdAt?.toDate
                        ? pedido.createdAt.toDate().toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" })
                        : "—"}
                    </span>
                  </div>
                  <div className={styles.orderCardBody}>
                    <div className={styles.orderItems}>
                      {(pedido.items || []).slice(0, 3).map((item, i) => (
                        <span key={i} className={styles.orderItemChip}>
                          {item.image && <img src={item.image} alt="" className={styles.itemChipImg} />}
                          {item.name} x{item.quantity}
                        </span>
                      ))}
                      {(pedido.items || []).length > 3 && (
                        <span className={styles.moreItems}>+{pedido.items.length - 3} más</span>
                      )}
                    </div>
                  </div>
                  <div className={styles.orderCardFooter}>
                    <div className={styles.footerLeft}>
                      {pedido.invoice?.wantsInvoice && (
                        <div className={styles.fiscalInfo}>
                          {pedido.invoice.taxId && <span>NIT: {pedido.invoice.taxId}</span>}
                        </div>
                      )}
                    </div>
                    <div className={styles.footerRight}>
                      <span className={styles.orderTotal}>${(pedido.total || 0).toLocaleString("es-MX")}</span>
                      <div className={styles.orderActions}>
                        <button className={styles.actionBtn} onClick={() => setSelectedOrder(pedido)} title="Ver detalle">👁</button>
                        <button className={styles.actionBtn} onClick={() => handleDownloadPDF(pedido)} title="Descargar PDF">
                          <HiOutlineArrowDownTray size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedOrder && (
        <div className={styles.modalOverlay} onClick={() => setSelectedOrder(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Pedido #{(selectedOrder.id || "").slice(-6).toUpperCase()}</h2>
              <button className={styles.closeBtn} onClick={() => setSelectedOrder(null)}>
                <HiOutlineXMark size={22} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalSection}>
                <h3>Estado</h3>
                <span className={`${styles.statusBadge} ${styles[STATUS_CLASSES[selectedOrder.status] || "status_pending"]}`}>
                  {STATUS_LABELS[selectedOrder.status] || "Pendiente"}
                </span>
                <p className={styles.orderDate}>
                  {selectedOrder.createdAt?.toDate
                    ? selectedOrder.createdAt.toDate().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </p>
              </div>
              <div className={styles.modalSection}>
                <h3>Artículos</h3>
                {(selectedOrder.items || []).map((item, i) => (
                  <div key={i} className={styles.detailItem}>
                    {item.image && <img src={item.image} alt="" className={styles.detailItemImg} />}
                    <div className={styles.detailItemInfo}>
                      <span className={styles.detailItemName}>{item.name}{item.variant ? ` (${item.variant})` : ""}</span>
                      <span className={styles.detailItemMeta}>SKU: {item.sku || item.barcode || "-"}</span>
                    </div>
                    <span className={styles.detailItemQty}>x{item.quantity}</span>
                    <span className={styles.detailItemPrice}>${(item.price * item.quantity).toLocaleString("es-MX")}</span>
                  </div>
                ))}
              </div>
              <div className={styles.modalSection}>
                <h3>Cliente</h3>
                <p>{selectedOrder.customer?.name}<br/>{selectedOrder.customer?.email}<br/>{selectedOrder.customer?.phone}</p>
              </div>
              {selectedOrder.invoice?.wantsInvoice && (
                <div className={styles.modalSection}>
                  <h3>Datos Fiscales</h3>
                  <p>Razón Social: {selectedOrder.invoice.businessName}<br/>
                     NIT: {selectedOrder.invoice.taxId}<br/>
                     NRC: {selectedOrder.invoice.nrc || ""}<br/>
                     Giro: {selectedOrder.invoice.businessType}</p>
                </div>
              )}
              <div className={styles.modalSection}>
                <h3>Totales</h3>
                <div className={styles.totalLine}><span>Subtotal</span><span>${(selectedOrder.subtotal || 0).toLocaleString("es-MX")}</span></div>
                {selectedOrder.discount > 0 && <div className={styles.totalLine}><span>Descuento</span><span>-${(selectedOrder.discount || 0).toLocaleString("es-MX")}</span></div>}
                <div className={styles.totalLine}><span>Envío</span><span>{selectedOrder.shipping === 0 ? "Gratis" : `$${(selectedOrder.shipping || 0).toLocaleString("es-MX")}`}</span></div>
                <div className={`${styles.totalLine} ${styles.totalLineGrand}`}><span>Total</span><span>${(selectedOrder.total || 0).toLocaleString("es-MX")}</span></div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.downloadBtn} onClick={() => { handleDownloadPDF(selectedOrder); setSelectedOrder(null); }}>
                <HiOutlineArrowDownTray size={20} /> Descargar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <NuevoPedidoModal
          settings={settings}
          user={user}
          onClose={() => setModalOpen(false)}
          onSuccess={() => { setModalOpen(false); loadPedidos(); }}
        />
      )}

      <StoreFooter />
    </div>
  );
}

const STEPS = [
  { key: "productos", label: "Productos", icon: "🛒" },
  { key: "cliente", label: "Cliente", icon: "👤" },
  { key: "confirmar", label: "Confirmar", icon: "✅" },
];

function NuevoPedidoModal({ settings, user, onClose, onSuccess }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState("forward");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  const [customer, setCustomer] = useState({
    name: user?.displayName || "",
    email: user?.email || "",
    phone: "",
    address: "",
    city: "",
  });
  const [wantsInvoice, setWantsInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState({ businessName: "", taxId: "", nrc: "", businessType: "" });
  const [discount, setDiscount] = useState(0);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (searchRef.current) searchRef.current.focus();
  }, []);

  useEffect(() => {
    if (step === 0 && searchRef.current) searchRef.current.focus();
  }, [step]);

  const goTo = (nextStep) => {
    if (step === 0 && items.length === 0) {
      setErrors({ items: "Agrega al menos un producto" });
      return;
    }
    if (step === 1) {
      const errs = {};
      if (!customer.name.trim()) errs.name = "Requerido";
      if (!customer.email.trim()) errs.email = "Requerido";
      if (!customer.phone.trim()) errs.phone = "Requerido";
      if (wantsInvoice) {
        if (!invoiceData.businessName.trim()) errs.businessName = "Requerido";
        if (!invoiceData.taxId.trim()) errs.taxId = "Requerido";
      }
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        return;
      }
    }
    setDirection(nextStep > step ? "forward" : "back");
    setErrors({});
    setStep(nextStep);
  };

  const handleSearch = useCallback(async (term) => {
    setSearchTerm(term);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (term.length < 2) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchProducts(term);
        setSearchResults(results);
      } catch (e) {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const addItem = (product) => {
    const key = `${product.id}_`;
    const existing = items.find(i => i.key === key);
    if (existing) {
      setItems(items.map(i => i.key === key ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setItems([...items, {
        key,
        productId: product.id,
        name: product.name,
        price: product.price || 0,
        quantity: 1,
        image: product.images?.[0] || "",
        sku: product.sku || "",
        barcode: product.barcode || "",
      }]);
    }
    setSearchTerm("");
    setSearchResults([]);
    setErrors({});
    if (searchRef.current) searchRef.current.focus();
  };

  const updateQty = (key, delta) => {
    setItems(items.map(i => i.key === key ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));
  };

  const removeItem = (key) => {
    setItems(items.filter(i => i.key !== key));
  };

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const total = Math.max(0, subtotal - discount);

  const handleGenerate = async () => {
    setSaving(true);
    try {
      const orderData = {
        items: items.map(i => ({
          productId: i.productId,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          image: i.image,
          sku: i.sku,
          barcode: i.barcode,
        })),
        subtotal,
        discount: Number(discount) || 0,
        shipping: 0,
        total,
        customer: { name: customer.name, email: customer.email, phone: customer.phone, address: customer.address, city: customer.city },
        userId: user?.uid || null,
        status: "pending",
        paymentMethod: "cashOnDelivery",
        paymentStatus: "pending",
        source: "facturacion",
        invoice: wantsInvoice ? { wantsInvoice: true, ...invoiceData } : null,
      };

      const id = await saveOrder(null, orderData);
      const fullOrder = { ...orderData, id };

      const { getStoreSettings: fetchSettings } = await import("@/lib/firestore");
      const freshSettings = await fetchSettings() || settings;
      let logoBase64 = null;
      if (freshSettings?.logo) {
        if (freshSettings.logo.startsWith("data:")) {
          logoBase64 = freshSettings.logo;
        } else {
          try {
            const res = await fetch(freshSettings.logo);
            const blob = await res.blob();
            logoBase64 = await new Promise((resolve) => {
              const img = new Image();
              img.crossOrigin = "anonymous";
              const url = URL.createObjectURL(blob);
              img.onload = () => {
                const c = document.createElement("canvas");
                c.width = img.width;
                c.height = img.height;
                c.getContext("2d").drawImage(img, 0, 0);
                URL.revokeObjectURL(url);
                resolve(c.toDataURL("image/png"));
              };
              img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
              img.src = url;
            });
          } catch (e) {
            logoBase64 = null;
          }
        }
      }
      const settingsWithLogo = { ...freshSettings, logo: logoBase64 };

      try {
        const origin = window.location.origin;
        const doc = await generateOrderInvoice(fullOrder, settingsWithLogo, origin);
        doc.save(`Factura_${(id || "0000").substring(0, 8).toUpperCase()}.pdf`);
      } catch (pdfErr) {
        console.error("PDF error:", pdfErr);
      }

      try {
        const doc = await generateOrderInvoice(fullOrder, settingsWithLogo, window.location.origin);
        const pdfBase64 = doc.output("datauristring").split(",")[1];
        await fetch("/api/send-order-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: fullOrder, storeSettings: freshSettings, pdfBase64: pdfBase64 || "" }),
        });
      } catch (mailErr) {
        console.error("Email error:", mailErr);
      }

      toast("Pedido creado y PDF descargado", "success");
      onSuccess();
    } catch (err) {
      console.error(err);
      toast("Error al crear el pedido", "error");
    } finally {
      setSaving(false);
    }
  };

  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className={styles.wizardOverlay} onClick={onClose}>
      <div className={styles.wizardModal} onClick={e => e.stopPropagation()}>
        <div className={styles.wizardHeader}>
          <div className={styles.wizardTitleRow}>
            <HiOutlinePlus size={22} />
            <span>Nuevo Pedido</span>
            {itemCount > 0 && <span className={styles.itemCountBadge}>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>}
          </div>
          <button className={styles.closeBtn} onClick={onClose}><HiOutlineXMark size={22} /></button>
        </div>

        <div className={styles.stepper}>
          {STEPS.map((s, i) => (
            <div key={s.key} className={`${styles.step} ${i === step ? styles.stepActive : ""} ${i < step ? styles.stepDone : ""}`}>
              <div className={styles.stepCircle}>
                {i < step ? <HiOutlineCheckCircle size={18} /> : <span>{s.icon}</span>}
              </div>
              <span className={styles.stepLabel}>{s.label}</span>
              {i < STEPS.length - 1 && <div className={`${styles.stepLine} ${i < step ? styles.stepLineDone : ""}`} />}
            </div>
          ))}
        </div>

        <div className={styles.wizardBody}>
          <div className={`${styles.wizardStep} ${direction === "forward" ? styles.slideInRight : styles.slideInLeft}`} key={step}>
            {step === 0 && (
              <div className={styles.stepContent}>
                <div className={styles.searchSection}>
                  <div className={styles.searchInputWrap}>
                    <HiOutlineMagnifyingGlass size={18} className={styles.searchIcon} />
                    <input
                      ref={searchRef}
                      type="text"
                      className={styles.searchInput}
                      placeholder="Buscar producto por nombre, código o SKU..."
                      value={searchTerm}
                      onChange={e => handleSearch(e.target.value)}
                    />
                    {searching && <span className={styles.searchSpinner}>Buscando...</span>}
                  </div>
                  {searchResults.length > 0 && (
                    <div className={styles.searchDropdown}>
                      {searchResults.map(p => (
                        <div key={p.id} className={styles.searchResultItem} onClick={() => addItem(p)}>
                          <img src={p.images?.[0] || ""} alt={p.name} className={styles.searchResultImg} />
                          <div className={styles.searchResultInfo}>
                            <span className={styles.searchResultName}>{p.name}</span>
                            <span className={styles.searchResultSku}>SKU: {p.sku || "-"} | Stock: {p.stock ?? "—"}</span>
                          </div>
                          <div className={styles.searchResultRight}>
                            <span className={styles.searchResultPrice}>${(p.price || 0).toLocaleString()}</span>
                            <span className={styles.addHint}>+ Agregar</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={styles.itemsHeader}>
                  <h3>
                    <span className={styles.cartIcon}><HiOutlineDocumentText size={18} /></span>
                    Productos a facturar
                  </h3>
                  {items.length > 0 && <span className={styles.itemsCount}>{items.length} producto{items.length !== 1 ? "s" : ""}</span>}
                </div>

                {errors.items && <p className={styles.fieldError}>{errors.items}</p>}

                {items.length === 0 ? (
                  <div className={styles.emptyItemsWizard}>
                    <div className={styles.emptyIcon}>📦</div>
                    <p>Busca y agrega productos usando la barra de búsqueda</p>
                  </div>
                ) : (
                  <div className={styles.itemsListWizard}>
                    {items.map(item => (
                      <div key={item.key} className={styles.invoiceItemCard}>
                        <div className={styles.invoiceItemLeft}>
                          {item.image && <img src={item.image} alt="" className={styles.invoiceItemImg} />}
                          <div className={styles.invoiceItemInfo}>
                            <span className={styles.invoiceItemName}>{item.name}</span>
                            <span className={styles.invoiceItemSku}>SKU: {item.sku || "-"}, ${item.price.toLocaleString()} c/u</span>
                          </div>
                        </div>
                        <div className={styles.invoiceItemRight}>
                          <div className={styles.invoiceItemControls}>
                            <button className={styles.qtyBtnWizard} onClick={() => updateQty(item.key, -1)} disabled={item.quantity <= 1}>
                              <HiOutlineMinus size={14} />
                            </button>
                            <span className={styles.qtyValueWizard}>{item.quantity}</span>
                            <button className={styles.qtyBtnWizard} onClick={() => updateQty(item.key, 1)}>
                              <HiOutlinePlus size={14} />
                            </button>
                          </div>
                          <span className={styles.invoiceItemTotalWizard}>${(item.price * item.quantity).toLocaleString()}</span>
                          <button className={styles.removeItemBtnWizard} onClick={() => removeItem(item.key)} title="Eliminar">
                            <HiOutlineTrash size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {items.length > 0 && (
                  <div className={styles.subtotalPreview}>
                    <span>Subtotal ({itemCount} items)</span>
                    <span>${subtotal.toLocaleString("es-MX")}</span>
                  </div>
                )}
              </div>
            )}

            {step === 1 && (
              <div className={styles.stepContent}>
                <div className={styles.stepIntro}>
                  <span className={styles.stepIntroIcon}>👤</span>
                  <div>
                    <h3>Datos del Cliente</h3>
                    <p>Completa la información del cliente para este pedido</p>
                  </div>
                </div>

                <div className={styles.customerGridWizard}>
                  <div className={styles.formGroupWizard}>
                    <label className={styles.formLabelWizard}>Nombre completo *</label>
                    <input type="text" className={`${styles.formInputWizard} ${errors.name ? styles.formInputError : ""}`}
                      value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })}
                      placeholder="Ej: Juan Pérez" />
                    {errors.name && <p className={styles.fieldError}>{errors.name}</p>}
                  </div>
                  <div className={styles.formGroupWizard}>
                    <label className={styles.formLabelWizard}>Email *</label>
                    <input type="email" className={`${styles.formInputWizard} ${errors.email ? styles.formInputError : ""}`}
                      value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })}
                      placeholder="correo@ejemplo.com" />
                    {errors.email && <p className={styles.fieldError}>{errors.email}</p>}
                  </div>
                  <div className={styles.formGroupWizard}>
                    <label className={styles.formLabelWizard}>Teléfono *</label>
                    <input type="tel" className={`${styles.formInputWizard} ${errors.phone ? styles.formInputError : ""}`}
                      value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })}
                      placeholder="+52 123 456 7890" />
                    {errors.phone && <p className={styles.fieldError}>{errors.phone}</p>}
                  </div>
                  <div className={styles.formGroupWizard}>
                    <label className={styles.formLabelWizard}>Dirección</label>
                    <input type="text" className={styles.formInputWizard}
                      value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })}
                      placeholder="Calle, número, colonia" />
                  </div>
                  <div className={styles.formGroupWizard}>
                    <label className={styles.formLabelWizard}>Ciudad</label>
                    <input type="text" className={styles.formInputWizard}
                      value={customer.city} onChange={e => setCustomer({ ...customer, city: e.target.value })}
                      placeholder="Ciudad" />
                  </div>
                </div>

                <div className={styles.invoiceToggleWizard}>
                  <button
                    type="button"
                    className={`${styles.invoiceToggleBtn} ${wantsInvoice ? styles.invoiceToggleBtnActive : ""}`}
                    onClick={() => setWantsInvoice(!wantsInvoice)}
                  >
                    <span className={styles.invoiceToggleIcon}>{wantsInvoice ? "🧾" : "➕"}</span>
                    <span>{wantsInvoice ? "Factura fiscal activada" : "¿Requiere factura fiscal?"}</span>
                  </button>
                </div>

                {wantsInvoice && (
                  <div className={`${styles.invoiceFieldsWizard} ${styles.slideDown}`}>
                    <div className={styles.invoiceFieldsHeader}>
                      <span className={styles.invoiceFieldsIcon}>🧾</span>
                      <span>Datos fiscales</span>
                    </div>
                    <div className={styles.customerGridWizard}>
                      <div className={styles.formGroupWizard}>
                        <label className={styles.formLabelWizard}>Razón Social *</label>
                        <input type="text" className={`${styles.formInputWizard} ${errors.businessName ? styles.formInputError : ""}`}
                          value={invoiceData.businessName} onChange={e => setInvoiceData({ ...invoiceData, businessName: e.target.value })}
                          placeholder="Nombre o razón social" />
                        {errors.businessName && <p className={styles.fieldError}>{errors.businessName}</p>}
                      </div>
                      <div className={styles.formGroupWizard}>
                        <label className={styles.formLabelWizard}>NIT *</label>
                        <input type="text" className={`${styles.formInputWizard} ${errors.taxId ? styles.formInputError : ""}`}
                          value={invoiceData.taxId} onChange={e => setInvoiceData({ ...invoiceData, taxId: e.target.value })}
                          placeholder="0614-123456-001-0" />
                        {errors.taxId && <p className={styles.fieldError}>{errors.taxId}</p>}
                      </div>
                      <div className={styles.formGroupWizard}>
                        <label className={styles.formLabelWizard}>NRC</label>
                        <input type="text" className={styles.formInputWizard}
                          value={invoiceData.nrc} onChange={e => setInvoiceData({ ...invoiceData, nrc: e.target.value })}
                          placeholder="Número de Registro" />
                      </div>
                      <div className={styles.formGroupWizard}>
                        <label className={styles.formLabelWizard}>Giro</label>
                        <input type="text" className={styles.formInputWizard}
                          value={invoiceData.businessType} onChange={e => setInvoiceData({ ...invoiceData, businessType: e.target.value })}
                          placeholder="Actividad comercial" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className={styles.stepContent}>
                <div className={styles.stepIntro}>
                  <span className={styles.stepIntroIcon}>✅</span>
                  <div>
                    <h3>Confirmar Pedido</h3>
                    <p>Revisa el resumen antes de generar la factura</p>
                  </div>
                </div>

                <div className={styles.confirmSection}>
                  <h4>Productos</h4>
                  <div className={styles.confirmItems}>
                    {items.map(item => (
                      <div key={item.key} className={styles.confirmItemRow}>
                        <span className={styles.confirmItemName}>{item.quantity}x {item.name}</span>
                        <span className={styles.confirmItemPrice}>${(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.confirmDivider} />

                <div className={styles.confirmSection}>
                  <h4>Cliente</h4>
                  <div className={styles.confirmCustomer}>
                    <p><strong>Nombre:</strong> {customer.name}</p>
                    <p><strong>Email:</strong> {customer.email}</p>
                    {customer.phone && <p><strong>Teléfono:</strong> {customer.phone}</p>}
                    {customer.address && <p><strong>Dirección:</strong> {customer.address}</p>}
                    {customer.city && <p><strong>Ciudad:</strong> {customer.city}</p>}
                  </div>
                  {wantsInvoice && (
                    <div className={styles.confirmInvoiceTag}>
                      <span>🧾</span>
                      <span>Factura fiscal: {invoiceData.businessName} | NIT: {invoiceData.taxId}</span>
                    </div>
                  )}
                </div>

                <div className={styles.confirmDivider} />

                <div className={styles.confirmTotals}>
                  <div className={styles.confirmTotalsRow}>
                    <span>Subtotal ({itemCount} items)</span>
                    <span>${subtotal.toLocaleString("es-MX")}</span>
                  </div>
                  <div className={styles.confirmTotalsRow}>
                    <span>Descuento</span>
                    <div className={styles.confirmDiscountWrap}>
                      <span>$</span>
                      <input type="number" className={styles.confirmDiscountInput}
                        value={discount} onChange={e => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                        min="0" />
                    </div>
                  </div>
                  <div className={`${styles.confirmTotalsRow} ${styles.confirmTotalGrand}`}>
                    <span>Total</span>
                    <span>${total.toLocaleString("es-MX")}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.wizardFooter}>
          {step > 0 ? (
            <button className={styles.wizardBackBtn} onClick={() => goTo(step - 1)}>
              ← Atrás
            </button>
          ) : (
            <button className={styles.wizardCancelBtn} onClick={onClose}>Cancelar</button>
          )}

          <div className={styles.wizardFooterRight}>
            {step < 2 ? (
              <button className={styles.wizardNextBtn} onClick={() => goTo(step + 1)}>
                {step === 0 ? `Siguiente: Datos →` : `Siguiente: Confirmar →`}
              </button>
            ) : (
              <button className={styles.wizardGenerateBtn} onClick={handleGenerate} disabled={saving}>
                {saving ? (
                  <span className={styles.savingSpinner}>Procesando...</span>
                ) : (
                  <><HiOutlineCheckCircle size={20} /> Generar Factura y Descargar PDF</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
