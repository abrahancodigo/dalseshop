"use client";

import { useEffect, useState, use } from "react";
import ProductCard from "@/components/store/ProductCard";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import { getProductBySlug, getReviews, saveReview, getRelatedProducts } from "@/lib/firestore";
import { useStore } from "@/context/StoreContext";
import { useCart } from "@/context/CartContext";
import { useImage } from "@/context/ImageContext";
import { 
  HiOutlineShoppingCart, 
  HiOutlineMinus, 
  HiOutlinePlus, 
  HiOutlineArrowLeft, 
  HiOutlineStar,
  HiOutlineMagnifyingGlassPlus 
} from "react-icons/hi2";
import Link from "next/link";
import styles from "./detalle.module.css";

export default function ProductDetailPage({ params }) {
  const resolvedParams = use(params);
  const { features, brands, categories } = useStore();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();
  const { openImage } = useImage();

  // Reviews
  const [reviews, setReviews] = useState([]);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ name: "", email: "", rating: 5, comment: "" });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState([]);

  useEffect(() => { 
    if (resolvedParams?.slug) {
      loadProduct(); 
    }
  }, [resolvedParams?.slug]);

const loadProduct = async () => {
    setLoading(true);
    setProduct(null);
    try {
      const p = await getProductBySlug(resolvedParams.slug);
      if (p) {
        setProduct(p);
        try {
          const r = await getReviews(p.id);
          console.log("Reviews loaded:", r.length, r);
          setReviews(r.filter((rev) => rev.isApproved !== false));
        } catch (revErr) {
          console.error("Reviews load error:", revErr);
          setReviews([]);
        }

        if (p.category) {
          try {
            const rel = await getRelatedProducts(p.category, p.id);
            setRelatedProducts(rel);
          } catch (err) {
            console.error("Related products error:", err);
          }
        }
      }
    } catch (err) { console.error("Error:", err); }
    finally { setLoading(false); }
  };

  const handleAddToCart = () => {
    if (product) {
      addItem(product, quantity);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewForm.name || !reviewForm.comment) return;
    setSubmittingReview(true);
    try {
await saveReview(null, {
          ...reviewForm,
          productId: product.id,
          productName: product.name,
          // New reviews are auto‑approved so they appear instantly
          isApproved: true,
        });
      setReviewSubmitted(true);
      setShowReviewForm(false);
      setReviewForm({ name: "", email: "", rating: 5, comment: "" });
    } catch (err) { console.error(err); }
    finally { setSubmittingReview(false); }
  };

  const hasDiscount = product?.comparePrice > 0 && product?.comparePrice > product?.price;
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + (r.rating || 5), 0) / reviews.length).toFixed(1) : null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <StoreHeader />

      <main className={styles.main}>
        <div className="container">
          <Link href="/productos" className={styles.backLink}>
            <HiOutlineArrowLeft />
            Volver al catálogo
          </Link>

          {!loading && product && (
            <nav className={styles.breadcrumbs}>
              <Link href="/">Inicio</Link>
              <span className={styles.separator}>/</span>
              <Link href="/productos">Productos</Link>
              {product.category && categories.find(c => c.id === product.category) && (
                <>
                  <span className={styles.separator}>/</span>
                  <Link href={`/productos?categoria=${product.category}`}>
                    {categories.find(c => c.id === product.category)?.name}
                  </Link>
                </>
              )}
              <span className={styles.separator}>/</span>
              <span className={styles.current}>{product.name}</span>
            </nav>
          )}

          {loading ? (
            <div className="loading-screen" style={{ minHeight: 400 }}>
              <div className="spinner" />
            </div>
          ) : !product ? (
            <div style={{ textAlign: "center", padding: "4rem 0" }}>
              <h2>Producto no encontrado</h2>
              <Link href="/productos" className="btn btn-primary" style={{ marginTop: "1rem" }}>
                Ver todos los productos
              </Link>
            </div>
          ) : (
            <>
              <div className={styles.productGrid}>
                {/* Images */}
                <div className={styles.images}>
                  <div className={styles.mainImageWrapper}>
                    <div className={styles.mainImage}>
                      {product.images?.[selectedImage] ? (
                        <img src={product.images[selectedImage]} alt={product.name} />
                      ) : (
                        <div className={styles.imagePlaceholder}>
                          <HiOutlineShoppingCart style={{ fontSize: "3rem" }} />
                        </div>
                      )}
                    </div>
                    {product.images?.[selectedImage] && (
                      <button
                        className={styles.lupaBtn}
                        onClick={() => openImage(product.images[selectedImage])}
                        title="Ver imagen ampliada"
                        aria-label="Ampliar imagen"
                      >
                        <HiOutlineMagnifyingGlassPlus />
                      </button>
                    )}
                  </div>
                  {product.images?.length > 1 && (
                    <div className={styles.thumbnails}>
                      {product.images.map((img, i) => (
                        <button
                          key={i}
                          className={`${styles.thumbnail} ${i === selectedImage ? styles.thumbnailActive : ""}`}
                          onClick={() => setSelectedImage(i)}
                        >
                          <img src={img} alt={`Vista ${i + 1}`} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className={styles.details}>
                  <h1 className={styles.productName}>{product.name}</h1>

<div className={styles.ratingRow}>
                      <span className={styles.ratingStars}>
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={i < Math.round(parseFloat(avgRating || 0)) ? styles.filledStar : styles.star}>★</span>
                        ))}
                      </span>
                      <span className={styles.ratingText}>
                        {avgRating ? `${avgRating} (${reviews.length} reseña${reviews.length !== 1 ? "s" : ""})` : `0 (${reviews.length} reseña${reviews.length !== 1 ? "s" : ""})`}
                      </span>
                    </div>

                  <div className={styles.priceBlock}>
                    <span className={styles.price}>${product.price?.toLocaleString()}</span>
                    {hasDiscount && (
                      <>
                        <span className={styles.comparePrice}>${product.comparePrice?.toLocaleString()}</span>
                        <span className={styles.discountBadge}>
                          -{Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)}%
                        </span>
                      </>
                    )}
                  </div>

                  {product.description && (
                    <div className={styles.description}>
                      <p>{product.description}</p>
                    </div>
                  )}

                  {product.stock > 0 && (
                    <p className={styles.stock}>✓ En stock ({product.stock} disponibles)</p>
                  )}

                  <div className={styles.addToCart}>
                    <div className={styles.quantityControl}>
                      <button onClick={() => setQuantity(Math.max(1, quantity - 1))}><HiOutlineMinus /></button>
                      <span>{quantity}</span>
                      <button onClick={() => setQuantity(quantity + 1)}><HiOutlinePlus /></button>
                    </div>
                    <button className={styles.addBtn} onClick={handleAddToCart}>
                      <HiOutlineShoppingCart />
                      {added ? "✓ Agregado" : "Agregar al Carrito"}
                    </button>
                  </div>

                  {product.tags?.length > 0 && (
                    <div className={styles.tags}>
                      {product.tags.map((tag) => (<span key={tag} className={styles.tag}>{tag}</span>))}
                    </div>
                  )}

                  <div className={styles.metaInfo}>
                    {product.sku && (
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>SKU</span>
                        <span className={styles.metaValue}>{product.sku}</span>
                      </div>
                    )}
                    {product.barcode && (
                      <div className={styles.metaItem}>
                        <span className={styles.metaLabel}>Código de barras</span>
                        <span className={styles.metaValue}>{product.barcode}</span>
                      </div>
                    )}
                     {product.brand && brands.find(b => b.id === product.brand) && (
                       <div className={styles.metaItem}>
                         <span className={styles.metaLabel}>Marca</span>
                         <span className={styles.metaValue}>{brands.find(b => b.id === product.brand)?.name}</span>
                       </div>
                     )}
                     {product.category && categories.find(c => c.id === product.category) && (
                       <div className={styles.metaItem}>
                         <span className={styles.metaLabel}>Categoría</span>
                         <span className={styles.metaValue}>{categories.find(c => c.id === product.category)?.name}</span>
                       </div>
                     )}
                  </div>
                </div>
              </div>

              {/* Reviews Section */}
              {features.reviews && (
                <div className={styles.reviewsSection}>
                  <div className={styles.reviewsHeader}>
                    <h2 className={styles.reviewsTitle}>
                      <HiOutlineStar /> Reseñas {reviews.length > 0 && `(${reviews.length})`}
                    </h2>
                    {!reviewSubmitted && (
                      <button className="btn btn-primary btn-sm" onClick={() => setShowReviewForm(!showReviewForm)}>
                        {showReviewForm ? "Cancelar" : "Escribir Reseña"}
                      </button>
                    )}
                  </div>

                  {reviewSubmitted && (
                    <div className={styles.reviewSuccess}>
                      ✓ ¡Gracias por tu reseña! Será publicada después de revisión.
                    </div>
                  )}

                  {showReviewForm && (
                    <form onSubmit={handleReviewSubmit} className={styles.reviewForm}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                        <div className="form-group">
                          <label className="form-label">Nombre *</label>
                          <input className="form-input" value={reviewForm.name} onChange={(e) => setReviewForm(p => ({ ...p, name: e.target.value }))} required placeholder="Tu nombre" />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Email</label>
                          <input type="email" className="form-input" value={reviewForm.email} onChange={(e) => setReviewForm(p => ({ ...p, email: e.target.value }))} placeholder="tu@email.com" />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Calificación</label>
                        <div className={styles.starPicker}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button key={n} type="button" className={`${styles.starBtn} ${n <= reviewForm.rating ? styles.starActive : ""}`} onClick={() => setReviewForm(p => ({ ...p, rating: n }))}>★</button>
                          ))}
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Comentario *</label>
                        <textarea className="form-textarea" value={reviewForm.comment} onChange={(e) => setReviewForm(p => ({ ...p, comment: e.target.value }))} required placeholder="Cuéntanos tu experiencia..." rows={3} />
                      </div>
                      <button type="submit" className="btn btn-primary" disabled={submittingReview}>{submittingReview ? "Enviando..." : "Enviar Reseña"}</button>
                    </form>
                  )}

                  {reviews.length === 0 && !showReviewForm && !reviewSubmitted && (
                    <p style={{ color: "var(--color-muted)", padding: "1rem 0" }}>Aún no hay reseñas. ¡Sé el primero en opinar!</p>
                  )}

                  {reviews.length > 0 && (
                    <div className={styles.reviewsList}>
                      {(showAllReviews ? reviews : reviews.slice(0,5)).map((rev) => (
                        <div key={rev.id} className={styles.reviewCard}>
                          <div className={styles.reviewCardTop}>
                            <strong>{rev.name}</strong>
                            <span className={styles.reviewStars}>{"★".repeat(rev.rating || 5)}</span>
                          </div>
                          <p className={styles.reviewComment}>{rev.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}
                { !showAllReviews && reviews.length > 5 && (
                  <button className="btn btn-sm btn-primary" onClick={() => setShowAllReviews(true)} style={{ marginTop: "1rem" }}>
                    Mostrar más ({reviews.length - 5}) reseñas
                  </button>
                )}
                { showAllReviews && reviews.length > 5 && (
                  <button className="btn btn-sm btn-ghost" onClick={() => setShowAllReviews(false)} style={{ marginTop: "1rem" }}>
                    Mostrar menos
                  </button>
                )}
              </div>
            )}
              {relatedProducts.length > 0 && (
                <div className={styles.relatedSection}>
                  <h3 className={styles.relatedTitle}>Productos Relacionados</h3>
                  <div className={styles.relatedGrid}>
                    {relatedProducts.map((p) => (
                      <ProductCard 
                        key={p.id} 
                        product={p} 
                        onAddToCart={() => addItem(p, 1)}
                      />
                    ))}
                  </div>
                </div>
              )}            
            </>
          )}
        </div>
      </main>

      <StoreFooter />
    </div>
  );
}
