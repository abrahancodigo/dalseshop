"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HiOutlineChartBar, HiOutlineClipboardDocumentList, HiOutlineClock, HiOutlinePhoto, HiOutlineArrowUpTray, HiOutlineTrash, HiOutlineMagnifyingGlass } from "react-icons/hi2";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import { useAuth } from "@/context/AuthContext";
import { useImage } from "@/context/ImageContext";
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

  const filteredProducts = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return products;
    return products.filter((product) => [product.name, product.sku, product.barcode]
      .some((value) => String(value || "").toLowerCase().includes(term)));
  }, [products, search]);

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
          <span className={styles.counter}><HiOutlineClipboardDocumentList /> {filteredProducts.length} productos</span>
          {!canEdit && <span className={styles.readOnly}>Solo lectura</span>}
        </div>

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
                {filteredProducts.map((product) => {
                  const draft = drafts[product.id] || makeDraft(product);
                  return <tr key={product.id}>
                    <td className={styles.productCell}><div className={styles.productInfo}>
                      {product.images?.[0] ? <img src={product.images[0]} alt="" /> : <div className={styles.imagePlaceholder}><HiOutlinePhoto /></div>}
                      <div><strong>{product.name}</strong><small>{product.sku || product.barcode || "Sin código"}</small><small>{product.description || ""}</small></div>
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
                    <td><div className={styles.actions}><button className={styles.saveButton} disabled={!canEdit || savingId === product.id} onClick={() => saveRow(product)}>{savingId === product.id ? "Guardando" : "Guardar"}</button><button className={styles.historyButton} onClick={() => openHistory(product)}><HiOutlineClock /> Historial</button>{(role === "admin" || role === "superadmin") && draft.id && <button className={styles.deleteButton} title="Eliminar período" onClick={() => removeResearch(product)}><HiOutlineTrash /></button>}</div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredProducts.length === 0 && <div className={styles.empty}>No hay productos que coincidan con la búsqueda.</div>}
        <p className={styles.help}>Las capturas se pueden pegar directamente con <strong>Ctrl + V</strong> dentro de la evidencia del competidor. Los porcentajes comparan el precio Dalse congelado en este período.</p>
      </main>
      <StoreFooter />

      {history && <div className={styles.modalBackdrop} onClick={() => setHistory(null)}><section className={styles.historyModal} onClick={(event) => event.stopPropagation()}><button className={styles.modalClose} onClick={() => setHistory(null)}>×</button><h2>Historial de {history.product.name}</h2>{history.loading ? <div className={styles.loading}><div className="spinner" /></div> : history.records.length === 0 ? <p>No hay investigaciones anteriores.</p> : <div className={styles.historyList}>{history.records.map((record) => <div className={styles.historyItem} key={record.id}><strong>{record.periodKey}</strong><span>Dalse: ${formatPrice(record.dalsePrice)}</span><span>{record.investigatedBy || "Usuario no registrado"}</span><div>{COMPETITORS.map(({ key, label }) => <span key={key}>{label}: {record.competitors?.[key]?.price ? `$${formatPrice(record.competitors[key].price)}` : "—"}</span>)}</div></div>)}</div>}</section></div>}
    </div>
  );
}
