import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  limit,
  writeBatch,
  runTransaction
} from "firebase/firestore";
import { db } from "./firebase";

// =====================================================
// SEARCH CACHES — prevents re-downloading entire
// collections on every keystroke (the #1 cost offender)
// =====================================================
let _productSearchCache = { data: null, ts: 0 };
let _customerSearchCache = { data: null, ts: 0 };
const SEARCH_CACHE_TTL = 60_000; // 60 seconds

// Product list cache — avoid re-reading entire products collection on every action
let _productsCache = { data: null, ts: 0, key: "" };
const PRODUCTS_CACHE_TTL = 15_000; // 15 seconds

/** Call this after saving/deleting a product so the next search re-fetches */
export function invalidateProductSearchCache() {
  _productSearchCache = { data: null, ts: 0 };
}
/** Call this after saving/deleting a customer so the next search re-fetches */
export function invalidateCustomerSearchCache() {
  _customerSearchCache = { data: null, ts: 0 };
}
/** Call this after any product mutation to invalidate the list cache */
export function invalidateProductsCache() {
  _productsCache = { data: null, ts: 0, key: "" };
}

export async function getBrands() {
  try {
    const q = query(collection(db, "brands"), orderBy("order", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    // If ordering fails, try without order
    console.warn("Brands orderBy failed, trying without order:", error.message);
    try {
      const q = query(collection(db, "brands"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (err2) {
      console.error("Error fetching brands:", err2);
      return [];
    }
  }
}

export function onBrandsChange(callback) {
  const q = query(collection(db, "brands"), orderBy("order", "asc"));
  let unsub = onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => {
    console.warn("Brands listener failed, trying without order:", error.message);
    unsub();
    unsub = onSnapshot(collection(db, "brands"), (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err2) => {
      console.error("Brands fallback listener also failed:", err2);
    });
  });

  return () => unsub();
}

export async function saveBrand(id, data) {
  try {
    const brandRef = id ? doc(db, "brands", id) : null;
    const brandData = {
      ...data,
      updatedAt: serverTimestamp()
    };
    if (brandRef) {
      await updateDoc(brandRef, brandData);
      return id;
    } else {
      const newRef = await addDoc(collection(db, "brands"), {
        ...brandData,
        createdAt: serverTimestamp()
      });
      return newRef.id;
    }
  } catch (error) {
    console.error("Error saving brand:", error);
    throw error;
  }
}

export async function deleteBrand(id) {
  try {
    await deleteDoc(doc(db, "brands", id));
  } catch (error) {
    console.error("Error deleting brand:", error);
    throw error;
  }
}

export async function getCategories() {
  try {
    const q = query(collection(db, "categories"), orderBy("order", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    // If ordering fails, try without order
    console.warn("Categories orderBy failed, trying without order:", error.message);
    try {
      const q = query(collection(db, "categories"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (err2) {
      console.error("Error fetching categories:", err2);
      return [];
    }
  }
}

export function onCategoriesChange(callback) {
  const q = query(collection(db, "categories"), orderBy("order", "asc"));
  let unsub = onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => {
    console.warn("Categories listener failed, trying without order:", error.message);
    unsub();
    unsub = onSnapshot(collection(db, "categories"), (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err2) => {
      console.error("Categories fallback listener also failed:", err2);
    });
  });

  return () => unsub();
}

export async function saveCategory(id, data) {
  try {
    const categoryRef = id ? doc(db, "categories", id) : null;
    const categoryData = {
      ...data,
      updatedAt: serverTimestamp()
    };
    if (categoryRef) {
      await updateDoc(categoryRef, categoryData);
      return id;
    } else {
      const newRef = await addDoc(collection(db, "categories"), {
        ...categoryData,
        createdAt: serverTimestamp()
      });
      return newRef.id;
    }
  } catch (error) {
    console.error("Error saving category:", error);
    throw error;
  }
}

export async function deleteCategory(id) {
  try {
    await deleteDoc(doc(db, "categories", id));
  } catch (error) {
    console.error("Error deleting category:", error);
    throw error;
  }
}

export async function searchProducts(searchTerm) {
  try {
    if (!searchTerm || searchTerm.length < 2) return [];
    
    // Use cache to avoid re-downloading ALL products on every keystroke
    const now = Date.now();
    if (!_productSearchCache.data || now - _productSearchCache.ts > SEARCH_CACHE_TTL) {
      const q = query(collection(db, "products"), where("isActive", "==", true));
      const snapshot = await getDocs(q);
      _productSearchCache = {
        data: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        ts: now
      };
    }
    
    const lowerTerm = searchTerm.toLowerCase();
    
    return _productSearchCache.data.filter(p => {
      const name = (p.name || "").toLowerCase();
      const description = (p.description || "").toLowerCase();
      const category = (p.category || "").toLowerCase();
      const brand = (p.brand || "").toLowerCase();
      const barcode = (p.barcode || "").toLowerCase();
      const sku = (p.sku || "").toLowerCase();
      
      return name.includes(lowerTerm) || 
             description.includes(lowerTerm) || 
             category.includes(lowerTerm) || 
             brand.includes(lowerTerm) ||
             barcode.includes(lowerTerm) ||
             sku.includes(lowerTerm);
    }).slice(0, 8); // Return top 8 results for the preview
  } catch (error) {
    console.error("Error searching products:", error);
    return [];
  }
}

export async function getProducts(options = {}) {
  const cacheKey = JSON.stringify(options);
  const now = Date.now();
  if (_productsCache.data && _productsCache.key === cacheKey && now - _productsCache.ts < PRODUCTS_CACHE_TTL) {
    return _productsCache.data;
  }
  try {
    let q = collection(db, "products");
    let constraints = [];
    
    // We only use simple constraints that don't always require a composite index with createdAt
    if (options.isActive !== undefined) constraints.push(where("isActive", "==", options.isActive));
    
    // If category is provided, we try to use it in the query. 
    // If it fails (missing index for category + createdAt), the catch block will handle it.
    if (options.category) constraints.push(where("category", "==", options.category));
    
    const limitVal = options.limitCount ? limit(options.limitCount) : null;
    
    const qFinal = query(
      q, 
      ...constraints, 
      orderBy("createdAt", "desc"), 
      ...(limitVal ? [limitVal] : [])
    );

    const snapshot = await getDocs(qFinal);
    const result = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    _productsCache = { data: result, ts: Date.now(), key: cacheKey };
    return result;
  } catch (error) {
    // FALLBACK: If query fails (likely missing index), fetch without complex filters and filter in memory
    if (error.code === 'failed-precondition' || error.message.includes('index')) {
      console.warn("Products query failed (index missing?), falling back to client-side filtering.");
      try {
        const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        let products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (options.isActive !== undefined) {
          products = products.filter(p => {
            const val = p.isActive;
            return val === options.isActive || String(val) === String(options.isActive);
          });
        }
        if (options.category) {
          products = products.filter(p => p.category === options.category);
        }
        if (options.limitCount) {
          products = products.slice(0, options.limitCount);
        }
        _productsCache = { data: products, ts: Date.now(), key: cacheKey };
        return products;
      } catch (err2) {
        console.error("Critical error in products fallback:", err2);
      }
    }
    
    console.error("Error fetching products:", error);
    return [];
  }
}

export function onProductsChange(options = {}, callback) {
  let q = collection(db, "products");
  let constraints = [];
  
  if (options.isActive !== undefined) constraints.push(where("isActive", "==", options.isActive));
  if (options.category) constraints.push(where("category", "==", options.category));
  
  const qWithConstraints = query(q, ...constraints, orderBy("createdAt", "desc"));

  return onSnapshot(qWithConstraints, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => {
    console.error("Error in products listener:", error);
  });
}

export async function getProductById(id) {
  try {
    const docRef = doc(db, "products", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error fetching product by id:", error);
    throw error;
  }
}

export async function getProductBySlug(slug) {
  try {
    const q = query(collection(db, "products"), where("slug", "==", slug));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error("Error fetching product by slug:", error);
    throw error;
  }
}

export async function saveProduct(id, data) {
  try {
    const productRef = id ? doc(db, "products", id) : null;
    
    // Normalize numeric and boolean fields
    const productData = {
      ...data,
      price: Number(data.price) || 0,
      comparePrice: Number(data.comparePrice) || 0,
      stock: Number(data.stock) || 0,
      isActive: data.isActive === true || data.isActive === "true",
      isFeatured: data.isFeatured === true || data.isFeatured === "true",
      updatedAt: serverTimestamp()
    };

    let result;
    if (productRef) {
      await updateDoc(productRef, productData);
      result = id;
    } else {
      const newRef = await addDoc(collection(db, "products"), {
        ...productData,
        createdAt: serverTimestamp()
      });
      result = newRef.id;
    }
    invalidateProductSearchCache(); // Clear search cache so new/updated products appear
    invalidateProductsCache(); // Clear products list cache
    return result;
  } catch (error) {
    console.error("Error saving product:", error);
    throw error;
  }
}

export async function deleteProduct(id) {
  try {
    await deleteDoc(doc(db, "products", id));
    invalidateProductSearchCache(); // Clear search cache
    invalidateProductsCache(); // Clear products list cache
  } catch (error) {
    console.error("Error deleting product:", error);
    throw error;
  }
}

export async function getReviews(productId) {
    try {
      let q;
      if (productId) {
        q = query(
          collection(db, "reviews"),
          where("productId", "==", productId),
          orderBy("createdAt", "desc")
        );
      } else {
        q = query(
          collection(db, "reviews"),
          orderBy("createdAt", "desc"),
          limit(50)
        );
      }
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.warn("Reviews query failed, trying without order:", error.message);
      try {
        let q = productId
          ? query(collection(db, "reviews"), where("productId", "==", productId))
          : query(collection(db, "reviews"), limit(50));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.error("Reviews fallback also failed:", err);
        return [];
      }
    }
  }

export async function saveReview(id, data) {
  try {
    const reviewRef = id ? doc(db, "reviews", id) : null;
    const reviewData = {
      ...data,
      updatedAt: serverTimestamp()
    };
    if (reviewRef) {
      await updateDoc(reviewRef, reviewData);
      return id;
    } else {
      const newRef = await addDoc(collection(db, "reviews"), {
        ...reviewData,
        createdAt: serverTimestamp()
      });
      return newRef.id;
    }
  } catch (error) {
    console.error("Error saving review:", error);
    throw error;
  }
}

export async function getRelatedProducts(categoryId, excludeProductId) {
  try {
    const q = query(
      collection(db, "products"),
      where("category", "==", categoryId),
      where("isActive", "==", true)
    );
    const snapshot = await getDocs(q);
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    return products.filter(p => p.id !== excludeProductId).slice(0, 12);
  } catch (error) {
    console.error("Error fetching related products:", error);
    return [];
  }
}

export async function addSubscriber(email) {
  try {
    const q = query(collection(db, "subscribers"), where("email", "==", email));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      throw new Error("Email already subscribed");
    }
    await addDoc(collection(db, "subscribers"), {
      email,
      subscribedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error adding subscriber:", error);
    throw error;
  }
}

export async function deleteBlogPost(id) {
  try {
    await deleteDoc(doc(db, "posts", id));
  } catch (error) {
    console.error("Error deleting blog post:", error);
    throw error;
  }
}

export async function deleteCoupon(id) {
  try {
    await deleteDoc(doc(db, "coupons", id));
  } catch (error) {
    console.error("Error deleting coupon:", error);
    throw error;
  }
}

export async function deletePage(id) {
  try {
    await deleteDoc(doc(db, "pages", id));
  } catch (error) {
    console.error("Error deleting page:", error);
    throw error;
  }
}

export async function deleteReview(id) {
  try {
    await deleteDoc(doc(db, "reviews", id));
  } catch (error) {
    console.error("Error deleting review:", error);
    throw error;
  }
}

export async function deleteSubscriber(id) {
  try {
    await deleteDoc(doc(db, "subscribers", id));
  } catch (error) {
    console.error("Error deleting subscriber:", error);
    throw error;
  }
}

export async function getBlogPostById(id) {
  try {
    const docRef = doc(db, "posts", id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (error) {
    console.error("Error fetching blog post:", error);
    return null;
  }
}

export async function getBlogPostBySlug(slug) {
  try {
    const q = query(collection(db, "posts"), where("slug", "==", slug));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error("Error fetching blog post by slug:", error);
    return null;
  }
}

export async function getBlogPosts(publishedOnly = false) {
  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return publishedOnly ? posts.filter(p => p.isPublished === true) : posts;
  } catch (error) {
    console.error("Error fetching blog posts:", error);
    return [];
  }
}

export async function getCouponByCode(code) {
  try {
    const q = query(collection(db, "coupons"), where("code", "==", code), where("isActive", "==", true));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error("Error fetching coupon:", error);
    return null;
  }
}

export async function getCoupons() {
  try {
    const q = query(collection(db, "coupons"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching coupons:", error);
    return [];
  }
}

export async function getOrdersByEmail(email) {
  try {
    if (!email) return [];
    const q = query(
      collection(db, "orders"),
      where("customerEmail", "==", email),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    // Fallback: try without orderBy (requires simpler index)
    console.warn("getOrdersByEmail query failed, trying without orderBy:", error.message);
    try {
      const q = query(
        collection(db, "orders"),
        where("customerEmail", "==", email)
      );
      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      results.sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const db2 = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return db2 - da;
      });
      return results;
    } catch (err2) {
      console.error("getOrdersByEmail fallback failed:", err2);
      return [];
    }
  }
}

export async function getOrders(options = {}) {
  try {
    const constraints = [orderBy("createdAt", "desc")];
    if (options.limitCount) constraints.push(limit(options.limitCount));
    const q = query(collection(db, "orders"), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching orders:", error);
    return [];
  }
}

export async function getOrderById(id) {
  try {
    const docRef = doc(db, "orders", id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (error) {
    console.error("Error fetching order:", error);
    return null;
  }
}

export async function deleteOrder(id) {
  try {
    await deleteDoc(doc(db, "orders", id));
    return true;
  } catch (error) {
    console.error("Error deleting order:", error);
    throw error;
  }
}

export async function getPageById(id) {
  try {
    const docRef = doc(db, "pages", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error fetching page by id:", error);
    throw error;
  }
}

export async function getPageBySlug(slug) {
  try {
    const q = query(collection(db, "pages"), where("slug", "==", slug));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error("Error fetching page by slug:", error);
    throw error;
  }
}

export async function getPages() {
  try {
    const q = query(collection(db, "pages"), orderBy("updatedAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.warn("Pages orderBy failed, trying without order:", error.message);
    try {
      const q = query(collection(db, "pages"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (err2) {
      console.error("Error fetching pages:", err2);
      return [];
    }
  }
}

export function onPagesChange(callback) {
  const q = query(collection(db, "pages"), orderBy("updatedAt", "desc"));
  let unsub = onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => {
    console.warn("Pages listener failed, trying without order:", error.message);
    unsub();
    unsub = onSnapshot(collection(db, "pages"), (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err2) => {
      console.error("Pages fallback listener also failed:", err2);
    });
  });

  return () => unsub();
}

/** Efficient query that fetches ONLY the active homepage — not all pages */
export async function getHomePage() {
  try {
    const q = query(
      collection(db, "pages"),
      where("isHomePage", "==", true),
      where("isPublished", "==", true)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    // If multiple, pick the most recently updated one
    const pages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (pages.length === 1) return pages[0];

    return pages.sort((a, b) => {
      const ta = a.updatedAt?.seconds || 0;
      const tb = b.updatedAt?.seconds || 0;
      return tb - ta;
    })[0];
  } catch (error) {
    console.error("Error fetching homepage:", error);
    return null;
  }
}

/** Efficient query for a single published page by slug */
export async function getPublishedPageBySlug(slug) {
  try {
    const q = query(
      collection(db, "pages"),
      where("slug", "==", slug),
      where("isPublished", "==", true)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const d = snapshot.docs[0];
    return { id: d.id, ...d.data() };
  } catch (error) {
    // Fallback: try without isPublished filter in case the field uses string booleans
    console.warn("getPublishedPageBySlug failed, trying simple slug query:", error.message);
    try {
      const q = query(collection(db, "pages"), where("slug", "==", slug));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      const d = snapshot.docs[0];
      const data = { id: d.id, ...d.data() };
      const isPub = data.isPublished === true || data.isPublished === "true";
      return isPub ? data : null;
    } catch (err2) {
      console.error("getPublishedPageBySlug fallback failed:", err2);
      return null;
    }
  }
}

export async function getShippingConfig() {
  try {
    const docRef = doc(db, "config", "shipping");
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : {};
  } catch (error) {
    console.error("Error fetching shipping config:", error);
    return {};
  }
}

export async function saveShippingConfig(data) {
  try {
    await setDoc(doc(db, "config", "shipping"), {
      ...data,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Error saving shipping config:", error);
    throw error;
  }
}

export async function getStoreTheme() {
  try {
    const docRef = doc(db, "config", "theme");
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : {};
  } catch (error) {
    console.error("Error fetching theme:", error);
    return {};
  }
}

export async function saveStoreTheme(data) {
  try {
    await setDoc(doc(db, "config", "theme"), {
      ...data,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Error saving theme:", error);
    throw error;
  }
}

export async function getStoreNavigation() {
  try {
    const docRef = doc(db, "config", "navigation");
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : {};
  } catch (error) {
    console.error("Error fetching navigation:", error);
    return {};
  }
}

export async function saveStoreNavigation(data) {
  try {
    await setDoc(doc(db, "config", "navigation"), {
      ...data,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Error saving navigation:", error);
    throw error;
  }
}

export async function getStoreFeatures() {
  try {
    const docRef = doc(db, "config", "features");
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : {};
  } catch (error) {
    console.error("Error fetching features:", error);
    return {};
  }
}

export async function saveStoreFeatures(data) {
  try {
    await setDoc(doc(db, "config", "features"), {
      ...data,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Error saving features:", error);
    throw error;
  }
}

export async function searchCustomers(searchTerm) {
  try {
    if (!searchTerm || searchTerm.length < 1) return [];
    
    // Use cache to avoid re-downloading ALL customers on every keystroke
    const now = Date.now();
    if (!_customerSearchCache.data || now - _customerSearchCache.ts > SEARCH_CACHE_TTL) {
      const snapshot = await getDocs(collection(db, "customers"));
      _customerSearchCache = {
        data: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        ts: now
      };
    }
    
    const lowerTerm = searchTerm.toLowerCase();
    return _customerSearchCache.data.filter(c => {
      const name = (c.name || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      return name.includes(lowerTerm) || email.includes(lowerTerm) || phone.includes(lowerTerm);
    }).slice(0, 6);
  } catch (error) {
    console.error("Error searching customers:", error);
    return [];
  }
}

export async function getCustomers(options = {}) {
  try {
    const constraints = [orderBy("lastOrderAt", "desc")];
    if (options.limitCount) constraints.push(limit(options.limitCount));
    const q = query(collection(db, "customers"), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching customers:", error);
    return [];
  }
}

export async function saveCustomer(data) {
  try {
    const q = query(collection(db, "customers"), where("email", "==", data.email));
    const snapshot = await getDocs(q);
    let resultId;
    if (!snapshot.empty) {
      const existing = snapshot.docs[0];
      await updateDoc(doc(db, "customers", existing.id), {
        ...data,
        totalOrders: (existing.data().totalOrders || 0) + 1,
        lastOrderAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      resultId = existing.id;
    } else {
      const newRef = await addDoc(collection(db, "customers"), {
        ...data,
        totalOrders: 1,
        lastOrderAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      resultId = newRef.id;
    }
    invalidateCustomerSearchCache(); // Clear search cache
    return resultId;
  } catch (error) {
    console.error("Error saving customer:", error);
    throw error;
  }
}

export async function getStoreSettings() {
  try {
    const docRef = doc(db, "config", "settings");
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : {};
  } catch (error) {
    console.error("Error fetching settings:", error);
    return {};
  }
}

export async function saveStoreSettings(data) {
  try {
    await setDoc(doc(db, "config", "settings"), {
      ...data,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Error saving settings:", error);
    throw error;
  }
}

export async function saveCoupon(id, data) {
  try {
    const docRef = id ? doc(db, "coupons", id) : null;
    const docData = { ...data, updatedAt: serverTimestamp() };
    if (docRef) {
      await updateDoc(docRef, docData);
      return id;
    } else {
      const newRef = await addDoc(collection(db, "coupons"), { ...docData, createdAt: serverTimestamp() });
      return newRef.id;
    }
  } catch (error) {
    console.error("Error saving coupon:", error);
    throw error;
  }
}

export async function getNextOrderNumber() {
  const counterRef = doc(db, "config", "orderCounter");
  try {
    const result = await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(counterRef);
      let nextVal = 1;
      if (snapshot.exists()) {
        nextVal = (snapshot.data().value || 0) + 1;
      }
      transaction.set(counterRef, { value: nextVal }, { merge: true });
      return nextVal;
    });
    return result;
  } catch (error) {
    console.error("Error getting next order number:", error);
    const fallback = Date.now();
    return fallback;
  }
}

export async function saveOrder(id, data) {
  try {
    const docRef = id ? doc(db, "orders", id) : null;
    
    // Ensure customerEmail exists at top level for easier querying
    const docData = { 
      ...data, 
      customerEmail: data.customerEmail || data.customer?.email || "",
      updatedAt: serverTimestamp() 
    };
    
    if (docRef) {
      await updateDoc(docRef, docData);
      return { id };
    } else {
      const orderNumber = await getNextOrderNumber();
      const newRef = await addDoc(collection(db, "orders"), { 
        ...docData, 
        orderNumber,
        createdAt: serverTimestamp() 
      });
      return { id: newRef.id, orderNumber };
    }
  } catch (error) {
    console.error("Error saving order:", error);
    throw error;
  }
}

export async function savePage(id, data) {
  try {
    // Normalize booleans to ensure they are saved correctly
    const isHomePage = Boolean(data.isHomePage);
    const isPublished = Boolean(data.isPublished);

    // Si esta página será la de inicio, desmarcamos las demás
    if (isHomePage) {
      const q = query(collection(db, "pages"), where("isHomePage", "==", true));
      const snapshot = await getDocs(q);
      const batchPromises = snapshot.docs
        .filter(docSnap => docSnap.id !== id)
        .map(docSnap => updateDoc(doc(db, "pages", docSnap.id), { isHomePage: false }));
      await Promise.all(batchPromises);
    }

    const docRef = id ? doc(db, "pages", id) : null;
    const docData = { 
      ...data, 
      isHomePage, 
      isPublished, 
      updatedAt: serverTimestamp() 
    };
    
    if (docRef) {
      await updateDoc(docRef, docData);
      return id;
    } else {
      const newRef = await addDoc(collection(db, "pages"), { 
        ...docData, 
        createdAt: serverTimestamp() 
      });
      return newRef.id;
    }
  } catch (error) {
    console.error("Error saving page:", error);
    throw error;
  }
}

export async function saveBlogPost(id, data) {
  try {
    const docRef = id ? doc(db, "posts", id) : null;
    const docData = { ...data, updatedAt: serverTimestamp() };
    if (docRef) {
      await updateDoc(docRef, docData);
      return id;
    } else {
      const newRef = await addDoc(collection(db, "posts"), { ...docData, createdAt: serverTimestamp() });
      return newRef.id;
    }
  } catch (error) {
    console.error("Error saving blog post:", error);
    throw error;
  }
}

export async function getBlogConfig() {
  try {
    const docRef = doc(db, "config", "blog");
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : {};
  } catch (error) {
    console.error("Error fetching blog config:", error);
    return {};
  }
}

export async function saveBlogConfig(data) {
  try {
    await setDoc(doc(db, "config", "blog"), {
      ...data,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Error saving blog config:", error);
    throw error;
  }
}

export async function getSubscribers() {
  try {
    const snapshot = await getDocs(collection(db, "subscribers"));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching subscribers:", error);
    return [];
  }
}

export function onStoreSettingsChange(callback) {
  return onSnapshot(doc(db, "config", "settings"), (doc) => {
    callback(doc.exists() ? doc.data() : null);
  });
}

export function onStoreThemeChange(callback) {
  return onSnapshot(doc(db, "config", "theme"), (doc) => {
    callback(doc.exists() ? doc.data() : null);
  });
}

export function onStoreFeaturesChange(callback) {
  return onSnapshot(doc(db, "config", "features"), (doc) => {
    callback(doc.exists() ? doc.data() : null);
  });
}

export function onStoreNavigationChange(callback) {
  return onSnapshot(doc(db, "config", "navigation"), (doc) => {
    callback(doc.exists() ? doc.data() : null);
  });
}

// ----- Usuarios / Roles -----

export async function getUserByEmail(email) {
  try {
    const q = query(collection(db, "users"), where("email", "==", email));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error getting user:", error);
    return null;
  }
}

export async function getUserById(id) {
  try {
    const docSnap = await getDoc(doc(db, "users", id));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error getting user by id:", error);
    return null;
  }
}

export async function getUsers() {
  try {
    const q = query(collection(db, "users"), orderBy("email", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
}

export async function saveUser(id, data) {
  try {
    const docRef = id ? doc(db, "users", id) : null;
    const docData = { ...data, updatedAt: serverTimestamp() };
    if (docRef) {
      await setDoc(docRef, docData, { merge: true });
      return id;
    } else {
      const newRef = await addDoc(collection(db, "users"), { ...docData, createdAt: serverTimestamp() });
      return newRef.id;
    }
  } catch (error) {
    console.error("Error saving user:", error);
    throw error;
  }
}

export async function deleteUser(id) {
  try {
    await deleteDoc(doc(db, "users", id));
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
}

export function onUsersChange(callback) {
  const q = query(collection(db, "users"), orderBy("email", "asc"));
  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(users);
  });
}

export function onUserByEmail(email, callback) {
  const q = query(collection(db, "users"), where("email", "==", email));
  return onSnapshot(q, (snapshot) => {
    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0];
      callback({ id: docSnap.id, ...docSnap.data() });
    } else {
      callback(null);
    }
  });
}

// ----- Inventory Movements -----

export async function getInventoryMovements(options = {}) {
  try {
    const constraints = [];
    if (options.productId) constraints.push(where("productId", "==", options.productId));
    if (options.type) constraints.push(where("type", "==", options.type));
    constraints.push(orderBy("createdAt", "desc"));
    if (options.limitCount) constraints.push(limit(options.limitCount));
    const q = query(collection(db, "inventory_movements"), ...constraints);
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching movements:", error);
    try {
      const fallbackConstraints = [orderBy("createdAt", "desc")];
      if (options.limitCount) fallbackConstraints.push(limit(options.limitCount));
      const fallback = query(collection(db, "inventory_movements"), ...fallbackConstraints);
      const snap = await getDocs(fallback);
      let results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (options.productId) results = results.filter(m => m.productId === options.productId);
      if (options.type) results = results.filter(m => m.type === options.type);
      if (options.limitCount) results = results.slice(0, options.limitCount);
      return results;
    } catch (e2) {
      console.error("Error in fallback movements query:", e2);
      return [];
    }
  }
}

export async function saveInventoryMovement(data) {
  try {
    const newRef = await addDoc(collection(db, "inventory_movements"), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return newRef.id;
  } catch (error) {
    console.error("Error saving movement:", error);
    throw error;
  }
}

export async function deleteInventoryMovement(id) {
  try {
    await deleteDoc(doc(db, "inventory_movements", id));
    return true;
  } catch (error) {
    console.error("Error deleting inventory movement:", error);
    throw error;
  }
}

export async function updateInventoryMovement(id, data) {
  try {
    const docRef = doc(db, "inventory_movements", id);
    await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
    return id;
  } catch (error) {
    console.error("Error updating inventory movement:", error);
    throw error;
  }
}

export async function bulkSaveProducts(products) {
  const results = { created: 0, updated: 0, errors: 0 };
  const existingProducts = await getProducts();
  let batch = writeBatch(db);
  let batchCount = 0;
  const MAX_BATCH = 500;

  for (const product of products) {
    try {
      if (!product.name || product.price === undefined) {
        results.errors++;
        continue;
      }

      const slug = product.name.toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      let existing = null;
      if (product.sku) {
        existing = existingProducts.find(p => p.sku === product.sku);
      }
      if (!existing && product.barcode) {
        existing = existingProducts.find(p => p.barcode === product.barcode);
      }

      const data = {
        name: product.name,
        slug,
        price: Number(product.price) || 0,
        comparePrice: Number(product.comparePrice) || 0,
        stock: Number(product.stock) || 0,
        sku: product.sku || "",
        barcode: product.barcode || "",
        description: product.description || "",
        category: product.category || "",
        brand: product.brand || "",
        isActive: product.isActive !== false,
        isFeatured: false,
        images: [],
        tags: [],
        variants: [],
      };

      if (batchCount >= MAX_BATCH) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }

      if (existing) {
        batch.update(doc(db, "products", existing.id), { ...data, updatedAt: serverTimestamp() });
        results.updated++;
      } else {
        const newRef = doc(collection(db, "products"));
        batch.set(newRef, { ...data, createdAt: serverTimestamp() });
        results.created++;
      }
      batchCount++;
    } catch (e) {
      console.error("Error bulk saving product:", e);
      results.errors++;
    }
  }

  if (batchCount > 0) {
    try { await batch.commit(); } catch (e) { console.error("Final batch commit failed:", e); results.errors++; }
  }
  invalidateProductsCache();
  return results;
}

// =====================================================
// PAYROLL & ATTENDANCE MODULE
// =====================================================

// --- EMPLOYEES ---
export async function getEmployees() {
  try {
    const q = query(collection(db, "employees"), orderBy("name", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.warn("Employees orderBy failed, trying without order:", error.message);
    try {
      const snapshot = await getDocs(collection(db, "employees"));
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      return list;
    } catch (err2) {
      console.error("Error fetching employees:", err2);
      return [];
    }
  }
}

export async function getEmployeeById(id) {
  try {
    const docRef = doc(db, "employees", id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (error) {
    console.error("Error fetching employee:", error);
    return null;
  }
}

export async function saveEmployee(id, data) {
  try {
    const empData = { ...data, updatedAt: serverTimestamp() };
    if (id) {
      await updateDoc(doc(db, "employees", id), empData);
      return id;
    } else {
      const newRef = await addDoc(collection(db, "employees"), { ...empData, createdAt: serverTimestamp() });
      return newRef.id;
    }
  } catch (error) {
    console.error("Error saving employee:", error);
    throw error;
  }
}

export async function deleteEmployee(id) {
  try {
    await deleteDoc(doc(db, "employees", id));
  } catch (error) {
    console.error("Error deleting employee:", error);
    throw error;
  }
}

// --- ATTENDANCE RECORDS ---
export async function getAttendanceRecords(options = {}) {
  try {
    let constraints = [];
    if (options.employeeId) constraints.push(where("employeeId", "==", options.employeeId));
    if (options.date) constraints.push(where("date", "==", options.date));
    if (options.dateFrom) constraints.push(where("date", ">=", options.dateFrom));
    if (options.dateTo) constraints.push(where("date", "<=", options.dateTo));
    const limitVal = options.limitCount ? limit(options.limitCount) : null;
    const q = query(collection(db, "attendance_records"), ...constraints, ...(limitVal ? [limitVal] : []));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    return [];
  }
}

export async function saveAttendanceRecord(id, data) {
  try {
    const recData = { ...data, updatedAt: serverTimestamp() };
    if (id) {
      await updateDoc(doc(db, "attendance_records", id), recData);
      return id;
    } else {
      const newRef = await addDoc(collection(db, "attendance_records"), { ...recData, createdAt: serverTimestamp() });
      return newRef.id;
    }
  } catch (error) {
    console.error("Error saving attendance record:", error);
    throw error;
  }
}

export async function deleteAttendanceRecord(id) {
  try {
    await deleteDoc(doc(db, "attendance_records", id));
  } catch (error) {
    console.error("Error deleting attendance record:", error);
    throw error;
  }
}

export async function bulkSaveAttendance(records) {
  let batch = writeBatch(db);
  let batchCount = 0;
  const MAX_BATCH = 450;
  const results = { created: 0, updated: 0, errors: 0 };
  for (const rec of records) {
    try {
      if (batchCount >= MAX_BATCH) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
      if (rec.id) {
        batch.update(doc(db, "attendance_records", rec.id), { ...rec, updatedAt: serverTimestamp() });
        results.updated++;
      } else {
        const newRef = doc(collection(db, "attendance_records"));
        batch.set(newRef, { ...rec, createdAt: serverTimestamp() });
        results.created++;
      }
      batchCount++;
    } catch (e) {
      console.error("Error bulk saving attendance:", e);
      results.errors++;
    }
  }
  if (batchCount > 0) {
    try { await batch.commit(); } catch (e) { console.error("Final attendance batch commit failed:", e); results.errors++; }
  }
  return results;
}

// --- PAYROLL PERIODS ---
export async function getPayrollPeriods() {
  try {
    const q = query(collection(db, "payroll_periods"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.deleted);
  } catch (error) {
    console.warn("Payroll periods orderBy failed:", error.message);
    try {
      const snapshot = await getDocs(collection(db, "payroll_periods"));
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.deleted);
    } catch (err2) {
      console.error("Error fetching payroll periods:", err2);
      return [];
    }
  }
}

export async function getPayrollPeriodById(id) {
  try {
    const docRef = doc(db, "payroll_periods", id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
  } catch (error) {
    console.error("Error fetching payroll period:", error);
    return null;
  }
}

export async function savePayrollPeriod(id, data) {
  try {
    const periodData = { ...data, updatedAt: serverTimestamp() };
    if (id) {
      await updateDoc(doc(db, "payroll_periods", id), periodData);
      return id;
    } else {
      const newRef = await addDoc(collection(db, "payroll_periods"), { ...periodData, createdAt: serverTimestamp() });
      return newRef.id;
    }
  } catch (error) {
    console.error("Error saving payroll period:", error);
    throw error;
  }
}

export async function deletePayrollPeriod(id) {
  try {
    await deleteDoc(doc(db, "payroll_periods", id));
  } catch (error) {
    console.error("Error deleting payroll period:", error);
    throw error;
  }
}

export async function softDeletePayrollPeriod(id) {
  try {
    await updateDoc(doc(db, "payroll_periods", id), {
      deleted: true,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error soft-deleting payroll period:", error);
    throw error;
  }
}

export async function restorePayrollPeriod(id) {
  try {
    await updateDoc(doc(db, "payroll_periods", id), {
      deleted: false,
      deletedAt: null,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error restoring payroll period:", error);
    throw error;
  }
}

export async function getTrashedPayrollPeriods() {
  try {
    const q = query(collection(db, "payroll_periods"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.deleted);
  } catch (error) {
    console.warn("Trashed periods query failed:", error.message);
    try {
      const snapshot = await getDocs(collection(db, "payroll_periods"));
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.deleted);
    } catch (err2) {
      console.error("Error fetching trashed periods:", err2);
      return [];
    }
  }
}

// --- PAYROLL CONFIG ---
export async function getPayrollConfig() {
  try {
    const docRef = doc(db, "config", "payroll");
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error) {
    console.error("Error fetching payroll config:", error);
    return null;
  }
}

export async function savePayrollConfig(data) {
  try {
    await setDoc(doc(db, "config", "payroll"), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error("Error saving payroll config:", error);
    throw error;
  }
}

// --- LOANS & ADVANCES ---
export async function getLoans() {
  try {
    const q = query(collection(db, "loans"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.warn("Loans query failed, trying without order:", error.message);
    try {
      const snapshot = await getDocs(collection(db, "loans"));
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      return list;
    } catch (err2) {
      console.error("Error fetching loans:", err2);
      return [];
    }
  }
}

export async function saveLoan(id, data) {
  try {
    const loanData = { ...data, updatedAt: serverTimestamp() };
    if (id) {
      await updateDoc(doc(db, "loans", id), loanData);
      return id;
    } else {
      const newRef = await addDoc(collection(db, "loans"), { ...loanData, createdAt: serverTimestamp() });
      return newRef.id;
    }
  } catch (error) {
    console.error("Error saving loan:", error);
    throw error;
  }
}

export async function deleteLoan(id) {
  try {
    await deleteDoc(doc(db, "loans", id));
  } catch (error) {
    console.error("Error deleting loan:", error);
    throw error;
  }
}