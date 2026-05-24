"use client";

import { useEffect, useState } from "react";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import { getBlogPostBySlug, getBlogPosts, getBlogConfig } from "@/lib/supabase-queries";
import { useParams, Link } from "react-router-dom";
import { HiOutlineArrowLeft, HiOutlineCalendar, HiOutlineUser } from "react-icons/hi2";
import { sanitizeHtml } from "@/lib/sanitize";
import styles from "./detalle.module.css";

export default function BlogPostPage() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({});

  useEffect(() => {
    Promise.all([
      getBlogPostBySlug(slug).then((p) => { if (p) setPost(p); }),
      getBlogPosts().then((all) => {
        const idx = all.findIndex(p => p.slug === slug);
        setRelated(all.filter((_, i) => i !== idx && i < 3));
      }).catch(() => {}),
      getBlogConfig().then(setConfig).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [slug]);

  const blogColors = {
    "--blog-bg": config.bgColor || "var(--color-secondary)",
    "--blog-text": config.textColor || "#FFFFFF",
    "--blog-card-bg": config.cardBg || "rgba(255,255,255,0.04)",
    "--blog-accent": config.accentColor || "var(--color-accent)",
    "--blog-gradient-from": config.gradientFrom || "var(--color-accent)",
    "--blog-gradient-to": config.gradientTo || "var(--color-primary)",
  };

  const formatDate = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  };

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <StoreHeader />
        <div className={styles.loadingWrap}><div className="spinner" /></div>
        <StoreFooter />
      </div>
    );
  }

  if (!post) {
    return (
      <div className={styles.wrapper}>
        <StoreHeader />
        <div className={styles.notFound}>
          <div className={styles.notFoundIcon}>🔍</div>
          <h2 className={styles.notFoundTitle}>Artículo no encontrado</h2>
          <p className={styles.notFoundText}>El artículo que buscas no existe o ha sido eliminado.</p>
          <Link to="/blog" className={styles.notFoundBtn}>
            <HiOutlineArrowLeft /> Volver al blog
          </Link>
        </div>
        <StoreFooter />
      </div>
    );
  }

  return (
    <div className={styles.wrapper} style={blogColors}>
      <StoreHeader />

      {/* ─── Hero minimal ─── */}
      <section className={styles.hero}>
        <div className={styles.heroBg}>
          <div className={styles.heroOrb1} />
          <div className={styles.heroOrb2} />
          <div className={styles.heroGrid} />
        </div>
        <div className="container">
          <div className={styles.heroTop}>
            <Link to="/blog" className={styles.backLink}>
              <HiOutlineArrowLeft /> Blog
            </Link>
            {post.category && (
              <span className={styles.heroBadge}>{post.category}</span>
            )}
          </div>
        </div>
      </section>

      {/* ─── Article: image sticky left + content right ─── */}
      <section className={styles.mainSection}>
        <div className="container">
          <div className={styles.articleLayout}>
            {post.image && (
              <div className={styles.imageColumn}>
                <div className={styles.articleImage}>
                  <img src={post.image} alt={post.title} />
                </div>
              </div>
            )}
            <div className={styles.contentColumn}>
              <h1 className={styles.articleTitle}>{post.title}</h1>
              <div className={styles.articleMeta}>
                <span className={styles.articleMetaItem}>
                  <HiOutlineCalendar /> {formatDate(post.createdAt)}
                </span>
                <span className={styles.articleMetaDivider} />
                <span className={styles.articleMetaItem}>
                  <HiOutlineUser /> {post.author || "Admin"}
                </span>
              </div>
              <article
                className={styles.content}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content.replace(/\n/g, "<br/>")) }}
              />
              {post.tags?.length > 0 && (
                <div className={styles.tags}>
                  {post.tags.map((t) => (
                    <span key={t} className={styles.tag}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Related ─── */}
      {related.length > 0 && (
        <section className={styles.relatedSection}>
          <div className="container">
            <h2 className={styles.relatedTitle}>Artículos relacionados</h2>
            <div className={styles.relatedGrid}>
              {related.map((r) => (
                <Link key={r.id} to={`/blog/${r.slug}`} className={styles.relatedCard}>
                  <div className={styles.relatedCardImage}>
                    {r.image ? (
                      <img src={r.image} alt={r.title} loading="lazy" />
                    ) : (
                      <div className={styles.relatedCardPlaceholder}>✦</div>
                    )}
                  </div>
                  <div className={styles.relatedCardBody}>
                    {r.category && <span className={styles.relatedCardBadge}>{r.category}</span>}
                    <h3 className={styles.relatedCardTitle}>{r.title}</h3>
                    <span className={styles.relatedCardLink}>
                      Leer <HiOutlineArrowLeft style={{ transform: "rotate(180deg)" }} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <StoreFooter />
    </div>
  );
}
