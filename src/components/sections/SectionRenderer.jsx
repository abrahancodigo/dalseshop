"use client";

import { Component, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useImage } from "@/context/ImageContext";
import StoreImage from "@/components/store/StoreImage";
import HeroCarousel from "./HeroCarousel";
import ProductCollection from "./ProductCollection";
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
      loading="lazy"
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
          <RenderSection section={section} priority={index === 0} />
        </SectionErrorBoundary>
      ))}
    </div>
  );
}

class SectionErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error) { console.error('Section Error:', error); }
  componentDidUpdate(previous) {
    if (previous.section !== this.props.section && this.state.hasError) this.setState({ hasError: false });
  }
  render() {
    if (this.state.hasError) return <div className={styles.sectionError} role="alert"><div className="container"><p>No se pudo cargar esta sección.</p></div></div>;
    return this.props.children;
  }
}

function RenderSection({ section, priority }) {
  if (!section) return null;
  const { type, config = {} } = section;

  switch (type) {
    case "hero": return <HeroCarousel config={config} priority={priority} />;
    case "featuredProducts": return <ProductCollection config={config} featured />;
    case "productGrid": return <ProductCollection config={config} />;
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
    case "fullWidthImage": return <FullWidthImageSection config={config} priority={priority} />;
    default: 
      console.warn(`Unknown section type: ${type}`);
      return null;
  }
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
      loading="lazy"
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
        <StoreImage
          sizes="(max-width: 768px) 100vw, 50vw"
          src={config.image}
          alt={config.title || ""}
          className={styles.mediaTextImg}
          loading="lazy"
          decoding="async"
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
              <StoreImage src={img} alt={`Galería ${i + 1}`} sizes="(max-width: 768px) 50vw, 33vw" />
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
      loading="lazy"
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
      const { addSubscriber } = await import("@/lib/firestore");
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
function FullWidthImageSection({ config, priority }) {
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
    height: height === "auto" ? "auto" : "100%",
    objectFit: ["cover", "contain", "fill", "none", "scale-down"].includes(objectFit) ? objectFit : "cover",
    display: "block",
  };

  const img = (
    <StoreImage
      src={config.image}
      alt={config.alt || ""}
      style={imgStyle}
      sizes="100vw"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
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
