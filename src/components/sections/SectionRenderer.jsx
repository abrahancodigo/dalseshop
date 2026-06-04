"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { getProducts, getFeaturedProducts, addSubscriber } from "@/lib/firestore";
import { useCart } from "@/context/CartContext";
import { useImage } from "@/context/ImageContext";
import ProductCard from "@/components/store/ProductCard";
import { sanitizeHtml } from "@/lib/sanitize";
import styles from "./sections.module.css";

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
  const [modalImage, setModalImage] = useState(null);
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

  const getSlideStyle = (index) => {
    const diff = index - current;
    
    // Simple circular distance for small slide counts
    let dist = diff;
    if (slides.length > 2) {
      if (diff > 1) dist = diff - slides.length;
      if (diff < -1) dist = diff + slides.length;
    }

    let transform = "translateX(0) scale(1) rotateY(0)";
    let opacity = 1;
    let zIndex = 1;
    let visibility = "visible";

    if (dist === 0) {
      transform = "translateX(0) scale(1) rotateY(0)";
      zIndex = 10;
    } else if (dist === 1 || (dist === -(slides.length - 1) && slides.length > 2)) {
      transform = "translateX(50%) scale(0.8) rotateY(-35deg)";
      opacity = 0.6;
      zIndex = 5;
    } else if (dist === -1 || (dist === (slides.length - 1) && slides.length > 2)) {
      transform = "translateX(-50%) scale(0.8) rotateY(35deg)";
      opacity = 0.6;
      zIndex = 5;
    } else {
      opacity = 0;
      visibility = "hidden";
      transform = `translateX(${dist > 0 ? "100%" : "-100%"}) scale(0.5)`;
    }

    return {
      transform,
      opacity,
      zIndex,
      visibility,
      transition: "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)"
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
            <div className={styles.slideCard}>
              {slide.image && (
                <img
                  src={slide.image}
                  alt={slide.title || ""}
                  className={styles.heroSlideImg}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isClickable) {
                      setModalImage(slide.image);
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

    {modalImage && (
      <div className={styles.heroModalOverlay} onClick={() => setModalImage(null)}>
        <div className={styles.heroModalContent} onClick={(e) => e.stopPropagation()}>
          <button className={styles.heroModalClose} onClick={() => setModalImage(null)} aria-label="Cerrar">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <img src={modalImage} alt="Banner completo" className={styles.heroModalImage} onClick={() => setModalImage(null)} />
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
      <section className={styles.sectionPlaceholder}>
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

  return (
    <section className={styles.section}>
      <div className="container">
        {config.title && <h2 className={styles.sectionTitle}>{config.title}</h2>}
        <div className={styles.productGrid} style={{ gridTemplateColumns: `repeat(${config.columns || 4}, 1fr)` }}>
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

  useEffect(() => {
    getProducts({
      isActive: true,
      category: config.category || undefined,
      limitCount: config.count || 8,
    })
      .then(setProducts)
      .catch((err) => {
        console.error("Error fetching product grid:", err);
      });
  }, [config.category, config.count]);

  if (products.length === 0) {
    return (
      <section className={styles.sectionPlaceholder}>
        <div className="container">
          {config.title && <h2 className={styles.sectionTitle}>{config.title}</h2>}
          <div style={{ textAlign: "center", padding: "3rem 1.5rem", background: "var(--color-surface)", borderRadius: "var(--border-radius)", border: "1px dashed var(--color-border)" }}>
            <p style={{ color: "var(--color-muted)", marginBottom: "1rem", fontSize: "1.1rem" }}>
              No se encontraron productos {config.category ? "en esta categoría" : ""}.
            </p>
            <p style={{ fontSize: "0.875rem", maxWidth: "500px", margin: "0 auto", color: "var(--color-text)" }}>
              Asegúrate de que tus productos estén marcados como <strong>Activos</strong> en el panel de administración y que pertenezcan a la categoría seleccionada.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <div className="container">
        {config.title && <h2 className={styles.sectionTitle}>{config.title}</h2>}
        <div className={styles.productGrid} style={{ gridTemplateColumns: `repeat(${config.columns || 4}, 1fr)` }}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} onAddToCart={(product) => addItem(product)} />
          ))}
        </div>
        {config.category && (
          <div className={styles.gridFooter}>
            <Link to={`/productos?categoria=${config.category}`} className={styles.gridFooterBtn}>
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
// IMAGE GALLERY
// ============================================================
function ImageGallerySection({ config }) {
  const { openImage } = useImage();
  if (!config.images?.length) return null;
  return (
    <section className={styles.section}>
      <div className="container">
        {config.title && <h2 className={styles.sectionTitle}>{config.title}</h2>}
        <div className={styles.gallery} style={{ gridTemplateColumns: `repeat(${config.columns || 3}, 1fr)` }}>
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
  const getEmbedUrl = (url) => {
    if (!url) return "";
    const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    if (youtubeMatch) return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return url;
  };

  if (!config.url) return null;

  return (
    <section className={styles.section}>
      <div className="container">
        {config.title && <h2 className={styles.sectionTitle}>{config.title}</h2>}
        <div className={styles.videoWrapper}>
          <iframe
            src={getEmbedUrl(config.url)}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={config.title || "Video"}
          />
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
              {openIndex === i && (
                <div className={styles.faqAnswer}>{item.answer}</div>
              )}
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
