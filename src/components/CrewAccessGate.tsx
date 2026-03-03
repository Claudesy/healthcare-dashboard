"use client";

import { FormEvent, type ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Route publik yang tidak memerlukan autentikasi crew
const PUBLIC_PATHS = ["/join/"];

interface CrewAccessGateProps {
  children: ReactNode;
}

export default function CrewAccessGate({ children }: CrewAccessGateProps) {
  const pathname = usePathname();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Bypass auth untuk route publik (halaman join pasien)
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return <>{children}</>;
  }
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (!isMounted) return;
        setIsAuthenticated(response.ok);
      } catch {
        if (!isMounted) return;
        setIsAuthenticated(false);
      } finally {
        if (!isMounted) return;
        setIsCheckingSession(false);
      }
    }

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: usernameInput,
          password: passwordInput,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) {
        setErrorMessage(payload?.error || "Nama atau password tidak valid.");
        return;
      }

      setIsAuthenticated(true);
      setPasswordInput("");
    } catch {
      setErrorMessage("Gagal terhubung ke server autentikasi.");
    } finally {
      setIsSubmitting(false);
      setIsCheckingSession(false);
    }
  }

  if (isCheckingSession) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "var(--bg-canvas)",
          color: "var(--text-muted)",
          fontFamily: "var(--font-geist-mono), monospace",
          letterSpacing: "0.08em",
          fontSize: 13,
        }}
      >
        VERIFYING CREW ACCESS...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "var(--bg-canvas)",
          padding: 24,
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            width: "100%",
            maxWidth: 420,
            background: "var(--bg-nav)",
            border: "1px solid var(--line-base)",
            boxShadow: "0 20px 45px rgba(0, 0, 0, 0.2)",
            borderRadius: 12,
            padding: 28,
            display: "grid",
            gap: 16,
          }}
        >
          <div style={{ marginBottom: 4 }}>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-geist-mono), monospace",
                fontSize: 11,
                letterSpacing: "0.16em",
                color: "var(--c-asesmen)",
              }}
            >
              CREW PORTAL
            </p>
            <h1
              style={{
                margin: "10px 0 4px",
                fontFamily: "var(--font-geist-sans), sans-serif",
                fontWeight: 600,
                fontSize: 26,
                color: "var(--text-main)",
              }}
            >
              Sign In
            </h1>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-geist-sans), sans-serif",
                fontSize: 14,
                color: "var(--text-muted)",
              }}
            >
              Gunakan akses crew yang sudah didaftarkan.
            </p>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-geist-sans), sans-serif" }}>
              Username
            </span>
            <input
              type="text"
              value={usernameInput}
              onChange={(event) => setUsernameInput(event.target.value)}
              autoComplete="username"
              placeholder="contoh: ferdi"
              style={{
                height: 44,
                borderRadius: 8,
                border: "1px solid var(--line-base)",
                background: "var(--bg-canvas)",
                color: "var(--text-main)",
                fontFamily: "var(--font-geist-sans), sans-serif",
                fontSize: 15,
                padding: "0 14px",
                outline: "none",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-geist-sans), sans-serif" }}>
              Password
            </span>
            <input
              type="password"
              value={passwordInput}
              onChange={(event) => setPasswordInput(event.target.value)}
              autoComplete="current-password"
              placeholder="masukkan password"
              style={{
                height: 44,
                borderRadius: 8,
                border: "1px solid var(--line-base)",
                background: "var(--bg-canvas)",
                color: "var(--text-main)",
                fontFamily: "var(--font-geist-sans), sans-serif",
                fontSize: 15,
                padding: "0 14px",
                outline: "none",
              }}
            />
          </label>

          {errorMessage ? (
            <p
              style={{
                margin: 0,
                color: "var(--c-critical)",
                fontFamily: "var(--font-geist-sans), sans-serif",
                fontSize: 13,
              }}
            >
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              marginTop: 4,
              height: 44,
              borderRadius: 8,
              border: "1px solid var(--c-asesmen)",
              background: "var(--c-asesmen)",
              color: "#F0E8DC",
              fontFamily: "var(--font-geist-sans), sans-serif",
              fontSize: 15,
              fontWeight: 600,
              cursor: isSubmitting ? "wait" : "pointer",
              opacity: isSubmitting ? 0.8 : 1,
            }}
          >
            {isSubmitting ? "Memproses..." : "Masuk"}
          </button>

          <div style={{ marginTop: 8, paddingTop: 16, borderTop: "1px solid var(--line-base)" }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
              Kredensial crew dikonfigurasi di server (env/runtime), tidak ditampilkan di UI.
            </p>
          </div>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
