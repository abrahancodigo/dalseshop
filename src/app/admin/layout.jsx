"use client";

import { createContext, useContext } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState, useMemo } from "react";
import Sidebar from "@/components/admin/Sidebar";
import { ROUTE_PERMISSIONS, hasPermission } from "@/lib/permissions";
import styles from "./admin.module.css";

const AdminLayoutContext = createContext({});

export function useAdminLayout() {
  return useContext(AdminLayoutContext);
}

export default function AdminLayout() {
  const { user, isAdmin, permissions, loading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState("dark");

  // Stabilize permissions dependency to avoid re-render cascades
  const permKey = useMemo(() => JSON.stringify(permissions), [permissions]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("admin-theme") || "dark";
    setTheme(savedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-admin-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("admin-theme", newTheme);
  };

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) {
      navigate("/auth/login", { state: { from: pathname } });
      return;
    }
    if (permissions) {
      const routeKey = Object.keys(ROUTE_PERMISSIONS).find((r) => pathname.startsWith(r));
      if (routeKey) {
        const needed = ROUTE_PERMISSIONS[routeKey];
        if (!hasPermission(permissions, needed)) {
          navigate("/admin");
        }
      }
    }
  }, [user, isAdmin, loading, permKey, pathname, navigate]);

  if (loading) {
    return (
      <div className="loading-screen" style={{ background: "#0F172A" }}>
        <div className="spinner" />
        <span style={{ color: "#94A3B8" }}>Cargando panel...</span>
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return (
    <div className={styles.adminLayout} data-admin-theme={theme}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className={styles.mainContent}>
        <div className={styles.contentWrapper}>
          <AdminLayoutContext.Provider
            value={{
              toggleSidebar: () => setSidebarOpen(!sidebarOpen),
              theme,
              toggleTheme,
            }}
          >
            <Outlet />
          </AdminLayoutContext.Provider>
        </div>
      </main>
    </div>
  );
}
