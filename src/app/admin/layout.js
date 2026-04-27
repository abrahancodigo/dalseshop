"use client";

import { createContext, useContext } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/admin/Sidebar";
import styles from "./admin.module.css";

const AdminLayoutContext = createContext({});

export function useAdminLayout() {
  return useContext(AdminLayoutContext);
}

export default function AdminLayout({ children }) {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    // Load saved theme
    const savedTheme = localStorage.getItem("admin-theme") || "dark";
    console.log("AdminLayout: Initial theme loaded:", savedTheme);
    setTheme(savedTheme);
  }, []);

  useEffect(() => {
    // Apply theme to HTML element for better CSS coverage
    console.log("AdminLayout: Applying theme to HTML:", theme);
    document.documentElement.setAttribute("data-admin-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    console.log("AdminLayout: Toggling theme to:", newTheme);
    setTheme(newTheme);
    localStorage.setItem("admin-theme", newTheme);
  };

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push("/auth/login");
    }
  }, [user, isAdmin, loading, router]);

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
            {children}
          </AdminLayoutContext.Provider>
        </div>
      </main>
    </div>
  );
}
