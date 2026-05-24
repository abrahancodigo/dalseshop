import { supabase } from "./supabase";

// =====================================================
// HELPERS — snake_case ↔ camelCase mapping
// =====================================================

function toCamelCase(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (typeof obj !== "object") return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = toCamelCase(value);
  }
  return result;
}

function toSnakeCase(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (typeof obj !== "object") return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    result[snakeKey] = toSnakeCase(value);
  }
  return result;
}

function mapList(data) {
  return (data || []).map(toCamelCase);
}

function mapItem(data) {
  return data ? toCamelCase(data) : null;
}

function now() {
  return new Date().toISOString();
}

// =====================================================
// SEARCH CACHES
// =====================================================
let _productSearchCache = { data: null, ts: 0 };
let _customerSearchCache = { data: null, ts: 0 };
const SEARCH_CACHE_TTL = 60_000;
let _productsCache = { data: null, ts: 0, key: "" };
const PRODUCTS_CACHE_TTL = 15_000;

export function invalidateProductSearchCache() {
  _productSearchCache = { data: null, ts: 0 };
}
export function invalidateCustomerSearchCache() {
  _customerSearchCache = { data: null, ts: 0 };
}
export function invalidateProductsCache() {
  _productsCache = { data: null, ts: 0, key: "" };
}

// =====================================================
// BRANDS
// =====================================================

export async function getBrands() {
  try {
    const { data } = await supabase.from("brands").select("*").order("order", { ascending: true });
    return mapList(data);
  } catch (error) {
    console.error("Error fetching brands:", error);
    return [];
  }
}

export function onBrandsChange(callback) {
  const channel = supabase
    .channel("brands-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "brands" }, (payload) => {
      getBrands().then(callback);
    })
    .subscribe();
  // Initial fetch
  getBrands().then(callback);
  return () => { supabase.removeChannel(channel); };
}

export async function saveBrand(id, data) {
  try {
    const snake = toSnakeCase(data);
    snake.updated_at = now();
    if (id) {
      const { error } = await supabase.from("brands").update(snake).eq("id", id);
      if (error) throw error;
      return id;
    } else {
      snake.created_at = now();
      const { data: inserted, error } = await supabase.from("brands").insert(snake).select("id").single();
      if (error) throw error;
      return inserted?.id;
    }
  } catch (error) {
    console.error("Error saving brand:", error);
    throw error;
  }
}

export async function deleteBrand(id) {
  try {
    const { error } = await supabase.from("brands").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Error deleting brand:", error);
    throw error;
  }
}

// =====================================================
// CATEGORIES
// =====================================================

export async function getCategories() {
  try {
    const { data } = await supabase.from("categories").select("*").order("order", { ascending: true });
    return mapList(data);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
}

export function onCategoriesChange(callback) {
  const channel = supabase
    .channel("categories-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => {
      getCategories().then(callback);
    })
    .subscribe();
  getCategories().then(callback);
  return () => { supabase.removeChannel(channel); };
}

export async function saveCategory(id, data) {
  try {
    const snake = toSnakeCase(data);
    snake.updated_at = now();
    if (id) {
      const { error } = await supabase.from("categories").update(snake).eq("id", id);
      if (error) throw error;
      return id;
    } else {
      snake.created_at = now();
      const { data: inserted, error } = await supabase.from("categories").insert(snake).select("id").single();
      if (error) throw error;
      return inserted?.id;
    }
  } catch (error) {
    console.error("Error saving category:", error);
    throw error;
  }
}

export async function deleteCategory(id) {
  try {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Error deleting category:", error);
    throw error;
  }
}

// =====================================================
// PRODUCTS
// =====================================================

export async function searchProducts(searchTerm) {
  try {
    if (!searchTerm || searchTerm.length < 2) return [];
    const now = Date.now();
    if (!_productSearchCache.data || now - _productSearchCache.ts > SEARCH_CACHE_TTL) {
      const { data } = await supabase.from("products").select("*").eq("is_active", true);
      _productSearchCache = { data: mapList(data), ts: now };
    }
    const lowerTerm = searchTerm.toLowerCase();
    return _productSearchCache.data.filter(p => {
      const name = (p.name || "").toLowerCase();
      const description = (p.description || "").toLowerCase();
      const category = (p.category || "").toLowerCase();
      const brand = (p.brand || "").toLowerCase();
      const barcode = (p.barcode || "").toLowerCase();
      const sku = (p.sku || "").toLowerCase();
      return name.includes(lowerTerm) || description.includes(lowerTerm) || category.includes(lowerTerm) || brand.includes(lowerTerm) || barcode.includes(lowerTerm) || sku.includes(lowerTerm);
    }).slice(0, 8);
  } catch (error) {
    console.error("Error searching products:", error);
    return [];
  }
}

export async function getProducts(options = {}) {
  const cacheKey = JSON.stringify(options);
  const nowTs = Date.now();
  if (_productsCache.data && _productsCache.key === cacheKey && nowTs - _productsCache.ts < PRODUCTS_CACHE_TTL) {
    return _productsCache.data;
  }
  try {
    let query = supabase.from("products").select("*");
    if (options.isActive !== undefined) query = query.eq("is_active", options.isActive);
    if (options.category) query = query.eq("category", options.category);
    query = query.order("created_at", { ascending: false });
    if (options.limitCount) query = query.limit(options.limitCount);
    const { data, error } = await query;
    if (error) throw error;
    const result = mapList(data);
    _productsCache = { data: result, ts: Date.now(), key: cacheKey };
    return result;
  } catch (error) {
    console.error("Error fetching products:", error);
    // Fallback: fetch all and filter in memory
    try {
      const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      let products = mapList(data);
      if (options.isActive !== undefined) products = products.filter(p => p.isActive === options.isActive);
      if (options.category) products = products.filter(p => p.category === options.category);
      if (options.limitCount) products = products.slice(0, options.limitCount);
      _productsCache = { data: products, ts: Date.now(), key: cacheKey };
      return products;
    } catch (e2) {
      console.error("Critical error in products fallback:", e2);
      return [];
    }
  }
}

export function onProductsChange(options = {}, callback) {
  const channel = supabase
    .channel("products-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
      getProducts(options).then(callback);
    })
    .subscribe();
  getProducts(options).then(callback);
  return () => { supabase.removeChannel(channel); };
}

export async function getProductById(id) {
  try {
    const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
    if (error) throw error;
    return mapItem(data);
  } catch (error) {
    console.error("Error fetching product by id:", error);
    return null;
  }
}

export async function getProductBySlug(slug) {
  try {
    const { data, error } = await supabase.from("products").select("*").eq("slug", slug).single();
    if (error && error.code !== "PGRST116") throw error;
    return mapItem(data);
  } catch (error) {
    console.error("Error fetching product by slug:", error);
    return null;
  }
}

export async function saveProduct(id, data) {
  try {
    const snake = toSnakeCase({
      ...data,
      price: Number(data.price) || 0,
      comparePrice: Number(data.comparePrice) || 0,
      stock: Number(data.stock) || 0,
      isActive: data.isActive === true || data.isActive === "true",
      isFeatured: data.isFeatured === true || data.isFeatured === "true",
    });
    snake.updated_at = now();
    if (id) {
      const { error } = await supabase.from("products").update(snake).eq("id", id);
      if (error) throw error;
      invalidateProductSearchCache();
      invalidateProductsCache();
      return id;
    } else {
      snake.created_at = now();
      const { data: inserted, error } = await supabase.from("products").insert(snake).select("id").single();
      if (error) throw error;
      invalidateProductSearchCache();
      invalidateProductsCache();
      return inserted?.id;
    }
  } catch (error) {
    console.error("Error saving product:", error);
    throw error;
  }
}

export async function deleteProduct(id) {
  try {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
    invalidateProductSearchCache();
    invalidateProductsCache();
  } catch (error) {
    console.error("Error deleting product:", error);
    throw error;
  }
}

export async function getReviews(productId) {
  try {
    let query = supabase.from("reviews").select("*");
    if (productId) query = query.eq("product_id", productId);
    query = query.order("created_at", { ascending: false }).limit(50);
    const { data, error } = await query;
    if (error) throw error;
    return mapList(data);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return [];
  }
}

export async function saveReview(id, data) {
  try {
    const snake = toSnakeCase(data);
    snake.updated_at = now();
    if (id) {
      const { error } = await supabase.from("reviews").update(snake).eq("id", id);
      if (error) throw error;
      return id;
    } else {
      snake.created_at = now();
      const { data: inserted, error } = await supabase.from("reviews").insert(snake).select("id").single();
      if (error) throw error;
      return inserted?.id;
    }
  } catch (error) {
    console.error("Error saving review:", error);
    throw error;
  }
}

export async function deleteReview(id) {
  try {
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Error deleting review:", error);
    throw error;
  }
}

export async function getRelatedProducts(categoryId, excludeProductId) {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("category", categoryId)
      .eq("is_active", true);
    if (error) throw error;
    const products = mapList(data);
    return products.filter(p => p.id !== excludeProductId).slice(0, 12);
  } catch (error) {
    console.error("Error fetching related products:", error);
    return [];
  }
}

// =====================================================
// SUBSCRIBERS
// =====================================================

export async function addSubscriber(email) {
  try {
    const { data: existing } = await supabase.from("subscribers").select("id").eq("email", email).single();
    if (existing) throw new Error("Email already subscribed");
    const { error } = await supabase.from("subscribers").insert({ email, subscribed_at: now() });
    if (error) throw error;
  } catch (error) {
    console.error("Error adding subscriber:", error);
    throw error;
  }
}

export async function getSubscribers() {
  try {
    const { data } = await supabase.from("subscribers").select("*");
    return mapList(data);
  } catch (error) {
    console.error("Error fetching subscribers:", error);
    return [];
  }
}

export async function deleteSubscriber(id) {
  try {
    const { error } = await supabase.from("subscribers").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Error deleting subscriber:", error);
    throw error;
  }
}

// =====================================================
// BLOG POSTS
// =====================================================

export async function getBlogPostById(id) {
  try {
    const { data, error } = await supabase.from("posts").select("*").eq("id", id).single();
    if (error && error.code !== "PGRST116") throw error;
    return mapItem(data);
  } catch (error) {
    console.error("Error fetching blog post:", error);
    return null;
  }
}

export async function getBlogPostBySlug(slug) {
  try {
    const { data, error } = await supabase.from("posts").select("*").eq("slug", slug).single();
    if (error && error.code !== "PGRST116") throw error;
    return mapItem(data);
  } catch (error) {
    console.error("Error fetching blog post by slug:", error);
    return null;
  }
}

export async function getBlogPosts(publishedOnly = false) {
  try {
    let query = supabase.from("posts").select("*").order("created_at", { ascending: false });
    if (publishedOnly) query = query.eq("is_published", true);
    const { data, error } = await query;
    if (error) throw error;
    return mapList(data);
  } catch (error) {
    console.error("Error fetching blog posts:", error);
    return [];
  }
}

export async function saveBlogPost(id, data) {
  try {
    const snake = toSnakeCase(data);
    snake.updated_at = now();
    if (id) {
      const { error } = await supabase.from("posts").update(snake).eq("id", id);
      if (error) throw error;
      return id;
    } else {
      snake.created_at = now();
      const { data: inserted, error } = await supabase.from("posts").insert(snake).select("id").single();
      if (error) throw error;
      return inserted?.id;
    }
  } catch (error) {
    console.error("Error saving blog post:", error);
    throw error;
  }
}

export async function deleteBlogPost(id) {
  try {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Error deleting blog post:", error);
    throw error;
  }
}

export async function getBlogConfig() {
  try {
    const { data } = await supabase.from("config").select("value").eq("key", "blog").single();
    return data?.value ? toCamelCase(data.value) : {};
  } catch (error) {
    return {};
  }
}

export async function saveBlogConfig(data) {
  try {
    const { error } = await supabase.from("config").upsert(
      { key: "blog", value: toSnakeCase(data), updated_at: now() },
      { onConflict: "key" }
    );
    if (error) throw error;
  } catch (error) {
    console.error("Error saving blog config:", error);
    throw error;
  }
}

// =====================================================
// COUPONS
// =====================================================

export async function getCouponByCode(code) {
  try {
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", code)
      .eq("is_active", true)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return mapItem(data);
  } catch (error) {
    console.error("Error fetching coupon:", error);
    return null;
  }
}

export async function getCoupons() {
  try {
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    return mapList(data);
  } catch (error) {
    console.error("Error fetching coupons:", error);
    return [];
  }
}

export async function saveCoupon(id, data) {
  try {
    const snake = toSnakeCase(data);
    snake.updated_at = now();
    if (id) {
      const { error } = await supabase.from("coupons").update(snake).eq("id", id);
      if (error) throw error;
      return id;
    } else {
      snake.created_at = now();
      const { data: inserted, error } = await supabase.from("coupons").insert(snake).select("id").single();
      if (error) throw error;
      return inserted?.id;
    }
  } catch (error) {
    console.error("Error saving coupon:", error);
    throw error;
  }
}

export async function deleteCoupon(id) {
  try {
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Error deleting coupon:", error);
    throw error;
  }
}

// =====================================================
// PAGES
// =====================================================

export async function getPageById(id) {
  try {
    const { data, error } = await supabase.from("pages").select("*").eq("id", id).single();
    if (error && error.code !== "PGRST116") throw error;
    return mapItem(data);
  } catch (error) {
    console.error("Error fetching page by id:", error);
    return null;
  }
}

export async function getPageBySlug(slug) {
  try {
    const { data, error } = await supabase.from("pages").select("*").eq("slug", slug).single();
    if (error && error.code !== "PGRST116") throw error;
    return mapItem(data);
  } catch (error) {
    console.error("Error fetching page by slug:", error);
    throw error;
  }
}

export async function getPages() {
  try {
    const { data } = await supabase.from("pages").select("*").order("updated_at", { ascending: false });
    return mapList(data);
  } catch (error) {
    console.error("Error fetching pages:", error);
    return [];
  }
}

export function onPagesChange(callback) {
  const channel = supabase
    .channel("pages-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "pages" }, () => {
      getPages().then(callback);
    })
    .subscribe();
  getPages().then(callback);
  return () => { supabase.removeChannel(channel); };
}

export async function getHomePage() {
  try {
    const { data, error } = await supabase
      .from("pages")
      .select("*")
      .eq("is_home_page", true)
      .eq("is_published", true)
      .limit(1);
    if (error) throw error;
    if (!data || data.length === 0) return null;
    const pages = mapList(data);
    return pages.sort((a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta;
    })[0];
  } catch (error) {
    console.error("Error fetching homepage:", error);
    return null;
  }
}

export async function getPublishedPageBySlug(slug) {
  try {
    const { data, error } = await supabase
      .from("pages")
      .select("*")
      .eq("slug", slug)
      .eq("is_published", true)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return mapItem(data);
  } catch (error) {
    console.error("Error fetching published page by slug:", error);
    return null;
  }
}

export async function savePage(id, data) {
  try {
    const isHomePage = Boolean(data.isHomePage);
    const isPublished = Boolean(data.isPublished);

    if (isHomePage) {
      await supabase.from("pages").update({ is_home_page: false }).neq("id", id || "").eq("is_home_page", true);
    }

    const snake = toSnakeCase({ ...data, isHomePage, isPublished });
    snake.updated_at = now();
    if (id) {
      const { error } = await supabase.from("pages").update(snake).eq("id", id);
      if (error) throw error;
      return id;
    } else {
      snake.created_at = now();
      const { data: inserted, error } = await supabase.from("pages").insert(snake).select("id").single();
      if (error) throw error;
      return inserted?.id;
    }
  } catch (error) {
    console.error("Error saving page:", error);
    throw error;
  }
}

export async function deletePage(id) {
  try {
    const { error } = await supabase.from("pages").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Error deleting page:", error);
    throw error;
  }
}

// =====================================================
// ORDERS
// =====================================================

export async function getOrdersByEmail(email) {
  try {
    if (!email) return [];
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_email", email)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return mapList(data);
  } catch (error) {
    console.error("Error fetching orders by email:", error);
    return [];
  }
}

export async function getOrders(options = {}) {
  try {
    let query = supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (options.limitCount) query = query.limit(options.limitCount);
    const { data, error } = await query;
    if (error) throw error;
    return mapList(data);
  } catch (error) {
    console.error("Error fetching orders:", error);
    return [];
  }
}

export async function getOrderById(id) {
  try {
    const { data, error } = await supabase.from("orders").select("*").eq("id", id).single();
    if (error && error.code !== "PGRST116") throw error;
    return mapItem(data);
  } catch (error) {
    console.error("Error fetching order:", error);
    return null;
  }
}

export async function saveOrder(id, data) {
  try {
    const snake = toSnakeCase({
      ...data,
      customerEmail: data.customerEmail || data.customer?.email || "",
    });
    snake.updated_at = now();
    if (id) {
      const { error } = await supabase.from("orders").update(snake).eq("id", id);
      if (error) throw error;
      return { id };
    } else {
      const orderNumber = await getNextOrderNumber();
      snake.order_number = orderNumber;
      snake.created_at = now();
      const { data: inserted, error } = await supabase.from("orders").insert(snake).select("id").single();
      if (error) throw error;
      return { id: inserted?.id, orderNumber };
    }
  } catch (error) {
    console.error("Error saving order:", error);
    throw error;
  }
}

export async function deleteOrder(id) {
  try {
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error deleting order:", error);
    throw error;
  }
}

export async function getNextOrderNumber() {
  try {
    const { data: counter } = await supabase.from("config").select("value").eq("key", "orderCounter").single();
    let nextVal = 1;
    if (counter?.value?.value) {
      nextVal = counter.value.value + 1;
    }
    await supabase.from("config").upsert(
      { key: "orderCounter", value: { value: nextVal }, updated_at: now() },
      { onConflict: "key" }
    );
    return nextVal;
  } catch (error) {
    console.error("Error getting next order number:", error);
    return Date.now();
  }
}

// =====================================================
// CUSTOMERS
// =====================================================

export async function searchCustomers(searchTerm) {
  try {
    if (!searchTerm || searchTerm.length < 1) return [];
    const nowTs = Date.now();
    if (!_customerSearchCache.data || nowTs - _customerSearchCache.ts > SEARCH_CACHE_TTL) {
      const { data } = await supabase.from("customers").select("*");
      _customerSearchCache = { data: mapList(data), ts: nowTs };
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
    let query = supabase.from("customers").select("*").order("last_order_at", { ascending: false, nullsFirst: false });
    if (options.limitCount) query = query.limit(options.limitCount);
    const { data, error } = await query;
    if (error) throw error;
    return mapList(data);
  } catch (error) {
    console.error("Error fetching customers:", error);
    return [];
  }
}

export async function saveCustomer(data) {
  try {
    const { data: existing } = await supabase.from("customers").select("id, total_orders").eq("email", data.email).single();
    const snake = toSnakeCase(data);
    if (existing) {
      snake.total_orders = (existing.total_orders || 0) + 1;
      snake.last_order_at = now();
      snake.updated_at = now();
      const { error } = await supabase.from("customers").update(snake).eq("id", existing.id);
      if (error) throw error;
      invalidateCustomerSearchCache();
      return existing.id;
    } else {
      snake.total_orders = 1;
      snake.last_order_at = now();
      snake.created_at = now();
      const { data: inserted, error } = await supabase.from("customers").insert(snake).select("id").single();
      if (error) throw error;
      invalidateCustomerSearchCache();
      return inserted?.id;
    }
  } catch (error) {
    console.error("Error saving customer:", error);
    throw error;
  }
}

// =====================================================
// STORE CONFIG (settings, theme, features, navigation, shipping)
// =====================================================

async function getConfig(key) {
  try {
    const { data } = await supabase.from("config").select("value").eq("key", key).single();
    return data?.value ? toCamelCase(data.value) : {};
  } catch (error) {
    return {};
  }
}

async function saveConfig(key, data) {
  try {
    const { error } = await supabase.from("config").upsert(
      { key, value: toSnakeCase(data), updated_at: now() },
      { onConflict: "key" }
    );
    if (error) throw error;
  } catch (error) {
    console.error(`Error saving config (${key}):`, error);
    throw error;
  }
}

function onConfigChange(key, callback) {
  const channel = supabase
    .channel(`config-${key}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "config", filter: `key=eq.${key}` }, (payload) => {
      callback(payload.new?.value ? toCamelCase(payload.new.value) : null);
    })
    .subscribe();
  getConfig(key).then(callback);
  return () => { supabase.removeChannel(channel); };
}

export async function getStoreSettings() { return getConfig("settings"); }
export async function saveStoreSettings(data) { return saveConfig("settings", data); }
export function onStoreSettingsChange(callback) { return onConfigChange("settings", callback); }

export async function getStoreTheme() { return getConfig("theme"); }
export async function saveStoreTheme(data) { return saveConfig("theme", data); }
export function onStoreThemeChange(callback) { return onConfigChange("theme", callback); }

export async function getStoreFeatures() { return getConfig("features"); }
export async function saveStoreFeatures(data) { return saveConfig("features", data); }
export function onStoreFeaturesChange(callback) { return onConfigChange("features", callback); }

export async function getStoreNavigation() { return getConfig("navigation"); }
export async function saveStoreNavigation(data) { return saveConfig("navigation", data); }
export function onStoreNavigationChange(callback) { return onConfigChange("navigation", callback); }

export async function getShippingConfig() { return getConfig("shipping"); }
export async function saveShippingConfig(data) { return saveConfig("shipping", data); }

export async function getPayrollConfig() { return getConfig("payroll"); }
export async function savePayrollConfig(data) { return saveConfig("payroll", data); }

// =====================================================
// USERS / PROFILES
// =====================================================

export async function getUserByEmail(email) {
  try {
    const { data, error } = await supabase.from("user_profiles").select("*").eq("email", email).single();
    if (error && error.code !== "PGRST116") throw error;
    return mapItem(data);
  } catch (error) {
    console.error("Error getting user:", error);
    return null;
  }
}

export async function getUserById(id) {
  try {
    const { data, error } = await supabase.from("user_profiles").select("*").eq("id", id).single();
    if (error && error.code !== "PGRST116") throw error;
    return mapItem(data);
  } catch (error) {
    console.error("Error getting user by id:", error);
    return null;
  }
}

export async function getUsers() {
  try {
    const { data, error } = await supabase.from("user_profiles").select("*").order("email", { ascending: true });
    if (error) throw error;
    return mapList(data);
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
}

export async function saveUser(id, data) {
  try {
    const snake = toSnakeCase(data);
    snake.updated_at = now();
    if (id) {
      const { error } = await supabase.from("user_profiles").update(snake).eq("id", id);
      if (error) throw error;
      return id;
    } else {
      snake.created_at = now();
      const { data: inserted, error } = await supabase.from("user_profiles").insert(snake).select("id").single();
      if (error) throw error;
      return inserted?.id;
    }
  } catch (error) {
    console.error("Error saving user:", error);
    throw error;
  }
}

export async function deleteUser(id) {
  try {
    const { error } = await supabase.from("user_profiles").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
}

export function onUsersChange(callback) {
  const channel = supabase
    .channel("users-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "user_profiles" }, () => {
      getUsers().then(callback);
    })
    .subscribe();
  getUsers().then(callback);
  return () => { supabase.removeChannel(channel); };
}

export function onUserByEmail(email, callback) {
  const channel = supabase
    .channel(`user-${email}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "user_profiles", filter: `email=eq.${email}` }, (payload) => {
      callback(payload.new ? mapItem(payload.new) : null);
    })
    .subscribe();
  getUserByEmail(email).then(callback);
  return () => { supabase.removeChannel(channel); };
}

// =====================================================
// INVENTORY MOVEMENTS
// =====================================================

export async function getInventoryMovements(options = {}) {
  try {
    let query = supabase.from("inventory_movements").select("*");
    if (options.productId) query = query.eq("product_id", options.productId);
    if (options.type) query = query.eq("type", options.type);
    query = query.order("created_at", { ascending: false });
    if (options.limitCount) query = query.limit(options.limitCount);
    const { data, error } = await query;
    if (error) throw error;
    return mapList(data);
  } catch (error) {
    // Fallback: fetch all and filter
    try {
      let query = supabase.from("inventory_movements").select("*").order("created_at", { ascending: false });
      if (options.limitCount) query = query.limit(options.limitCount);
      const { data } = await query;
      let results = mapList(data);
      if (options.productId) results = results.filter(m => m.productId === options.productId);
      if (options.type) results = results.filter(m => m.type === options.type);
      return results;
    } catch (e2) {
      console.error("Error in fallback movements query:", e2);
      return [];
    }
  }
}

export async function saveInventoryMovement(data) {
  try {
    const snake = toSnakeCase({ ...data, createdAt: now() });
    const { data: inserted, error } = await supabase.from("inventory_movements").insert(snake).select("id").single();
    if (error) throw error;
    return inserted?.id;
  } catch (error) {
    console.error("Error saving movement:", error);
    throw error;
  }
}

export async function updateInventoryMovement(id, data) {
  try {
    const snake = toSnakeCase({ ...data, updatedAt: now() });
    const { error } = await supabase.from("inventory_movements").update(snake).eq("id", id);
    if (error) throw error;
    return id;
  } catch (error) {
    console.error("Error updating inventory movement:", error);
    throw error;
  }
}

export async function deleteInventoryMovement(id) {
  try {
    const { error } = await supabase.from("inventory_movements").delete().eq("id", id);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error deleting inventory movement:", error);
    throw error;
  }
}

// =====================================================
// EMPLOYEES
// =====================================================

export async function getEmployees() {
  try {
    const { data, error } = await supabase.from("employees").select("*").order("name", { ascending: true });
    if (error) throw error;
    return mapList(data);
  } catch (error) {
    console.error("Error fetching employees:", error);
    return [];
  }
}

export async function getEmployeeById(id) {
  try {
    const { data, error } = await supabase.from("employees").select("*").eq("id", id).single();
    if (error && error.code !== "PGRST116") throw error;
    return mapItem(data);
  } catch (error) {
    console.error("Error fetching employee:", error);
    return null;
  }
}

export async function saveEmployee(id, data) {
  try {
    const snake = toSnakeCase(data);
    snake.updated_at = now();
    if (id) {
      const { error } = await supabase.from("employees").update(snake).eq("id", id);
      if (error) throw error;
      return id;
    } else {
      snake.created_at = now();
      const { data: inserted, error } = await supabase.from("employees").insert(snake).select("id").single();
      if (error) throw error;
      return inserted?.id;
    }
  } catch (error) {
    console.error("Error saving employee:", error);
    throw error;
  }
}

export async function deleteEmployee(id) {
  try {
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Error deleting employee:", error);
    throw error;
  }
}

// =====================================================
// ATTENDANCE RECORDS
// =====================================================

export async function getAttendanceRecords(options = {}) {
  try {
    let query = supabase.from("attendance_records").select("*");
    if (options.employeeId) query = query.eq("employee_id", options.employeeId);
    if (options.date) query = query.eq("date", options.date);
    if (options.dateFrom) query = query.gte("date", options.dateFrom);
    if (options.dateTo) query = query.lte("date", options.dateTo);
    if (options.limitCount) query = query.limit(options.limitCount);
    const { data, error } = await query;
    if (error) throw error;
    return mapList(data);
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    return [];
  }
}

export async function saveAttendanceRecord(id, data) {
  try {
    const snake = toSnakeCase(data);
    snake.updated_at = now();
    if (id) {
      const { error } = await supabase.from("attendance_records").update(snake).eq("id", id);
      if (error) throw error;
      return id;
    } else {
      snake.created_at = now();
      const { data: inserted, error } = await supabase.from("attendance_records").insert(snake).select("id").single();
      if (error) throw error;
      return inserted?.id;
    }
  } catch (error) {
    console.error("Error saving attendance record:", error);
    throw error;
  }
}

export async function deleteAttendanceRecord(id) {
  try {
    const { error } = await supabase.from("attendance_records").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Error deleting attendance record:", error);
    throw error;
  }
}

export async function bulkSaveAttendance(records) {
  const results = { created: 0, updated: 0, errors: 0 };
  for (const rec of records) {
    try {
      const snake = toSnakeCase(rec);
      if (rec.id) {
        snake.updated_at = now();
        const { error } = await supabase.from("attendance_records").update(snake).eq("id", rec.id);
        if (error) throw error;
        results.updated++;
      } else {
        snake.created_at = now();
        const { error } = await supabase.from("attendance_records").insert(snake);
        if (error) throw error;
        results.created++;
      }
    } catch (e) {
      console.error("Error bulk saving attendance:", e);
      results.errors++;
    }
  }
  return results;
}

// =====================================================
// PAYROLL PERIODS
// =====================================================

export async function getPayrollPeriods() {
  try {
    const { data, error } = await supabase.from("payroll_periods").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return mapList(data).filter(p => !p.deleted);
  } catch (error) {
    console.error("Error fetching payroll periods:", error);
    return [];
  }
}

export async function getPayrollPeriodById(id) {
  try {
    const { data, error } = await supabase.from("payroll_periods").select("*").eq("id", id).single();
    if (error && error.code !== "PGRST116") throw error;
    return mapItem(data);
  } catch (error) {
    console.error("Error fetching payroll period:", error);
    return null;
  }
}

export async function savePayrollPeriod(id, data) {
  try {
    const snake = toSnakeCase(data);
    snake.updated_at = now();
    if (id) {
      const { error } = await supabase.from("payroll_periods").update(snake).eq("id", id);
      if (error) throw error;
      return id;
    } else {
      snake.created_at = now();
      const { data: inserted, error } = await supabase.from("payroll_periods").insert(snake).select("id").single();
      if (error) throw error;
      return inserted?.id;
    }
  } catch (error) {
    console.error("Error saving payroll period:", error);
    throw error;
  }
}

export async function deletePayrollPeriod(id) {
  try {
    const { error } = await supabase.from("payroll_periods").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Error deleting payroll period:", error);
    throw error;
  }
}

export async function softDeletePayrollPeriod(id) {
  try {
    const { error } = await supabase.from("payroll_periods").update({ deleted: true, deleted_at: now(), updated_at: now() }).eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Error soft-deleting payroll period:", error);
    throw error;
  }
}

export async function restorePayrollPeriod(id) {
  try {
    const { error } = await supabase.from("payroll_periods").update({ deleted: false, deleted_at: null, updated_at: now() }).eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Error restoring payroll period:", error);
    throw error;
  }
}

export async function getTrashedPayrollPeriods() {
  try {
    const { data, error } = await supabase.from("payroll_periods").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return mapList(data).filter(p => p.deleted);
  } catch (error) {
    console.error("Error fetching trashed periods:", error);
    return [];
  }
}

// =====================================================
// LOANS
// =====================================================

export async function getLoans() {
  try {
    const { data, error } = await supabase.from("loans").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return mapList(data);
  } catch (error) {
    console.error("Error fetching loans:", error);
    return [];
  }
}

export async function saveLoan(id, data) {
  try {
    const snake = toSnakeCase(data);
    snake.updated_at = now();
    if (id) {
      const { error } = await supabase.from("loans").update(snake).eq("id", id);
      if (error) throw error;
      return id;
    } else {
      snake.created_at = now();
      const { data: inserted, error } = await supabase.from("loans").insert(snake).select("id").single();
      if (error) throw error;
      return inserted?.id;
    }
  } catch (error) {
    console.error("Error saving loan:", error);
    throw error;
  }
}

export async function deleteLoan(id) {
  try {
    const { error } = await supabase.from("loans").delete().eq("id", id);
    if (error) throw error;
  } catch (error) {
    console.error("Error deleting loan:", error);
    throw error;
  }
}

// =====================================================
// BULK PRODUCT IMPORT
// =====================================================

export async function bulkSaveProducts(products) {
  const results = { created: 0, updated: 0, errors: 0 };
  const existing = await getProducts();
  for (const product of products) {
    try {
      if (!product.name || product.price === undefined) {
        results.errors++;
        continue;
      }
      const slug = product.name.toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      let existingProduct = null;
      if (product.sku) existingProduct = existing.find(p => p.sku === product.sku);
      if (!existingProduct && product.barcode) existingProduct = existing.find(p => p.barcode === product.barcode);
      const data = {
        name: product.name, slug, price: Number(product.price) || 0,
        comparePrice: Number(product.comparePrice) || 0, stock: Number(product.stock) || 0,
        sku: product.sku || "", barcode: product.barcode || "",
        description: product.description || "", category: product.category || "",
        brand: product.brand || "", isActive: product.isActive !== false,
        isFeatured: false, images: [], tags: [], variants: [],
      };
      const snake = toSnakeCase(data);
      if (existingProduct) {
        snake.updated_at = now();
        const { error } = await supabase.from("products").update(snake).eq("id", existingProduct.id);
        if (error) throw error;
        results.updated++;
      } else {
        snake.created_at = now();
        const { error } = await supabase.from("products").insert(snake);
        if (error) throw error;
        results.created++;
      }
    } catch (e) {
      console.error("Error bulk saving product:", e);
      results.errors++;
    }
  }
  invalidateProductsCache();
  return results;
}
