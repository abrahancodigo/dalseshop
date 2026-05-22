"use client";

import { useState, useEffect } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdminLayout } from "../layout";
import { useAuth } from "@/context/AuthContext";
import { getUsers, saveUser, deleteUser } from "@/lib/firestore";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import {
  HiOutlineShieldCheck,
  HiOutlineUserCircle,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineXMark,
  HiOutlineMagnifyingGlass,
  HiOutlineExclamationCircle,
} from "react-icons/hi2";
import adminStyles from "../admin.module.css";
import styles from "./usuarios.module.css";

const ROLE_LABELS = {
  superadmin: "Super Admin",
  admin: "Administrador",
  manager: "Gerente",
  editor: "Editor",
  viewer: "Espectador",
};

const PERMISSION_LABELS = {
  dashboard: "Dashboard",
  products: "Productos",
  categories: "Categorías",
  brands: "Marcas",
  orders: "Pedidos",
  customers: "Clientes",
  coupons: "Cupones",
  blog: "Blog",
  pages: "Páginas",
  navigation: "Navegación",
  settings: "Configuración",
  theme: "Tema / Diseño",
  shipping: "Envíos",
  reviews: "Reseñas",
  newsletter: "Newsletter",
  features: "Funcionalidades",
  users: "Usuarios",
  inventory: "Inventario",
};

export default function UsuariosPage() {
  const { toggleSidebar } = useAdminLayout();
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    email: "",
    displayName: "",
    role: "viewer",
    isActive: true,
  });
  const [customPerms, setCustomPerms] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = users.filter((u) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      (u.email || "").toLowerCase().includes(term) ||
      (u.displayName || "").toLowerCase().includes(term) ||
      (ROLE_LABELS[u.role] || (u.role === null ? "Sin rol" : "")).toLowerCase().includes(term)
    );
  });

  const openCreate = () => {
    setEditId(null);
    setForm({ email: "", displayName: "", role: "viewer", isActive: true });
    setCustomPerms({});
    setError("");
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditId(u.id);
    setForm({
      email: u.email || "",
      displayName: u.displayName || "",
      role: u.role || "viewer",
      isActive: u.isActive !== false,
    });
    setCustomPerms(u.customPermissions || {});
    setError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.email.trim()) {
      setError("El email es requerido");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const role = form.role === "none" ? null : form.role;
      const data = {
        email: form.email.trim().toLowerCase(),
        displayName: form.displayName.trim() || form.email.trim(),
        photoURL: "",
        role,
        isActive: form.isActive,
      };
      if (role) {
        const defaultPerms = ROLE_PERMISSIONS[role] || {};
        const hasCustom = Object.keys(customPerms).some(
          (k) => customPerms[k] !== undefined && customPerms[k] !== defaultPerms[k]
        );
        if (hasCustom) {
          data.customPermissions = customPerms;
        }
      }
      await saveUser(editId, data);
      setShowModal(false);
      loadUsers();
    } catch (err) {
      setError("Error al guardar el usuario");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteUser(id);
      setDeleteConfirm(null);
      loadUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleCustomPerm = (key, value) => {
    const defaultPerms = ROLE_PERMISSIONS[form.role] || {};
    const currentVal = customPerms[key] !== undefined ? customPerms[key] : defaultPerms[key];
    let nextVal;
    if (typeof value === "string") {
      nextVal = currentVal === value ? undefined : value;
    } else {
      nextVal = currentVal ? false : true;
    }
    setCustomPerms((prev) => {
      const next = { ...prev };
      if (nextVal === undefined || nextVal === defaultPerms[key]) {
        delete next[key];
      } else {
        next[key] = nextVal;
      }
      return next;
    });
  };

  const getPermValue = (key) => {
    if (!form.role || form.role === "none") return false;
    const defaultPerms = ROLE_PERMISSIONS[form.role] || {};
    return customPerms[key] !== undefined ? customPerms[key] : defaultPerms[key];
  };

  const isCustomized = (key) => {
    if (!form.role || form.role === "none") return false;
    const defaultPerms = ROLE_PERMISSIONS[form.role] || {};
    return customPerms[key] !== undefined && customPerms[key] !== defaultPerms[key];
  };

  if (!hasPermission("users")) {
    return (
      <>
        <AdminHeader title="Usuarios" subtitle="Gestión de usuarios" onMenuToggle={toggleSidebar} />
        <div className={adminStyles.pageContent}>
          <div className={adminStyles.emptyState}>
            <HiOutlineExclamationCircle size={48} />
            <h3>Sin acceso</h3>
            <p>No tienes permisos para gestionar usuarios.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AdminHeader
        title="Usuarios"
        subtitle={`${users.length} usuario${users.length !== 1 ? "s" : ""}`}
        onMenuToggle={toggleSidebar}
      />

      <div className={adminStyles.pageContent}>
        <div className={styles.actionBar}>
          <div className={styles.searchBox}>
            <HiOutlineMagnifyingGlass className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Buscar por email, nombre o rol..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
            {search && (
              <button className={styles.clearSearchBtn} onClick={() => setSearch("")}>
                <HiOutlineXMark />
              </button>
            )}
          </div>
          <button className="btn btn-primary" onClick={openCreate}>
            <HiOutlineUserCircle /> Nuevo Usuario
          </button>
        </div>

        {loading ? (
          <div className="loading-screen" style={{ minHeight: 300 }}>
            <div className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className={adminStyles.emptyState}>
            <div className={adminStyles.emptyIcon}><HiOutlineUserCircle /></div>
            <h3 className={adminStyles.emptyTitle}>
              {search ? "Sin resultados" : "Sin usuarios"}
            </h3>
            <p className={adminStyles.emptyText}>
              {search ? "No se encontraron usuarios que coincidan con la búsqueda." : "Aún no hay usuarios registrados en el sistema."}
            </p>
          </div>
        ) : (
          <>
            {search && (
              <p className={styles.searchResultInfo}>
                {filtered.length} usuario{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
              </p>
            )}
            <div className={styles.grid}>
              {filtered.map((u) => (
                <div key={u.id} className={`${styles.card} ${!u.isActive ? styles.inactive : ""} ${!u.role ? styles.noRole : ""}`}>
                  <div className={styles.cardTop}>
                    <div className={styles.userAvatar}>
                      {u.photoURL ? (
                        <img src={u.photoURL} alt={u.displayName} className={styles.avatarImg} />
                      ) : (
                        <HiOutlineUserCircle className={styles.avatarIcon} />
                      )}
                    </div>
                    <div className={styles.userInfo}>
                      <span className={styles.userName}>{u.displayName || u.email}</span>
                      <span className={styles.userEmail}>{u.email}</span>
                    </div>
                    {!u.isActive && <span className={styles.inactiveBadge}>Inactivo</span>}
                  </div>

                  <div className={styles.roleBadge} data-role={u.role || "none"}>
                    {u.role ? (ROLE_LABELS[u.role] || u.role) : "Sin rol"}
                  </div>

                  {u.customPermissions && (
                    <div className={styles.customHint}>Permisos personalizados</div>
                  )}

                  <div className={styles.cardActions}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>
                      <HiOutlinePencilSquare /> Editar
                    </button>
                    {u.role !== "superadmin" && (
                      deleteConfirm === u.id ? (
                        <div className={styles.deleteConfirm}>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u.id)}>Sí</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(null)}>No</button>
                        </div>
                      ) : (
                        <button className="btn btn-ghost btn-sm" onClick={() => setDeleteConfirm(u.id)} style={{ color: "var(--color-danger)" }}>
                          <HiOutlineTrash />
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => !saving && setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editId ? "Editar Usuario" : "Nuevo Usuario"}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)} disabled={saving}>
                <HiOutlineXMark />
              </button>
            </div>
            <div className={styles.modalBody}>
              {error && <div className={styles.formError}>{error}</div>}

              <div className="admin-form-group">
                <label className="admin-form-label">Email *</label>
                <input
                  className="admin-form-input"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="usuario@email.com"
                  disabled={!!editId}
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Nombre</label>
                <input
                  className="admin-form-input"
                  value={form.displayName}
                  onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
                  placeholder="Nombre del usuario"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Rol</label>
                <select
                  className="admin-form-select"
                  value={form.role || "none"}
                  onChange={(e) => {
                    const newRole = e.target.value === "none" ? null : e.target.value;
                    setForm((p) => ({ ...p, role: newRole }));
                    setCustomPerms({});
                  }}
                >
                  <option value="none">Sin rol</option>
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <option key={key} value={key} disabled={key === "superadmin" && editId !== null}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  />
                  Usuario activo
                </label>
              </div>

              {form.role && form.role !== "none" && (
                <div className={styles.permissionsSection}>
                  <h4 className={styles.permissionsTitle}>
                    Permisos personalizados
                    <span className={styles.permissionsHint}>
                      (opcional - solo sobreescribe los del rol)
                    </span>
                  </h4>
                  <div className={styles.permissionsGrid}>
                    {Object.entries(PERMISSION_LABELS).map(([key, label]) => {
                      const val = getPermValue(key);
                      const customized = isCustomized(key);
                      let displayVal = "";
                      if (val === true || val === "manage") displayVal = "✓";
                      else if (val === "view") displayVal = "👁";
                      else displayVal = "—";
                      return (
                        <div key={key} className={`${styles.permItem} ${customized ? styles.permCustom : ""}`}>
                          <span className={styles.permLabel}>{label}</span>
                          <div className={styles.permControls}>
                            <span className={styles.permValue}>{displayVal}</span>
                            {val === true || val === "manage" ? (
                              <button className={styles.permBtn} onClick={() => toggleCustomPerm(key, "view")} title="Cambiar a solo vista">👁</button>
                            ) : null}
                            {val === "view" ? (
                              <button className={styles.permBtn} onClick={() => toggleCustomPerm(key, "manage")} title="Cambiar a gestión">✏️</button>
                            ) : null}
                            {val === "manage" || val === "view" ? (
                              <button className={styles.permBtn} onClick={() => toggleCustomPerm(key, false)} title="Quitar acceso">🚫</button>
                            ) : (
                              <button className={styles.permBtn} onClick={() => toggleCustomPerm(key, "manage")} title="Dar acceso total">➕</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.email.trim()}>
                {saving ? "Guardando..." : editId ? "Guardar" : "Crear Usuario"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
