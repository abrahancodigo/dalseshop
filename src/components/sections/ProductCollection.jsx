import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useNearViewport } from "@/hooks/useViewport";
import { normalizeProductOptions } from "@/lib/productFilters.mjs";
import ProductCard from "@/components/store/ProductCard";
import styles from "./sections.module.css";

export default function ProductCollection({ config, featured = false }) {
  const [ref, nearViewport] = useNearViewport();
  const { addItem } = useCart();
  const count = Math.min(48, Math.max(1, Math.floor(Number(config.count) || (featured ? 4 : 8))));
  const columns = Math.min(6, Math.max(1, Math.floor(Number(config.columns) || 4)));
  const optionsKey = JSON.stringify(normalizeProductOptions({ isActive: true, category: config.category, brand: config.brand, productCodes: config.productCodes, limitCount: count }));
  const key = `${featured}:${optionsKey}`;
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const loading = !result || result.key !== key || result.status === "loading";

  useEffect(() => {
    if (!nearViewport) return;
    let cancelled = false;
    setResult({ key, status: "loading", products: [] });
    const request = import("@/lib/firestore").then(({ getProducts, getFeaturedProducts }) => featured ? getFeaturedProducts(count) : getProducts(JSON.parse(optionsKey)));
    request.then((products) => { if (!cancelled) setResult({ key, status: "ready", products }); })
      .catch(() => { if (!cancelled) setResult({ key, status: "error", products: [] }); });
    return () => { cancelled = true; };
  }, [nearViewport, key, optionsKey, featured, count, retry]);

  const params = new URLSearchParams();
  if (config.category) params.set("categoria", config.category);
  if (config.brand) params.set("marca", config.brand);
  return <section ref={ref} className={`${styles.section} ${styles.productSection}`} aria-busy={loading}>
    <div className="container">
      {config.title && <h2 className={styles.sectionTitle}>{config.title}</h2>}
      {loading ? <div className={styles.productGrid} style={{ "--grid-cols": columns }} role="status" aria-label="Cargando productos">
        {Array.from({ length: count }, (_, index) => <div key={index} className={styles.productSkeleton} aria-hidden="true"><div /><span /><span /><b /></div>)}
      </div> : result.status === "error" ? <div className={styles.collectionMessage} role="status"><p>No pudimos cargar estos productos.</p><button className="btn btn-outline" onClick={() => setRetry((value) => value + 1)}>Volver a intentar</button></div>
        : result.products.length ? <div className={styles.productGrid} style={{ "--grid-cols": columns }}>
          {result.products.map((product) => <ProductCard key={product.id} product={product} onAddToCart={addItem} />)}
        </div> : <p className={styles.collectionMessage}>No hay productos disponibles en esta selección.</p>}
      {!featured && (config.category || config.brand) && <div className={styles.gridFooter}><Link to={`/productos?${params}`} className={styles.gridFooterBtn}>Ver todos los productos →</Link></div>}
    </div>
  </section>;
}
