"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  HiOutlineArrowRight,
  HiOutlineCalendar,
  HiOutlineEnvelope,
  HiOutlineSparkles,
  HiOutlineUser,
} from "react-icons/hi2";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import { addSubscriber, getBlogConfig, getBlogPosts } from "@/lib/supabase-queries";
import styles from "./blog.module.css";

export default function BlogPage() {
  const [posts, setPosts] = useState([]);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);
  const [email, setEmail] = useState("");
  const [subStatus, setSubStatus] = useState("idle");

  useEffect(() => {
    Promise.all([
      getBlogPosts(true).then(setPosts).catch(() => setPosts([])),
      getBlogConfig().then(setConfig).catch(() => setConfig({})),
    ]).finally(() => setLoading(false));
  }, []);

  const formatDate = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("es-MX", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const categories = useMemo(() => {
    const counts = posts.reduce((acc, post) => {
      if (!post.category) return acc;
      acc[post.category] = (acc[post.category] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [posts]);

  const featuredPost = posts[0] || null;
  const visiblePosts = activeCategory
    ? posts.filter((post) => post.category === activeCategory)
    : posts;
  const listedPosts = visiblePosts.filter((post) => post.id !== featuredPost?.id);

  const heroTitle = config.heroTitle?.trim() || "Blog";
  const heroSubtitle =
    config.heroSubtitle?.trim() ||
    "Lee las publicaciones disponibles y explora contenido creado desde la tienda.";
  const newsletterTitle = config.newsletterTitle?.trim() || "Recibe nuevas publicaciones";
  const newsletterText =
    config.newsletterText?.trim() ||
    "Ingresa tu correo para recibir novedades del blog cuando haya contenido nuevo.";

  const blogColors = {
    "--blog-bg": config.bgColor || "#f7f7f4",
    "--blog-text": config.textColor || "#141414",
    "--blog-card-bg": config.cardBg || "#ffffff",
    "--blog-accent": config.accentColor || "var(--color-accent)",
    "--blog-gradient-from": config.gradientFrom || "var(--color-accent)",
    "--blog-gradient-to": config.gradientTo || "var(--color-primary)",
  };

  const renderHeroTitle = () =>
    heroTitle.split(/(\*[^*]+\*)/).map((part, i) =>
      part.startsWith("*") && part.endsWith("*") ? (
        <span key={i} className={styles.heroHighlight}>
          {part.slice(1, -1)}
        </span>
      ) : (
        part
      )
    );

  const handleSubscribe = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || subStatus === "loading") return;

    setSubStatus("loading");
    try {
      await addSubscriber(cleanEmail);
      setSubStatus("success");
      setEmail("");
      setTimeout(() => setSubStatus("idle"), 3000);
    } catch (err) {
      setSubStatus("error");
      setTimeout(() => setSubStatus("idle"), 3000);
    }
  };

  const PostMeta = ({ post, compact = false }) => (
    <div className={compact ? styles.metaCompact : styles.meta}>
      {post.createdAt && (
        <span>
          <HiOutlineCalendar />
          {formatDate(post.createdAt)}
        </span>
      )}
      {post.author && (
        <span>
          <HiOutlineUser />
          {post.author}
        </span>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <StoreHeader />
        <div className={styles.loadingWrap}>
          <div className="spinner" />
        </div>
        <StoreFooter />
      </div>
    );
  }

  return (
    <div className={styles.wrapper} style={blogColors}>
      <StoreHeader />

      <main className={styles.blogBody}>
        <section className={styles.hero}>
          <div className="container">
            <div className={styles.heroInner}>
              <div className={styles.heroContent}>
                <span className={styles.eyebrow}>Blog</span>
                <h1 className={styles.heroTitle}>{renderHeroTitle()}</h1>
                <p className={styles.heroSubtitle}>{heroSubtitle}</p>
                {posts.length > 0 && (
                  <div className={styles.heroSummary}>
                    <span>{posts.length} publicacion{posts.length !== 1 ? "es" : ""}</span>
                    {categories.length > 0 && (
                      <span>{categories.length} categoria{categories.length !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                )}
              </div>

              {featuredPost && (
                <Link to={`/blog/${featuredPost.slug}`} className={styles.featured}>
                  <div className={styles.featuredImage}>
                    {featuredPost.image ? (
                      <img src={featuredPost.image} alt={featuredPost.title} />
                    ) : (
                      <div className={styles.imageFallback}>
                        <HiOutlineSparkles />
                      </div>
                    )}
                  </div>
                  <div className={styles.featuredBody}>
                    {featuredPost.category && (
                      <span className={styles.categoryPill}>{featuredPost.category}</span>
                    )}
                    <PostMeta post={featuredPost} compact />
                    <h2>{featuredPost.title}</h2>
                    {featuredPost.excerpt && <p>{featuredPost.excerpt}</p>}
                    <span className={styles.readLink}>
                      Leer publicacion <HiOutlineArrowRight />
                    </span>
                  </div>
                </Link>
              )}
            </div>
          </div>
        </section>

        {posts.length === 0 ? (
          <section className={styles.emptyState}>
            <div className="container">
              <div className={styles.emptyPanel}>
                <span className={styles.emptyIcon}>
                  <HiOutlineSparkles />
                </span>
                <h2>No hay publicaciones disponibles</h2>
                <p>Cuando existan articulos publicados, apareceran aqui.</p>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className={styles.filters}>
              <div className="container">
                <div className={styles.filterBar}>
                  <button
                    className={`${styles.filterBtn} ${!activeCategory ? styles.filterBtnActive : ""}`}
                    onClick={() => setActiveCategory(null)}
                  >
                    Todo
                    <span>{posts.length}</span>
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.name}
                      className={`${styles.filterBtn} ${
                        activeCategory === category.name ? styles.filterBtnActive : ""
                      }`}
                      onClick={() => setActiveCategory(category.name)}
                    >
                      {category.name}
                      <span>{category.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className={styles.postsSection}>
              <div className="container">
                <div className={styles.sectionHead}>
                  <div>
                    <span className={styles.eyebrow}>Publicaciones</span>
                    <h2>{activeCategory || "Todas las publicaciones"}</h2>
                  </div>
                  {activeCategory && (
                    <button className={styles.clearFilter} onClick={() => setActiveCategory(null)}>
                      Ver todo
                    </button>
                  )}
                </div>

                {listedPosts.length > 0 ? (
                  <div className={styles.postsGrid}>
                    {listedPosts.map((post) => (
                      <Link key={post.id} to={`/blog/${post.slug}`} className={styles.postCard}>
                        <div className={styles.postCardImage}>
                          {post.image ? (
                            <img src={post.image} alt={post.title} loading="lazy" />
                          ) : (
                            <div className={styles.imageFallback}>
                              <HiOutlineSparkles />
                            </div>
                          )}
                        </div>
                        <div className={styles.postCardBody}>
                          <div className={styles.postCardTop}>
                            {post.category && <span className={styles.categoryPill}>{post.category}</span>}
                            <PostMeta post={post} compact />
                          </div>
                          <h3>{post.title}</h3>
                          {post.excerpt && <p>{post.excerpt}</p>}
                          <span className={styles.readLink}>
                            Leer <HiOutlineArrowRight />
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className={styles.noResults}>
                    <p>
                      {activeCategory
                        ? `No hay mas publicaciones en "${activeCategory}".`
                        : "Por ahora solo hay una publicacion publicada."}
                    </p>
                  </div>
                )}
              </div>
            </section>

            {config.newsletterEnabled !== false && (
              <section className={styles.newsletter}>
                <div className="container">
                  <div className={styles.newsletterInner}>
                    <div>
                      <span className={styles.newsletterIcon}>
                        <HiOutlineEnvelope />
                      </span>
                      <h2>{newsletterTitle}</h2>
                      <p>{newsletterText}</p>
                    </div>
                    <div className={styles.newsletterForm}>
                      <input
                        type="email"
                        placeholder="tu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSubscribe()}
                      />
                      <button onClick={handleSubscribe} disabled={subStatus === "loading"}>
                        {subStatus === "loading" ? "Enviando..." : "Suscribirme"}
                      </button>
                      {subStatus === "success" && (
                        <p className={styles.formSuccess}>Correo registrado correctamente.</p>
                      )}
                      {subStatus === "error" && (
                        <p className={styles.formError}>No se pudo registrar el correo.</p>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <StoreFooter />
    </div>
  );
}
