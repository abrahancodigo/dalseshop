export const ROLE_PERMISSIONS = {
  superadmin: {
    dashboard: true, settings: true, theme: true, pages: "manage",
    navigation: true, products: "manage", categories: true, brands: true,
    orders: "manage", customers: true, coupons: true,
    blog: true, newsletter: true, reviews: true, shipping: true,
    features: true, users: true, inventory: "manage", payroll: "manage",
  },
  admin: {
    dashboard: true, settings: true, theme: true, pages: "manage",
    navigation: true, products: "manage", categories: true, brands: true,
    orders: "manage", customers: true, coupons: true,
    blog: true, newsletter: true, reviews: true, shipping: true,
    features: true, users: true, inventory: "manage", payroll: "manage",
  },
  escritor: {
    dashboard: true, settings: "view", theme: "view", pages: "manage",
    navigation: "view", products: "manage", categories: true, brands: true,
    orders: "view", customers: "view", coupons: "view",
    blog: true, newsletter: "view", reviews: "view", shipping: "view",
    features: "view", users: false, inventory: "manage", payroll: "view",
  },
  lector: {
    dashboard: true, settings: "view", theme: "view", pages: "view",
    navigation: "view", products: "view", categories: "view", brands: "view",
    orders: "view", customers: "view", coupons: "view",
    blog: "view", newsletter: "view", reviews: "view", shipping: "view",
    features: "view", users: false, inventory: false, payroll: false,
  },
};

export const ROUTE_PERMISSIONS = {
  "/admin": "dashboard",
  "/admin/configuracion": "settings",
  "/admin/tema": "theme",
  "/admin/paginas": "pages",
  "/admin/navegacion": "navigation",
  "/admin/productos": "products",
  "/admin/categorias": "categories",
  "/admin/marcas": "brands",
  "/admin/pedidos": "orders",
  "/admin/clientes": "customers",
  "/admin/cupones": "coupons",
  "/admin/blog": "blog",
  "/admin/marketing/newsletter": "newsletter",
  "/admin/marketing/resenas": "reviews",
  "/admin/envios": "shipping",
  "/admin/funcionalidades": "features",
  "/admin/usuarios": "users",
  "/inventario": "inventory",
  "/control-asistencia": "payroll",
};

export function hasPermission(userPerms, permission) {
  if (!userPerms) return false;
  const value = userPerms[permission];
  if (value === true || value === "manage" || value === "view") return true;
  return false;
}

export function canManage(userPerms, permission) {
  if (!userPerms) return false;
  return userPerms[permission] === "manage" || userPerms[permission] === true;
}
