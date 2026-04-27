"use client";

import { useEffect, useState } from "react";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import { getBlogPosts } from "@/lib/firestore";
import Link from "next/link";
import styles from "./blog.module.css";

export default function BlogPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBlogPosts(true).then(setPosts).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const formatDate = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <StoreHeader />
      <main className={styles.main}>
        <div className="container">
          <div className={styles.pageHeader}>
            <h1 className={styles.pageTitle}>Blog</h1>
            <p className={styles.pageSubtitle}>Noticias, consejos y novedades</p>
          </div>
          {loading ? (
            <div className="loading-screen" style={{ minHeight: 300 }}><div className="spinner" /></div>
          ) : posts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--color-muted)" }}>
              <p>Aún no hay artículos publicados.</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {posts.map((post) => (
                <Link key={post.id} href={`/blog/${post.slug}`} className={styles.card}>
                  {post.image && <div className={styles.cardImage}><img src={post.image} alt={post.title} /></div>}
                  <div className={styles.cardBody}>
                    <div className={styles.cardMeta}>
                      <span>{formatDate(post.createdAt)}</span>
                      <span>{post.author || "Admin"}</span>
                    </div>
                    <h2 className={styles.cardTitle}>{post.title}</h2>
                    {post.excerpt && <p className={styles.cardExcerpt}>{post.excerpt}</p>}
                    {post.tags?.length > 0 && (
                      <div className={styles.cardTags}>
                        {post.tags.map((t) => <span key={t} className={styles.tag}>{t}</span>)}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <StoreFooter />
    </div>
  );
}
