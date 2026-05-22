"use client";

import { useEffect, useState, useRef, useCallback, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { writeBatch, doc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import {
  getProducts, saveProduct,
  getInventoryMovements, saveInventoryMovement, bulkSaveProducts,
  deleteProduct, deleteInventoryMovement, updateInventoryMovement,
} from "@/lib/firestore";
import { formatPrice } from "@/lib/format";
import { getLocalDateString } from "@/lib/dates";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  HiOutlineMagnifyingGlass, HiOutlineXMark, HiOutlineCheckCircle,
  HiOutlineExclamationTriangle, HiOutlineXCircle, HiOutlineArrowPath,
  HiOutlineMinus, HiOutlinePlus, HiOutlinePhoto,
  HiOutlineArrowDownTray, HiOutlineArrowUpTray,
  HiOutlineDocumentText, HiOutlineCube, HiOutlineClipboardDocumentList,
  HiOutlineChartBar, HiOutlineFunnel, HiOutlineClock,
  HiOutlineShoppingBag, HiOutlineTruck, HiOutlineExclamationCircle,
  HiOutlineReceiptRefund, HiOutlineWrenchScrewdriver, HiOutlineEye,
  HiOutlinePencilSquare, HiOutlineTrash, HiOutlinePrinter,
  HiOutlineCheck, HiOutlineArchiveBox, HiOutlineHome,
  HiOutlineCurrencyDollar, HiOutlineShieldCheck,
  HiOutlineArrowUturnLeft,
} from "react-icons/hi2";
import styles from "./inventario.module.css";

const LOW_STOCK_THRESHOLD = 10;
const TABS = [
  { key: "productos", label: "Productos", icon: HiOutlineCube },
  { key: "movimientos", label: "Movimientos", icon: HiOutlineClipboardDocumentList },
  { key: "reportes", label: "Reportes", icon: HiOutlineChartBar },
];

const MOVEMENT_TYPES = [
  { key: "entrada", label: "Entrada", icon: HiOutlineArrowDownTray, color: "#10B981", sign: 1 },
  { key: "salida", label: "Salida", icon: HiOutlineArrowUpTray, color: "#E17055", sign: -1 },
  { key: "averia", label: "Avería", icon: HiOutlineExclamationCircle, color: "#FDCB6E", sign: -1 },
  { key: "faltante", label: "Faltante", icon: HiOutlineXCircle, color: "#D63031", sign: -1 },
  { key: "nota_credito", label: "Nota Crédito", icon: HiOutlineReceiptRefund, color: "#0984E3", sign: 1 },
  { key: "ajuste", label: "Ajuste", icon: HiOutlineWrenchScrewdriver, color: "#6C5CE7", sign: 0 },
];

const REASON_SUGGESTIONS = {
  entrada: ["Compra a proveedor", "Devolución de cliente", "Corrección de inventario", "Transferencia entre almacenes"],
  salida: ["Venta", "Transferencia a sucursal", "Merma operativa"],
  averia: ["Daño en almacén", "Daño en transporte", "Producto defectuoso", "Caducidad"],
  faltante: ["Diferencia en conteo", "Pérdida no identificada", "Robo hormiga"],
  nota_credito: ["Devolución de cliente", "Reembolso", "Garantía"],
  ajuste: ["Inventario físico", "Migración de datos", "Corrección manual"],
};

const COLUMNAS_IMPORT = [
  { key: "name", label: "Nombre *", alt: ["nombre", "producto", "product", "descripcion"] },
  { key: "price", label: "Precio *", alt: ["precio", "costo", "valor"] },
  { key: "stock", label: "Stock", alt: ["existencia", "cantidad", "inventario", "quantity"] },
  { key: "sku", label: "SKU", alt: ["codigo", "code", "referencia"] },
  { key: "barcode", label: "Código barras", alt: ["barras", "codigo de barras", "ean", "upc"] },
  { key: "category", label: "Categoría", alt: ["categoria", "familia", "tipo"] },
  { key: "brand", label: "Marca", alt: ["marca", "brand"] },
  { key: "comparePrice", label: "Precio anterior", alt: ["precio_anterior", "compare_at", "precio original"] },
  { key: "description", label: "Descripción", alt: ["descripcion", "detalle"] },
];

const COLUMNAS_IMPORT_INV = [
  { key: "sku", label: "SKU", alt: ["codigo", "code", "referencia", "sku"] },
  { key: "barcode", label: "Código barras", alt: ["barras", "codigo de barras", "ean", "upc"] },
  { key: "stock", label: "Stock *", alt: ["existencia", "cantidad", "inventario", "quantity", "stock"] },
];

const formatDate = (d) => {
  if (!d) return "—";
  const date = d?.toDate ? d.toDate() : new Date(d);
  return date.toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const formatDateShort = (d) => {
  if (!d) return "—";
  const date = d?.toDate ? d.toDate() : new Date(d);
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
};

export default function InventarioPage() {
  const { user, hasPermission, canManage, role, loading: authLoading, permissions } = useAuth();
  const { settings, categories, brands } = useStore();
  const inventoryAccess = hasPermission("inventory");
  const canDeleteInventory = canManage("inventory") && (role === "admin" || role === "superadmin");
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const stockInputRef = useRef({});

  const [activeTab, setActiveTab] = useState("productos");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState("");

  // Productos
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStock, setFilterStock] = useState("all");
  const [stockEdits, setStockEdits] = useState({});
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Checkbox selection
  const [selectedProducts, setSelectedProducts] = useState(new Set());

  // Undo stack (last 3 actions)
  const [undoStack, setUndoStack] = useState([]);

  // Edit product modal
  const [editProductModal, setEditProductModal] = useState(null);
  const [editProductData, setEditProductData] = useState({});
  const [savingProduct, setSavingProduct] = useState(false);

  // Delete product confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Movimientos
  const [movements, setMovements] = useState([]);
  const [movLoading, setMovLoading] = useState(false);
  const [movFilterType, setMovFilterType] = useState("");
  const [movFilterProduct, setMovFilterProduct] = useState("");
  const [showMovForm, setShowMovForm] = useState(false);
  const [editingMovement, setEditingMovement] = useState(null);
  const [movForm, setMovForm] = useState({
    productId: "", productName: "", productSku: "",
    type: "entrada", quantity: "1", reason: "", reference: "", notes: "",
  });
  const [movItems, setMovItems] = useState([]);
  const [movAddQty, setMovAddQty] = useState("1");
  const [productSearch, setProductSearch] = useState("");
  const [productSearchResults, setProductSearchResults] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [savingMov, setSavingMov] = useState(false);
  const [expandedRef, setExpandedRef] = useState(null);

  // Movement type modal
  const [typeModal, setTypeModal] = useState(null);
  const [typeMovements, setTypeMovements] = useState([]);
  const [typeModalLoading, setTypeModalLoading] = useState(false);

  // Single movement detail modal
  const [detailMov, setDetailMov] = useState(null);

  // Group movement detail modal
  const [groupDetail, setGroupDetail] = useState(null);

  // Import inventory
  const [showImportInv, setShowImportInv] = useState(false);
  const [showImportInvGuide, setShowImportInvGuide] = useState(false);
  const [importInvData, setImportInvData] = useState([]);
  const [importInvMapping, setImportInvMapping] = useState({});
  const [importInvHeaders, setImportInvHeaders] = useState([]);
  const [importingInv, setImportingInv] = useState(false);
  const [importInvResult, setImportInvResult] = useState(null);

  // Reportes
  const [reportDateFrom, setReportDateFrom] = useState("");
  const [reportDateTo, setReportDateTo] = useState("");
  const [reportType, setReportType] = useState("");
  const [reportMovements, setReportMovements] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);

  // Cardex
  const [cardexProductId, setCardexProductId] = useState("");
  const [cardexProductName, setCardexProductName] = useState("");
  const [cardexSearch, setCardexSearch] = useState("");
  const [cardexResults, setCardexResults] = useState([]);
  const [showCardexDropdown, setShowCardexDropdown] = useState(false);
  const [cardexMovements, setCardexMovements] = useState([]);
  const [cardexLoading, setCardexLoading] = useState(false);

  // Import
  const [showImport, setShowImport] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [importData, setImportData] = useState([]);
  const [importMapping, setImportMapping] = useState({});
  const [importHeaders, setImportHeaders] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/auth/login"); return; }
    if (!authLoading && user && !inventoryAccess) { navigate("/facturacion"); return; }
  }, [user, authLoading, inventoryAccess, navigate]);

  useEffect(() => { if (user && inventoryAccess) { loadProducts(); } }, [user, inventoryAccess]);
  useEffect(() => { if (activeTab === "movimientos" && user) loadMovements(); }, [activeTab, user]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeys = (e) => {
      const tag = e.target.tagName;
      const isEditing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target.isContentEditable;

      if (e.key === "Escape") {
        if (editProductModal) { setEditProductModal(null); return; }
        if (deleteConfirm) { setDeleteConfirm(null); return; }
        if (typeModal) { setTypeModal(null); return; }
        if (detailMov) { setDetailMov(null); return; }
        if (groupDetail) { setGroupDetail(null); return; }
        if (showMovForm) { setShowMovForm(false); resetMovForm(); return; }
        if (showImport) { setShowImport(false); return; }
        if (showImportInv) { setShowImportInv(false); return; }
      }

      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        if (activeTab === "productos") document.querySelector(`.${styles.searchBox} input`)?.focus();
        if (activeTab === "movimientos") document.querySelector(`.${styles.sectionActions} input`)?.focus();
      }

      if (e.ctrlKey && !isEditing && e.key === "n" && activeTab === "movimientos" && canManage("inventory")) {
        e.preventDefault();
        setShowMovForm(true);
        setEditingMovement(null);
        resetMovForm();
      }
    };

    window.addEventListener("keydown", handleGlobalKeys);
    return () => window.removeEventListener("keydown", handleGlobalKeys);
  }, [activeTab, editProductModal, deleteConfirm, typeModal, detailMov, groupDetail, showMovForm, showImport, showImportInv, canManage]);

  const loadProducts = async () => {
    setLoading(true);
    try { setProducts(await getProducts()); } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadMovements = async () => {
    setMovLoading(true);
    try { setMovements(await getInventoryMovements({ limitCount: 200 })); }
    catch (e) { console.error(e); }
    finally { setMovLoading(false); }
  };

  const loadReportes = async () => {
    setReportLoading(true);
    try {
      let data = await getInventoryMovements({ limitCount: 500 });
      if (reportType) data = data.filter(m => m.type === reportType);
      if (reportDateFrom) {
        const from = new Date(reportDateFrom).getTime();
        data = data.filter(m => {
          const d = m.createdAt?.toDate ? m.createdAt.toDate().getTime() : 0;
          return d >= from;
        });
      }
      if (reportDateTo) {
        const to = new Date(reportDateTo + "T23:59:59").getTime();
        data = data.filter(m => {
          const d = m.createdAt?.toDate ? m.createdAt.toDate().getTime() : 0;
          return d <= to;
        });
      }
      setReportMovements(data);
    } catch (e) { console.error(e); }
    finally { setReportLoading(false); }
  };

  // ===== CARDEX =====
  const handleCardexSearch = (term) => {
    setCardexSearch(term);
    if (term.length < 1) { setCardexResults([]); setShowCardexDropdown(false); return; }
    const t = term.toLowerCase();
    const r = products.filter(p => p.name?.toLowerCase().includes(t) || p.sku?.toLowerCase().includes(t)).slice(0, 8);
    setCardexResults(r);
    setShowCardexDropdown(r.length > 0);
  };

  const selectCardexProduct = (product) => {
    setCardexProductId(product.id);
    setCardexProductName(product.name);
    setCardexSearch(product.name);
    setShowCardexDropdown(false);
    loadCardex(product.id);
  };

  const loadCardex = async (productId) => {
    setCardexLoading(true);
    try {
      const data = await getInventoryMovements({ productId, limitCount: 500 });
      const sorted = data.sort((a, b) => {
        const aD = a.createdAt?.toDate?.() || new Date(0);
        const bD = b.createdAt?.toDate?.() || new Date(0);
        return aD - bD;
      });
      setCardexMovements(sorted);
    } catch (e) { console.error(e); }
    finally { setCardexLoading(false); }
  };

  // ===== INLINE STOCK EDITING =====
  const handleStockChange = (productId, value) => {
    setStockEdits(prev => ({ ...prev, [productId]: value }));
  };

  const handleStockKeyDown = async (product, e) => {
    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      const val = parseInt(stockEdits[product.id]);
      if (isNaN(val) || val < 0) {
        setStockEdits(prev => ({ ...prev, [product.id]: String(product.stock || 0) }));
        return;
      }
      await commitStockChange(product, val);
    }
  };

  const handleStockBlur = async (product) => {
    const val = parseInt(stockEdits[product.id]);
    if (isNaN(val) || val < 0) {
      setStockEdits(prev => ({ ...prev, [product.id]: String(product.stock || 0) }));
      return;
    }
    await commitStockChange(product, val);
  };

  const commitStockChange = async (product, newStock) => {
    const prev = product.stock;
    if (newStock === prev) return;
    try {
      const type = newStock > prev ? "entrada" : newStock < prev ? "salida" : "ajuste";
      await saveProduct(product.id, { stock: newStock });
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock: newStock } : p));
      await saveInventoryMovement({
        productId: product.id, productName: product.name, productSku: product.sku,
        type, quantity: Math.abs(newStock - prev), previousStock: prev, newStock,
        reason: "Ajuste desde inventario", userEmail: user?.email || "",
        reference: "", notes: "",
      });
      setSuccessMsg("Stock actualizado");
      setTimeout(() => setSuccessMsg(""), 2000);
    } catch (e) { console.error(e); alert("Error al actualizar stock"); }
  };

  // Initialize stockEdits when products load
  useEffect(() => {
    const edits = {};
    products.forEach(p => { if (!stockEdits[p.id]) edits[p.id] = String(p.stock || 0); });
    setStockEdits(prev => ({ ...prev, ...edits }));
  }, [products]);

  const stockIncrement = (product, delta) => {
    const val = parseInt(stockEdits[product.id] || product.stock);
    const newVal = Math.max(0, (isNaN(val) ? product.stock : val) + delta);
    setStockEdits(prev => ({ ...prev, [product.id]: String(newVal) }));
    commitStockChange(product, newVal);
  };

  // ===== PRODUCT EDIT MODAL =====
  const openEditProduct = (product) => {
    setEditProductModal(product);
    setEditProductData({
      name: product.name || "",
      price: product.price || 0,
      comparePrice: product.comparePrice || 0,
      sku: product.sku || "",
      barcode: product.barcode || "",
      category: product.category || "",
      brand: product.brand || "",
      description: product.description || "",
      stock: product.stock || 0,
    });
  };

  const handleSaveProduct = async () => {
    if (!editProductModal || !editProductData.name.trim()) return;
    setSavingProduct(true);
    try {
      await saveProduct(editProductModal.id, editProductData);
      setSuccessMsg("Producto actualizado");
      setTimeout(() => setSuccessMsg(""), 2000);
      setEditProductModal(null);
      loadProducts();
    } catch (e) { console.error(e); alert("Error al actualizar producto"); }
    finally { setSavingProduct(false); }
  };

  const handleDeleteProduct = async (product) => {
    const backup = { ...product };
    try {
      await deleteProduct(product.id);
      pushUndo({ type: "delete", data: backup });
      setSuccessMsg("Producto eliminado");
      setTimeout(() => setSuccessMsg(""), 2000);
      setDeleteConfirm(null);
      loadProducts();
    } catch (e) { console.error(e); alert("Error al eliminar producto"); }
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.size === 0) return;
    const count = selectedProducts.size;
    const backups = products.filter(p => selectedProducts.has(p.id)).map(p => ({ ...p }));
    try {
      await Promise.all([...selectedProducts].map(id => deleteProduct(id)));
      pushUndo({ type: "bulkDelete", data: backups });
      setSuccessMsg(`${count} producto(s) eliminado(s)`);
      setTimeout(() => setSuccessMsg(""), 2000);
      setSelectedProducts(new Set());
      loadProducts();
    } catch (e) { console.error(e); alert("Error al eliminar productos"); }
  };

  const toggleSelectProduct = (id) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const pushUndo = (action) => {
    setUndoStack(prev => [action, ...prev].slice(0, 3));
  };

  const handleUndo = async (index) => {
    const action = undoStack[index];
    if (!action) return;
    try {
      if (action.type === "delete") {
        await saveProduct(null, action.data);
        setSuccessMsg("Producto restaurado");
      } else if (action.type === "bulkDelete") {
        await Promise.all(action.data.map(p => saveProduct(null, p)));
        setSuccessMsg(`${action.data.length} producto(s) restaurado(s)`);
      }
      setTimeout(() => setSuccessMsg(""), 2000);
      setUndoStack([]);
      loadProducts();
    } catch (e) { console.error(e); alert("Error al deshacer"); }
  };

  const dismissUndo = () => setUndoStack([]);

  // ===== PRODUCT FILTERS =====
  const filteredProducts = (() => {
    let r = [...products];
    if (search) {
      const t = search.toLowerCase();
      r = r.filter(p => p.name?.toLowerCase().includes(t) || p.sku?.toLowerCase().includes(t) || p.barcode?.toLowerCase().includes(t));
    }
    if (filterCategory) r = r.filter(p => p.category === filterCategory);
    if (filterStock === "low") r = r.filter(p => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD);
    else if (filterStock === "out") r = r.filter(p => p.stock === 0);
    else if (filterStock === "in") r = r.filter(p => p.stock > LOW_STOCK_THRESHOLD);
    return r;
  })();

  const totalPages = pageSize === 0 ? 1 : Math.ceil(filteredProducts.length / pageSize) || 1;
  const paginatedProducts = pageSize === 0 ? filteredProducts : filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterCategory, filterStock, pageSize]);

  const productStats = {
    total: filteredProducts.length,
    inStock: filteredProducts.filter(p => p.stock > LOW_STOCK_THRESHOLD).length,
    lowStock: filteredProducts.filter(p => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD).length,
    outOfStock: filteredProducts.filter(p => p.stock === 0).length,
    totalValue: filteredProducts.reduce((s, p) => s + p.price * (p.stock || 0), 0),
  };

  // ===== MOVIMIENTOS =====
  const filteredMovements = (() => {
    let m = [...movements];
    if (movFilterType) m = m.filter(mm => mm.type === movFilterType);
    if (movFilterProduct) m = m.filter(mm => mm.productName?.toLowerCase().includes(movFilterProduct.toLowerCase()));
    return m;
  })();

  const handleProductSearch = (term) => {
    setProductSearch(term);
    if (term.length < 1) { setProductSearchResults([]); setShowProductDropdown(false); return; }
    const termLower = term.toLowerCase();
    const results = products.filter(p =>
      p.name?.toLowerCase().includes(termLower) ||
      p.sku?.toLowerCase().includes(termLower) ||
      p.barcode?.toLowerCase().includes(termLower)
    ).slice(0, 8);
    setProductSearchResults(results);
    setShowProductDropdown(results.length > 0);
  };

  const selectProduct = (product) => {
    setMovForm(mf => ({ ...mf, productId: product.id, productName: product.name, productSku: product.sku || "" }));
    setProductSearch(product.name);
    setShowProductDropdown(false);
    setMovAddQty("1");
  };

  const addMovItem = () => {
    if (!movForm.productId || !movForm.productName) return;
    const qty = parseInt(movAddQty) || 1;
    const exists = movItems.find(i => i.productId === movForm.productId);
    if (exists) {
      setMovItems(prev => prev.map(i => i.productId === movForm.productId ? { ...i, quantity: i.quantity + qty } : i));
    } else {
      setMovItems(prev => [...prev, {
        productId: movForm.productId,
        productName: movForm.productName,
        productSku: movForm.productSku,
        quantity: qty,
      }]);
    }
    setMovForm(mf => ({ ...mf, productId: "", productName: "", productSku: "" }));
    setProductSearch("");
    setShowProductDropdown(false);
  };

  const removeMovItem = (productId) => {
    setMovItems(prev => prev.filter(i => i.productId !== productId));
  };

  const updateMovItemQty = (productId, qty) => {
    setMovItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity: Math.max(1, parseInt(qty) || 1) } : i));
  };

  const generateRef = () => {
    const d = getLocalDateString().replace(/-/g, "");
    const n = String(movements.length + 1).padStart(3, "0");
    return `MOV-${d}-${n}`;
  };

  const handleSubmitMovement = async () => {
    const items = editingMovement ? [{
      productId: movForm.productId,
      productName: movForm.productName,
      productSku: movForm.productSku,
      quantity: parseInt(movForm.quantity),
    }] : movItems;
    if (items.length === 0) { alert("Agrega al menos un producto"); return; }
    const typeDef = MOVEMENT_TYPES.find(t => t.key === movForm.type);
    const ref = movForm.reference || generateRef();

    if (editingMovement) {
      const product = products.find(p => p.id === editingMovement.productId);
      if (!product) return;
      const oldSign = MOVEMENT_TYPES.find(t => t.key === editingMovement.type)?.sign ?? 0;
      const newSign = typeDef?.sign ?? 0;
      const revertedStock = product.stock - editingMovement.quantity * oldSign;
      const newStock = revertedStock + parseInt(movForm.quantity) * newSign;
      if (newStock < 0) { alert("El stock no puede quedar negativo"); return; }
      setSavingMov(true);
      try {
        await saveProduct(product.id, { stock: newStock });
        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, stock: newStock } : p));
        await updateInventoryMovement(editingMovement.id, {
          type: movForm.type, quantity: parseInt(movForm.quantity), reason: movForm.reason,
          reference: ref, notes: movForm.notes,
          previousStock: product.stock, newStock,
        });
        setSuccessMsg("Movimiento actualizado");
        setTimeout(() => setSuccessMsg(""), 2500);
        setShowMovForm(false);
        setEditingMovement(null);
        resetMovForm();
        loadMovements();
      } catch (e) { console.error(e); alert("Error al actualizar movimiento"); }
      finally { setSavingMov(false); }
      return;
    }

    setSavingMov(true);
    try {
      const batch = writeBatch(db);
      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (!product) continue;
        const qty = parseInt(item.quantity);
        const sign = typeDef?.sign ?? 0;
        const newStock = Math.max(0, (product.stock || 0) + qty * sign);
        batch.update(doc(db, "products", item.productId), { stock: newStock });
        setProducts(prev => prev.map(p => p.id === item.productId ? { ...p, stock: newStock } : p));
        const movRef = doc(collection(db, "inventory_movements"));
        batch.set(movRef, {
          productId: item.productId, productName: item.productName, productSku: item.productSku || "",
          type: movForm.type, quantity: qty, previousStock: product.stock, newStock,
          reason: movForm.reason, reference: ref,
          notes: movForm.notes, userEmail: user?.email || "",
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
      setSuccessMsg(`Movimiento registrado (${items.length} producto${items.length > 1 ? "s" : ""})`);
      setTimeout(() => setSuccessMsg(""), 2500);
      setShowMovForm(false);
      resetMovForm();
      setTimeout(() => loadMovements(), 500);
    } catch (e) { console.error(e); alert("Error al guardar movimiento"); }
    finally { setSavingMov(false); }
  };

  const resetMovForm = () => {
    setMovForm({ productId: "", productName: "", productSku: "", type: "entrada", quantity: "1", reason: "", reference: "", notes: "" });
    setMovItems([]);
    setProductSearch("");
    setMovAddQty("1");
  };

  const handleEditMovement = (mov) => {
    setEditingMovement(mov);
    setMovForm({
      productId: mov.productId,
      productName: mov.productName,
      productSku: mov.productSku || "",
      type: mov.type,
      quantity: String(mov.quantity),
      reason: mov.reason || "",
      reference: mov.reference || "",
      notes: mov.notes || "",
    });
    setProductSearch(mov.productName);
    setShowMovForm(true);
  };

  const handleDeleteMovement = async (mov) => {
    if (!canDeleteInventory) {
      alert("Usted no tiene los permisos para realizar esta accion");
      return;
    }
    if (!confirm(`¿Eliminar este movimiento? El stock NO se revertirá automáticamente.`)) return;
    try {
      await deleteInventoryMovement(mov.id);
      setSuccessMsg("Movimiento eliminado");
      setTimeout(() => setSuccessMsg(""), 2000);
      loadMovements();
    } catch (e) { console.error(e); alert("Error al eliminar movimiento"); }
  };

  // ===== SINGLE MOVEMENT DETAIL =====
  const openDetailModal = (mov) => setDetailMov(mov);

  // ===== MOVEMENT TYPE MODAL =====
  const openTypeModal = async (typeKey) => {
    setTypeModal(typeKey);
    setTypeModalLoading(true);
    try {
      let data = await getInventoryMovements({ limitCount: 500 });
      data = data.filter(m => m.type === typeKey);
      setTypeMovements(data);
    } catch (e) { console.error(e); }
    finally { setTypeModalLoading(false); }
  };

  // ===== PDF PRINT (Grupo de movimientos) =====
  const generateMovementPDF = (movementsList, typeKey) => {
    try {
      const typeDef = MOVEMENT_TYPES.find(t => t.key === typeKey);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const company = settings?.name || "DalseShop";
      const borderColor = typeDef?.color || "#6C5CE7";
      const rgb = hexToRgb(borderColor);

      const M = 10;
      const W = pageWidth - M * 2;

      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.rect(0, 0, pageWidth, 3, "F");

      doc.setFontSize(16);
      doc.setTextColor(40, 40, 40);
      doc.setFont("helvetica", "bold");
      doc.text(company, M, 12);

      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.setFont("helvetica", "normal");
      doc.text(`Reporte de Inventario — ${typeDef?.label || "Movimientos"}`, M, 18);

      doc.setFontSize(7);
      doc.setTextColor(140, 140, 140);
      doc.text(`Generado: ${new Date().toLocaleString("es-MX")}`, pageWidth - M, 10, { align: "right" });
      doc.text(`Registros: ${movementsList.length}`, pageWidth - M, 15, { align: "right" });

      doc.setDrawColor(220, 220, 220);
      doc.line(M, 23, pageWidth - M, 23);

      const totalQty = movementsList.reduce((s, m) => s + (m.quantity || 0), 0);
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.setFont("helvetica", "bold");
      doc.text(`Total movimientos: ${movementsList.length}     Cantidad total: ${totalQty}`, M, 30);

      const rows = movementsList.map(m => [
        formatDate(m.createdAt),
        m.productName || "—",
        m.productSku || "—",
        String(m.quantity),
        m.reason || "—",
        m.reference || "—",
        m.userEmail || "—",
      ]);

      autoTable(doc, {
        startY: 36,
        head: [["Fecha", "Producto", "SKU", "Cant.", "Motivo", "Referencia", "Usuario"]],
        body: rows,
        theme: "grid",
        styles: { fontSize: 7, cellPadding: 2, textColor: [50, 50, 50], overflow: "linebreak" },
        headStyles: { fillColor: rgb, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
        alternateRowStyles: { fillColor: [248, 249, 252] },
        columnStyles: {
          0: { halign: "center" },
          3: { halign: "center" },
        },
        margin: { left: M, right: M, top: 10, bottom: 30 },
        pageBreak: "auto",
        tableWidth: "auto",
      });

      const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 16 : pageHeight - 40;
      const sigY = Math.min(finalY, pageHeight - 35);
      const sigW = W / 3 - 8;
      const startX = M + 4;
      const gap = 12;

      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.line(startX, sigY, startX + sigW, sigY);
      doc.line(startX + sigW + gap, sigY, startX + sigW * 2 + gap, sigY);
      doc.line(startX + sigW * 2 + gap * 2, sigY, startX + sigW * 3 + gap * 2, sigY);

      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "bold");
      doc.text("ENVIA", startX + sigW / 2, sigY + 6, { align: "center" });
      doc.text("AUTORIZA", startX + sigW + gap + sigW / 2, sigY + 6, { align: "center" });
      doc.text("RECIBE", startX + sigW * 2 + gap * 2 + sigW / 2, sigY + 6, { align: "center" });

      const pageCount = doc.internal.pages.length;
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(6);
        doc.setTextColor(160, 160, 160);
        doc.text(
          `${company} | ${typeDef?.label || ""} | ${new Date().toLocaleDateString("es-MX")} | Pág. ${i} de ${pageCount}`,
          pageWidth / 2, pageHeight - M, { align: "center" }
        );
      }

      doc.save(`${typeDef?.label || "Movimientos"}_${getLocalDateString()}.pdf`);
    } catch (err) {
      console.error("Error generando PDF:", err);
      alert("Error al generar el PDF. Revisa la consola.");
    }
  };

  // ===== PDF PRINT (Movimiento individual) =====
  const generateSingleMovementPDF = (mov) => {
    try {
      const typeDef = MOVEMENT_TYPES.find(t => t.key === mov.type);
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const company = settings?.name || "DalseShop";
      const borderColor = typeDef?.color || "#6C5CE7";
      const rgb = hexToRgb(borderColor);

      const product = products.find(p => p.id === mov.productId);
      const barcode = product?.barcode || "—";

      const M = 10;
      const W = pageWidth - M * 2;

      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.rect(0, 0, pageWidth, 3, "F");

      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      doc.setFont("helvetica", "bold");
      doc.text(company, pageWidth / 2, 12, { align: "center" });

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "normal");
      doc.text(`Comprobante de Movimiento — ${typeDef?.label || mov.type}`, pageWidth / 2, 18, { align: "center" });

      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(`Generado: ${new Date().toLocaleString("es-MX")}`, pageWidth - M, 10, { align: "right" });

      doc.setDrawColor(220, 220, 220);
      doc.line(M, 23, pageWidth - M, 23);

      const leftX = M;
      let y = 30;
      doc.setFontSize(9);

      const addHeaderRow = (label, value) => {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 100, 100);
        doc.text(`${label}:`, leftX, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(40, 40, 40);
        doc.text(value || "—", leftX + 32, y);
        y += 6;
      };

      addHeaderRow("Fecha", formatDate(mov.createdAt));
      addHeaderRow("Referencia", mov.reference);
      addHeaderRow("Motivo", mov.reason);

      if (mov.notes) {
        addHeaderRow("Notas", mov.notes);
      }

      y += 2;

      autoTable(doc, {
        startY: y,
        head: [["Producto", "Código de barras", "Cant.", "Stock Ant.", "Stock Nuevo", "Usuario"]],
        body: [[
          mov.productName || "—",
          barcode,
          String(mov.quantity),
          String(mov.previousStock ?? "—"),
          String(mov.newStock ?? "—"),
          mov.userEmail || "—",
        ]],
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [50, 50, 50] },
        headStyles: { fillColor: rgb, textColor: 255, fontStyle: "bold", fontSize: 8.5 },
        alternateRowStyles: { fillColor: [248, 249, 252] },
        columnStyles: {
          2: { halign: "center" },
          3: { halign: "center" },
          4: { halign: "center" },
        },
        margin: { left: M, right: M, top: 10, bottom: 30 },
        tableWidth: "auto",
      });

      const tableY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 16 : pageHeight - 40;
      const sigY = Math.min(tableY, pageHeight - 35);
      const sigW = W / 3 - 8;
      const startX = M + 4;
      const gap = 12;

      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.line(startX, sigY, startX + sigW, sigY);
      doc.line(startX + sigW + gap, sigY, startX + sigW * 2 + gap, sigY);
      doc.line(startX + sigW * 2 + gap * 2, sigY, startX + sigW * 3 + gap * 2, sigY);

      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "bold");
      doc.text("ENVIA", startX + sigW / 2, sigY + 6, { align: "center" });
      doc.text("AUTORIZA", startX + sigW + gap + sigW / 2, sigY + 6, { align: "center" });
      doc.text("RECIBE", startX + sigW * 2 + gap * 2 + sigW / 2, sigY + 6, { align: "center" });

      doc.setFontSize(7);
      doc.setTextColor(160, 160, 160);
      doc.setFont("helvetica", "normal");
      doc.text(`${company} | ${new Date().toLocaleDateString("es-MX")}`, pageWidth / 2, pageHeight - M, { align: "center" });

      doc.save(`${typeDef?.label || "Mov"}_${mov.productName?.slice(0, 20)}_${getLocalDateString()}.pdf`);
    } catch (err) {
      console.error("Error generando PDF individual:", err);
      alert("Error al generar el PDF. Revisa la consola.");
    }
  };

  // ===== EXPORT SINGLE MOVEMENT EXCEL =====
  const exportSingleMovementExcel = (mov) => {
    const typeDef = MOVEMENT_TYPES.find(t => t.key === mov.type);
    const data = [{
      Fecha: formatDate(mov.createdAt),
      Tipo: typeDef?.label || mov.type,
      Producto: mov.productName,
      SKU: mov.productSku || "—",
      Cantidad: mov.quantity,
      "Stock Anterior": mov.previousStock ?? "—",
      "Stock Nuevo": mov.newStock ?? "—",
      Motivo: mov.reason || "—",
      Referencia: mov.reference || "—",
      Usuario: mov.userEmail || "—",
      Notas: mov.notes || "",
    }];
    exportToExcel(data, `Movimiento_${mov.reference || mov.id}_${getLocalDateString()}`);
  };

  // ===== EXPORT GROUP MOVEMENT EXCEL =====
  const exportGroupExcel = (group) => {
    const typeDef = MOVEMENT_TYPES.find(t => t.key === group.type);
    const data = group.items.map(m => ({
      Fecha: formatDate(m.createdAt),
      Tipo: MOVEMENT_TYPES.find(t => t.key === m.type)?.label || m.type,
      Producto: m.productName,
      SKU: m.productSku || "—",
      Cantidad: m.quantity,
      "Stock Anterior": m.previousStock ?? "—",
      "Stock Nuevo": m.newStock ?? "—",
      Motivo: m.reason || "—",
      Referencia: m.reference || "—",
      Usuario: m.userEmail || "—",
    }));
    exportToExcel(data, `Grupo_${group.ref}_${getLocalDateString()}`);
  };

  const printTypeModal = () => {
    if (typeMovements.length === 0) return;
    generateMovementPDF(typeMovements, typeModal);
  };

  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  }

  // ===== IMPORT =====
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (json.length < 2) { alert("El archivo está vacío"); return; }
        const headers = json[0].map(h => String(h || "").trim());
        const rows = json.slice(1).filter(r => r.some(cell => cell !== undefined && cell !== null && cell !== ""));
        setImportHeaders(headers);
        setImportData(rows);

        const mapping = {};
        COLUMNAS_IMPORT.forEach(col => {
          const idx = headers.findIndex(h => {
            const hl = h.toLowerCase();
            return hl === col.key.toLowerCase() || col.alt.some(a => hl === a.toLowerCase() || hl.includes(a.toLowerCase()));
          });
          if (idx >= 0) mapping[col.key] = idx;
        });
        if (mapping.name === undefined) {
          const nameIdx = headers.findIndex(h => h.toLowerCase().includes("nom"));
          if (nameIdx >= 0) mapping.name = nameIdx;
        }
        if (mapping.price === undefined) {
          const priceIdx = headers.findIndex(h => h.toLowerCase().includes("prec") || h.toLowerCase().includes("cost"));
          if (priceIdx >= 0) mapping.price = priceIdx;
        }
        setImportMapping(mapping);
      } catch (err) { console.error(err); alert("Error al leer el archivo Excel"); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    if (importMapping.name === undefined || importMapping.price === undefined) {
      alert("Debes mapear al menos Nombre y Precio");
      return;
    }
    setImporting(true);
    try {
      const toImport = importData.map(row => {
        const obj = {};
        Object.entries(importMapping).forEach(([key, colIdx]) => {
          let val = colIdx !== undefined ? row[colIdx] : undefined;
          if (val !== undefined && val !== null) val = String(val).trim();
          obj[key] = val;
        });
        return obj;
      }).filter(p => p.name && p.price !== undefined);

      const result = await bulkSaveProducts(toImport);
      setImportResult(result);
      setSuccessMsg(`Importación: ${result.created} creados, ${result.updated} actualizados, ${result.errors} errores`);
      setTimeout(() => { setSuccessMsg(""); setImportResult(null); }, 5000);
      loadProducts();
    } catch (e) { console.error(e); alert("Error en la importación"); }
    finally { setImporting(false); }
  };

  // ===== IMPORT INVENTORY =====
  const handleImportInvFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (json.length < 2) { alert("El archivo está vacío"); return; }
        const headers = json[0].map(h => String(h || "").trim());
        const rows = json.slice(1).filter(r => r.some(cell => cell !== undefined && cell !== null && cell !== ""));
        setImportInvHeaders(headers);
        setImportInvData(rows);

        const mapping = {};
        COLUMNAS_IMPORT_INV.forEach(col => {
          const idx = headers.findIndex(h => {
            const hl = h.toLowerCase();
            return hl === col.key.toLowerCase() || col.alt.some(a => hl === a.toLowerCase() || hl.includes(a.toLowerCase()));
          });
          if (idx >= 0) mapping[col.key] = idx;
        });
        if (mapping.stock === undefined) {
          const stockIdx = headers.findIndex(h => h.toLowerCase().includes("stock") || h.toLowerCase().includes("existencia") || h.toLowerCase().includes("cantidad"));
          if (stockIdx >= 0) mapping.stock = stockIdx;
        }
        setImportInvMapping(mapping);
      } catch (err) { console.error(err); alert("Error al leer el archivo Excel"); }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportInv = async () => {
    if (importInvMapping.sku === undefined && importInvMapping.barcode === undefined) {
      alert("Debes mapear al menos SKU o Código de Barras");
      return;
    }
    if (importInvMapping.stock === undefined) {
      alert("Debes mapear la columna de Stock");
      return;
    }
    setImportingInv(true);
    try {
      const allProducts = products;
      const toImport = importInvData.map(row => {
        const obj = {};
        Object.entries(importInvMapping).forEach(([key, colIdx]) => {
          let val = colIdx !== undefined ? row[colIdx] : undefined;
          if (val !== undefined && val !== null) val = String(val).trim();
          obj[key] = val;
        });
        return obj;
      }).filter(r => r.stock !== undefined && r.stock !== "" && (r.sku || r.barcode));

      let created = 0, updated = 0, errors = 0, skipped = 0;
      const batchOps = [];

      for (const item of toImport) {
        try {
          const qty = parseInt(item.stock);
          if (isNaN(qty) || qty < 0) { errors++; continue; }

          let product = null;
          if (item.sku) product = allProducts.find(p => p.sku === item.sku);
          if (!product && item.barcode) product = allProducts.find(p => p.barcode === item.barcode);

          if (!product) { skipped++; continue; }

          const prevStock = product.stock || 0;
          const newStock = qty;
          const diff = newStock - prevStock;

          if (diff === 0) { skipped++; continue; }

          const movType = diff > 0 ? "entrada" : "salida";

          batchOps.push({ type: "product", id: product.id, data: { stock: newStock } });
          batchOps.push({
            type: "movement",
            productId: product.id,
            productName: product.name,
            productSku: product.sku || "",
            movType,
            quantity: Math.abs(diff),
            previousStock: prevStock,
            newStock,
          });
          updated++;
        } catch (e) {
          console.error("Error importing inventory item:", e);
          errors++;
        }
      }

      const BATCH_SIZE = 500;
      for (let i = 0; i < batchOps.length; i += BATCH_SIZE) {
        const chunk = batchOps.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        for (const op of chunk) {
          if (op.type === "product") {
            batch.update(doc(db, "products", op.id), op.data);
          } else {
            const movRef = doc(collection(db, "inventory_movements"));
            batch.set(movRef, {
              productId: op.productId,
              productName: op.productName,
              productSku: op.productSku,
              type: op.movType,
              quantity: op.quantity,
              previousStock: op.previousStock,
              newStock: op.newStock,
              reason: "Importación masiva de inventario",
              reference: `IMP-${getLocalDateString()}`,
              userEmail: user?.email || "",
              createdAt: serverTimestamp(),
            });
          }
        }
        await batch.commit();
      }

      const result = { updated, skipped, errors };
      setImportInvResult(result);
      setSuccessMsg(`Inventario importado: ${result.updated} actualizados, ${result.skipped} saltados, ${result.errors} errores`);
      setTimeout(() => { setSuccessMsg(""); setImportInvResult(null); }, 5000);
      loadProducts();
      loadMovements();
    } catch (e) { console.error(e); alert("Error en la importación de inventario"); }
    finally { setImportingInv(false); }
  };

  // Export helpers
  const exportToExcel = (data, filename) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const handleExportMovimientos = () => {
    const exportData = filteredMovements.map(m => ({
      Fecha: formatDate(m.createdAt),
      Tipo: MOVEMENT_TYPES.find(t => t.key === m.type)?.label || m.type,
      Producto: m.productName,
      SKU: m.productSku,
      Cantidad: m.quantity,
      Stock_Anterior: m.previousStock,
      Stock_Nuevo: m.newStock,
      Motivo: m.reason,
      Referencia: m.reference,
      Usuario: m.userEmail,
    }));
    exportToExcel(exportData, `Movimientos_${getLocalDateString()}`);
  };

  const handleExportReportes = () => {
    const exportData = reportMovements.map(m => ({
      Fecha: formatDate(m.createdAt),
      Tipo: MOVEMENT_TYPES.find(t => t.key === m.type)?.label || m.type,
      Producto: m.productName,
      SKU: m.productSku,
      Cantidad: m.quantity,
      Stock_Anterior: m.previousStock,
      Stock_Nuevo: m.newStock,
      Motivo: m.reason,
      Referencia: m.reference,
      Usuario: m.userEmail,
    }));
    exportToExcel(exportData, `Reporte_${getLocalDateString()}`);
  };

  const handleExportProductos = () => {
    const data = filteredProducts.map(p => ({
      Nombre: p.name,
      SKU: p.sku,
      Código_Barras: p.barcode,
      Categoría: categories.find(c => c.id === p.category)?.name || "",
      Stock: p.stock,
      Precio: p.price,
      Valor_Stock: p.price * (p.stock || 0),
      Estado: p.stock === 0 ? "Agotado" : p.stock <= LOW_STOCK_THRESHOLD ? "Bajo" : "En stock",
    }));
    exportToExcel(data, `Inventario_${getLocalDateString()}`);
  };

  // Report helpers
  const reportSummary = reportMovements.reduce((acc, m) => {
    const typeDef = MOVEMENT_TYPES.find(t => t.key === m.type);
    if (typeDef?.sign === 1) acc.totalIn += m.quantity || 0;
    if (typeDef?.sign === -1) acc.totalOut += m.quantity || 0;
    const typeLabel = typeDef?.label || m.type;
    if (!acc.byType[typeLabel]) acc.byType[typeLabel] = 0;
    acc.byType[typeLabel]++;
    return acc;
  }, { totalIn: 0, totalOut: 0, byType: {} });

  // Group movements by reference for expandable display
  const groupedMovements = (() => {
    const groups = {};
    filteredMovements.forEach(m => {
      const ref = m.reference || m.id;
      if (!groups[ref]) groups[ref] = { ref, items: [], createdAt: m.createdAt, type: m.type, reason: m.reason };
      groups[ref].items.push(m);
      if (m.createdAt?.toDate?.() > new Date(0)) groups[ref].createdAt = m.createdAt;
      if (m.type) groups[ref].type = m.type;
    });
    return Object.values(groups).sort((a, b) => {
      const aDate = a.createdAt?.toDate?.() || new Date(0);
      const bDate = b.createdAt?.toDate?.() || new Date(0);
      return bDate - aDate;
    });
  })();

  // ===== KEYBOARD TABLE NAVIGATION =====
  const handleTableKeyDown = useCallback((e, items, onEnter, onSpace, getItemId) => {
    const key = e.key;
    if (!["ArrowDown", "ArrowUp", "Enter", " "].includes(key)) return;

    const target = e.target;
    const tag = target.tagName;
    const isEditing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;

    if (isEditing && (key === "ArrowDown" || key === "ArrowUp")) return;

    const row = target.closest("tr");
    if (!row) return;

    const tbody = row.parentElement;
    const rows = Array.from(tbody.querySelectorAll("tr[tabindex]"));
    const currentIdx = rows.indexOf(row);
    if (currentIdx === -1) return;

    if (key === "ArrowDown") {
      e.preventDefault();
      const nextRow = rows[currentIdx + 1];
      if (nextRow) {
        if (isEditing) nextRow.focus();
        else {
          const td = target.closest("td");
          const cellIdx = td ? Array.from(td.parentElement.children).indexOf(td) : 0;
          const nextCell = nextRow.children[cellIdx];
          if (nextCell) {
            const focusable = nextCell.querySelector('button, input, a, [tabindex="0"]');
            if (focusable) focusable.focus();
          }
        }
      }
    } else if (key === "ArrowUp") {
      e.preventDefault();
      const prevRow = rows[currentIdx - 1];
      if (prevRow) {
        if (isEditing) prevRow.focus();
        else {
          const td = target.closest("td");
          const cellIdx = td ? Array.from(td.parentElement.children).indexOf(td) : 0;
          const prevCell = prevRow.children[cellIdx];
          if (prevCell) {
            const focusable = prevCell.querySelector('button, input, a, [tabindex="0"]');
            if (focusable) focusable.focus();
          }
        }
      }
    } else if (key === "Enter" && !isEditing) {
      if (tag !== "BUTTON" && tag !== "A" && target.getAttribute("role") !== "button") {
        e.preventDefault();
        if (onEnter) {
          const item = items[currentIdx];
          if (item) onEnter(item, currentIdx);
        }
      }
    } else if (key === " " && !isEditing) {
      if (tag !== "INPUT" && tag !== "BUTTON" && tag !== "A" && target.getAttribute("role") !== "button") {
        e.preventDefault();
        if (onSpace) {
          const item = items[currentIdx];
          if (item) onSpace(item, currentIdx);
        }
      }
    }
  }, []);

  // ===== PRODUCT TABLE KEYBOARD =====
  const handleProdRowEnter = useCallback((product) => {
    openEditProduct(product);
  }, []);

  const handleProdRowSpace = useCallback((product) => {
    toggleSelectProduct(product.id);
  }, []);

  // ===== MOVEMENT TABLE KEYBOARD =====
  const handleMovRowEnter = useCallback((group, idx) => {
    if (group.items.length === 1) {
      openDetailModal(group.items[0]);
    } else {
      setGroupDetail(group);
    }
  }, []);

  const handleMovRowSpace = useCallback(() => {}, []); // no-op for movement rows

  if (authLoading || !user || !hasPermission("inventory")) {
    return <div style={{ minHeight: "100vh" }}><StoreHeader /><div className="loading-screen"><div className="spinner" /></div><StoreFooter /></div>;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <StoreHeader />
      <div className={styles.layout}>
        {/* ===== LEFT SIDEBAR ===== */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarTitle}>Módulo</div>
            <div className={styles.sidebarSubtitle}>Inventario</div>
          </div>
          <nav className={styles.sidebarNav}>
            {TABS.map(tab => (
              <button
                key={tab.key}
                className={`${styles.sidebarLink} ${activeTab === tab.key ? styles.sidebarLinkActive : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <tab.icon className={styles.sidebarLinkIcon} />
                <span>{tab.label}</span>
                {tab.key === "productos" && <span className={styles.sidebarLinkBadge}>{products.length}</span>}
                {tab.key === "movimientos" && <span className={styles.sidebarLinkBadge}>{movements.length}</span>}
              </button>
            ))}
            <div className={styles.sidebarDivider} />
            {canManage("inventory") && (
              <button className={styles.sidebarLink} onClick={() => setShowImport(true)}>
                <HiOutlineArrowDownTray className={styles.sidebarLinkIcon} />
                <span>Importar Productos</span>
              </button>
            )}
            {canManage("inventory") && (
              <button className={styles.sidebarLink} onClick={() => setShowImportInv(true)}>
                <HiOutlineDocumentText className={styles.sidebarLinkIcon} />
                <span>Importar Inventario</span>
              </button>
            )}
            <button className={styles.sidebarLink} onClick={handleExportProductos}>
              <HiOutlineArrowUpTray className={styles.sidebarLinkIcon} />
              <span>Exportar</span>
            </button>
          </nav>
          <div className={styles.sidebarFooter}>
            <div className={styles.sidebarFooterText}>{products.length} productos registrados</div>
          </div>
        </aside>

        {/* ===== MAIN CONTENT ===== */}
        <div className={styles.mainContent}>
          {successMsg && (
            <div style={{ padding: "0.5rem 1.5rem 0" }}>
              <div className={styles.toast}>
                <HiOutlineCheckCircle /> {successMsg}
              </div>
            </div>
          )}

          {/* KPI Strip */}
          <div style={{ padding: "1.15rem 1.5rem 0.35rem" }}>
            <div className={styles.kpiStrip}>
              <div className={styles.kpiCard} style={{ "--kpi-color": "#4F46E5", "--kpi-bg": "rgba(79, 70, 229, 0.08)" }}>
                <div className={styles.kpiIcon}><HiOutlineCube /></div>
                <div className={styles.kpiContent}>
                  <div className={styles.kpiValue}>{products.length}</div>
                  <div className={styles.kpiLabel}>Total Productos</div>
                </div>
              </div>
              <div className={styles.kpiCard} style={{ "--kpi-color": "#059669", "--kpi-bg": "rgba(5, 150, 105, 0.08)" }}>
                <div className={styles.kpiIcon}><HiOutlineCheckCircle /></div>
                <div className={styles.kpiContent}>
                  <div className={styles.kpiValue}>{products.filter(p => p.stock > LOW_STOCK_THRESHOLD).length}</div>
                  <div className={styles.kpiLabel}>En Stock</div>
                </div>
              </div>
              <div className={styles.kpiCard} style={{ "--kpi-color": "#D97706", "--kpi-bg": "rgba(217, 119, 6, 0.08)" }}>
                <div className={styles.kpiIcon}><HiOutlineExclamationTriangle /></div>
                <div className={styles.kpiContent}>
                  <div className={styles.kpiValue}>{products.filter(p => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD).length}</div>
                  <div className={styles.kpiLabel}>Stock Bajo</div>
                </div>
              </div>
              <div className={styles.kpiCard} style={{ "--kpi-color": "#0F172A", "--kpi-bg": "rgba(15, 23, 42, 0.06)" }}>
                <div className={styles.kpiIcon}><HiOutlineCurrencyDollar /></div>
                <div className={styles.kpiContent}>
                  <div className={styles.kpiValue}>{formatPrice(products.reduce((s, p) => s + p.price * (p.stock || 0), 0))}</div>
                  <div className={styles.kpiLabel}>Valor Inventario</div>
                </div>
              </div>
            </div>
          </div>

          {/* ===== TAB: PRODUCTOS ===== */}
          {activeTab === "productos" && (
            <div className={styles.contentArea}>
              <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <span className={styles.sectionTitle}>
                      <HiOutlineCube /> Listado de Productos
                      <span className={styles.sectionBadge}>{filteredProducts.length}</span>
                    </span>
                    <div className={styles.sectionActions}>
                      <div className={styles.searchBox} style={{ maxWidth: 200 }}>
                        <HiOutlineMagnifyingGlass className={styles.searchIcon} />
                        <input placeholder="Buscar nombre, SKU, código..." value={search} onChange={e => setSearch(e.target.value)} className={styles.searchInput} />
                      </div>
                      <select className={styles.filterSelect} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                        <option value="">Categorías</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <select className={styles.filterSelect} value={filterStock} onChange={e => setFilterStock(e.target.value)}>
                        <option value="all">Todos</option>
                        <option value="in">En stock</option>
                        <option value="low">Stock bajo</option>
                        <option value="out">Agotados</option>
                      </select>
                      {canManage("inventory") && (
                        <button className={styles.btnOutline} onClick={() => setShowImport(true)} style={{ padding: "0.3rem 0.6rem", fontSize: "0.7rem" }}>
                          <HiOutlineArrowDownTray /> Importar
                        </button>
                      )}
                      <button className={styles.btnOutline} onClick={handleExportProductos} style={{ padding: "0.3rem 0.6rem", fontSize: "0.7rem" }}>
                        <HiOutlineArrowUpTray /> Exportar
                      </button>
                      {selectedProducts.size > 0 && canManage("inventory") && (
                        <button className={styles.btnDanger} onClick={() => setDeleteConfirm("__bulk__")} style={{ padding: "0.3rem 0.6rem", fontSize: "0.7rem" }}>
                          <HiOutlineTrash /> Eliminar ({selectedProducts.size})
                        </button>
                      )}
                    </div>
                </div>
                  {undoStack.length > 0 && (
                    <div className={styles.undoBar}>
                      <HiOutlineArrowUturnLeft /> {undoStack.length} acción(es) para deshacer
                      <button className={styles.undoBarBtn} onClick={() => handleUndo(0)}>Deshacer última</button>
                      <button className={styles.undoBarDismiss} onClick={dismissUndo} title="Descartar"><HiOutlineXMark /></button>
                    </div>
                  )}
                {loading ? (
                  <div className={styles.centerState}><div className="spinner" /><p>Cargando productos...</p></div>
                ) : filteredProducts.length === 0 ? (
                  <div className={styles.emptyState}><HiOutlineCube size={32} /><p>No se encontraron productos</p></div>
                ) : (
                  <>
                  {filteredProducts.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 0 0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", color: "#475569" }}>
                        <span>Mostrar</span>
                        <select
                          value={pageSize}
                          onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                          style={{ padding: "0.25rem 0.4rem", border: "1.5px solid #CBD5E1", borderRadius: 5, fontSize: "0.73rem", background: "white", outline: "none", cursor: "pointer" }}
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                          <option value={0}>Todos</option>
                        </select>
                        <span>{filteredProducts.length} registros</span>
                      </div>
                      {pageSize > 0 && totalPages > 1 && (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ padding: "0.3rem 0.6rem", border: "1.5px solid #CBD5E1", borderRadius: 5, background: currentPage === 1 ? "#F1F5F9" : "white", color: currentPage === 1 ? "#94A3B8" : "#1E293B", fontSize: "0.73rem", cursor: currentPage === 1 ? "default" : "pointer", fontWeight: 600 }}>Anterior</button>
                          {(() => { const pages = []; const s = Math.max(1, currentPage - 2); const e = Math.min(totalPages, currentPage + 2); if (s > 1) { pages.push(<button key={1} onClick={() => setCurrentPage(1)} style={{ padding: "0.3rem 0.55rem", border: "1.5px solid #CBD5E1", borderRadius: 5, background: "white", color: "#1E293B", fontSize: "0.73rem", cursor: "pointer", fontWeight: 600, minWidth: 28, textAlign: "center" }}>1</button>); if (s > 2) pages.push(<span key="ds1" style={{ color: "#94A3B8", fontSize: "0.73rem", padding: "0 0.15rem" }}>···</span>); } for (let i = s; i <= e; i++) pages.push(<button key={i} onClick={() => setCurrentPage(i)} style={{ padding: "0.3rem 0.55rem", border: `1.5px solid ${i === currentPage ? "#4F46E5" : "#CBD5E1"}`, borderRadius: 5, background: i === currentPage ? "#4F46E5" : "white", color: i === currentPage ? "white" : "#1E293B", fontSize: "0.73rem", cursor: "pointer", fontWeight: 600, minWidth: 28, textAlign: "center" }}>{i}</button>); if (e < totalPages) { if (e < totalPages - 1) pages.push(<span key="ds2" style={{ color: "#94A3B8", fontSize: "0.73rem", padding: "0 0.15rem" }}>···</span>); pages.push(<button key={totalPages} onClick={() => setCurrentPage(totalPages)} style={{ padding: "0.3rem 0.55rem", border: "1.5px solid #CBD5E1", borderRadius: 5, background: "white", color: "#1E293B", fontSize: "0.73rem", cursor: "pointer", fontWeight: 600, minWidth: 28, textAlign: "center" }}>{totalPages}</button>); } return pages; })()}
                          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ padding: "0.3rem 0.6rem", border: "1.5px solid #CBD5E1", borderRadius: 5, background: currentPage === totalPages ? "#F1F5F9" : "white", color: currentPage === totalPages ? "#94A3B8" : "#1E293B", fontSize: "0.73rem", cursor: currentPage === totalPages ? "default" : "pointer", fontWeight: 600 }}>Siguiente</button>
                        </div>
                      )}
                    </div>
                  )}
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th className={styles.cellCheck}>
                            <input type="checkbox" checked={filteredProducts.length > 0 && selectedProducts.size === filteredProducts.length} onChange={toggleSelectAll} />
                          </th>
                          <th className={styles.cellImg}>Foto</th>
                          <th>Producto</th>
                          <th>SKU</th>
                          <th>Categoría</th>
                          <th style={{ textAlign: "right" }}>Precio</th>
                          <th style={{ textAlign: "center" }}>Stock</th>
                          <th style={{ textAlign: "right" }}>Valor</th>
                          <th style={{ textAlign: "center" }}>Ajuste</th>
                          {canManage("inventory") && <th style={{ textAlign: "right" }}>Acc.</th>}
                        </tr>
                      </thead>
                      <tbody onKeyDown={(e) => handleTableKeyDown(e, paginatedProducts, handleProdRowEnter, handleProdRowSpace)}>
                        {paginatedProducts.map((product, idx) => (
                          <tr key={product.id} tabIndex={0} style={idx === 0 ? {} : undefined}>
                            <td className={styles.cellCheck}>
                              <input type="checkbox" checked={selectedProducts.has(product.id)} onChange={() => toggleSelectProduct(product.id)} />
                            </td>
                            <td>
                              {product.images?.[0] ? <img src={product.images[0]} alt="" className={styles.cellThumb} /> : <div className={styles.cellThumbPH}><HiOutlinePhoto /></div>}
                            </td>
                            <td className={styles.cellName}>
                              <span className={styles.prodName}>{product.name}</span>
                              {product.brand && <span className={styles.prodMeta}>{product.brand}</span>}
                            </td>
                            <td className={styles.cellSku}><code>{product.sku || "—"}</code></td>
                            <td><span className={styles.cellCategory}>{categories.find(c => c.id === product.category)?.name || "—"}</span></td>
                            <td className={styles.cellPrice} style={{ textAlign: "right" }}>{formatPrice(product.price)}</td>
                            <td style={{ textAlign: "center" }}>
                              <span className={`${styles.stockBadge} ${product.stock === 0 ? styles.sOut : product.stock <= LOW_STOCK_THRESHOLD ? styles.sLow : styles.sOk}`}>
                                <span className={styles.stockDot} />
                                {product.stock === 0 ? "Agotado" : product.stock}
                              </span>
                            </td>
                            <td className={styles.cellValue} style={{ textAlign: "right" }}>{formatPrice(product.price * (product.stock || 0))}</td>
                            <td style={{ textAlign: "center" }}>
                              <div className={styles.qtyControls} style={{ justifyContent: "center" }}>
                                <button className={styles.qtyBtn} onClick={() => stockIncrement(product, -1)}><HiOutlineMinus /></button>
                                <input type="number" min="0" className={styles.inlineStockInput} value={stockEdits[product.id] ?? String(product.stock || 0)} onChange={e => handleStockChange(product.id, e.target.value)} onKeyDown={e => handleStockKeyDown(product, e)} onBlur={() => handleStockBlur(product)} />
                                <button className={styles.qtyBtn} onClick={() => stockIncrement(product, 1)}><HiOutlinePlus /></button>
                              </div>
                            </td>
                            {canManage("inventory") && (
                              <td style={{ textAlign: "right" }}>
                                <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                                  <button className={`${styles.actionBtn} ${styles.actionBtnEdit}`} onClick={() => openEditProduct(product)} title="Editar"><HiOutlinePencilSquare /></button>
                                  <button className={`${styles.actionBtn} ${styles.actionBtnDel}`} onClick={() => setDeleteConfirm(product)} title="Eliminar"><HiOutlineTrash /></button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ===== TAB: MOVIMIENTOS ===== */}
          {activeTab === "movimientos" && (
            <div className={styles.contentArea}>
              {showMovForm && canManage("inventory") && (
                <div className={styles.movFormCard}>
                  <h3 className={styles.movFormTitle}>
                    <HiOutlineClipboardDocumentList />
                    {editingMovement ? "Editar Movimiento" : "Registrar Movimiento"}
                  </h3>
                  <div className={styles.movFormGrid}>
                    <div className={styles.movFormField}>
                      <label>Tipo de Movimiento</label>
                      <div className={styles.typeChips}>
                        {MOVEMENT_TYPES.map(t => (
                          <button key={t.key} className={`${styles.typeChip} ${movForm.type === t.key ? styles.typeChipActive : ""}`} style={{ "--chip-color": t.color }} onClick={() => setMovForm(mf => ({ ...mf, type: t.key }))}>
                            <t.icon /> {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className={styles.movFormField}>
                      <label>Referencia</label>
                      <input value={movForm.reference} onChange={e => setMovForm(mf => ({ ...mf, reference: e.target.value }))} placeholder="Auto-generada si se deja vacía" className={styles.movInput} />
                    </div>
                    {editingMovement ? (
                      <>
                        <div className={styles.movFormField}>
                          <label>Producto</label>
                          <input value={productSearch} disabled className={styles.movInput} />
                          {movForm.productName && <span className={styles.selectedProduct}><HiOutlineCheckCircle size={14} /> {movForm.productName} {movForm.productSku && `· ${movForm.productSku}`} · Stock: {products.find(p => p.id === movForm.productId)?.stock ?? "—"}</span>}
                        </div>
                        <div className={styles.movFormField}>
                          <label>Cantidad</label>
                          <input type="number" min="1" value={movForm.quantity} onChange={e => setMovForm(mf => ({ ...mf, quantity: e.target.value }))} className={styles.movInput} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={styles.movFormField} style={{ gridColumn: "1 / -1" }}>
                          <label>Productos</label>
                          <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                            <div className={styles.productSearchWrap} style={{ flex: 1 }}>
                              <input value={productSearch} onChange={e => handleProductSearch(e.target.value)} onFocus={() => productSearchResults.length > 0 && setShowProductDropdown(true)} onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)} placeholder="Buscar producto por nombre, SKU..." className={styles.movInput} />
                              {showProductDropdown && (
                                <div className={styles.productDropdown}>
                                  {productSearchResults.map(p => (
                                    <div key={p.id} className={styles.dropItem} onClick={() => selectProduct(p)}>
                                      <span className={styles.dropName}>{p.name}</span>
                                      <span className={styles.dropSku}>SKU: {p.sku || "—"} | Stock: {p.stock || 0}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <input type="number" min="1" value={movAddQty} onChange={e => setMovAddQty(e.target.value)} style={{ width: 70 }} className={styles.movInput} placeholder="Cant" />
                            <button className={styles.btnPrimary} onClick={addMovItem} disabled={!movForm.productId} style={{ whiteSpace: "nowrap", height: 38 }}>
                              <HiOutlinePlus /> Agregar
                            </button>
                          </div>
                          {movItems.length > 0 && (
                            <div style={{ marginTop: "0.6rem", border: "1px solid #E2E8F0", borderRadius: 6, overflow: "hidden" }}>
                              <table className={styles.table} style={{ fontSize: "0.75rem" }}>
                                <thead>
                                  <tr>
                                    <th>Producto</th>
                                    <th style={{ textAlign: "center", width: 60 }}>Cant.</th>
                                    <th style={{ width: 40 }}></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {movItems.map(item => (
                                    <tr key={item.productId}>
                                      <td><span style={{ fontWeight: 600, fontSize: "0.78rem" }}>{item.productName}</span></td>
                                      <td style={{ textAlign: "center" }}>
                                        <input type="number" min="1" value={item.quantity} onChange={e => updateMovItemQty(item.productId, e.target.value)} style={{ width: 55, textAlign: "center" }} className={styles.movInput} />
                                      </td>
                                      <td style={{ textAlign: "center" }}>
                                        <button className={`${styles.actionBtn} ${styles.actionBtnDel}`} onClick={() => removeMovItem(item.productId)} style={{ width: 26, height: 26, fontSize: "0.75rem" }}><HiOutlineXMark /></button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    <div className={styles.movFormField}>
                      <label>Motivo</label>
                      <input value={movForm.reason} onChange={e => setMovForm(mf => ({ ...mf, reason: e.target.value }))} placeholder="Ej: Compra a proveedor..." className={styles.movInput} list="reason-suggestions" />
                      <datalist id="reason-suggestions">{(REASON_SUGGESTIONS[movForm.type] || []).map(s => <option key={s} value={s} />)}</datalist>
                    </div>
                    <div className={styles.movFormField}>
                      <label>Notas (opcional)</label>
                      <textarea value={movForm.notes} onChange={e => setMovForm(mf => ({ ...mf, notes: e.target.value }))} rows={2} placeholder="Notas adicionales..." className={styles.movTextarea} />
                    </div>
                  </div>
                  <div className={styles.movFormFooter}>
                    <button className={styles.btnGhost} onClick={() => { setShowMovForm(false); setEditingMovement(null); resetMovForm(); }}>Cancelar</button>
                    <button className={styles.btnPrimary} onClick={handleSubmitMovement} disabled={savingMov || (editingMovement ? !movForm.productId : movItems.length === 0)}>
                      {savingMov ? "Guardando..." : editingMovement ? "Actualizar" : `Registrar (${movItems.length} prod.)`}
                    </button>
                  </div>
                </div>
              )}

              {/* Movement type summary cards */}
              <div className={styles.movTypeGrid}>
                {MOVEMENT_TYPES.map(t => {
                  const count = movements.filter(m => m.type === t.key).length;
                  return (
                    <button key={t.key} className={styles.movTypeCard} style={{ "--card-color": t.color }} onClick={() => openTypeModal(t.key)}>
                      <t.icon className={styles.movTypeIcon} style={{ color: t.color }} />
                      <span className={styles.movTypeCount}>{count}</span>
                      <span className={styles.movTypeLabel}>{t.label}</span>
                      <HiOutlineEye className={styles.movTypeEye} />
                    </button>
                  );
                })}
              </div>

              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>
                    <HiOutlineClipboardDocumentList /> Historial de Movimientos
                    <span className={styles.sectionBadge}>{filteredMovements.length}</span>
                  </span>
                  <div className={styles.sectionActions}>
                    {canManage("inventory") && (
                      <button className={styles.btnPrimary} onClick={() => { setShowMovForm(!showMovForm); setEditingMovement(null); resetMovForm(); }}>
                        <HiOutlinePlus /> Nuevo
                      </button>
                    )}
                    <button className={styles.btnOutline} onClick={handleExportMovimientos}><HiOutlineArrowUpTray /> Exportar</button>
                    <div className={styles.typeFilterChips}>
                      {MOVEMENT_TYPES.map(t => (
                        <button key={t.key} className={`${styles.typeFilterChip} ${movFilterType === t.key ? styles.typeFilterChipActive : ""}`} style={{ "--chip-color": t.color }} onClick={() => setMovFilterType(movFilterType === t.key ? "" : t.key)}>
                          <t.icon /> {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {movLoading ? (
                  <div className={styles.centerState}><div className="spinner" /></div>
                ) : filteredMovements.length === 0 ? (
                  <div className={styles.emptyState}><HiOutlineClipboardDocumentList size={32} /><p>{canManage("inventory") ? "Aún no hay movimientos." : "No se encontraron movimientos."}</p></div>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th style={{ width: 30 }}></th>
                          <th>Referencia</th>
                          <th>Fecha</th>
                          <th>Tipo</th>
                          <th>Productos</th>
                          <th style={{ textAlign: "right" }}>Items</th>
                          <th>Motivo</th>
                          <th>Usuario</th>
                          {canManage("inventory") && <th style={{ textAlign: "right" }}>Acc.</th>}
                        </tr>
                      </thead>
                      <tbody onKeyDown={(e) => handleTableKeyDown(e, groupedMovements, handleMovRowEnter, handleMovRowSpace)}>
                        {groupedMovements.map((group, idx) => {
                          const isExpanded = expandedRef === group.ref;
                          const typeDef = MOVEMENT_TYPES.find(t => t.key === group.type);
                          const totalQty = group.items.reduce((s, i) => s + (i.quantity || 0), 0);
                          const firstItem = group.items[0];
                          return (
                            <Fragment key={group.ref}>
                              <tr tabIndex={0}
                                onClick={() => {
                                  if (group.items.length === 1) {
                                    openDetailModal(firstItem);
                                  } else {
                                    setGroupDetail(group);
                                  }
                                }}
                                style={{ cursor: "pointer", background: isExpanded ? "#F8FAFC" : undefined }}
                              >
                                <td style={{ textAlign: "center", fontSize: "0.7rem", color: "#94A3B8" }}>
                                  <span onClick={(e) => { e.stopPropagation(); if (group.items.length > 1) setExpandedRef(isExpanded ? null : group.ref); }} style={{ cursor: group.items.length > 1 ? "pointer" : "default" }}>
                                    {isExpanded ? "▾" : group.items.length > 1 ? "▸" : ""}
                                  </span>
                                </td>
                                <td><code style={{ fontWeight: 700, fontSize: "0.78rem", color: "#0F172A" }}>{group.ref}</code></td>
                                <td style={{ fontSize: "0.73rem", color: "#64748B" }}>
                                  {firstItem?.createdAt?.toDate ? firstItem.createdAt.toDate().toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                                </td>
                                <td>
                                  <span className={styles.movTypeBadge} style={{ background: `${typeDef?.color || "#636E72"}20`, color: typeDef?.color || "#636E72" }}>
                                    {typeDef?.icon && <typeDef.icon style={{ fontSize: "0.82rem" }} />}
                                    {typeDef?.label || (firstItem?.type || "—")}
                                  </span>
                                </td>
                                <td>
                                  {group.items.length === 1 ? (
                                    <span className={styles.movProdName}>{firstItem?.productName}</span>
                                  ) : (
                                    <span className={styles.movProdName} style={{ color: "#4F46E5" }}>
                                      {group.items.length} productos
                                    </span>
                                  )}
                                </td>
                                <td style={{ textAlign: "right", fontWeight: 600 }}>
                                  <span style={{ color: typeDef?.sign === 1 ? "#059669" : typeDef?.sign === -1 ? "#DC2626" : "inherit" }}>
                                    {typeDef?.sign === 1 ? "+" : typeDef?.sign === -1 ? "−" : ""}{totalQty}
                                  </span>
                                </td>
                                <td style={{ fontSize: "0.73rem", color: "#64748B" }}>{firstItem?.reason || "—"}</td>
                                <td style={{ fontSize: "0.7rem", color: "#94A3B8" }}>{firstItem?.userEmail || "—"}</td>
                                {(canManage("inventory") || canDeleteInventory) && (
                                  <td style={{ textAlign: "right" }}>
                                    <div style={{ display: "flex", gap: 3, justifyContent: "flex-end" }}>
                                      {canManage("inventory") && (
                                        <button className={`${styles.actionBtn} ${styles.actionBtnEdit}`} onClick={(e) => { e.stopPropagation(); handleEditMovement(firstItem); }} title="Editar"><HiOutlinePencilSquare /></button>
                                      )}
                                      {canDeleteInventory && (
                                        <button className={`${styles.actionBtn} ${styles.actionBtnDel}`} onClick={(e) => { e.stopPropagation(); handleDeleteMovement(firstItem); }} title="Eliminar"><HiOutlineTrash /></button>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                              {isExpanded && group.items.length > 1 && group.items.map(item => {
                                const itemTypeDef = MOVEMENT_TYPES.find(t => t.key === item.type);
                                return (
                                  <tr key={item.id} className={styles.expandedRow} onClick={() => openDetailModal(item)} style={{ cursor: "pointer" }}>
                                    <td></td>
                                    <td colSpan={2} style={{ fontSize: "0.7rem", color: "#94A3B8", paddingLeft: "2rem" }}>
                                      {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                                    </td>
                                    <td>
                                      {itemTypeDef?.icon && <itemTypeDef.icon style={{ fontSize: "0.75rem", color: itemTypeDef?.color, marginRight: 4 }} />}
                                    </td>
                                    <td colSpan={2}>
                                      <span className={styles.movProdName}>{item.productName}</span>
                                      {item.productSku && <span className={styles.movProdSku}> · {item.productSku}</span>}
                                    </td>
                                    <td style={{ fontSize: "0.73rem", color: "#64748B" }}>
                                      <span style={{ color: itemTypeDef?.sign === 1 ? "#059669" : itemTypeDef?.sign === -1 ? "#DC2626" : "inherit", fontWeight: 600 }}>
                                        {itemTypeDef?.sign === 1 ? "+" : itemTypeDef?.sign === -1 ? "−" : ""}{item.quantity}
                                      </span>
                                    </td>
                                    <td style={{ fontSize: "0.7rem", color: "#94A3B8" }}>{item.previousStock ?? "—"} → {item.newStock ?? "—"}</td>
                                    {(canManage("inventory") || canDeleteInventory) && <td></td>}
                                  </tr>
                                );
                              })}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== TAB: REPORTES ===== */}
          {activeTab === "reportes" && (
            <div className={styles.contentArea}>
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}><HiOutlineChartBar /> Reportes de Movimientos</span>
                  <div className={styles.sectionActions}>
                    <input type="date" value={reportDateFrom} onChange={e => setReportDateFrom(e.target.value)} className={styles.filterSelect} />
                    <span className={styles.filterSep}>—</span>
                    <input type="date" value={reportDateTo} onChange={e => setReportDateTo(e.target.value)} className={styles.filterSelect} />
                    <select className={styles.filterSelect} value={reportType} onChange={e => setReportType(e.target.value)}>
                      <option value="">Todos los tipos</option>
                      {MOVEMENT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                    <button className={styles.btnPrimary} onClick={loadReportes}><HiOutlineFunnel /> Filtrar</button>
                    <button className={styles.btnOutline} onClick={handleExportReportes} disabled={reportMovements.length === 0}><HiOutlineArrowUpTray /> Excel</button>
                    <button className={styles.btnOutline} onClick={() => generateMovementPDF(reportMovements, reportType || "all")} disabled={reportMovements.length === 0}><HiOutlinePrinter /> PDF</button>
                  </div>
                </div>
                <div style={{ padding: "1rem" }}>
                  {reportLoading ? (
                    <div className={styles.centerState}><div className="spinner" /></div>
                  ) : (
                    <>
                      <div className={styles.reportSummaryGrid}>
                        <div className={styles.reportSummaryCard}>
                          <span className={styles.reportSumVal} style={{ color: "#059669" }}>+{reportSummary.totalIn}</span>
                          <span className={styles.reportSumLabel}>Total Entradas</span>
                        </div>
                        <div className={styles.reportSummaryCard}>
                          <span className={styles.reportSumVal} style={{ color: "#DC2626" }}>−{reportSummary.totalOut}</span>
                          <span className={styles.reportSumLabel}>Total Salidas</span>
                        </div>
                        <div className={styles.reportSummaryCard}>
                          <span className={styles.reportSumVal}>{reportMovements.length}</span>
                          <span className={styles.reportSumLabel}>Movimientos</span>
                        </div>
                        <div className={styles.reportSummaryCard}>
                          <span className={styles.reportSumVal}>{Object.keys(reportSummary.byType).length === 0 ? "—" : `${Object.keys(reportSummary.byType).length} tipos`}</span>
                          <span className={styles.reportSumLabel}>Tipos de mov.</span>
                        </div>
                      </div>

                      {Object.keys(reportSummary.byType).length > 0 && (
                        <div className={styles.reportBreakdown}>
                          <h4>Desglose por tipo</h4>
                          {Object.entries(reportSummary.byType).map(([label, count]) => {
                            const pct = reportMovements.length > 0 ? Math.round((count / reportMovements.length) * 100) : 0;
                            return (
                              <div key={label} className={styles.breakdownItem}>
                                <span className={styles.breakdownLabel}>{label}</span>
                                <div className={styles.breakdownBar}><div className={styles.breakdownFill} style={{ width: `${pct}%` }} /></div>
                                <span className={styles.breakdownCount}>{count} ({pct}%)</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {reportMovements.length > 0 && (
                        <div className={styles.tableWrap} style={{ border: "1px solid #E2E8F0", borderRadius: 8 }}>
                          <table className={styles.table}>
                            <thead>
                              <tr>
                                <th>Fecha</th><th>Tipo</th><th>Producto</th>
                                <th style={{ textAlign: "right" }}>Cant.</th><th>Motivo</th><th>Usuario</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reportMovements.map(m => {
                                const typeDef = MOVEMENT_TYPES.find(t => t.key === m.type);
                                return (
                                  <tr key={m.id} onClick={() => openDetailModal(m)} style={{ cursor: "pointer" }}>
                                    <td style={{ fontSize: "0.73rem", color: "#64748B" }}>{m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                                    <td><span className={styles.movTypeBadge} style={{ background: `${typeDef?.color || "#636E72"}20`, color: typeDef?.color || "#636E72" }}>{typeDef?.icon && <typeDef.icon style={{ fontSize: "0.82rem" }} />} {typeDef?.label || m.type}</span></td>
                                    <td><span className={styles.movProdName}>{m.productName}</span>{m.productSku && <span className={styles.movProdSku}>{m.productSku}</span>}</td>
                                    <td style={{ textAlign: "right" }}><span style={{ color: typeDef?.sign === 1 ? "#059669" : typeDef?.sign === -1 ? "#DC2626" : "inherit", fontWeight: 600 }}>{typeDef?.sign === 1 ? "+" : typeDef?.sign === -1 ? "−" : ""}{m.quantity}</span></td>
                                    <td style={{ fontSize: "0.73rem", color: "#64748B" }}>{m.reason || "—"}</td>
                                    <td style={{ fontSize: "0.7rem", color: "#94A3B8" }}>{m.userEmail || "—"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {reportMovements.length === 0 && (
                        <div className={styles.emptyState}><HiOutlineChartBar size={32} /><p>Aplica filtros para ver el reporte</p></div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* ===== CARDEX ===== */}
              <div className={styles.sectionCard} style={{ marginTop: "1rem" }}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}><HiOutlineDocumentText /> Cardex de Producto</span>
                  <div className={styles.sectionActions}>
                    <div style={{ position: "relative", width: 280 }}>
                      <input value={cardexSearch} onChange={e => handleCardexSearch(e.target.value)} onFocus={() => cardexResults.length > 0 && setShowCardexDropdown(true)} onBlur={() => setTimeout(() => setShowCardexDropdown(false), 200)} placeholder="Buscar producto..." className={styles.movInput} />
                      {showCardexDropdown && (
                        <div className={styles.productDropdown}>
                          {cardexResults.map(p => (
                            <div key={p.id} className={styles.dropItem} onMouseDown={() => selectCardexProduct(p)}>
                              <span className={styles.dropName}>{p.name}</span>
                              <span className={styles.dropSku}>SKU: {p.sku || "—"} | Stock: {p.stock || 0}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {!cardexProductId ? (
                  <div className={styles.emptyState}><HiOutlineCube size={28} /><p>Selecciona un producto para ver su cardex</p></div>
                ) : cardexLoading ? (
                  <div className={styles.centerState}><div className="spinner" /></div>
                ) : cardexMovements.length === 0 ? (
                  <div className={styles.emptyState}><HiOutlineClipboardDocumentList size={28} /><p>Sin movimientos para este producto</p></div>
                ) : (
                  <>
                    <div style={{ padding: "0.75rem 1rem", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#0F172A" }}>{cardexProductName}</span>
                        <span style={{ fontSize: "0.78rem", color: "#64748B" }}>
                          Stock actual: <strong>{products.find(p => p.id === cardexProductId)?.stock ?? "—"}</strong>
                        </span>
                        <span style={{ fontSize: "0.78rem", color: "#64748B" }}>
                          Mov.: <strong>{cardexMovements.length}</strong>
                        </span>
                        <span style={{ fontSize: "0.78rem", color: "#059669" }}>
                          Entradas: <strong>+{cardexMovements.filter(m => { const td = MOVEMENT_TYPES.find(t => t.key === m.type); return td?.sign === 1; }).reduce((s, m) => s + (m.quantity || 0), 0)}</strong>
                        </span>
                        <span style={{ fontSize: "0.78rem", color: "#DC2626" }}>
                          Salidas: <strong>−{cardexMovements.filter(m => { const td = MOVEMENT_TYPES.find(t => t.key === m.type); return td?.sign === -1; }).reduce((s, m) => s + (m.quantity || 0), 0)}</strong>
                        </span>
                      </div>
                    </div>
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Fecha</th><th>Tipo</th><th>Ref.</th>
                            <th style={{ textAlign: "right" }}>Entrada</th>
                            <th style={{ textAlign: "right" }}>Salida</th>
                            <th style={{ textAlign: "right" }}>Stock</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            let bal = 0;
                            return cardexMovements.map(m => {
                              const td = MOVEMENT_TYPES.find(t => t.key === m.type);
                              const isIn = td?.sign === 1;
                              const isOut = td?.sign === -1;
                              const qty = m.quantity || 0;
                              if (isIn) bal += qty;
                              if (isOut) bal -= qty;
                              return (
                                <tr key={m.id} onClick={() => openDetailModal(m)} style={{ cursor: "pointer" }}>
                                  <td style={{ fontSize: "0.73rem", color: "#64748B" }}>
                                    {m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                                  </td>
                                  <td>
                                    <span className={styles.movTypeBadge} style={{ background: `${td?.color || "#636E72"}20`, color: td?.color || "#636E72" }}>
                                      {td?.icon && <td.icon style={{ fontSize: "0.8rem" }} />} {td?.label || m.type}
                                    </span>
                                  </td>
                                  <td><code style={{ fontSize: "0.7rem", color: "#64748B" }}>{m.reference || "—"}</code></td>
                                  <td style={{ textAlign: "right", color: "#059669", fontWeight: 600 }}>{isIn ? qty : "—"}</td>
                                  <td style={{ textAlign: "right", color: "#DC2626", fontWeight: 600 }}>{isOut ? qty : "—"}</td>
                                  <td style={{ textAlign: "right", fontWeight: 700, fontSize: "0.85rem" }}>{bal}</td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <StoreFooter />

      {/* ===== EDIT PRODUCT MODAL ===== */}
      {editProductModal && (
        <div className={styles.modalOverlay} onClick={() => !savingProduct && setEditProductModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}><HiOutlinePencilSquare /> Editar Producto</h2>
              <button className={styles.modalClose} onClick={() => setEditProductModal(null)} disabled={savingProduct}><HiOutlineXMark /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.editProdGrid}>
                <div className={styles.movFormField}>
                  <label>Nombre</label>
                  <input className={styles.movInput} value={editProductData.name || ""} onChange={e => setEditProductData(prev => ({ ...prev, name: e.target.value }))} />
                </div>
                <div className={styles.movFormField}>
                  <label>SKU</label>
                  <input className={styles.movInput} value={editProductData.sku || ""} onChange={e => setEditProductData(prev => ({ ...prev, sku: e.target.value }))} />
                </div>
                <div className={styles.movFormField}>
                  <label>Precio</label>
                  <input type="number" min="0" step="0.01" className={styles.movInput} value={editProductData.price || 0} onChange={e => setEditProductData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className={styles.movFormField}>
                  <label>Precio Anterior</label>
                  <input type="number" min="0" step="0.01" className={styles.movInput} value={editProductData.comparePrice || 0} onChange={e => setEditProductData(prev => ({ ...prev, comparePrice: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className={styles.movFormField}>
                  <label>Stock</label>
                  <input type="number" min="0" className={styles.movInput} value={editProductData.stock || 0} onChange={e => setEditProductData(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className={styles.movFormField}>
                  <label>Código de Barras</label>
                  <input className={styles.movInput} value={editProductData.barcode || ""} onChange={e => setEditProductData(prev => ({ ...prev, barcode: e.target.value }))} />
                </div>
                <div className={styles.movFormField}>
                  <label>Categoría</label>
                  <select className={styles.movInput} value={editProductData.category || ""} onChange={e => setEditProductData(prev => ({ ...prev, category: e.target.value }))}>
                    <option value="">Sin categoría</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className={styles.movFormField}>
                  <label>Marca</label>
                  <select className={styles.movInput} value={editProductData.brand || ""} onChange={e => setEditProductData(prev => ({ ...prev, brand: e.target.value }))}>
                    <option value="">Sin marca</option>
                    {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
                <div className={styles.movFormField} style={{ gridColumn: "1 / -1" }}>
                  <label>Descripción</label>
                  <textarea className={styles.movTextarea} rows={2} value={editProductData.description || ""} onChange={e => setEditProductData(prev => ({ ...prev, description: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={() => setEditProductModal(null)} disabled={savingProduct}>Cancelar</button>
              <button className={styles.btnPrimary} onClick={handleSaveProduct} disabled={savingProduct}>
                {savingProduct ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== DELETE PRODUCT CONFIRM ===== */}
      {deleteConfirm && (
        <div className={styles.modalOverlay} onClick={() => setDeleteConfirm(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle} style={{ color: "#EF4444" }}><HiOutlineExclamationTriangle /> Eliminar Producto</h2>
              <button className={styles.modalClose} onClick={() => setDeleteConfirm(null)}><HiOutlineXMark /></button>
            </div>
            <div className={styles.modalBody} style={{ textAlign: "center", padding: "1.5rem" }}>
              <HiOutlineExclamationTriangle size={48} style={{ color: "#EF4444", marginBottom: "0.75rem" }} />
              {deleteConfirm === "__bulk__" ? (
                <>
                  <p style={{ fontWeight: 650, fontSize: "0.95rem", marginBottom: "0.5rem" }}>
                    ¿Eliminar {selectedProducts.size} producto(s)?
                  </p>
                  <p style={{ color: "#1E293B", fontSize: "0.82rem" }}>
                    Los productos seleccionados se eliminarán permanentemente. Podrás deshacer esta acción.
                  </p>
                </>
              ) : (
                <>
                  <p style={{ fontWeight: 650, fontSize: "0.95rem", marginBottom: "0.5rem" }}>
                    ¿Eliminar "{deleteConfirm.name}"?
                  </p>
                  <p style={{ color: "#1E293B", fontSize: "0.82rem" }}>
                    Esta acción no se puede deshacer. El producto se eliminará permanentemente.
                  </p>
                </>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={() => setDeleteConfirm(null)}>Cancelar</button>
              <button className={styles.btnDanger} onClick={() => deleteConfirm === "__bulk__" ? handleBulkDelete() : handleDeleteProduct(deleteConfirm)}>
                <HiOutlineTrash /> {deleteConfirm === "__bulk__" ? `Eliminar ${selectedProducts.size}` : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MOVEMENT TYPE DETAIL MODAL ===== */}
      {typeModal && (
        <div className={styles.modalOverlay} onClick={() => setTypeModal(null)}>
          <div className={styles.modalLg} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                  {(() => {
                    const t = MOVEMENT_TYPES.find(x => x.key === typeModal);
                    return <>{t?.icon && <t.icon style={{ color: t.color, fontSize: "1.3rem" }} />}{t?.label || typeModal}</>;
                  })()}
                </span>
                <span className={styles.modalCount}>{typeMovements.length} registros</span>
              </h2>
              <div className={styles.modalHeaderActions}>
                <button className={styles.btnOutline} onClick={printTypeModal} disabled={typeMovements.length === 0}>
                  <HiOutlinePrinter /> Imprimir PDF
                </button>
                <button className={styles.modalClose} onClick={() => setTypeModal(null)}><HiOutlineXMark /></button>
              </div>
            </div>
            <div className={styles.modalBody}>
              {typeModalLoading ? (
                <div className={styles.centerState}><div className="spinner" /></div>
              ) : typeMovements.length === 0 ? (
                <div className={styles.emptyState}>
                  <HiOutlineArchiveBox size={32} />
                  <p>No hay registros de este tipo</p>
                </div>
              ) : (
                <div className={styles.typeModalSummary}>
                  <div className={styles.typeModalInfo}>
                    <span>Tipo: <strong>{MOVEMENT_TYPES.find(t => t.key === typeModal)?.label}</strong></span>
                    <span>Total registros: <strong>{typeMovements.length}</strong></span>
                    <span>Cantidad total: <strong>{typeMovements.reduce((s, m) => s + (m.quantity || 0), 0)}</strong></span>
                    <span>Fecha: <strong>{formatDateShort(new Date())}</strong></span>
                  </div>
                  <div className={styles.tableWrap} style={{ maxHeight: "50vh", overflow: "auto", border: "1px solid #E2E8F0", borderRadius: 8 }}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Fecha</th><th>Producto</th><th>SKU</th>
                          <th style={{ textAlign: "right" }}>Cant.</th><th style={{ textAlign: "center" }}>Stock Ant.</th>
                          <th style={{ textAlign: "center" }}>Stock Nuevo</th><th>Motivo</th><th>Ref.</th><th>Usuario</th>
                        </tr>
                      </thead>
                      <tbody>
                        {typeMovements.map(m => (
                          <tr key={m.id}>
                            <td style={{ fontSize: "0.73rem", color: "#64748B" }}>{formatDate(m.createdAt)}</td>
                            <td><span className={styles.movProdName}>{m.productName}</span></td>
                            <td style={{ fontSize: "0.7rem", color: "#64748B" }}>{m.productSku || "—"}</td>
                            <td style={{ textAlign: "right", fontWeight: 600 }}>{m.quantity}</td>
                            <td style={{ textAlign: "center" }}>{m.previousStock ?? "—"}</td>
                            <td style={{ textAlign: "center" }}>{m.newStock ?? "—"}</td>
                            <td style={{ fontSize: "0.73rem", color: "#64748B" }}>{m.reason || "—"}</td>
                            <td style={{ fontSize: "0.73rem", color: "#64748B" }}>{m.reference || "—"}</td>
                            <td style={{ fontSize: "0.7rem", color: "#94A3B8" }}>{m.userEmail || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== SINGLE MOVEMENT DETAIL MODAL ===== */}
      {detailMov && (() => {
        const typeDef = MOVEMENT_TYPES.find(t => t.key === detailMov.type);
        return (
          <div className={styles.modalOverlay} onClick={() => setDetailMov(null)}>
            <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                    {typeDef?.icon && <typeDef.icon style={{ color: typeDef.color, fontSize: "1.3rem" }} />}
                    Detalle de {typeDef?.label || "Movimiento"}
                  </span>
                </h2>
                <div className={styles.modalHeaderActions}>
                  <button className={styles.btnOutline} onClick={() => generateSingleMovementPDF(detailMov)}>
                    <HiOutlinePrinter /> PDF
                  </button>
                  <button className={styles.btnOutline} onClick={() => exportSingleMovementExcel(detailMov)}>
                    <HiOutlineArrowDownTray /> Excel
                  </button>
                  <button className={styles.modalClose} onClick={() => setDetailMov(null)}><HiOutlineXMark /></button>
                </div>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Producto</span>
                    <span className={styles.detailValue}>{detailMov.productName || "—"}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>SKU</span>
                    <span className={styles.detailValue}>{detailMov.productSku || "—"}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Tipo de Movimiento</span>
                    <span className={styles.detailValue} style={{ color: typeDef?.color }}>
                      <span className={styles.movTypeBadge} style={{ background: `${typeDef?.color || "#636E72"}20`, color: typeDef?.color }}>
                        {typeDef?.icon && <typeDef.icon style={{ fontSize: "0.85rem" }} />}
                        {typeDef?.label}
                      </span>
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Cantidad</span>
                    <span className={styles.detailValue} style={{ fontWeight: 700, fontSize: "1.1rem", color: typeDef?.sign === 1 ? "#10B981" : typeDef?.sign === -1 ? "#E17055" : "inherit" }}>
                      {typeDef?.sign === 1 ? "+" : typeDef?.sign === -1 ? "−" : ""}{detailMov.quantity}
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Stock Anterior</span>
                    <span className={styles.detailValue}>{detailMov.previousStock ?? "—"}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Stock Nuevo</span>
                    <span className={styles.detailValue} style={{ fontWeight: 600 }}>
                      {detailMov.newStock ?? "—"}
                      <span style={{ fontSize: "0.78rem", color: "#94A3B8", marginLeft: "0.5rem" }}>
                        ({detailMov.newStock > detailMov.previousStock ? "+" : ""}{detailMov.newStock - detailMov.previousStock})
                      </span>
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Motivo</span>
                    <span className={styles.detailValue}>{detailMov.reason || "—"}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Referencia</span>
                    <span className={styles.detailValue}>{detailMov.reference || "—"}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Usuario</span>
                    <span className={styles.detailValue}>{detailMov.userEmail || "—"}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Fecha</span>
                    <span className={styles.detailValue}>{formatDate(detailMov.createdAt)}</span>
                  </div>
                  {detailMov.notes && (
                    <div className={styles.detailItem} style={{ gridColumn: "1 / -1" }}>
                      <span className={styles.detailLabel}>Notas</span>
                      <span className={styles.detailValue} style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{detailMov.notes}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button className={styles.btnGhost} onClick={() => setDetailMov(null)}>Cerrar</button>
                <button className={styles.btnOutline} onClick={() => exportSingleMovementExcel(detailMov)}>
                  <HiOutlineArrowDownTray /> Exportar Excel
                </button>
                <button className={styles.btnPrimary} onClick={() => generateSingleMovementPDF(detailMov)}>
                  <HiOutlinePrinter /> Imprimir PDF
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== GROUP MOVEMENT DETAIL MODAL ===== */}
      {groupDetail && (() => {
        const group = groupDetail;
        const typeDef = MOVEMENT_TYPES.find(t => t.key === group.type);
        const totalQty = group.items.reduce((s, i) => s + (i.quantity || 0), 0);
        return (
          <div className={styles.modalOverlay} onClick={() => setGroupDetail(null)}>
            <div className={styles.modalLg} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
                    {typeDef?.icon && <typeDef.icon style={{ color: typeDef.color, fontSize: "1.3rem" }} />}
                    Movimiento {group.ref}
                  </span>
                  <span className={styles.modalCount}>{group.items.length} productos</span>
                </h2>
                <div className={styles.modalHeaderActions}>
                  <button className={styles.btnOutline} onClick={() => exportGroupExcel(group)}>
                    <HiOutlineArrowDownTray /> Exportar Excel
                  </button>
                  <button className={styles.btnOutline} onClick={() => generateMovementPDF(group.items, group.type)}>
                    <HiOutlinePrinter /> PDF
                  </button>
                  <button className={styles.modalClose} onClick={() => setGroupDetail(null)}><HiOutlineXMark /></button>
                </div>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.typeModalInfo}>
                  <span>Referencia: <strong>{group.ref}</strong></span>
                  <span>Tipo: <strong style={{ color: typeDef?.color }}>{typeDef?.label || "—"}</strong></span>
                  <span>Total productos: <strong>{group.items.length}</strong></span>
                  <span>Cantidad total: <strong>{totalQty}</strong></span>
                  <span>Motivo: <strong>{group.items[0]?.reason || "—"}</strong></span>
                  <span>Fecha: <strong>{formatDateShort(group.items[0]?.createdAt)}</strong></span>
                </div>
                <div className={styles.tableWrap} style={{ maxHeight: "50vh", overflow: "auto", border: "1px solid #E2E8F0", borderRadius: 8, marginTop: "0.85rem" }}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Producto</th><th>SKU</th><th>Tipo</th>
                        <th style={{ textAlign: "right" }}>Cant.</th>
                        <th style={{ textAlign: "center" }}>Stock Ant.</th>
                        <th style={{ textAlign: "center" }}>Stock Nuevo</th>
                        <th>Usuario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map(m => {
                        const itemTypeDef = MOVEMENT_TYPES.find(t => t.key === m.type);
                        return (
                          <tr key={m.id} onClick={() => { setGroupDetail(null); openDetailModal(m); }} style={{ cursor: "pointer" }}>
                            <td><span className={styles.movProdName}>{m.productName}</span></td>
                            <td style={{ fontSize: "0.7rem", color: "#64748B" }}>{m.productSku || "—"}</td>
                            <td>
                              <span className={styles.movTypeBadge} style={{ background: `${itemTypeDef?.color || "#636E72"}20`, color: itemTypeDef?.color || "#636E72" }}>
                                {itemTypeDef?.icon && <itemTypeDef.icon style={{ fontSize: "0.8rem" }} />} {itemTypeDef?.label || m.type}
                              </span>
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 600, color: itemTypeDef?.sign === 1 ? "#059669" : itemTypeDef?.sign === -1 ? "#DC2626" : "inherit" }}>
                              {itemTypeDef?.sign === 1 ? "+" : itemTypeDef?.sign === -1 ? "−" : ""}{m.quantity}
                            </td>
                            <td style={{ textAlign: "center" }}>{m.previousStock ?? "—"}</td>
                            <td style={{ textAlign: "center" }}>{m.newStock ?? "—"}</td>
                            <td style={{ fontSize: "0.7rem", color: "#94A3B8" }}>{m.userEmail || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button className={styles.btnGhost} onClick={() => setGroupDetail(null)}>Cerrar</button>
                <button className={styles.btnOutline} onClick={() => exportGroupExcel(group)}>
                  <HiOutlineArrowDownTray /> Exportar Excel
                </button>
                <button className={styles.btnPrimary} onClick={() => generateMovementPDF(group.items, group.type)}>
                  <HiOutlinePrinter /> Imprimir PDF
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ===== IMPORT MODAL ===== */}
      {showImport && (
        <div className={styles.modalOverlay} onClick={() => { if (!importing) setShowImport(false); }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}><HiOutlineArrowDownTray /> Importar Productos desde Excel</h2>
              <button className={styles.modalClose} onClick={() => setShowImport(false)} disabled={importing}><HiOutlineXMark /></button>
            </div>
            <div className={styles.modalBody}>
              <button
                className={`${styles.importGuideToggle} ${showGuide ? styles.importGuideToggleActive : ""}`}
                onClick={() => setShowGuide(g => !g)}
              >
                {showGuide ? "▾" : "▸"} {showGuide ? "Ocultar formato esperado" : "Ver formato esperado del Excel"}
              </button>

              {showGuide && (
                <div className={styles.importGuideContent}>
                  <div className={styles.importGuideTitle}>Formato de columnas esperado</div>
                  <div className={styles.importGuideSubtitle}>
                    Prepara tu archivo Excel con una fila de encabezados. El sistema detecta automáticamente
                    las columnas aunque uses nombres diferentes a los sugeridos.
                  </div>
                  <table className={styles.importGuideTable}>
                    <thead>
                      <tr>
                        <th style={{ width: "34%" }}>Columna</th>
                        <th style={{ width: "16%" }}>Requerido</th>
                        <th style={{ width: "30%" }}>Nombres aceptados</th>
                        <th style={{ width: "20%" }}>Ejemplo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {COLUMNAS_IMPORT.map(col => (
                        <tr key={col.key}>
                          <td><strong>{col.label.replace(" *", "")}</strong></td>
                          <td>
                            {col.label.includes("*") ? (
                              <span className={`${styles.importGuideBadge} ${styles.importGuideBadgeReq}`}>Requerido</span>
                            ) : (
                              <span className={`${styles.importGuideBadge} ${styles.importGuideBadgeOpt}`}>Opcional</span>
                            )}
                          </td>
                          <td><span className={styles.importGuideAlt}>{col.alt.slice(0, 3).join(", ")}</span></td>
                          <td><span className={styles.importGuideExample}>{col.key === "name" ? "Camiseta básica" : col.key === "price" ? "25.99" : col.key === "stock" ? "50" : col.key === "sku" ? "CAM-001" : col.key === "barcode" ? "7501234567890" : col.key === "category" ? "Ropa" : col.key === "brand" ? "Nike" : col.key === "comparePrice" ? "35.00" : "..."}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className={styles.importDropzone} onClick={() => fileInputRef.current?.click()}>
                <HiOutlineDocumentText size={40} />
                <p className={styles.dropText}>
                  {importData.length > 0
                    ? `${importData.length} filas cargadas. Click para cambiar archivo`
                    : "Click para seleccionar archivo Excel (.xlsx, .xls, .csv)"}
                </p>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} style={{ display: "none" }} />
              </div>

              {importData.length > 0 && (
                <>
                  <div className={styles.mappingSection}>
                    <h4>Mapeo de columnas</h4>
                    <div className={styles.mappingGrid}>
                      {COLUMNAS_IMPORT.map(col => (
                        <div key={col.key} className={styles.mappingItem}>
                          <label className={styles.mappingLabel}>{col.label}</label>
                          <select
                            className={styles.mappingSelect}
                            value={importMapping[col.key] !== undefined ? importMapping[col.key] : ""}
                            onChange={e => {
                              const val = e.target.value === "" ? undefined : parseInt(e.target.value);
                              setImportMapping(prev => ({ ...prev, [col.key]: val }));
                            }}
                          >
                            <option value="">— No mapear —</option>
                            {importHeaders.map((h, i) => <option key={i} value={i}>{h}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={styles.previewSection}>
                    <h4>Vista previa (primeras 5 filas)</h4>
                    <div className={styles.previewTableWrap}>
                      <table className={styles.previewTable}>
                        <thead>
                          <tr>
                            {importHeaders.map((h, i) => <th key={i}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {importData.slice(0, 5).map((row, i) => (
                            <tr key={i}>
                              {importHeaders.map((_, j) => <td key={j}>{row[j] !== undefined ? String(row[j]) : ""}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {importResult && (
                    <div className={styles.importResult}>
                      <HiOutlineCheckCircle /> {importResult.created} creados · {importResult.updated} actualizados · {importResult.errors} errores
                    </div>
                  )}
                </>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={() => setShowImport(false)} disabled={importing}>Cancelar</button>
              <button
                className={styles.btnPrimary}
                onClick={handleImport}
                disabled={importing || importData.length === 0 || importMapping.name === undefined || importMapping.price === undefined}
              >
                {importing ? "Importando..." : `Importar ${importData.length} productos`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== IMPORT INVENTARIO MODAL ===== */}
      {showImportInv && (
        <div className={styles.modalOverlay} onClick={() => { if (!importingInv) setShowImportInv(false); }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}><HiOutlineDocumentText /> Importar Inventario desde Excel</h2>
              <button className={styles.modalClose} onClick={() => setShowImportInv(false)} disabled={importingInv}><HiOutlineXMark /></button>
            </div>
            <div className={styles.modalBody}>
              <button
                className={`${styles.importGuideToggle} ${showImportInvGuide ? styles.importGuideToggleActive : ""}`}
                onClick={() => setShowImportInvGuide(g => !g)}
              >
                {showImportInvGuide ? "▾" : "▸"} {showImportInvGuide ? "Ocultar formato esperado" : "Ver formato esperado del Excel"}
              </button>

              {showImportInvGuide && (
                <div className={styles.importGuideContent}>
                  <div className={styles.importGuideTitle}>Formato de columnas esperado</div>
                  <div className={styles.importGuideSubtitle}>
                    Prepara tu archivo Excel con una fila de encabezados. El sistema buscará productos existentes
                    por SKU o Código de Barras y actualizará su stock sin duplicarlos.
                  </div>
                  <table className={styles.importGuideTable}>
                    <thead>
                      <tr>
                        <th style={{ width: "34%" }}>Columna</th>
                        <th style={{ width: "16%" }}>Requerido</th>
                        <th style={{ width: "30%" }}>Nombres aceptados</th>
                        <th style={{ width: "20%" }}>Ejemplo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {COLUMNAS_IMPORT_INV.map(col => (
                        <tr key={col.key}>
                          <td><strong>{col.label.replace(" *", "")}</strong></td>
                          <td>
                            {col.label.includes("*") ? (
                              <span className={`${styles.importGuideBadge} ${styles.importGuideBadgeReq}`}>Requerido</span>
                            ) : (
                              <span className={`${styles.importGuideBadge} ${styles.importGuideBadgeOpt}`}>Opcional</span>
                            )}
                          </td>
                          <td><span className={styles.importGuideAlt}>{col.alt.slice(0, 3).join(", ")}</span></td>
                          <td><span className={styles.importGuideExample}>{col.key === "sku" ? "CAM-001" : col.key === "barcode" ? "7501234567890" : col.key === "stock" ? "50" : "..."}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className={styles.importDropzone} onClick={() => fileInputRef.current?.click()}>
                <HiOutlineDocumentText size={40} />
                <p className={styles.dropText}>
                  {importInvData.length > 0
                    ? `${importInvData.length} filas cargadas. Click para cambiar archivo`
                    : "Click para seleccionar archivo Excel (.xlsx, .xls, .csv)"}
                </p>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportInvFileUpload} style={{ display: "none" }} />
              </div>

              {importInvData.length > 0 && (
                <>
                  <div className={styles.mappingSection}>
                    <h4>Mapeo de columnas</h4>
                    <div className={styles.mappingGrid}>
                      {COLUMNAS_IMPORT_INV.map(col => (
                        <div key={col.key} className={styles.mappingItem}>
                          <label className={styles.mappingLabel}>{col.label}</label>
                          <select
                            className={styles.mappingSelect}
                            value={importInvMapping[col.key] !== undefined ? importInvMapping[col.key] : ""}
                            onChange={e => {
                              const val = e.target.value === "" ? undefined : parseInt(e.target.value);
                              setImportInvMapping(prev => ({ ...prev, [col.key]: val }));
                            }}
                          >
                            <option value="">— No mapear —</option>
                            {importInvHeaders.map((h, i) => <option key={i} value={i}>{h}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                    <p style={{ fontSize: "0.7rem", color: "#64748B", marginTop: "0.5rem" }}>
                      El sistema buscará productos por SKU o Código de Barras. Solo se actualizarán productos existentes.
                    </p>
                  </div>

                  <div className={styles.previewSection}>
                    <h4>Vista previa (primeras 5 filas)</h4>
                    <div className={styles.previewTableWrap}>
                      <table className={styles.previewTable}>
                        <thead>
                          <tr>
                            {importInvHeaders.map((h, i) => <th key={i}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {importInvData.slice(0, 5).map((row, i) => (
                            <tr key={i}>
                              {importInvHeaders.map((_, j) => <td key={j}>{row[j] !== undefined ? String(row[j]) : ""}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {importInvResult && (
                    <div className={styles.importResult}>
                      <HiOutlineCheckCircle /> {importInvResult.updated} actualizados · {importInvResult.skipped} saltados · {importInvResult.errors} errores
                    </div>
                  )}
                </>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={() => setShowImportInv(false)} disabled={importingInv}>Cancelar</button>
              <button
                className={styles.btnPrimary}
                onClick={handleImportInv}
                disabled={importingInv || importInvData.length === 0 || (importInvMapping.sku === undefined && importInvMapping.barcode === undefined) || importInvMapping.stock === undefined}
              >
                {importingInv ? "Importando..." : `Importar inventario (${importInvData.length} filas)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
