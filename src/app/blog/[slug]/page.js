"use client";

import { useEffect, useState, use } from "react";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import { getBlogPostBySlug } from "@/lib/firestore";
import Link from "next/link";
import { HiOutlineArrowLeft } from "react-icons/hi2";
import styles from "./detalle.module.css";

export default function BlogPostPage({ params }) {
  const resolvedParams = use(params);
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBlogPostBySlug(resolvedParams.slug).then((p) => { if (p?.isPublished) setPost(p); }).catch(() => {}).finally(() => setLoading(false));
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
        <div className="container" style={{ maxWidth: 800 }}>
          <Link href="/blog" className={styles.backLink}><HiOutlineArrowLeft /> Volver al blog</Link>
          {loading ? (
            <div className="loading-screen" style={{ minHeight: 400 }}><div className="spinner" /></div>
          ) : !post ? (
            <div style={{ textAlign: "center", padding: "4rem 0" }}>
              <h2>Artículo no encontrado</h2>
              <Link href="/blog" className="btn btn-primary" style={{ marginTop: "1rem" }}>Ver Blog</Link>
            </div>
          ) : (
            <article className={styles.article}>
              <div className={styles.meta}>
                <span>{formatDate(post.createdAt)}</span>
                <span>por {post.author || "Admin"}</span>
              </div>
              <h1 className={styles.title}>{post.title}</h1>
              {post.image && <div className={styles.heroImage}><img src={post.image} alt={post.title} /></div>}
              <div className={styles.content} dangerouslySetInnerHTML={{ __html: post.content.replace(/\n/g, "<br/>") }} />
              {post.tags?.length > 0 && (
                <div className={styles.tags}>
                  {post.tags.map((t) => <span key={t} className={styles.tag}>{t}</span>)}
                </div>
              )}
            </article>
          )}
        </div>
      </main>
      <StoreFooter />
    </div>
  );
}
