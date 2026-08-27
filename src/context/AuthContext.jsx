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
import { ensureUserProfile, getUserById, saveUser } from "@/lib/firestore";
import { ROLE_PERMISSIONS, hasPermission, canManage } from "@/lib/permissions";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const authTimingRef = useRef(null);
  const [authTiming, setAuthTiming] = useState(() => {
    try {
      const saved = sessionStorage.getItem("auth_timing");
      const timing = saved ? JSON.parse(saved) : null;
      authTimingRef.current = timing;
      return timing;
    } catch {
      return null;
    }
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState("");
  const [userDoc, setUserDoc] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [role, setRole] = useState(null);
  // redirecting: true while waiting for Google redirect to complete
  const [redirecting, setRedirecting] = useState(
    () => sessionStorage.getItem("auth_redirect_pending") === "1"
  );
  const unsubscribeRef = useRef(null);
  const isRegisteringRef = useRef(false);

  const updateAuthTiming = (updates) => {
    const current = authTimingRef.current;
    if (!current) return;

    const next = {
      ...current,
      ...updates,
      totalMs: Date.now() - current.startedAt,
    };
    authTimingRef.current = next;
    sessionStorage.setItem("auth_timing", JSON.stringify(next));
    setAuthTiming(next);
  };

  const startAuthTiming = () => {
    const timing = {
      startedAt: Date.now(),
      phase: "Autenticando...",
      requestMs: null,
      profileMs: null,
      totalMs: 0,
    };
    authTimingRef.current = timing;
    sessionStorage.setItem("auth_timing", JSON.stringify(timing));
    setAuthTiming(timing);
  };

  const resolveUser = async (fbUser) => {
    if (fbUser) {
      sessionStorage.removeItem("auth_manual_logout");
      setUser(fbUser);
      // User documents are keyed by Firebase Auth UID. Reading the document
      // directly is faster than a collection query and matches Firestore rules.
      let doc = await getUserById(fbUser.uid);
      if (!doc) {
        try {
          doc = await ensureUserProfile();
        } catch (error) {
          console.warn("Could not ensure server user profile, using local fallback:", error.message);
        }
      }
      if (doc?.isActive === false) {
        setAuthError("Esta cuenta está inactiva. Contacta al administrador.");
        setUser(null);
        setUserDoc(null);
        setPermissions(null);
        setRole(null);
        setIsAdmin(false);
        await signOut(auth);
        return;
      }
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
      // Only wait for a redirect result when this browser actually initiated
      // a Google redirect. Waiting on every normal email/password login adds
      // an unnecessary delay before the auth listener is registered.
      const redirectPending = sessionStorage.getItem("auth_redirect_pending") === "1";
      if (redirectPending) {
        try {
          const result = await getRedirectResult(auth);
          if (result) {
            console.log("Redirect login successful for:", result.user.email);
          }
        } catch (err) {
          console.error("Redirect login error:", err);
        } finally {
          sessionStorage.removeItem("auth_redirect_pending");
          if (active) setRedirecting(false);
        }
      } else if (active) {
        setRedirecting(false);
      }

      // Subscribe immediately for normal logins. The role lookup still
      // completes before loading ends, so protected routes remain protected.
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (!active) return;
        if (!isRegisteringRef.current) {
          const profileStartedAt = Date.now();
          await resolveUser(fbUser);
          if (fbUser) {
            updateAuthTiming({
              phase: "Completado",
              profileMs: Date.now() - profileStartedAt,
            });
          }
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
    setAuthError("");
    startAuthTiming();
    try {
      await signInWithPopup(auth, googleProvider);
      updateAuthTiming({
        phase: authTimingRef.current.profileMs == null ? "Credenciales verificadas" : authTimingRef.current.phase,
        requestMs: Date.now() - authTimingRef.current.startedAt,
      });
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
    setAuthError("");
    startAuthTiming();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      updateAuthTiming({
        phase: authTimingRef.current.profileMs == null ? "Credenciales verificadas" : authTimingRef.current.phase,
        requestMs: Date.now() - authTimingRef.current.startedAt,
      });
    } catch (error) {
      updateAuthTiming({ phase: "Error de autenticación" });
      throw error;
    }
  };

  const resetPassword = async (email) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    sessionStorage.setItem("auth_manual_logout", "1");
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
        authError,
        authTiming,
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
