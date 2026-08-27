import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";

const formatDuration = (milliseconds) => (
  typeof milliseconds === "number" ? `${(milliseconds / 1000).toFixed(2)} s` : "—"
);

export default function AuthTimingOverlay() {
  const { authTiming } = useAuth();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!import.meta.env.DEV || !authTiming) return undefined;

    setNow(Date.now());
    const intervalId = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(intervalId);
  }, [authTiming]);

  if (!import.meta.env.DEV || !authTiming) return null;

  const totalMs = authTiming.phase === "Completado"
    ? authTiming.totalMs
    : Math.max(authTiming.totalMs || 0, now - authTiming.startedAt);

  return (
    <aside
      aria-live="polite"
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 10000,
        width: 260,
        padding: "12px 14px",
        borderRadius: 10,
        background: "rgba(15, 23, 42, 0.94)",
        color: "#E2E8F0",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <strong style={{ display: "block", color: "#93C5FD", marginBottom: 4 }}>
        Medición local de acceso
      </strong>
      <div>Estado: {authTiming.phase}</div>
      <div>Credenciales Firebase: {formatDuration(authTiming.requestMs)}</div>
      <div>Perfil y permisos: {formatDuration(authTiming.profileMs)}</div>
      <div style={{ marginTop: 4, fontWeight: 700 }}>Total: {formatDuration(totalMs)}</div>
    </aside>
  );
}
