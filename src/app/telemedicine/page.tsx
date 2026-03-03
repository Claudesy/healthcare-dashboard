"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Video, Plus, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react";

import { AppointmentBooking } from "@/components/telemedicine/AppointmentBooking";
import type { AppointmentWithDetails, AppointmentStatus } from "@/types/telemedicine.types";

/* ── Design tokens — sama dengan halaman Profile User ── */
const L = {
  bg:        "#0f0f0f",
  bgPanel:   "#141414",
  bgHover:   "rgba(255,255,255,0.03)",
  border:    "rgba(255,255,255,0.08)",
  borderAcc: "rgba(230,126,34,0.4)",
  text:      "#d4d4d4",
  muted:     "#666666",
  accent:    "#E67E22",
  green:     "#4ADE80",
  mono:      "var(--font-geist-mono), 'Fira Code', monospace",
  sans:      "var(--font-geist-sans), sans-serif",
};

/* ── Shared primitives ── */
const Panel = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: L.bgPanel, border: `1px solid ${L.border}`, borderRadius: 4, overflow: "hidden", ...style }}>
    {children}
  </div>
);

const PanelSection = ({ children, last = false }: { children: React.ReactNode; last?: boolean }) => (
  <div style={{ padding: "12px 18px", borderBottom: last ? "none" : `1px solid ${L.border}` }}>
    {children}
  </div>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontFamily: L.mono, fontSize: 11, color: L.muted, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
    {children}
  </div>
);

/* ── Status config ── */
const STATUS_CONFIG: Record<AppointmentStatus, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:     { label: "Menunggu",     color: "#facc15", icon: <Clock size={11} /> },
  CONFIRMED:   { label: "Dikonfirmasi", color: "#60a5fa", icon: <CheckCircle size={11} /> },
  IN_PROGRESS: { label: "Berlangsung",  color: "#4ADE80", icon: <Video size={11} /> },
  COMPLETED:   { label: "Selesai",      color: L.muted,   icon: <CheckCircle size={11} /> },
  CANCELLED:   { label: "Dibatalkan",   color: "#f87171", icon: <XCircle size={11} /> },
  NO_SHOW:     { label: "Tidak Hadir",  color: "#fb923c", icon: <AlertCircle size={11} /> },
};

/* ── PatientFlowDiagram ── */
const FLOW_STEPS = [
  { num: "01", code: "PETUGAS",  label: "Isi No. HP Pasien",        sub: "saat buat appointment" },
  { num: "02", code: "SISTEM",   label: "Generate Token Unik",       sub: "disimpan ke database" },
  { num: "03", code: "WHATSAPP", label: "Kirim Link via WhatsApp",   sub: "/join/[token]" },
  { num: "04", code: "PASIEN",   label: "Klik Link → Buka Browser",  sub: "tanpa install / login" },
  { num: "05", code: "INPUT",    label: "Masukkan Nama",             sub: "klik Masuk Konsultasi" },
  { num: "06", code: "LIVEKIT",  label: "Connect ke Video Room",     sub: "role: PATIENT" },
  { num: "07", code: "SELESAI",  label: "Dokter & Pasien Terhubung", sub: "konsultasi berlangsung" },
];

function PatientFlowDiagram() {
  return (
    <Panel style={{ height: "100%" }}>
      <PanelSection>
        <SectionLabel>Alur Kerja Pasien</SectionLabel>
      </PanelSection>
      <PanelSection last>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {FLOW_STEPS.map((step, i) => (
            <div key={step.code}>
              {/* Step row */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 0" }}>
                {/* Number + connector column */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 28 }}>
                  <div style={{
                    width: 28, height: 28,
                    borderRadius: "50%",
                    border: `1px solid ${i === 6 ? L.border : "rgba(255,255,255,0.15)"}`,
                    background: i === 6 ? "rgba(255,255,255,0.05)" : "#1a1a1a",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: L.mono, fontSize: 10,
                    color: i === 6 ? L.accent : L.muted,
                    letterSpacing: "0.05em",
                    flexShrink: 0,
                  }}>
                    {step.num}
                  </div>
                  {i < FLOW_STEPS.length - 1 && (
                    <div style={{ width: 1, height: 20, background: L.border, marginTop: 3 }} />
                  )}
                </div>

                {/* Text */}
                <div style={{ paddingTop: 4 }}>
                  <div style={{
                    fontFamily: L.mono, fontSize: 9,
                    color: L.muted,
                    letterSpacing: "0.12em",
                    marginBottom: 2,
                  }}>
                    {step.code}
                  </div>
                  <div style={{
                    fontFamily: L.sans, fontSize: 12,
                    color: i === 6 ? L.text : "rgba(212,212,212,0.75)",
                    fontWeight: i === 6 ? 500 : 400,
                    lineHeight: 1.3,
                    marginBottom: 1,
                  }}>
                    {step.label}
                  </div>
                  <div style={{ fontFamily: L.mono, fontSize: 10, color: L.muted }}>
                    {step.sub}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </PanelSection>
    </Panel>
  );
}

/* ── AppointmentRow ── */
interface AppointmentCardProps {
  appointment: AppointmentWithDetails;
  onJoin?: () => void;
}

function AppointmentRow({ appointment, onJoin }: AppointmentCardProps) {
  const status = STATUS_CONFIG[appointment.status];
  const isActive = ["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(appointment.status);
  const scheduledAt = new Date(appointment.scheduledAt);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr auto",
      alignItems: "center",
      gap: 16,
      padding: "10px 18px",
      borderBottom: `1px solid ${L.border}`,
      background: "transparent",
      transition: "background 0.15s",
    }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = L.bgHover; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
    >
      <div>
        {/* ID + status badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{ fontFamily: L.mono, fontSize: 11, color: L.accent, letterSpacing: "0.05em" }}>
            #{appointment.id.slice(-8).toUpperCase()}
          </span>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            padding: "1px 7px", borderRadius: 2,
            background: `${status.color}18`,
            color: status.color,
            fontFamily: L.mono, fontSize: 10, letterSpacing: "0.06em",
          }}>
            {status.icon}&nbsp;{status.label}
          </span>
        </div>

        {/* Info baris */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: L.mono, fontSize: 11, color: L.muted }}>
            {scheduledAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
          </span>
          <span style={{ color: L.border }}>·</span>
          <span style={{ fontFamily: L.mono, fontSize: 11, color: L.muted }}>
            {appointment.durationMinutes}m
          </span>
          <span style={{ color: L.border }}>·</span>
          <span style={{ fontFamily: L.mono, fontSize: 11, color: L.muted }}>
            {appointment.doctorId}
          </span>
          {appointment.keluhanUtama && (
            <>
              <span style={{ color: L.border }}>·</span>
              <span style={{ fontSize: 12, color: L.muted, fontStyle: "italic" }}>
                {appointment.keluhanUtama.slice(0, 35)}{appointment.keluhanUtama.length > 35 ? "…" : ""}
              </span>
            </>
          )}
        </div>
      </div>

      {isActive && onJoin && (
        <button
          onClick={onJoin}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 14px",
            background: appointment.status === "IN_PROGRESS" ? "rgba(74,222,128,0.15)" : "rgba(230,126,34,0.15)",
            border: `1px solid ${appointment.status === "IN_PROGRESS" ? L.green : L.accent}`,
            borderRadius: 2,
            color: appointment.status === "IN_PROGRESS" ? L.green : L.accent,
            fontFamily: L.mono, fontSize: 11, letterSpacing: "0.05em",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Video size={12} />
          {appointment.status === "IN_PROGRESS" ? "MASUK" : "JOIN"}
        </button>
      )}
    </div>
  );
}

/* ── Main Page ── */
export default function TelemedicinePage(): React.JSX.Element {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);

  const loadAppointments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/telemedicine/appointments?limit=30");
      const data = (await res.json()) as { data?: AppointmentWithDetails[] };
      setAppointments(data.data ?? []);
    } catch {
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadAppointments(); }, [loadAppointments]);

  const handleBookingSuccess = useCallback((appointmentId: string) => {
    setShowBooking(false);
    void loadAppointments();
    router.push(`/telemedicine/${appointmentId}`);
  }, [loadAppointments, router]);

  const activeAppointments = appointments.filter((a) => ["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(a.status));
  const pastAppointments   = appointments.filter((a) => ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(a.status));

  return (
    <div style={{ width: "100%", maxWidth: 1100, padding: "32px 40px", fontFamily: L.sans }}>

      {/* ── Breadcrumb ── */}
      <div style={{ fontFamily: L.mono, fontSize: 11, color: L.muted, letterSpacing: "0.12em", marginBottom: 6 }}>
        SISTEM / TELEMEDICINE
      </div>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: L.text, fontSize: 22, fontWeight: 400, margin: 0, letterSpacing: "-0.01em" }}>
            Konsultasi Video
          </h1>
          <div style={{ fontFamily: L.mono, fontSize: 11, color: L.muted, marginTop: 4 }}>
            {appointments.length} total · {activeAppointments.length} aktif
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => void loadAppointments()}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px",
              background: "transparent",
              border: `1px solid ${L.border}`,
              borderRadius: 2,
              color: L.muted,
              fontFamily: L.mono, fontSize: 11,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={12} /> REFRESH
          </button>
          <button
            onClick={() => setShowBooking(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 14px",
              background: "rgba(230,126,34,0.15)",
              border: `1px solid ${L.accent}`,
              borderRadius: 2,
              color: L.accent,
              fontFamily: L.mono, fontSize: 11, letterSpacing: "0.05em",
              cursor: "pointer",
            }}
          >
            <Plus size={12} /> BUAT KONSULTASI
          </button>
        </div>
      </div>

      {/* ── Main Grid: kiri list · kanan sidebar ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 24, alignItems: "start" }}>

        {/* ── Kiri: Appointment list + (optional) booking form ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {isLoading ? (
            <Panel>
              <PanelSection last>
                <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
                  <div style={{ width: 28, height: 28, border: `2px solid ${L.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                </div>
              </PanelSection>
            </Panel>
          ) : appointments.length === 0 ? (
            <Panel>
              <PanelSection last>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 0", color: L.muted }}>
                  <Video size={36} style={{ opacity: 0.15, marginBottom: 14 }} />
                  <div style={{ fontFamily: L.mono, fontSize: 12, marginBottom: 6 }}>belum ada appointment</div>
                  <div style={{ fontFamily: L.mono, fontSize: 11, color: L.muted, marginBottom: 20, opacity: 0.6 }}>klik BUAT KONSULTASI untuk memulai</div>
                  <button
                    onClick={() => setShowBooking(true)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "6px 16px",
                      background: "rgba(230,126,34,0.15)",
                      border: `1px solid ${L.accent}`,
                      borderRadius: 2,
                      color: L.accent,
                      fontFamily: L.mono, fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={12} /> BUAT KONSULTASI PERTAMA
                  </button>
                </div>
              </PanelSection>
            </Panel>
          ) : (
            <>
              {/* Aktif */}
              {activeAppointments.length > 0 && (
                <div>
                  <SectionLabel>Aktif ({activeAppointments.length})</SectionLabel>
                  <Panel>
                    {activeAppointments.map((appt) => (
                      <AppointmentRow
                        key={appt.id}
                        appointment={appt}
                        onJoin={() => router.push(`/telemedicine/${appt.id}`)}
                      />
                    ))}
                    <div style={{ padding: "8px 18px" }} />
                  </Panel>
                </div>
              )}

              {/* Riwayat */}
              {pastAppointments.length > 0 && (
                <div>
                  <SectionLabel>Riwayat ({pastAppointments.length})</SectionLabel>
                  <Panel>
                    {pastAppointments.map((appt) => (
                      <AppointmentRow key={appt.id} appointment={appt} />
                    ))}
                    <div style={{ padding: "8px 18px" }} />
                  </Panel>
                </div>
              )}
            </>
          )}

          {/* Booking form — muncul di bawah list */}
          {showBooking && (
            <div>
              <SectionLabel>Buat Konsultasi Baru</SectionLabel>
              <Panel>
                <AppointmentBooking
                  onSuccess={handleBookingSuccess}
                  onCancel={() => setShowBooking(false)}
                />
              </Panel>
            </div>
          )}
        </div>

        {/* ── Kanan: Diagram alur pasien (selalu visible) ── */}
        <div>
          <PatientFlowDiagram />
        </div>
      </div>
    </div>
  );
}
