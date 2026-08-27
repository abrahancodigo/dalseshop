"use client";

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { serverTimestamp } from "firebase/firestore";
import { HiOutlineChartBar, HiOutlineClipboardDocumentList, HiOutlineClock, HiOutlinePhoto, HiOutlineArrowUpTray, HiOutlineTrash, HiOutlineMagnifyingGlass, HiOutlineFunnel, HiOutlineArrowDownTray, HiOutlineDocumentText, HiOutlineInformationCircle } from "react-icons/hi2";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import { useAuth } from "@/context/AuthContext";
import { useImage } from "@/context/ImageContext";
import { useStore } from "@/context/StoreContext";
import { getProducts, getMarketResearch, saveMarketResearch, deleteMarketResearch } from "@/lib/firestore";
import { uploadImage, deleteFile } from "@/lib/storage";
import { formatPrice } from "@/lib/format";
import styles from "./estudio-mercado.module.css";

const COMPETITORS = [
  { key: "selectos", label: "Selectos" },
  { key: "sanNicolas", label: "San Nicolás" },
  { key: "siman", label: "Siman" },
  { key: "operadora", label: "La Operadora" },
];

const getCurrentPeriod = () => new Date().toISOString().slice(0, 7);

const emptyCompetitors = () => Object.fromEntries(
  COMPETITORS.map(({ key }) => [key, { price: "", screenshotUrl: "", sourceUrl: "", notes: "" }])
);

const makeDraft = (product, record) => ({
  id: record?.id || null,
  createdAt: record?.createdAt || null,
  updatedAt: record?.updatedAt || null,
  status: record?.status || "draft",
  productId: product.id,
  productName: product.name || "",
  productSku: product.sku || product.barcode || "",
  dalsePrice: record?.dalsePrice ?? product.price ?? 0,
  competitors: { ...emptyCompetitors(), ...(record?.competitors || {}) },
  notes: record?.notes || "",
});

const getDifference = (dalsePrice, competitorPrice) => {
  const dalse = Number(dalsePrice);
  const competitor = Number(competitorPrice);
  if (!competitor || !Number.isFinite(dalse)) return null;
  return ((dalse - competitor) / competitor) * 100;
};

const getRecordDate = (record) => {
  const value = record?.updatedAt || record?.createdAt || record?.investigatedAt;
  if (!value) return null;
  return value?.toDate ? value.toDate() : new Date(value);
};

const getResearchStatus = (draft) => {
  if (!draft?.id) return "pending";
  const prices = COMPETITORS.map(({ key }) => draft.competitors?.[key]?.price);
  const complete = prices.every((price) => Number(price) > 0);
  const date = getRecordDate(draft);
  const stale = date && Date.now() - date.getTime() > 30 * 24 * 60 * 60 * 1000;
  if (stale) return "stale";
  return complete ? "complete" : "partial";
};

const normalizeUrl = (value) => {
  const url = String(value || "").trim();
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
};

export default function EstudioMercadoPage() {
  const { user, hasPermission, canManage, role, loading: authLoading } = useAuth();
  const { openImage } = useImage();
  const { categories, brands } = useStore();
  const navigate = useNavigate();
  const canView = hasPermission("marketResearch");
  const canEdit = canManage("marketResearch");
  const [period, setPeriod] = useState(getCurrentPeriod);
  const [products, setProducts] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [history, setHistory] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [uploadingKey, setUploadingKey] = useState("");
  const [message, setMessage] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [comparePeriod, setComparePeriod] = useState("");
  const [comparisonDrafts, setComparisonDrafts] = useState({});
  const [detailTarget, setDetailTarget] = useState(null);
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!authLoading && (!user || !canView)) navigate("/auth/login", { replace: true });
  }, [authLoading, user, canView, navigate]);

  useEffect(() => {
    if (!user || !canView) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([getProducts({ isActive: true }), getMarketResearch({ periodKey: period })])
      .then(([productList, records]) => {
        if (cancelled) return;
        setProducts(productList);
        const recordMap = {};
        records.forEach((record) => { recordMap[record.productId] = record; });
        setDrafts(Object.fromEntries(productList.map((product) => [product.id, makeDraft(product, recordMap[product.id])] )));
      })
      .catch(() => setMessage("No se pudieron cargar los datos del estudio."))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period, user, canView]);

  useEffect(() => {
    if (!user || !canView || !comparePeriod || comparePeriod === period) {
      setComparisonDrafts({});
      return;
    }
    getMarketResearch({ periodKey: comparePeriod }).then((records) => {
      const map = {};
      records.forEach((record) => { map[record.productId] = record; });
      setComparisonDrafts(map);
    });
  }, [comparePeriod, period, user, canView]);

  const filteredProducts = useMemo(() => {
    const term = search.toLowerCase().trim();
    return products.filter((product) => {
      const matchesTerm = !term || [product.name, product.sku, product.barcode]
        .some((value) => String(value || "").toLowerCase().includes(term));
      const matchesCategory = !filterCategory || product.category === filterCategory;
      const matchesBrand = !filterBrand || product.brand === filterBrand;
      const status = getResearchStatus(drafts[product.id]);
      const matchesStatus = filterStatus === "all" || status === filterStatus;
      return matchesTerm && matchesCategory && matchesBrand && matchesStatus;
    });
  }, [products, search, filterCategory, filterBrand, filterStatus, drafts]);

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const visibleProducts = useMemo(() => (
    pageSize === 0 ? filteredProducts : filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  ), [filteredProducts, pageSize, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [search, filterCategory, filterBrand, filterStatus, pageSize, period]);

  const stats = useMemo(() => {
    const values = Object.values(drafts);
    const analyzed = values.filter((draft) => draft.id);
    const differences = analyzed.flatMap((draft) => COMPETITORS.map(({ key }) => getDifference(draft.dalsePrice, draft.competitors?.[key]?.price)).filter((value) => value !== null));
    return {
      total: products.length,
      analyzed: analyzed.length,
      complete: analyzed.filter((draft) => getResearchStatus(draft) === "complete").length,
      expensive: analyzed.filter((draft) => COMPETITORS.some(({ key }) => (getDifference(draft.dalsePrice, draft.competitors?.[key]?.price) || 0) > 0)).length,
      averageDifference: differences.length ? differences.reduce((sum, value) => sum + value, 0) / differences.length : 0,
    };
  }, [drafts, products.length]);

  const updateDraft = (productId, updates) => {
    setDrafts((current) => ({
      ...current,
      [productId]: { ...current[productId], ...updates },
    }));
  };

  const updateCompetitor = (productId, key, updates) => {
    const draft = drafts[productId];
    updateDraft(productId, {
      competitors: { ...draft.competitors, [key]: { ...draft.competitors[key], ...updates } },
    });
  };

  const saveRow = async (product, overrideDraft = null) => {
    const draft = overrideDraft || drafts[product.id];
    if (!draft) return;
    setSavingId(product.id);
    try {
      const id = await saveMarketResearch(draft.id, {
        ...draft,
        periodKey: period,
        investigatedBy: user.email || user.uid,
        investigatedByUid: user.uid,
        investigatedAt: serverTimestamp(),
      });
      updateDraft(product.id, { id });
      setMessage(`Estudio de ${product.name} guardado.`);
    } catch {
      setMessage("No se pudo guardar el estudio.");
    } finally {
      setSavingId(null);
    }
  };

  const uploadEvidence = async (product, competitorKey, file) => {
    if (!canEdit || !file || !file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) {
      setMessage("La captura no puede superar 10 MB.");
      return;
    }
    const uploadKey = `${product.id}-${competitorKey}`;
    setUploadingKey(uploadKey);
    try {
      const oldUrl = drafts[product.id]?.competitors?.[competitorKey]?.screenshotUrl;
      const screenshotUrl = await uploadImage(file, "market-research");
      const nextDraft = {
        ...drafts[product.id],
        competitors: {
          ...drafts[product.id].competitors,
          [competitorKey]: { ...drafts[product.id].competitors[competitorKey], screenshotUrl },
        },
      };
      updateDraft(product.id, nextDraft);
      await saveRow(product, nextDraft);
      if (oldUrl) deleteFile(oldUrl);
      setMessage("Captura subida y estudio actualizado.");
    } catch {
      setMessage("No se pudo subir la captura.");
    } finally {
      setUploadingKey("");
    }
  };

  const handlePaste = (event, product, competitorKey) => {
    if (!canEdit) return;
    const imageItem = [...(event.clipboardData?.items || [])].find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    event.preventDefault();
    uploadEvidence(product, competitorKey, imageItem.getAsFile());
  };

  const openHistory = async (product) => {
    setHistory({ product, loading: true, records: [] });
    const records = await getMarketResearch({ productId: product.id });
    setHistory({ product, loading: false, records: records.sort((a, b) => String(b.periodKey).localeCompare(String(a.periodKey))) });
  };

  const removeResearch = async (product) => {
    const id = drafts[product.id]?.id;
    if (!id || !window.confirm(`¿Eliminar el estudio de ${product.name} del período ${period}?`)) return;
    try {
      await deleteMarketResearch(id);
      Object.values(drafts[product.id]?.competitors || {}).forEach((item) => item.screenshotUrl && deleteFile(item.screenshotUrl));
      updateDraft(product.id, makeDraft(product));
      setMessage("Estudio eliminado.");
    } catch {
      setMessage("No se pudo eliminar el estudio.");
    }
  };

  const reportRows = filteredProducts.map((product) => {
    const draft = drafts[product.id] || makeDraft(product);
    const row = {
      Producto: product.name,
      "Código de barras": product.barcode || "",
      SKU: product.sku || "",
      Categoria: categories.find((item) => item.id === product.category)?.name || "",
      Marca: brands.find((item) => item.id === product.brand)?.name || product.brand || "",
      "Precio Dalse": Number(draft.dalsePrice) || 0,
    };
    COMPETITORS.forEach(({ key, label }) => {
      const price = Number(draft.competitors?.[key]?.price) || 0;
      row[label] = price;
      row[`${label} %`] = getDifference(draft.dalsePrice, price) ?? "";
    });
    return row;
  });

  const exportExcel = async () => {
    if (!reportRows.length) return;
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.json_to_sheet(reportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Mercado ${period}`);
    XLSX.writeFile(workbook, `Estudio_Mercado_${period}.xlsx`);
  };

  const exportPdf = async () => {
    if (!reportRows.length) return;
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    pdf.setFontSize(16);
    pdf.text(`Estudio de Mercado - ${period}`, 14, 14);
    autoTable(pdf, {
      startY: 20,
      head: [["Producto", "Código de barras", "SKU", "Dalse", ...COMPETITORS.flatMap(({ label }) => [label, "%"]) ]],
      body: reportRows.map((row) => [row.Producto, row["Código de barras"] || "-", row.SKU || "-", `$${formatPrice(row["Precio Dalse"])}`, ...COMPETITORS.flatMap(({ label }) => [row[label] ? `$${formatPrice(row[label])}` : "-", typeof row[`${label} %`] === "number" ? `${row[`${label} %`].toFixed(1)}%` : "-"]) ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [79, 70, 229] },
    });
    pdf.save(`Estudio_Mercado_${period}.pdf`);
  };

  const comparisonSummary = useMemo(() => {
    if (!comparePeriod || comparePeriod === period) return null;
    const changes = products.map((product) => {
      const current = drafts[product.id];
      const previous = comparisonDrafts[product.id];
      if (!current?.id || !previous) return null;
      return Number(current.dalsePrice) - Number(previous.dalsePrice);
    }).filter((value) => Number.isFinite(value));
    if (!changes.length) return null;
    return changes.reduce((sum, value) => sum + value, 0) / changes.length;
  }, [comparePeriod, period, products, drafts, comparisonDrafts]);

  if (authLoading || !user || !canView) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <div className={styles.page}>
      <StoreHeader />
      <main className={styles.main}>
        <div className={styles.heading}>
          <div>
            <span className={styles.eyebrow}><HiOutlineChartBar /> INTELIGENCIA DE PRECIOS</span>
            <h1>Estudio de Mercado</h1>
            <p>Compara tus precios con la competencia y conserva el historial de cada investigación.</p>
          </div>
          <label className={styles.periodPicker}>Período
            <input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
          </label>
        </div>

        <div className={styles.toolbar}>
          <label className={styles.search}><HiOutlineMagnifyingGlass /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, SKU o código..." /></label>
          <select className={styles.filter} value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}><option value="">Todas las categorías</option>{categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select className={styles.filter} value={filterBrand} onChange={(event) => setFilterBrand(event.target.value)}><option value="">Todas las marcas</option>{brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select className={styles.filter} value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}><option value="all">Todos los estados</option><option value="complete">Completas</option><option value="partial">Parciales</option><option value="pending">Sin investigar</option><option value="stale">Vencidas</option></select>
          <span className={styles.counter}><HiOutlineClipboardDocumentList /> {filteredProducts.length} productos</span>
          {!canEdit && <span className={styles.readOnly}>Solo lectura</span>}
        </div>

        <div className={styles.summaryGrid}>
          <div className={styles.summaryCard}><span>Productos</span><strong>{stats.total}</strong></div>
          <div className={styles.summaryCard}><span>Investigados</span><strong>{stats.analyzed}</strong><small>{stats.complete} completos</small></div>
          <div className={styles.summaryCard}><span>Dalse más caro</span><strong>{stats.expensive}</strong><small>en al menos una competencia</small></div>
          <div className={styles.summaryCard}><span>Diferencia promedio</span><strong className={stats.averageDifference > 0 ? styles.expensive : styles.cheaper}>{stats.averageDifference > 0 ? "+" : ""}{stats.averageDifference.toFixed(1)}%</strong><small>contra precios registrados</small></div>
        </div>

         <div className={styles.reportBar}><div><HiOutlineFunnel /><strong>Comparar períodos</strong><span>{comparisonSummary === null ? "Selecciona otro mes para ver cambios." : `Variación media del precio Dalse: ${comparisonSummary >= 0 ? "+" : ""}$${formatPrice(comparisonSummary)}`}</span></div><div className={styles.reportActions}><label>Fecha a comparar<input type="date" value={comparePeriod ? `${comparePeriod}-01` : ""} max={`${period}-01`} onChange={(event) => setComparePeriod(event.target.value ? event.target.value.slice(0, 7) : "")} /></label><button onClick={exportExcel}><HiOutlineArrowDownTray /> Excel</button><button onClick={exportPdf}><HiOutlineDocumentText /> PDF</button>{!loading && filteredProducts.length > 0 && <div className={`${styles.pagination} ${styles.paginationTop}`}><span>Mostrando {visibleProducts.length} de {filteredProducts.length}</span><label>Filas<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option><option value={0}>Todas</option></select></label><button disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => page - 1)}>Anterior</button><strong>Página {currentPage} de {totalPages}</strong><button disabled={currentPage >= totalPages} onClick={() => setCurrentPage((page) => page + 1)}>Siguiente</button></div>}</div></div>

        {message && <div className={styles.message}>{message}</div>}

        {loading ? <div className={styles.loading}><div className="spinner" /> Cargando productos...</div> : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr>
                <th className={styles.productCol}>Producto</th><th>Precio Dalse</th>
                {COMPETITORS.map((competitor) => <th key={competitor.key}>{competitor.label}</th>)}
                <th>Acciones</th>
              </tr></thead>
              <tbody>
                {visibleProducts.map((product) => {
                  const draft = drafts[product.id] || makeDraft(product);
                  return <tr key={product.id}>
                    <td className={styles.productCell}><div className={styles.productInfo}>
                      {product.images?.[0] ? <img src={product.images[0]} alt="" /> : <div className={styles.imagePlaceholder}><HiOutlinePhoto /></div>}
                      <div><strong>{product.name}</strong><small>Código de barras: {product.barcode || "Sin código de barras"}</small>{product.sku && <small>SKU: {product.sku}</small>}</div>
                    </div></td>
                    <td><input className={styles.priceInput} type="number" min="0" step="0.01" disabled={!canEdit} value={draft.dalsePrice} onChange={(event) => updateDraft(product.id, { dalsePrice: event.target.value })} /></td>
                    {COMPETITORS.map(({ key }) => {
                      const competitor = draft.competitors[key] || {};
                      const difference = getDifference(draft.dalsePrice, competitor.price);
                      const uploadKey = `${product.id}-${key}`;
                      return <td key={key}>
                        <div className={styles.competitorCell}>
                          <input className={styles.priceInput} type="number" min="0" step="0.01" disabled={!canEdit} value={competitor.price} placeholder="$" onChange={(event) => updateCompetitor(product.id, key, { price: event.target.value })} />
                          {difference !== null && <span className={`${styles.difference} ${difference > 0 ? styles.expensive : styles.cheaper}`}>{difference > 0 ? "+" : ""}{difference.toFixed(1)}% {difference > 0 ? "arriba" : difference < 0 ? "abajo" : "igual"}</span>}
                          <div className={styles.evidence} tabIndex={canEdit ? 0 : -1} onPaste={(event) => handlePaste(event, product, key)} title={canEdit ? "Pega una captura con Ctrl + V" : "Sin permiso de edición"}>
                            {competitor.screenshotUrl ? <button type="button" className={styles.evidencePreview} onClick={() => openImage(competitor.screenshotUrl)} title="Ver captura completa"><img src={competitor.screenshotUrl} alt={`Evidencia ${key}`} /></button> : <><HiOutlinePhoto /><span>{canEdit ? "Pegar captura" : "Sin evidencia"}</span></>}
                            {canEdit && <label className={styles.uploadButton}><HiOutlineArrowUpTray /><input type="file" accept="image/*" onChange={(event) => uploadEvidence(product, key, event.target.files?.[0])} />{uploadingKey === uploadKey ? "Subiendo" : "Subir"}</label>}
                          </div>
                        </div>
                      </td>;
                    })}
                    <td><div className={styles.actions}><span className={`${styles.status} ${styles[getResearchStatus(draft)]}`}>{({ complete: "Completa", partial: "Parcial", stale: "Vencida", pending: "Pendiente" })[getResearchStatus(draft)]}</span><button className={styles.saveButton} disabled={!canEdit || savingId === product.id} onClick={() => saveRow(product)}>{savingId === product.id ? "Guardando" : "Guardar"}</button><button className={styles.historyButton} onClick={() => openHistory(product)}><HiOutlineClock /> Historial</button><button className={styles.detailButton} onClick={() => setDetailTarget({ product, key: COMPETITORS[0].key })}><HiOutlineInformationCircle /> Detalles</button>{(role === "admin" || role === "superadmin") && draft.id && <button className={styles.deleteButton} title="Eliminar período" onClick={() => removeResearch(product)}><HiOutlineTrash /></button>}</div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}

         {!loading && filteredProducts.length > 0 && <div className={styles.pagination}><span>Mostrando {visibleProducts.length} de {filteredProducts.length}</span><label>Filas<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option><option value={0}>Todas</option></select></label><button disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => page - 1)}>Anterior</button><strong>Página {currentPage} de {totalPages}</strong><button disabled={currentPage >= totalPages} onClick={() => setCurrentPage((page) => page + 1)}>Siguiente</button></div>}
         {!loading && filteredProducts.length === 0 && <div className={styles.empty}>No hay productos que coincidan con la búsqueda.</div>}
        <p className={styles.help}>Las capturas se pueden pegar directamente con <strong>Ctrl + V</strong> dentro de la evidencia del competidor. Los porcentajes comparan el precio Dalse congelado en este período.</p>
      </main>
      <StoreFooter />

      {detailTarget && <div className={styles.modalBackdrop} onClick={() => setDetailTarget(null)}><section className={styles.detailModal} onClick={(event) => event.stopPropagation()}><button className={styles.modalClose} onClick={() => setDetailTarget(null)}>×</button><h2>Detalles de precios</h2><p className={styles.modalProduct}>{detailTarget.product.name}</p><div className={styles.competitorTabs}>{COMPETITORS.map(({ key, label }) => <button key={key} className={detailTarget.key === key ? styles.competitorTabActive : ""} onClick={() => setDetailTarget({ ...detailTarget, key })}>{label}</button>)}</div>{(() => { const item = drafts[detailTarget.product.id]?.competitors?.[detailTarget.key] || {}; return <div className={styles.detailForm}><label>Fuente o enlace<input value={item.sourceUrl || ""} disabled={!canEdit} placeholder="https://..." onChange={(event) => updateCompetitor(detailTarget.product.id, detailTarget.key, { sourceUrl: normalizeUrl(event.target.value) || event.target.value })} /></label><label>Sucursal / ubicación<input value={item.location || ""} disabled={!canEdit} onChange={(event) => updateCompetitor(detailTarget.product.id, detailTarget.key, { location: event.target.value })} /></label><label>Notas<textarea value={item.notes || ""} disabled={!canEdit} rows={4} onChange={(event) => updateCompetitor(detailTarget.product.id, detailTarget.key, { notes: event.target.value })} /></label>{item.sourceUrl && normalizeUrl(item.sourceUrl) && <a href={normalizeUrl(item.sourceUrl)} target="_blank" rel="noreferrer">Abrir fuente</a>}<button className={styles.saveButton} disabled={!canEdit || savingId === detailTarget.product.id} onClick={() => { saveRow(detailTarget.product); setDetailTarget(null); }}>Guardar detalles</button></div>; })()}</section></div>}

      {history && <div className={styles.modalBackdrop} onClick={() => setHistory(null)}><section className={styles.historyModal} onClick={(event) => event.stopPropagation()}><button className={styles.modalClose} onClick={() => setHistory(null)}>×</button><h2>Historial de {history.product.name}</h2>{history.loading ? <div className={styles.loading}><div className="spinner" /></div> : history.records.length === 0 ? <p>No hay investigaciones anteriores.</p> : <div className={styles.historyList}>{history.records.map((record) => <div className={styles.historyItem} key={record.id}><strong>{record.periodKey}</strong><span>Dalse: ${formatPrice(record.dalsePrice)}</span><span>{record.investigatedBy || "Usuario no registrado"}</span><div>{COMPETITORS.map(({ key, label }) => <span key={key}>{label}: {record.competitors?.[key]?.price ? `$${formatPrice(record.competitors[key].price)}` : "—"}</span>)}</div></div>)}</div>}</section></div>}
    </div>
  );
}
