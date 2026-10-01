export const storefrontCacheScope = import.meta.env.VITE_USE_EMULATORS === "true"
  && import.meta.env.VITE_LOCAL_STOREFRONT_PREVIEW !== "true" ? "demo-dalseshop" : "dalseshop";
