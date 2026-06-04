"use client";
import { createContext, useContext, useEffect, useState, useRef } from "react";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, googleProvider, SUPER_ADMIN_EMAIL } from "@/lib/firebase";
import { getUserByEmail, saveUser } from "@/lib/firestore";
import { ROLE_PERMISSIONS, hasPermission, canManage } from "@/lib/permissions";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userDoc, setUserDoc] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [role, setRole] = useState(null);
  // redirecting: true while waiting for Google redirect to complete
  const [redirecting, setRedirecting] = useState(
    () => sessionStorage.getItem("auth_redirect_pending") === "1"
  );
  const unsubscribeRef = useRef(null);
  const isRegisteringRef = useRef(false);

  const resolveUser = async (fbUser) => {
    if (fbUser) {
      setUser(fbUser);
      let doc = await getUserByEmail(fbUser.email);
      if (doc) {
        // Determine role: use existing valid role or default to "lector"
        const validRoles = ["superadmin", "admin", "escritor", "lector"];
        const userRole = validRoles.includes(doc.role) ? doc.role : "lector";
        const mergedPerms = { ...ROLE_PERMISSIONS[userRole] };
        if (doc.customPermissions) {
          Object.assign(mergedPerms, doc.customPermissions);
        }
        setPermissions(mergedPerms);
        setRole(userRole);
        setIsAdmin(userRole !== "lector");
        // Update DB if role was not valid
        if (userRole !== doc.role) {
          try {
            await saveUser(doc.id, { role: userRole, isActive: true });
          } catch (e) { console.error("Error updating user role:", e); }
        }
        setUserDoc(doc);
      } else if (fbUser.email === SUPER_ADMIN_EMAIL) {
        const perms = ROLE_PERMISSIONS.superadmin;
        setPermissions(perms);
        setRole("superadmin");
        setIsAdmin(true);
        try {
          const newId = await saveUser(fbUser.uid, {
            email: fbUser.email,
            displayName: fbUser.displayName || "",
            photoURL: fbUser.photoURL || "",
            role: "superadmin",
            isActive: true,
          });
          doc = { id: newId, email: fbUser.email, displayName: fbUser.displayName, role: "superadmin", isActive: true };
          setUserDoc(doc);
        } catch (e) {
          console.error("Error creating superadmin user doc:", e);
        }
      } else {
        // New users default to "lector" role
        const defaultRole = "lector";
        const perms = ROLE_PERMISSIONS[defaultRole];
        setPermissions(perms);
        setRole(defaultRole);
        setIsAdmin(false);
        try {
          const newId = await saveUser(fbUser.uid, {
            email: fbUser.email,
            displayName: fbUser.displayName || "",
            photoURL: fbUser.photoURL || "",
            role: defaultRole,
            isActive: true,
          });
          doc = { id: newId, email: fbUser.email, displayName: fbUser.displayName, role: defaultRole, isActive: true };
          setUserDoc(doc);
        } catch (e) {
          console.error("Error auto-registering user:", e);
        }
      }
    } else {
      setUser(null);
      setUserDoc(null);
      setPermissions(null);
      setRole(null);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    let active = true;

    const init = async () => {
      // 1. Check if we're returning from a Google redirect
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          console.log("Redirect login successful for:", result.user.email);
        }
      } catch (err) {
        console.error("Redirect login error:", err);
      } finally {
        // Clear the pending flag regardless of outcome
        sessionStorage.removeItem("auth_redirect_pending");
        if (active) setRedirecting(false);
      }

      // 2. Now subscribe to auth state — Firebase has already processed the redirect
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (!active) return;
        if (!isRegisteringRef.current) {
          await resolveUser(fbUser);
        }
        if (active) setLoading(false);
      });

      unsubscribeRef.current = unsubscribe;
    };

    init();

    return () => {
      active = false;
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (
        error.code === "auth/popup-blocked" ||
        error.code === "auth/popup-closed-by-user" ||
        error.code === "auth/cancelled-popup-request"
      ) {
        // Mark that we're starting a redirect so the login page shows a spinner
        sessionStorage.setItem("auth_redirect_pending", "1");
        setRedirecting(true);
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      console.error("Login error:", error);
      throw error;
    }
  };

  const registerWithEmail = async (email, password, displayName) => {
    isRegisteringRef.current = true;
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const fbUser = credential.user;
      const name = (displayName || email.split("@")[0]).trim();
      await updateProfile(fbUser, { displayName: name });
      await resolveUser(auth.currentUser);
    } finally {
      isRegisteringRef.current = false;
    }
  };

  const loginWithEmail = async (email, password) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const resetPassword = async (email) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        redirecting,
        isAdmin,
        userDoc,
        permissions,
        role,
        hasPermission: (perm) => hasPermission(permissions, perm),
        canManage: (perm) => canManage(permissions, perm),
        loginWithGoogle,
        registerWithEmail,
        loginWithEmail,
        resetPassword,
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
