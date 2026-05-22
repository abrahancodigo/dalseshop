"use client";

import { useAuth } from "@/context/AuthContext";
import {
  HiOutlineBars3,
  HiOutlineBell,
  HiOutlineArrowRightOnRectangle,
  HiOutlineSun,
  HiOutlineMoon,
} from "react-icons/hi2";
import { useAdminLayout } from "../../app/admin/layout";
import styles from "./AdminHeader.module.css";

export default function AdminHeader({ title, subtitle, onMenuToggle }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useAdminLayout();

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={onMenuToggle}>
          <HiOutlineBars3 />
        </button>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      </div>

      <div className={styles.right}>
        <button className={styles.iconBtn} onClick={() => {
          console.log("AdminHeader: Theme toggle clicked. Current:", theme);
          toggleTheme();
        }} title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}>
          {theme === "dark" ? <HiOutlineSun /> : <HiOutlineMoon />}
        </button>

        <button className={styles.iconBtn} title="Notificaciones">
          <HiOutlineBell />
        </button>

        <div className={styles.userArea}>
          {user?.photoURL && (
            <img
              src={user.photoURL}
              alt={user.displayName}
              className={styles.avatar}
            />
          )}
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.displayName}</span>
            <span className={styles.userEmail}>{user?.email}</span>
          </div>
        </div>

        <button
          className={styles.logoutBtn}
          onClick={logout}
          title="Cerrar sesión"
        >
          <HiOutlineArrowRightOnRectangle />
        </button>
      </div>
    </header>
  );
}
