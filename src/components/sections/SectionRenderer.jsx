"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { getProducts, getFeaturedProducts, addSubscriber } from "@/lib/firestore";
import { useCart } from "@/context/CartContext";
import { useImage } from "@/context/ImageContext";
import ProductCard from "@/components/store/ProductCard";
import { sanitizeHtml } from "@/lib/sanitize";
import { isYouTubeUrl, extractYouTubeId, getYouTubeEmbedUrl } from "@/lib/videoUtils";
import VideoPlayer from "./VideoPlayer";
import styles from "./sections.module.css";

// ============================================================
// TIKTOK EMBED HELPER
// ============================================================
function isTikTokUrl(url) {
  if (!url) return false;
  return /tiktok\.com/.test(url) || /vt\.tiktok\.com/.test(url) || /vm\.tiktok\.com/.test(url);
}

function TikTokEmbed({ url }) {
  const [videoId, setVideoId] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    async function resolve() {
      try {
        const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
        const res = await fetch(oembedUrl);
        if (!res.ok) throw new Error("oEmbed failed");
        const data = await res.json();
        if (cancelled) return;

        const match = data.html.match(/data-video-id="(\d+)"/);
        if (match) {
          setVideoId(match[1]);
        } else {
          setError(true);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [url]);

  if (error || !videoId) {
    if (error) {
      return (
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", padding: "1rem", background: "#111", color: "#fff", borderRadius: 12, textDecoration: "none" }}>
          Ver en TikTok
        </a>
      );
    }
    return null;
  }

  return (
    <iframe
      src={`https://www.tiktok.com/embed/v2/${videoId}`}
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      title="TikTok video"
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
    />
  );
}

// ============================================================
// MAIN RENDERER
// ============================================================
export default function SectionRenderer({ sections }) {
  if (!sections || sections.length === 0) return null;

  return (
    <div className={styles.renderer}>
      {sections.map((section, index) => (
        <SectionErrorBoundary key={section.id || `section-${index}`} section={section}>
          <RenderSection section={section} />
        </SectionErrorBoundary>
      ))}
    </div>
  );
}

function SectionErrorBoundary({ children, section }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Reset error when section changes
    setHasError(false);
  }, [section]);

  if (hasError) {
    return (
      <div className={styles.sectionError}>
        <div className="container">
          <p>Ocurrió un error al cargar la sección: <strong>{section.type}</strong></p>
        </div>
      </div>
    );
  }

  try {
    return children;
  } catch (error) {
    console.error("Section Error:", error, section);
    setHasError(true);
    return null;
  }
}

function RenderSection({ section }) {
  if (!section) return null;
  const { type, config = {} } = section;

  switch (type) {
    case "hero": return <HeroSection config={config} />;
    case "featuredProducts": return <FeaturedProductsSection config={config} />;
    case "productGrid": return <ProductGridSection config={config} />;
    case "textBlock": return <TextBlockSection config={config} />;
    case "mediaText": return <MediaTextSection config={config} />;
    case "imageGallery": return <ImageGallerySection config={config} />;
    case "testimonials": return <TestimonialsSection config={config} />;
    case "video": return <VideoSection config={config} />;
    case "faq": return <FAQSection config={config} />;
    case "newsletter": return <NewsletterSection config={config} />;
    case "banner": return <BannerSection config={config} />;
    case "separator": return <SeparatorSection config={config} />;
    case "customHtml": return <CustomHtmlSection config={config} />;
    case "fullWidthImage": return <FullWidthImageSection config={config} />;
    default: 
      console.warn(`Unknown section type: ${type}`);
      return null;
  }
}

// ============================================================
// HERO SECTION (Multi-Image Slider with 3D Cube Animation)
// ============================================================
function HeroSection({ config }) {
  const slides = config.slides?.length > 0
    ? config.slides
    : [{ image: config.image, title: config.title, subtitle: config.subtitle, buttonText: config.buttonText, buttonLink: config.buttonLink }];

  const { openImage } = useImage();
  const autoplaySpeed = (config.autoplaySpeed || 5) * 1000;
  const hasMultipleSlides = slides.length > 1;
  const isClickable = config.clickable === true || config.clickable === "true";

  const [current, setCurrent] = useState(0);
  const [previous, setPrevious] = useState(null);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState("next");
  const [modalIndex, setModalIndex] = useState(null);
  const timeoutRef = useRef(null);
  const animRef = useRef(null);

  const goTo = useCallback((index, dir = "next") => {
    if (animating || index === current) return;
    setDirection(dir);
    setPrevious(current);
    setCurrent(index);
    setAnimating(true);
    if (animRef.current) clearTimeout(animRef.current);
    animRef.current = setTimeout(() => {
      setAnimating(false);
      setPrevious(null);
    }, 900);
  }, [animating, current]);

  const goNext = useCallback(() => {
    goTo((current + 1) % slides.length, "next");
  }, [current, slides.length, goTo]);

  const goPrev = useCallback(() => {
    goTo((current - 1 + slides.length) % slides.length, "prev");
  }, [current, slides.length, goTo]);

  const goNextRef = useRef(goNext);
  goNextRef.current = goNext;

  useEffect(() => {
    if (!hasMultipleSlides) return;
    timeoutRef.current = setInterval(() => goNextRef.current(), autoplaySpeed);
    return () => clearInterval(timeoutRef.current);
  }, [hasMultipleSlides, autoplaySpeed]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearInterval(timeoutRef.current);
      if (animRef.current) clearTimeout(animRef.current);
    };
  }, []);

  const handleMouseEnter = () => { if (timeoutRef.current) clearInterval(timeoutRef.current); };
  const handleMouseLeave = () => {
    if (!hasMultipleSlides) return;
    if (timeoutRef.current) clearInterval(timeoutRef.current);
    timeoutRef.current = setInterval(() => goNextRef.current(), autoplaySpeed);
  };

  const openModal = useCallback((index) => {
    setModalIndex(index);
    if (timeoutRef.current) clearInterval(timeoutRef.current);
  }, []);

  const closeModal = useCallback(() => {
    setModalIndex(null);
    if (hasMultipleSlides) {
      timeoutRef.current = setInterval(() => goNextRef.current(), autoplaySpeed);
    }
  }, [hasMultipleSlides, autoplaySpeed]);

  const modalPrev = useCallback(() => {
    setModalIndex((i) => (i - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const modalNext = useCallback(() => {
    setModalIndex((i) => (i + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (modalIndex === null) return;
    const handleKey = (e) => {
      if (e.key === "Escape") closeModal();
      if (e.key === "ArrowLeft") modalPrev();
      if (e.key === "ArrowRight") modalNext();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [modalIndex, closeModal, modalPrev, modalNext]);

  const transition = config.transition || "cube";

  const getSlideStyle = (index) => {
    const diff = index - current;
    let dist = diff;
    if (slides.length > 2) {
      if (diff > 1) dist = diff - slides.length;
      if (diff < -1) dist = diff + slides.length;
    }

    const isCurrent = dist === 0;
    const isPrev = dist === -1 || (dist === slides.length - 1 && slides.length > 2);
    const isNext = dist === 1 || (dist === -(slides.length - 1) && slides.length > 2);

    let transform = "";
    let opacity = 1;
    let zIndex = 1;
    let visibility = "visible";
    let filter = "none";

    switch (transition) {
      case "fade":
        if (isCurrent) {
          transform = "translateX(0) scale(1)";
          zIndex = 10;
          opacity = 1;
        } else {
          transform = "translateX(0) scale(1)";
          opacity = 0;
          zIndex = 1;
          visibility = "hidden";
        }
        break;

      case "slide":
        if (isCurrent) {
          transform = "translateX(0) scale(1)";
          zIndex = 10;
        } else if (isNext || (dist === -(slides.length - 1) && slides.length > 2)) {
          transform = "translateX(100%) scale(1)";
          opacity = 0;
          zIndex = 1;
          visibility = "hidden";
        } else if (isPrev || (dist === slides.length - 1 && slides.length > 2)) {
          transform = "translateX(-100%) scale(1)";
          opacity = 0;
          zIndex = 1;
          visibility = "hidden";
        } else {
          transform = `translateX(${dist > 0 ? "100%" : "-100%"}) scale(1)`;
          opacity = 0;
          visibility = "hidden";
        }
        break;

      case "zoom":
        if (isCurrent) {
          transform = "translateX(0) scale(1)";
          zIndex = 10;
          opacity = 1;
        } else {
          transform = `translateX(0) scale(${dist > 0 ? 1.3 : 0.7})`;
          opacity = 0;
          zIndex = 1;
          visibility = "hidden";
        }
        break;

      case "blur":
        if (isCurrent) {
          transform = "translateX(0) scale(1)";
          zIndex = 10;
          opacity = 1;
          filter = "blur(0)";
        } else {
          transform = "translateX(0) scale(1.05)";
          opacity = 0;
          zIndex = 1;
          visibility = "hidden";
          filter = "blur(12px)";
        }
        break;

      case "flip":
        if (isCurrent) {
          transform = "translateX(0) rotateY(0deg) scale(1)";
          zIndex = 10;
          opacity = 1;
        } else if (isNext || (dist === -(slides.length - 1) && slides.length > 2)) {
          transform = "translateX(30%) rotateY(-90deg) scale(0.8)";
          opacity = 0;
          zIndex = 1;
        } else if (isPrev || (dist === slides.length - 1 && slides.length > 2)) {
          transform = "translateX(-30%) rotateY(90deg) scale(0.8)";
          opacity = 0;
          zIndex = 1;
        } else {
          transform = `translateX(${dist > 0 ? "100%" : "-100%"}) rotateY(${dist > 0 ? -90 : 90}deg) scale(0.5)`;
          opacity = 0;
          visibility = "hidden";
        }
        break;

      case "kenburn":
        if (isCurrent) {
          transform = "translateX(0) scale(1)";
          zIndex = 10;
          opacity = 1;
        } else {
          transform = "translateX(0) scale(1)";
          opacity = 0;
          zIndex = 1;
          visibility = "hidden";
        }
        break;

      default: // cube
        if (isCurrent) {
          transform = "translateX(0) scale(1) rotateY(0)";
          zIndex = 10;
        } else if (isNext || (dist === -(slides.length - 1) && slides.length > 2)) {
          transform = "translateX(50%) scale(0.8) rotateY(-35deg)";
          opacity = 0.6;
          zIndex = 5;
        } else if (isPrev || (dist === slides.length - 1 && slides.length > 2)) {
          transform = "translateX(-50%) scale(0.8) rotateY(35deg)";
          opacity = 0.6;
          zIndex = 5;
        } else {
          opacity = 0;
          visibility = "hidden";
          transform = `translateX(${dist > 0 ? "100%" : "-100%"}) scale(0.5)`;
        }
        break;
    }

    return {
      transform,
      opacity,
      zIndex,
      visibility,
      filter,
      transition: "all 0.7s cubic-bezier(0.4, 0, 0.2, 1)",
    };
  };

  return (
    <>
    <section
      className={styles.hero}
      style={{ minHeight: `${config.height || 500}px`, perspective: "1200px" }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={styles.coverflowContainer}>
        {slides.map((slide, index) => (
          <div 
            key={index} 
            className={styles.heroSlide}
            style={getSlideStyle(index)}
          >
            <div className={`${styles.slideCard} ${transition === "kenburn" && index === current ? styles.slideCardKenburn : ""}`}>
              {slide.image && (
                <img
                  src={slide.image}
                  alt={slide.title || ""}
                  className={styles.heroSlideImg}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isClickable) {
                      openModal(index);
                    } else {
                      openImage(slide.image);
                    }
                  }}
                  style={{ cursor: isClickable ? "zoom-in" : "pointer" }}
                  title={isClickable ? "Click para ver imagen completa" : ""}
                />
              )}
              <div className={styles.heroOverlay} style={{ opacity: (config.overlayOpacity || 30) / 100, pointerEvents: "none" }} />
              <div className={styles.heroContent} style={{ pointerEvents: "none" }}>
                {slide.title && <h1 className={styles.heroTitle}>{slide.title}</h1>}
                {slide.subtitle && <p className={styles.heroSubtitle}>{slide.subtitle}</p>}
                {slide.buttonText && (
                  <Link to={slide.buttonLink || "#"} className={styles.heroBtn} style={{ pointerEvents: "auto" }}>
                    {slide.buttonText}
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasMultipleSlides && (
        <>
          <button className={`${styles.heroArrow} ${styles.heroArrowPrev}`} onClick={goPrev} aria-label="Anterior">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button className={`${styles.heroArrow} ${styles.heroArrowNext}`} onClick={goNext} aria-label="Siguiente">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          
          {/* Slide counter like in the screenshot */}
          <div className={styles.heroCounter}>
            {current + 1} / {slides.length}
          </div>
        </>
      )}

      {hasMultipleSlides && (
        <div className={styles.heroThumbs}>
          {slides.map((slide, index) => (
            <button
              key={index}
              className={`${styles.heroThumb} ${index === current ? styles.heroThumbActive : ""}`}
              onClick={() => goTo(index, index > current ? "next" : "prev")}
              aria-label={`Slide ${index + 1}`}
            >
              <img src={slide.image} alt="" className={styles.heroThumbImg} />
            </button>
          ))}
        </div>
      )}
    </section>

    {modalIndex !== null && (
      <div className={styles.heroModalOverlay} onClick={closeModal}>
        <div className={styles.heroModalContent} onClick={(e) => e.stopPropagation()}>
          <button className={styles.heroModalClose} onClick={closeModal} aria-label="Cerrar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>

          {hasMultipleSlides && (
            <button className={`${styles.heroModalArrow} ${styles.heroModalArrowPrev}`} onClick={(e) => { e.stopPropagation(); modalPrev(); }} aria-label="Anterior">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}

          <img
            src={slides[modalIndex].image}
            alt={slides[modalIndex].title || "Banner completo"}
            className={styles.heroModalImage}
          />

          {hasMultipleSlides && (
            <button className={`${styles.heroModalArrow} ${styles.heroModalArrowNext}`} onClick={(e) => { e.stopPropagation(); modalNext(); }} aria-label="Siguiente">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}

          {hasMultipleSlides && (
            <div className={styles.heroModalCounter}>
              {modalIndex + 1} / {slides.length}
            </div>
          )}
        </div>
      </div>
    )}
  </>
  );
}

// ============================================================
// FEATURED PRODUCTS
// ============================================================
function FeaturedProductsSection({ config }) {
  const [products, setProducts] = useState([]);
  const { addItem } = useCart();
  const limit = config.count || 4;

  useEffect(() => {
    getFeaturedProducts(limit)
      .then(setProducts)
      .catch((err) => {
        console.error("Error fetching featured products:", err);
      });
  }, [limit]);

  if (products.length === 0) {
    return (
      <section className={styles.section}>
        <div className="container">
          {config.title && <h2 className={styles.sectionTitle}>{config.title}</h2>}
          <div className={styles.emptyGrid}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={styles.skeletonCard} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const cols = Math.min(Math.max(Number(config.columns) || 4, 1), 6);

  return (
    <section className={styles.section}>
      <div className="container">
        {config.title && <h2 className={styles.sectionTitle}>{config.title}</h2>}
        <div className={styles.productGrid} style={{ "--grid-cols": cols }}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} onAddToCart={(product) => addItem(product)} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// PRODUCT GRID
// ============================================================
function ProductGridSection({ config }) {
  const [products, setProducts] = useState([]);
  const { addItem } = useCart();
  const depsKey = useMemo(() => JSON.stringify({ category: config.category, brand: config.brand, count: config.count, productCodes: config.productCodes }), [config.category, config.brand, config.count, config.productCodes]);

  useEffect(() => {
    getProducts({
      isActive: true,
      category: config.category || undefined,
      brand: config.brand || undefined,
      productCodes: config.productCodes?.length ? config.productCodes : undefined,
      limitCount: config.count || 8,
    })
      .then(setProducts)
      .catch((err) => {
        console.error("Error fetching product grid:", err);
      });
  }, [depsKey]);

  if (products.length === 0) {
    return (
      <section className={styles.section}>
        <div className="container">
          {config.title && <h2 className={styles.sectionTitle}>{config.title}</h2>}
          <div style={{ textAlign: "center", padding: "3rem 1.5rem", background: "var(--color-surface)", borderRadius: "var(--border-radius)", border: "1px dashed var(--color-border)" }}>
            <p style={{ color: "var(--color-muted)", marginBottom: "1rem", fontSize: "1.1rem" }}>
              No se encontraron productos {(config.category || config.brand || config.productCodes?.length) ? "con los filtros seleccionados" : ""}.
            </p>
            <p style={{ fontSize: "0.875rem", maxWidth: "500px", margin: "0 auto", color: "var(--color-text)" }}>
              Asegúrate de que tus productos estén marcados como <strong>Activos</strong> en el panel de administración y que coincidan con los filtros seleccionados.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const cols = Math.min(Math.max(Number(config.columns) || 4, 1), 6);

  return (
    <section className={styles.section}>
      <div className="container">
        {config.title && <h2 className={styles.sectionTitle}>{config.title}</h2>}
        <div className={styles.productGrid} style={{ "--grid-cols": cols }}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} onAddToCart={(product) => addItem(product)} />
          ))}
        </div>
        {(config.category || config.brand) && (
          <div className={styles.gridFooter}>
            <Link
              to={`/productos${config.category ? `?categoria=${config.category}` : ""}${config.brand ? `${config.category ? "&" : "?"}marca=${config.brand}` : ""}`}
              className={styles.gridFooterBtn}
            >
              Ver todos los productos →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================
// TEXT BLOCK
// ============================================================
function TextBlockSection({ config }) {
  return (
    <section
      className={styles.section}
      style={{ background: config.backgroundColor || undefined, textAlign: config.alignment || "center" }}
    >
      <div className="container">
        {config.title && <h2 className={styles.sectionTitle}>{config.title}</h2>}
        {config.content && (
          <div className={styles.textContent} dangerouslySetInnerHTML={{ __html: sanitizeHtml(config.content.replace(/\n/g, "<br/>")) }} />
        )}
      </div>
    </section>
  );
}

// ============================================================
// MEDIA + TEXT (Split Section)
// ============================================================
function MediaTextSection({ config }) {
  const { openImage } = useImage();
  const mediaPosition = config.mediaPosition || "left";
  const verticalAlign = config.verticalAlign || "center";
  const isReversed = mediaPosition === "right";

  const alignMap = { top: "flex-start", center: "center", bottom: "flex-end" };
  const textAlignMap = { top: "left", center: "center", bottom: "left" };

  const getEmbedUrl = (url) => {
    if (!url) return "";
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return url;
  };

  const renderMedia = () => {
    if (config.mediaType === "video" && config.videoUrl) {
      if (isTikTokUrl(config.videoUrl)) {
        return (
          <div className={styles.mediaTextVideo}>
            <TikTokEmbed url={config.videoUrl} />
          </div>
        );
      }
      if (isYouTubeUrl(config.videoUrl)) {
        return <VideoPlayer url={config.videoUrl} title={config.title} />;
      }
      const embedUrl = getEmbedUrl(config.videoUrl);
      return (
        <div className={styles.mediaTextVideo}>
          <iframe
            src={embedUrl}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={config.title || "Video"}
          />
        </div>
      );
    }
    if (config.image) {
      return (
        <img
          src={config.image}
          alt={config.title || ""}
          className={styles.mediaTextImg}
          onClick={() => openImage(config.image)}
          style={{ cursor: "pointer" }}
          title="Click para ver imagen completa"
        />
      );
    }
    return <div className={styles.mediaTextPlaceholder}>Sin media</div>;
  };

  return (
    <section className={styles.mediaTextSection} style={{ background: config.backgroundColor || undefined }}>
      <div className={`container`}>
        {config.title && <h2 className={styles.sectionTitle} style={{ textAlign: "center" }}>{config.title}</h2>}
        <div className={`${styles.mediaTextContainer} ${isReversed ? styles.mediaTextReversed : ""}`} style={{ alignItems: alignMap[verticalAlign] }}>
          <div className={styles.mediaTextMedia}>
            {renderMedia()}
          </div>
          <div className={styles.mediaTextContent} style={{ textAlign: textAlignMap[verticalAlign] }}>
            {config.content && (
              <div className={styles.mediaTextText} dangerouslySetInnerHTML={{ __html: sanitizeHtml(config.content) }} />
            )}
            {config.buttonText && (
              <Link to={config.buttonLink || "#"} className={styles.mediaTextBtn}>
                {config.buttonText}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// IMAGE GALLERY
// ============================================================
function ImageGallerySection({ config }) {
  const { openImage } = useImage();
  if (!config.images?.length) return null;
  const cols = Math.min(Math.max(Number(config.columns) || 3, 1), 6);
  return (
    <section className={styles.section}>
      <div className="container">
        {config.title && <h2 className={styles.sectionTitle}>{config.title}</h2>}
        <div className={styles.gallery} style={{ "--grid-cols": cols }}>
          {config.images.map((img, i) => (
            <div key={i} className={styles.galleryItem} onClick={() => openImage(img)} style={{ cursor: "pointer" }} title="Click para ver imagen completa">
              <img src={img} alt={`Galería ${i + 1}`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// TESTIMONIALS
// ============================================================
function TestimonialsSection({ config }) {
  if (!config.items?.length) return null;
  return (
    <section className={styles.section} style={{ background: "var(--color-surface)" }}>
      <div className="container">
        {config.title && <h2 className={styles.sectionTitle}>{config.title}</h2>}
        <div className={styles.testimonials}>
          {config.items.map((item, i) => (
            <div key={i} className={styles.testimonialCard}>
              <div className={styles.testimonialStars}>
                {"★".repeat(item.rating || 5)}
              </div>
              <p className={styles.testimonialText}>"{item.text}"</p>
              <span className={styles.testimonialName}>— {item.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// VIDEO
// ============================================================
function VideoSection({ config }) {
  if (!config.url) return null;

  const isTikTok = isTikTokUrl(config.url);
  const isYT = isYouTubeUrl(config.url);

  if (isYT) {
    return (
      <section className={styles.section}>
        <div className="container">
          {config.title && <h2 className={styles.sectionTitle}>{config.title}</h2>}
          <VideoPlayer url={config.url} title={config.title} />
        </div>
      </section>
    );
  }

  const getEmbedUrl = (url) => {
    if (!url) return "";
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return url;
  };

  return (
    <section className={styles.section}>
      <div className="container">
        {config.title && <h2 className={styles.sectionTitle}>{config.title}</h2>}
        <div className={styles.videoWrapper}>
          {isTikTok ? (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <TikTokEmbed url={config.url} />
            </div>
          ) : (
            <iframe
              src={getEmbedUrl(config.url)}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={config.title || "Video"}
            />
          )}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// FAQ
// ============================================================
function FAQSection({ config }) {
  const [openIndex, setOpenIndex] = useState(null);

  if (!config.items?.length) return null;

  return (
    <section className={styles.section}>
      <div className="container" style={{ maxWidth: 800 }}>
        {config.title && <h2 className={styles.sectionTitle}>{config.title}</h2>}
        <div className={styles.faqList}>
          {config.items.map((item, i) => (
            <div key={i} className={`${styles.faqItem} ${openIndex === i ? styles.faqOpen : ""}`}>
              <button className={styles.faqQuestion} onClick={() => setOpenIndex(openIndex === i ? null : i)}>
                <span>{item.question}</span>
                <span className={styles.faqToggle}>{openIndex === i ? "−" : "+"}</span>
              </button>
              <div className={styles.faqAnswerWrapper}>
                <div className={styles.faqAnswer}>{item.answer}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// NEWSLETTER
// ============================================================
function NewsletterSection({ config }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await addSubscriber(email.trim());
      setSubmitted(true);
      setEmail("");
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={styles.newsletter}>
      <div className="container" style={{ maxWidth: 600, textAlign: "center" }}>
        {config.title && <h2 className={styles.sectionTitle} style={{ color: "white" }}>{config.title}</h2>}
        {config.subtitle && <p className={styles.newsletterSubtitle}>{config.subtitle}</p>}
        {submitted ? (
          <p style={{ color: "white", fontSize: "1rem", fontWeight: 600 }}>✓ ¡Gracias por suscribirte!</p>
        ) : (
          <form onSubmit={handleSubmit} className={styles.newsletterForm}>
            <input type="email" placeholder="tu@email.com" className={styles.newsletterInput} value={email} onChange={(e) => setEmail(e.target.value)} required />
            <button type="submit" className={styles.newsletterBtn} disabled={submitting}>{submitting ? "..." : config.buttonText || "Suscribir"}</button>
          </form>
        )}
      </div>
    </section>
  );
}

// ============================================================
// BANNER
// ============================================================
function BannerSection({ config }) {
  const height = config.height || "400";
  const padding = config.padding || "60px";
  const textAlign = config.textAlign || "center";
  const titleSize = config.titleSize || "large";
  const overlayOpacity = config.overlayOpacity || 0;
  const overlayColor = config.overlayColor || "#000000";
  
  const titleStyles = {
    small: { fontSize: "1.75rem", fontWeight: 700 },
    medium: { fontSize: "2.25rem", fontWeight: 800 },
    large: { fontSize: "3rem", fontWeight: 900 },
    xlarge: { fontSize: "3.75rem", fontWeight: 900 },
  };

  return (
    <section
      className={styles.banner}
      style={{
        backgroundImage: config.image ? `url(${config.image})` : undefined,
        backgroundColor: config.backgroundColor || "var(--color-primary)",
        minHeight: `${height}px`,
        padding: padding,
        textAlign: textAlign,
        position: "relative",
      }}
    >
      {/* Overlay */}
      {config.image && overlayOpacity > 0 && (
        <div 
          className={styles.bannerOverlay}
          style={{
            backgroundColor: overlayColor,
            opacity: overlayOpacity / 100,
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 0,
          }}
        />
      )}
      
      <div className="container" style={{ position: "relative", zIndex: 1 }}>
        {config.title && (
          <h2 
            className={styles.bannerTitle} 
            style={titleStyles[titleSize] || titleStyles.large}
          >
            {config.title}
          </h2>
        )}
        {config.subtitle && (
          <p className={styles.bannerSubtitle} style={{ fontSize: titleSize === "small" ? "1.1rem" : "1.25rem" }}>
            {config.subtitle}
          </p>
        )}
        {config.buttonText && (
          <Link to={config.buttonLink || "#"} className={styles.bannerBtn}>
            {config.buttonText}
          </Link>
        )}
      </div>
    </section>
  );
}

// ============================================================
// SEPARATOR
// ============================================================
function SeparatorSection({ config }) {
  return (
    <div className={styles.separator} style={{ height: `${config.height || 40}px` }}>
      {config.style === "line" && <hr className={styles.separatorLine} />}
      {config.style === "dots" && <div className={styles.separatorDots}>• • •</div>}
    </div>
  );
}

// ============================================================
// FULL WIDTH IMAGE
// ============================================================
function FullWidthImageSection({ config }) {
  if (!config.image) return null;

  const height = config.height || "auto";
  const objectFit = config.objectFit || "cover";
  const sectionStyle = {};

  if (height === "fullscreen") {
    sectionStyle.minHeight = "100vh";
  } else if (height !== "auto") {
    sectionStyle.height = `${height}px`;
  }

  const imgStyle = {
    width: "100%",
    height: "100%",
    objectFit: objectFit,
    display: "block",
  };

  const img = (
    <img
      src={config.image}
      alt={config.alt || ""}
      style={imgStyle}
      loading="lazy"
    />
  );

  return (
    <div className={styles.fullWidthImage} style={sectionStyle}>
      {config.link ? (
        <a
          href={config.link}
          target={config.link.startsWith("http") ? "_blank" : undefined}
          rel={config.link.startsWith("http") ? "noopener noreferrer" : undefined}
          style={{ display: "block", width: "100%", height: "100%", textDecoration: "none" }}
        >
          {img}
        </a>
      ) : (
        img
      )}
    </div>
  );
}

// ============================================================
// CUSTOM HTML
// ============================================================
function CustomHtmlSection({ config }) {
  if (!config.code) return null;
  return (
    <section className={styles.section}>
      <div className="container" dangerouslySetInnerHTML={{ __html: sanitizeHtml(config.code) }} />
    </section>
  );
}
