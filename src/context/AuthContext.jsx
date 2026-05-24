"use client";
import { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase, SUPER_ADMIN_EMAIL } from "@/lib/supabase";
import { getUserByEmail, saveUser } from "@/lib/supabase-queries";
import { ROLE_PERMISSIONS, hasPermission, canManage } from "@/lib/permissions";

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userDoc, setUserDoc] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [role, setRole] = useState(null);
  const unsubscribeRef = useRef(null);

  const resolveUser = async (sessionUser) => {
    if (sessionUser) {
      setUser(sessionUser);
      let doc = await getUserByEmail(sessionUser.email);
      if (doc) {
        const validRoles = ["superadmin", "admin", "escritor", "lector"];
        const userRole = validRoles.includes(doc.role) ? doc.role : "lector";
        const mergedPerms = { ...ROLE_PERMISSIONS[userRole] };
        if (doc.customPermissions) {
          Object.assign(mergedPerms, doc.customPermissions);
        }
        setPermissions(mergedPerms);
        setRole(userRole);
        setIsAdmin(userRole !== "lector");
        if (userRole !== doc.role) {
          try {
            await saveUser(doc.id, { role: userRole, isActive: true });
          } catch (e) { console.error("Error updating user role:", e); }
        }
        setUserDoc(doc);
      } else if (sessionUser.email === SUPER_ADMIN_EMAIL) {
        const perms = ROLE_PERMISSIONS.superadmin;
        setPermissions(perms);
        setRole("superadmin");
        setIsAdmin(true);
        try {
          const newId = await saveUser(null, {
            auth_user_id: sessionUser.id,
            email: sessionUser.email,
            displayName: sessionUser.user_metadata?.full_name || "",
            photoURL: sessionUser.user_metadata?.avatar_url || "",
            role: "superadmin",
            isActive: true,
          });
          doc = { id: newId, email: sessionUser.email, displayName: sessionUser.user_metadata?.full_name, role: "superadmin", isActive: true };
          setUserDoc(doc);
        } catch (e) {
          console.error("Error creating superadmin user doc:", e);
        }
      } else {
        const defaultRole = "lector";
        const perms = ROLE_PERMISSIONS[defaultRole];
        setPermissions(perms);
        setRole(defaultRole);
        setIsAdmin(false);
        try {
          const newId = await saveUser(null, {
            auth_user_id: sessionUser.id,
            email: sessionUser.email,
            displayName: sessionUser.user_metadata?.full_name || "",
            photoURL: sessionUser.user_metadata?.avatar_url || "",
            role: defaultRole,
            isActive: true,
          });
          doc = { id: newId, email: sessionUser.email, displayName: sessionUser.user_metadata?.full_name, role: defaultRole, isActive: true };
          setUserDoc(doc);
        } catch (e) {
          console.error("Error auto-registering user:", e);
        }
      }
    } else {
      setUser(null);
      setSession(null);
      setUserDoc(null);
      setPermissions(null);
      setRole(null);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    let active = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;
      setSession(session);
      await resolveUser(session?.user ?? null);
      if (active) setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) {
        setSession(session);
        resolveUser(session?.user ?? null).then(() => {
          if (active) setLoading(false);
        });
      }
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: "select_account" }
      }
    });
    if (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        redirecting: false,
        isAdmin,
        userDoc,
        permissions,
        role,
        hasPermission: (perm) => hasPermission(permissions, perm),
        canManage: (perm) => canManage(permissions, perm),
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
