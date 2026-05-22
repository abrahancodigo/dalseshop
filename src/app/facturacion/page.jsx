"use client";

import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback, useRef } from "react";
import { getOrdersByEmail, saveOrder, getStoreSettings, searchProducts, searchCustomers, saveCustomer } from "@/lib/firestore";
import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import { formatPrice } from "@/lib/format";
import { generateOrderInvoice, prepareLogoForPDF } from "@/lib/invoice";
import {
  HiOutlineArrowDownTray, HiOutlineXMark, HiOutlinePlus,
  HiOutlineTrash, HiOutlineMagnifyingGlass,
  HiOutlineDocumentText, HiOutlineCheckCircle,
} from "react-icons/hi2";
import styles from "./facturacion.module.css";

const STATUS_LABELS = { pending: "Pendiente", confirmed: "Confirmado", shipped: "Enviado", completed: "Completado", cancelled: "Cancelado" };
const STATUS_CLASSES = { pending: "status_pending", confirmed: "status_confirmed", shipped: "status_shipped", completed: "status_completed", cancelled: "status_cancelled" };

const fmtOrderNum = (o) => o.orderNumber ? `#${String(o.orderNumber).padStart(4, "0")}` : `#${(o.id || "").slice(-6).toUpperCase()}`;

function toast(msg, type) {
  const el = document.createElement("div");
  el.className = `toast ${type === "success" ? "toast-success" : "toast-error"}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

export default function FacturacionPage() {
  const { user, loading: authLoading } = useAuth();
  const { settings, features } = useStore();
  const showPricesVal = features.showPrices !== false;
  const navigate = useNavigate();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filterTab, setFilterTab] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth/login");
  }, [user, authLoading, navigate]);

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
      const logoBase64 = await prepareLogoForPDF(settings?.logoBase64 || settings?.logo);
      const settingsWithLogo = { ...settings, logo: logoBase64 };
      const doc = await generateOrderInvoice(order, settingsWithLogo, origin, { showPrices: showPricesVal });
      const name = `Factura_${order.orderNumber || (order.id || "0000").substring(0, 8).toUpperCase()}.pdf`;
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
            <div className={styles.compactList}>
              <div className={styles.compactTable}>
                <div className={styles.compactHeader}>
                  <span className={styles.colNum}>#</span>
                  <span className={styles.colDate}>Fecha</span>
                  <span className={styles.colStatus}>Estado</span>
                  <span className={styles.colItems}>Artículos</span>
                  <span className={styles.colTotal}>Total</span>
                  <span className={styles.colActions}>Acciones</span>
                </div>
                {filteredPedidos.map(pedido => (
                  <div key={pedido.id} className={styles.compactRow} onClick={() => setSelectedOrder(pedido)}>
                    <span className={styles.colNum}>
                      <span className={styles.compactOrderNum}>{fmtOrderNum(pedido)}</span>
                    </span>
                    <span className={styles.colDate}>
                      <span className={styles.compactDate}>
                        {pedido.createdAt?.toDate
                          ? pedido.createdAt.toDate().toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" })
                          : "—"}
                      </span>
                    </span>
                    <span className={styles.colStatus}>
                      <span className={`${styles.compactStatus} ${styles[STATUS_CLASSES[pedido.status] || "status_pending"]}`}>
                        {STATUS_LABELS[pedido.status] || "Pendiente"}
                      </span>
                      {pedido.invoice?.wantsInvoice && <span className={styles.compactInvoiceBadge}>F</span>}
                    </span>
                    <span className={styles.colItems}>
                      <span className={styles.compactItems}>
                        {(pedido.items || []).slice(0, 2).map((item, i) => (
                          <span key={i} className={styles.compactItemChip}>{item.name} x{item.quantity}</span>
                        ))}
                        {(pedido.items || []).length > 2 && (
                          <span className={styles.compactMoreItems}>+{pedido.items.length - 2}</span>
                        )}
                      </span>
                    </span>
                    <span className={styles.colTotal}>
                      <span className={styles.compactTotal}>${formatPrice(pedido.total)}</span>
                    </span>
                    <span className={styles.colActions} onClick={e => e.stopPropagation()}>
                      <button className={styles.compactActionBtn} onClick={() => setSelectedOrder(pedido)} title="Ver detalle">
                        <HiOutlineDocumentText size={14} />
                      </button>
                      <button className={styles.compactActionBtn} onClick={() => handleDownloadPDF(pedido)} title="Descargar PDF">
                        <HiOutlineArrowDownTray size={14} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {selectedOrder && (
        <div className={styles.modalOverlay} onClick={() => setSelectedOrder(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Pedido {fmtOrderNum(selectedOrder)}</h2>
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
                    <span className={styles.detailItemPrice}>${formatPrice(item.price * item.quantity)}</span>
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
                <div className={styles.totalLine}><span>Subtotal</span><span>${formatPrice(selectedOrder.subtotal)}</span></div>
                <div className={styles.totalLine}><span>Envío</span><span>{selectedOrder.shipping === 0 ? "Gratis" : `$${formatPrice(selectedOrder.shipping)}`}</span></div>
                <div className={`${styles.totalLine} ${styles.totalLineGrand}`}><span>Total</span><span>${formatPrice(selectedOrder.total)}</span></div>
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

function NuevoPedidoModal({ settings, user, onClose, onSuccess }) {
  const { features } = useStore();
  const showPricesVal = features.showPrices !== false;
  const productSearchRef = useRef(null);
  const customerSearchRef = useRef(null);
  const debounceRef = useRef(null);
  const customerDebounceRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);

  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [customerResults, setCustomerResults] = useState([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [customer, setCustomer] = useState({
    name: user?.displayName || "",
    email: user?.email || "",
    phone: "",
    address: "",
    city: "",
  });
  const [wantsInvoice, setWantsInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState({ businessName: "", taxId: "", nrc: "", businessType: "" });
  const [paymentMethod, setPaymentMethod] = useState("cashOnDelivery");
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (productSearchRef.current) productSearchRef.current.focus();
  }, []);

  const handleProductSearch = useCallback(async (term) => {
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

  const handleCustomerSearch = useCallback(async (term) => {
    setCustomerSearchTerm(term);
    setCustomer(prev => ({ ...prev, name: term }));
    if (customerDebounceRef.current) clearTimeout(customerDebounceRef.current);
    if (term.length < 1) { setCustomerResults([]); setShowCustomerDropdown(false); return; }
    customerDebounceRef.current = setTimeout(async () => {
      setCustomerSearching(true);
      try {
        const results = await searchCustomers(term);
        setCustomerResults(results);
        setShowCustomerDropdown(results.length > 0);
      } catch (e) {
        setCustomerResults([]);
        setShowCustomerDropdown(false);
      } finally {
        setCustomerSearching(false);
      }
    }, 300);
  }, []);

  const selectCustomer = (c) => {
    setCustomer({ name: c.name, email: c.email || "", phone: c.phone || "", address: c.address || "", city: c.city || "" });
    if (c.invoice?.wantsInvoice) {
      setWantsInvoice(true);
      setInvoiceData({
        businessName: c.invoice.businessName || "",
        taxId: c.invoice.taxId || "",
        nrc: c.invoice.nrc || "",
        businessType: c.invoice.businessType || "",
      });
    }
    setCustomerSearchTerm(c.name);
    setShowCustomerDropdown(false);
    setCustomerResults([]);
  };

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
    if (productSearchRef.current) productSearchRef.current.focus();
  };

  const updateQty = (key, delta) => {
    setItems(items.map(i => i.key === key ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i));
  };

  const removeItem = (key) => {
    setItems(items.filter(i => i.key !== key));
  };

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const total = subtotal;
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  const validate = () => {
    const errs = {};
    if (items.length === 0) errs.items = "Agrega al menos un producto";
    if (!customer.name.trim()) errs.name = "Requerido";
    if (!customer.email.trim()) errs.email = "Requerido";
    if (!customer.phone.trim()) errs.phone = "Requerido";
    if (wantsInvoice) {
      if (!invoiceData.businessName.trim()) errs.businessName = "Requerido";
      if (!invoiceData.taxId.trim()) errs.taxId = "Requerido";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleGenerate = async () => {
    if (!validate()) return;
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
        shipping: 0,
        total,
        customer: { name: customer.name, email: customer.email, phone: customer.phone, address: customer.address, city: customer.city },
        userId: user?.uid || null,
        status: "pending",
        paymentMethod,
        paymentStatus: "pending",
        source: "facturacion",
        invoice: wantsInvoice ? { wantsInvoice: true, ...invoiceData } : null,
      };

      const { id, orderNumber } = await saveOrder(null, orderData);
      const fullOrder = { ...orderData, id, orderNumber };

      try {
        await saveCustomer({
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          city: customer.city,
          invoice: wantsInvoice ? { wantsInvoice: true, ...invoiceData } : null,
        });
      } catch (custErr) {
        console.error("Customer save error:", custErr);
      }

      const freshSettings = settings;
      const logoBase64 = await prepareLogoForPDF(freshSettings?.logoBase64 || freshSettings?.logo);
      const settingsWithLogo = { ...freshSettings, logo: logoBase64 };

      try {
        const origin = window.location.origin;
        const doc = await generateOrderInvoice(fullOrder, settingsWithLogo, origin, { showPrices: showPricesVal });
        doc.save(`Factura_${orderNumber || (id || "").substring(0, 8).toUpperCase()}.pdf`);
      } catch (pdfErr) {
        console.error("PDF error:", pdfErr);
      }

      try {
        const doc = await generateOrderInvoice(fullOrder, settingsWithLogo, window.location.origin, { showPrices: showPricesVal });
        const pdfBase64 = doc.output("datauristring").split(",")[1];
        const sendOrderEmail = httpsCallable(functions, "sendOrderEmail");
        await sendOrderEmail({ order: fullOrder, storeSettings: freshSettings, pdfBase64: pdfBase64 || "", showPrices: showPricesVal });
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

  return (
    <div className={styles.wizardOverlay} onClick={onClose}>
      <div className={styles.splitModal} onClick={e => e.stopPropagation()}>
        <div className={styles.wizardHeader}>
          <div className={styles.wizardTitleRow}>
            <HiOutlineDocumentText size={22} />
            <span>Nueva Factura</span>
            {itemCount > 0 && <span className={styles.itemCountBadge}>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>}
          </div>
          <button className={styles.closeBtn} onClick={onClose}><HiOutlineXMark size={22} /></button>
        </div>

        <div className={styles.splitPane}>
          {/* LEFT PANEL — Form */}
          <div className={styles.leftPanel}>
            {/* Product Search */}
            <div className={styles.leftSection}>
              <div className={styles.leftSectionTitle}>Productos</div>
              <div className={styles.searchInputWrap}>
                <HiOutlineMagnifyingGlass size={16} className={styles.searchIcon} />
                <input
                  ref={productSearchRef}
                  type="text"
                  className={styles.searchInput}
                  placeholder="Buscar producto por nombre o SKU..."
                  value={searchTerm}
                  onChange={e => handleProductSearch(e.target.value)}
                />
                {searching && <span className={styles.searchSpinner} />}
              </div>
              {searchResults.length > 0 && (
                <div className={styles.searchDropdown}>
                  {searchResults.map(p => (
                    <div key={p.id} className={styles.searchResultItem} onClick={() => addItem(p)} tabIndex={0} onKeyDown={e => { if (e.key === "Enter") addItem(p); }}>
                      <img src={p.images?.[0] || ""} alt={p.name} className={styles.searchResultImg} />
                      <div className={styles.searchResultInfo}>
                        <span className={styles.searchResultName}>{p.name}</span>
                        <span className={styles.searchResultSku}>SKU: {p.sku || "-"} | ${formatPrice(p.price)}</span>
                      </div>
                      <span className={styles.addHint}>+</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Items List */}
            <div className={styles.leftSection}>
              {errors.items && <p className={styles.fieldError}>{errors.items}</p>}
              {items.length === 0 ? (
                <div className={styles.emptyItemsWizard}>
                  <p>Busca y agrega productos usando el campo superior</p>
                </div>
              ) : (
                <div className={styles.itemsListSplit}>
                  {items.map(item => (
                    <div key={item.key} className={styles.splitItemRow}>
                      <div className={styles.splitItemLeft}>
                        {item.image && <img src={item.image} alt="" className={styles.splitItemImg} />}
                        <div className={styles.splitItemInfo}>
                          <span className={styles.splitItemName}>{item.name}</span>
                          <span className={styles.splitItemSku}>${formatPrice(item.price)} c/u</span>
                        </div>
                      </div>
                      <div className={styles.splitItemRight}>
                        <div className={styles.splitQtyControls}>
                          <button className={styles.splitQtyBtn} onClick={() => updateQty(item.key, -1)} disabled={item.quantity <= 0}>−</button>
                          <input
                            type="number"
                            min="0"
                            value={item.quantity}
                            onChange={(e) => setItems(items.map(i => i.key === item.key ? { ...i, quantity: Math.max(0, parseInt(e.target.value) || 0) } : i))}
                            className={styles.splitQtyInput}
                          />
                          <button className={styles.splitQtyBtn} onClick={() => updateQty(item.key, 1)}>+</button>
                        </div>
                        <span className={styles.splitItemTotal}>${formatPrice(item.price * item.quantity)}</span>
                        <button className={styles.splitRemoveBtn} onClick={() => removeItem(item.key)} title="Eliminar">
                          <HiOutlineTrash size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Customer Search + Form */}
            <div className={styles.leftSection}>
              <div className={styles.leftSectionTitle}>Cliente</div>
              <div className={styles.customerSearchWrap}>
                <input
                  ref={customerSearchRef}
                  type="text"
                  className={`${styles.formInputSplit} ${errors.name ? styles.formInputError : ""}`}
                  placeholder="Nombre del cliente..."
                  value={customerSearchTerm}
                  onChange={e => handleCustomerSearch(e.target.value)}
                  onFocus={() => { if (customerResults.length > 0) setShowCustomerDropdown(true); }}
                />
                {customerSearching && <span className={styles.customerSearchSpinner} />}
                {showCustomerDropdown && (
                  <div className={styles.customerDropdown}>
                    {customerResults.map(c => (
                      <div key={c.id} className={styles.customerDropdownItem} onClick={() => selectCustomer(c)} tabIndex={0} onKeyDown={e => { if (e.key === "Enter") selectCustomer(c); }}>
                        <div className={styles.customerDropdownName}>{c.name}</div>
                        <div className={styles.customerDropdownMeta}>{c.email} {c.phone && `| ${c.phone}`}</div>
                      </div>
                    ))}
                  </div>
                )}
                {errors.name && <p className={styles.fieldError}>{errors.name}</p>}
              </div>
              <div className={styles.customerFieldsSplit}>
                <input type="email" className={`${styles.formInputSplit} ${errors.email ? styles.formInputError : ""}`}
                  placeholder="Email *" value={customer.email}
                  onChange={e => setCustomer({ ...customer, email: e.target.value })} />
                {errors.email && <p className={styles.fieldError}>{errors.email}</p>}
                <input type="tel" className={`${styles.formInputSplit} ${errors.phone ? styles.formInputError : ""}`}
                  placeholder="Teléfono *" value={customer.phone}
                  onChange={e => setCustomer({ ...customer, phone: e.target.value })} />
                {errors.phone && <p className={styles.fieldError}>{errors.phone}</p>}
                <input type="text" className={styles.formInputSplit}
                  placeholder="Dirección" value={customer.address}
                  onChange={e => setCustomer({ ...customer, address: e.target.value })} />
                <input type="text" className={styles.formInputSplit}
                  placeholder="Ciudad" value={customer.city}
                  onChange={e => setCustomer({ ...customer, city: e.target.value })} />
              </div>

              {/* Invoice Toggle */}
              <button
                type="button"
                className={`${styles.invoiceToggleBtn} ${wantsInvoice ? styles.invoiceToggleBtnActive : ""}`}
                onClick={() => setWantsInvoice(!wantsInvoice)}
              >
                <span>{wantsInvoice ? "🧾 Factura fiscal activada" : "➕ ¿Requiere factura fiscal?"}</span>
              </button>
              {wantsInvoice && (
                <div className={styles.invoiceFieldsSplit}>
                  <input type="text" className={`${styles.formInputSplit} ${errors.businessName ? styles.formInputError : ""}`}
                    placeholder="Razón Social *" value={invoiceData.businessName}
                    onChange={e => setInvoiceData({ ...invoiceData, businessName: e.target.value })} />
                  {errors.businessName && <p className={styles.fieldError}>{errors.businessName}</p>}
                  <input type="text" className={`${styles.formInputSplit} ${errors.taxId ? styles.formInputError : ""}`}
                    placeholder="NIT *" value={invoiceData.taxId}
                    onChange={e => setInvoiceData({ ...invoiceData, taxId: e.target.value })} />
                  {errors.taxId && <p className={styles.fieldError}>{errors.taxId}</p>}
                  <input type="text" className={styles.formInputSplit}
                    placeholder="NRC" value={invoiceData.nrc}
                    onChange={e => setInvoiceData({ ...invoiceData, nrc: e.target.value })} />
                  <input type="text" className={styles.formInputSplit}
                    placeholder="Giro" value={invoiceData.businessType}
                    onChange={e => setInvoiceData({ ...invoiceData, businessType: e.target.value })} />
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className={styles.leftSection}>
              <div className={styles.leftSectionTitle}>Método de Pago</div>
              <div className={styles.paymentOptions}>
              {[
                  { value: "cashOnDelivery", label: "Efectivo", icon: "💵" },
                  { value: "bankTransfer", label: "Transferencia", icon: "🏦" },
                  { value: "card", label: "Tarjeta", icon: "💳" },
                ].map(op => (
                  <button
                    key={op.value}
                    type="button"
                    className={`${styles.paymentOption} ${paymentMethod === op.value ? styles.paymentOptionActive : ""}`}
                    onClick={() => setPaymentMethod(op.value)}
                  >
                    <span>{op.icon}</span>
                    <span>{op.label}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT PANEL — Invoice Preview */}
          <div className={styles.rightPanel}>
            <div className={styles.invoicePreview}>
              {/* Header */}
              <div className={styles.previewHeader}>
                <div className={styles.previewStoreInfo}>
                  {settings?.logo && <img src={settings.logo} alt="" className={styles.previewLogo} />}
                  <div>
                    <div className={styles.previewStoreName}>{(settings?.name || "TIENDA").toUpperCase()}</div>
                    {settings?.address && <div className={styles.previewStoreDetail}>{settings.address}</div>}
                    {settings?.phone && <div className={styles.previewStoreDetail}>Tel: {settings.phone}</div>}
                    {settings?.email && <div className={styles.previewStoreDetail}>{settings.email}</div>}
                  </div>
                </div>
                <div className={styles.previewMeta}>
                  <div className={styles.previewDocTitle}>NOTA DE PEDIDO</div>
                  <div className={styles.previewDocId}>#PENDIENTE</div>
                  <div className={styles.previewDocDate}>Fecha: {new Date().toLocaleDateString("es-MX")}</div>
                </div>
              </div>

              <div className={styles.previewDivider} />

              {/* Customer */}
              <div className={styles.previewSection}>
                <div className={styles.previewSectionTitle}>DATOS DEL CLIENTE</div>
                {customer.name ? (
                  <div className={styles.previewCustomerData}>
                    <div><strong>Nombre:</strong> {customer.name}</div>
                    <div><strong>Email:</strong> {customer.email || "—"}</div>
                    <div><strong>Teléfono:</strong> {customer.phone || "—"}</div>
                    {(customer.address || customer.city) && (
                      <div><strong>Dirección:</strong> {customer.address}{customer.address && customer.city ? ", " : ""}{customer.city}</div>
                    )}
                  </div>
                ) : (
                  <div className={styles.previewEmpty}>Ingresa los datos del cliente</div>
                )}
              </div>

              {wantsInvoice && (
                <div className={styles.previewSection}>
                  <div className={styles.previewSectionTitle}>DATOS FISCALES</div>
                  <div className={styles.previewCustomerData}>
                    <div><strong>Razón Social:</strong> {invoiceData.businessName || "—"}</div>
                    <div><strong>NIT:</strong> {invoiceData.taxId || "—"}</div>
                    {invoiceData.nrc && <div><strong>NRC:</strong> {invoiceData.nrc}</div>}
                    {invoiceData.businessType && <div><strong>Giro:</strong> {invoiceData.businessType}</div>}
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div className={styles.previewSection}>
                <div className={styles.previewSectionTitle}>ARTÍCULOS</div>
                {items.length === 0 ? (
                  <div className={styles.previewEmpty}>Agrega productos para ver la previsualización</div>
                ) : (
                  <div className={styles.previewTableWrap}>
                    <table className={styles.previewTable}>
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Producto</th>
                          <th>Cant.</th>
                          <th>P.Unit.</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(item => (
                          <tr key={item.key}>
                            <td>{item.barcode || item.sku || "-"}</td>
                            <td>{item.name}</td>
                            <td>{item.quantity}</td>
                            <td>${formatPrice(item.price)}</td>
                            <td>${formatPrice((item.price || 0) * (item.quantity || 1))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Totals */}
              {items.length > 0 && (
                <div className={styles.previewTotals}>
                  <div className={styles.previewTotalRow}>
                    <span>Subtotal ({itemCount} items)</span>
                    <span>${formatPrice(subtotal)}</span>
                  </div>
                  <div className={styles.previewTotalRow}>
                    <span>Método de pago</span>
                    <span className={styles.previewPaymentVal}>
                      {paymentMethod === "cashOnDelivery" ? "💵 Efectivo" : paymentMethod === "bankTransfer" ? "🏦 Transferencia" : "💳 Tarjeta"}
                    </span>
                  </div>
                  <div className={`${styles.previewTotalRow} ${styles.previewTotalGrand}`}>
                    <span>TOTAL</span>
                    <span>${formatPrice(total)}</span>
                  </div>
                </div>
              )}

              <div className={styles.previewFooter}>¡Gracias por tu preferencia!</div>
            </div>
          </div>
        </div>

        <div className={styles.wizardFooter}>
          <button className={styles.wizardCancelBtn} onClick={onClose}>Cancelar</button>
          <div className={styles.wizardFooterRight}>
            <button className={styles.wizardGenerateBtn} onClick={handleGenerate} disabled={saving}>
              {saving ? (
                <span>Procesando...</span>
              ) : (
                <><HiOutlineCheckCircle size={18} /> Generar Factura y Descargar PDF</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
