import { createContext, useContext, useEffect, useState } from "react";
import { auth, googleProvider } from "../firebase"; 
import { onAuthStateChanged, signOut, signInWithPopup, User } from "firebase/auth";

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {   // 🔥 Fixed Capital letter
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('auth:onAuthStateChanged user=', currentUser && { uid: currentUser.uid, email: currentUser.email });
      setUser(currentUser);
      if (currentUser) setLastError(null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // If there's a locally stored admin or staff session (dev-only fallback), restore it
  useEffect(() => {
    if (!auth || typeof window === "undefined") return;
    try {
      const rawAdmin = localStorage.getItem("localAdmin");
      if (rawAdmin && !user) {
        const parsed = JSON.parse(rawAdmin);
        // basic shape check
        if (parsed && parsed.uid && parsed.role === "admin") {
          setUser(parsed);
          setLastError(null);
          setLoading(false);
          return;
        }
      }

      const rawStaff = localStorage.getItem("localStaff");
      if (rawStaff && !user) {
        const parsed = JSON.parse(rawStaff);
        if (parsed && parsed.uid && parsed.role === "staff") {
          setUser(parsed);
          setLastError(null);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      // ignore
    }
  }, []);



  // Use popup flow for Google sign-in to avoid issues with tracking prevention.
  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged will handle the signed-in user after popup completes.
    } catch (err: any) {
      // Provide a helpful message for common Firebase auth errors (e.g. unauthorized domains)
      const code = err?.code;
      let friendly = err?.message || String(err);
      if (code === "auth/unauthorized-domain") {
        const host = typeof window !== "undefined" ? window.location.host : "<your-host>";
        friendly = `Unauthorized domain: Add '${host}' to your Firebase project's Authorized domains (Firebase Console → Authentication → Sign-in method → Authorized domains).`;
      }
      setLastError(friendly);
      console.error('signInWithPopup failed:', err);
      throw err;
    }
  };

  // Local admin login (predefined credentials). This is a fallback for
  // development/demo: it creates a local admin session stored in localStorage.
  const adminLogin = async (id: string, password: string) => {
    // hardcoded credentials (per user request)
    if (id === "admin123" && password === "ideal123") {
      const localUser = {
        uid: "admin123",
        email: "admin@local",
        displayName: "Canteen Admin",
        role: "admin",
      };
      setUser(localUser as any);
      localStorage.setItem("localAdmin", JSON.stringify(localUser));
      setLastError(null);
      setLoading(false);

      // create a dev-admin session on backend so admin APIs are authorized
      try {
        await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ code: 'dev-admin' }),
        });
      } catch (e) {
        // ignore errors
      }

      return localUser;
    }
    const errMsg = "Invalid canteen credentials";
    setLastError(errMsg);
    throw new Error(errMsg);
  };



  // Real staff login against the backend API
  const staffLogin = async (id: string, password: string) => {
    setLoading(true);
    try {
      // 1. Try real backend Authentication
      const res = await fetch('/api/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: id, password })
      });
      
      if (res.ok) {
        const staffUser = await res.json();
        setUser(staffUser as any);
        localStorage.setItem("localStaff", JSON.stringify(staffUser));
        setLastError(null);
        setLoading(false);

        try {
          await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ code: 'dev-staff' }),
          });
        } catch (err) {}

        return staffUser;
      }
      
      // If backend fails but credential is the hardcoded fallback
      if (id === "staff123" && password === "ideal123") {
        const localUser = {
          uid: "staff123",
          email: "staff@local",
          displayName: "Canteen Staff",
          role: "staff",
        };
        setUser(localUser as any);
        localStorage.setItem("localStaff", JSON.stringify(localUser));
        setLastError(null);
        setLoading(false);

        try {
          await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ code: 'dev-staff' }),
          });
        } catch (e) {}

        return localUser;
      }

      const errorData = await res.json().catch(() => ({}));
      const errMsg = errorData.error || "Invalid staff credentials";
      setLastError(errMsg);
      setLoading(false);
      throw new Error(errMsg);
    } catch (err: any) {
      setLoading(false);
      setLastError(err?.message || "Login failed");
      throw err;
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem("localAdmin");
      localStorage.removeItem("localStaff");
    } catch (e) {}
    try {
      await signOut(auth);
    } catch (e) {}
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, adminLogin, staffLogin, logout, loading, lastError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
