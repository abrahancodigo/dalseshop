"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { storefrontCacheScope } from "@/lib/storefrontEnvironment.mjs";
import { getStorefrontBootstrap } from "@/lib/storefrontBootstrap.mjs";

const StoreContext = createContext(null);
const STORE_CACHE_KEY = `dalseshop_store_v2_${storefrontCacheScope}`;

const defaultSettings = {
  name: "Mi Tienda",
  slogan: "",
  description: "",
  logo: "",
  favicon: "",
  email: "",
  phone: "",
  address: "",
  legalInfo: {
    businessName: "",
    nit: "",
    phone: "",
    email: "",
  },
  notifications: {
    ownerEmail: "",
    extraEmail1: "",
    extraEmail2: "",
  },
  contactNotifications: {
    email1: "",
    email2: "",
    email3: "",
  },
  seo: {
    metaTitle: "",
    metaDescription: "",
    keywords: "",
  },
  socialMedia: {
    facebook: "",
    instagram: "",
    twitter: "",
    youtube: "",
    tiktok: "",
    whatsapp: "",
  },
};

const defaultTheme = {
  primaryColor: "#6C5CE7",
  secondaryColor: "#0D1B2A",
  accentColor: "#00CEC9",
  backgroundColor: "#FFFFFF",
  textColor: "#1A1A2E",
  headerTextColor: "",
  footerTextColor: "",
  mutedTextColor: "#475569",
  primaryContrastColor: "",
  secondaryContrastColor: "",
  fontFamily: "Inter",
  fontFamilyHeadings: "Inter",
  borderRadius: "8",
  headerStyle: "solid",
  cardStyle: "shadow",
};

const defaultFeatures = {
  cart: true,
  orders: true,
  coupons: false,
  reviews: false,
  wishlist: false,
  search: true,
  newsletter: false,
  blog: false,
  shipping: false,
  customers: false,
  showPrices: true,
};

const defaultNavigation = {
  header: {
    menuItems: [
      { label: "Inicio", href: "/", order: 0 },
      { label: "Productos", href: "/productos", order: 1 },
    ],
  },
  footer: {
    columns: [
      { title: "Información", content: "" },
      { title: "Enlaces", content: "" },
      { title: "Contacto", content: "" },
    ],
    copyright: "© 2026 Mi Tienda. Todos los derechos reservados.",
    showSocialLinks: true,
  },
};

export function StoreProvider({ children }) {
  // Hydrate from local cache so header/footer/theme render instantly on return visits.
  // Fresh data from Firestore arrives right after and updates silently.
  const [initialCache] = useState(() => {
    const prepared = getStorefrontBootstrap()?.store || null;
    try {
      const raw = localStorage.getItem(STORE_CACHE_KEY);
      if (!raw) return prepared;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return prepared;
      return parsed;
    } catch {
      return prepared;
    }
  });
  const [settings, setSettings] = useState({ ...defaultSettings, ...(initialCache?.settings || {}) });
  const [theme, setTheme] = useState({ ...defaultTheme, ...(initialCache?.theme || {}) });
  const [features, setFeatures] = useState({ ...defaultFeatures, ...(initialCache?.features || {}) });
  const [navigation, setNavigation] = useState({ ...defaultNavigation, ...(initialCache?.navigation || {}) });
  const [brands, setBrands] = useState(Array.isArray(initialCache?.brands) ? initialCache.brands : []);
  const [categories, setCategories] = useState(Array.isArray(initialCache?.categories) ? initialCache.categories : []);
  const [loading, setLoading] = useState(!initialCache);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { getStoreSettings, getStoreTheme, getStoreFeatures, getStoreNavigation, getBrands, getCategories } = await import("@/lib/firestore");
        if (cancelled) return;
        const [
          settingsData,
          themeData,
          featuresData,
          navigationData,
          brandsData,
          categoriesData,
        ] = await Promise.all([
          getStoreSettings(),
          getStoreTheme(),
          getStoreFeatures(),
          getStoreNavigation(),
          getBrands(),
          getCategories(),
        ]);

        if (cancelled) return;

        if (settingsData && Object.keys(settingsData).length > 0) {
          setSettings({ ...defaultSettings, ...settingsData });
        }
        if (themeData && Object.keys(themeData).length > 0) {
          setTheme({ ...defaultTheme, ...themeData });
        }
        if (featuresData && Object.keys(featuresData).length > 0) {
          setFeatures({ ...defaultFeatures, ...featuresData });
        }
        if (navigationData && Object.keys(navigationData).length > 0) {
          setNavigation({ ...defaultNavigation, ...navigationData });
        }
        setBrands(brandsData || []);
        setCategories(categoriesData || []);
        // Refresh the local cache for instant loads next time
        try {
          localStorage.setItem(
            STORE_CACHE_KEY,
            JSON.stringify({
              settings: settingsData || {},
              theme: themeData || {},
              features: featuresData || {},
              navigation: navigationData || {},
              brands: brandsData || [],
              categories: categoriesData || [],
            })
          );
        } catch {
          // storage full or blocked: app keeps working, just without cache
        }
      } catch (err) {
        console.warn("Error loading store config:", err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 5000);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  // Apply theme as CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--color-primary", theme.primaryColor || defaultTheme.primaryColor);
    root.style.setProperty("--color-secondary", theme.secondaryColor || defaultTheme.secondaryColor);
    root.style.setProperty("--color-accent", theme.accentColor || defaultTheme.accentColor);
    root.style.setProperty("--color-background", theme.backgroundColor || defaultTheme.backgroundColor);
    root.style.setProperty("--color-text", theme.textColor || defaultTheme.textColor);
    root.style.setProperty("--font-family", (theme.fontFamily || defaultTheme.fontFamily) + ", sans-serif");
    root.style.setProperty("--border-radius", (theme.borderRadius || defaultTheme.borderRadius) + "px");
    root.style.setProperty("--color-muted", theme.mutedTextColor || defaultTheme.mutedTextColor);

    // Dynamic contrast colors
    const getContrastColor = (hex) => {
      if (!hex) return "white";
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness > 128 ? "#1A1A2E" : "#FFFFFF";
    };

    const autoSecondaryText = getContrastColor(theme.secondaryColor || defaultTheme.secondaryColor);
    const autoPrimaryText = getContrastColor(theme.primaryColor || defaultTheme.primaryColor);

    root.style.setProperty("--color-secondary-text", theme.secondaryContrastColor || autoSecondaryText);
    root.style.setProperty("--color-primary-text", theme.primaryContrastColor || autoPrimaryText);

    // Manual or Auto colors for Header/Footer
    root.style.setProperty("--color-header-text", theme.headerTextColor || theme.secondaryContrastColor || autoSecondaryText);
    root.style.setProperty("--color-footer-text", theme.footerTextColor || theme.secondaryContrastColor || autoSecondaryText);
  }, [theme]);

  // Memoized value: prevents re-rendering every consumer on unrelated state changes
  const value = useMemo(
    () => ({
      settings,
      theme,
      features,
      navigation,
      brands,
      categories,
      loading,
      defaultSettings,
      defaultTheme,
      defaultFeatures,
      defaultNavigation,
    }),
    [settings, theme, features, navigation, brands, categories, loading]
  );

  return (
    <StoreContext.Provider
      value={value}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}

export default StoreContext;
