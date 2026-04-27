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
  limit
} from "firebase/firestore";
import { db } from "./firebase";

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
  let internalUnsub = null;
  
  const outerUnsub = onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => {
    console.warn("Brands listener failed, trying without order:", error.message);
    internalUnsub = onSnapshot(collection(db, "brands"), (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  });

  return () => {
    outerUnsub();
    if (internalUnsub) internalUnsub();
  };
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
  let internalUnsub = null;

  const outerUnsub = onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => {
    console.warn("Categories listener failed, trying without order:", error.message);
    internalUnsub = onSnapshot(collection(db, "categories"), (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  });

  return () => {
    outerUnsub();
    if (internalUnsub) internalUnsub();
  };
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
    
    // Fetch all active products
    const q = query(collection(db, "products"), where("isActive", "==", true));
    const snapshot = await getDocs(q);
    const allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const lowerTerm = searchTerm.toLowerCase();
    
    return allProducts.filter(p => {
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
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

    if (productRef) {
      await updateDoc(productRef, productData);
      return id;
    } else {
      const newRef = await addDoc(collection(db, "products"), {
        ...productData,
        createdAt: serverTimestamp()
      });
      return newRef.id;
    }
  } catch (error) {
    console.error("Error saving product:", error);
    throw error;
  }
}

export async function deleteProduct(id) {
  try {
    await deleteDoc(doc(db, "products", id));
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
          orderBy("createdAt", "desc")
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
          : query(collection(db, "reviews"));
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
    return products.filter(p => p.id !== excludeProductId).slice(0, 4);
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

export async function getBlogPosts() {
  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

export async function getOrders() {
  try {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
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
  let internalUnsub = null;

  const outerUnsub = onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => {
    console.warn("Pages listener failed, trying without order:", error.message);
    internalUnsub = onSnapshot(collection(db, "pages"), (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  });

  return () => {
    outerUnsub();
    if (internalUnsub) internalUnsub();
  };
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
      return id;
    } else {
      const newRef = await addDoc(collection(db, "orders"), { ...docData, createdAt: serverTimestamp() });
      return newRef.id;
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