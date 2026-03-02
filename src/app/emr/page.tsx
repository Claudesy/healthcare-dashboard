"use client";

import { useState, useRef } from "react";
import EMRTransferPanel from "./EMRTransferPanel";

const FINAL_STRING = "nyeri kepala berdenyut, disertai mual dan fotofobia";

interface CDSSSuggestion {
  rank: number; icd10: string; nama: string; confidence: number;
  rationale: string; red_flags: string[]; recommended_actions: string[];
}
interface CDSSRedFlag {
  severity: "emergency" | "urgent" | "warning"; condition: string;
  action: string; criteria_met: string[];
}
interface CDSSResult {
  suggestions: CDSSSuggestion[];
  red_flags: CDSSRedFlag[];
  traffic_light: "GREEN" | "YELLOW" | "RED";
  traffic_light_reason: string;
  processing_time_ms: number;
  source: "ai" | "local";
}

export default function EMRPage() {
  const [headerText, setHeaderText] = useState("SENTRA / PUSKESMAS KEDIRI // RM-BARU // SENAUTO ENGINE: IDLE");
  const [headerColor, setHeaderColor] = useState("var(--text-muted)");
  const [isTyping, setIsTyping] = useState(false);
  const [ghostVisible, setGhostVisible] = useState(true);
  const [words, setWords] = useState<string[]>([]);
  const [anamnesaVisible, setAnamnesaVisible] = useState([false, false, false]);
  const [showEmrLoader, setShowEmrLoader] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [draftBorderColor, setDraftBorderColor] = useState("var(--text-muted)");

  const [labOpen, setLabOpen] = useState(false);
  const [labSelected, setLabSelected] = useState([false, false, false]);

  const [trajectoryActive, setTrajectoryActive] = useState(false);
  const [showInsight, setShowInsight] = useState(false);
  const insightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [cdssResult, setCdssResult]   = useState<CDSSResult | null>(null);
  const [cdssLoading, setCdssLoading] = useState(false);
  const [cdssError, setCdssError]     = useState("");

  // Editable vitals state
  const [vitals, setVitals] = useState({
    gcs: "", td: "", nadi: "", napas: "", suhu: "", spo2: "", map: "",
  });

  // Editable anamnesa
  const [keluhanUtama, setKeluhanUtama] = useState("");
  const [keluhanTambahan, setKeluhanTambahan] = useState("");

  // Editable exam
  const [exam, setExam] = useState({
    kepala: "", dada: "", perut: "", ekstremitas: "", kulit: "", genitalia: "",
  });

  function handleSenAutoClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (isTyping || !keluhanUtama.trim()) return;
    setIsTyping(true);
    setGhostVisible(false);
    setDraftBorderColor("var(--c-asesmen)");
    setHeaderText("SENTRA // RM-BARU // SENAUTO ENGINE: SYNTHESIZING...");
    setHeaderColor("var(--c-asesmen)");
    setWords(FINAL_STRING.split(" "));

    const totalTime = (FINAL_STRING.split(" ").length * 80) + 800;

    setTimeout(() => {
      setHeaderText("SENTRA // RM-BARU // EMR RETRIEVAL ACTIVE");
      setShowEmrLoader(true);

      [0, 1, 2].forEach((i) => {
        setTimeout(() => {
          setAnamnesaVisible((prev) => {
            const next = [...prev];
            next[i] = true;
            return next;
          });
        }, i * 200);
      });

      setTimeout(() => {
        setShowEmrLoader(false);
        setHistoryLoaded(true);
        setHeaderText("SENTRA // RM-BARU // IN PROGRESS — MENUNGGU INPUT DOKTER");
        setAnamnesaVisible([true, true, true]);
      }, 1500);
    }, totalTime);
  }

  function toggleTrajectory() {
    const next = !trajectoryActive;
    setTrajectoryActive(next);
    if (next) {
      if (insightTimeoutRef.current) clearTimeout(insightTimeoutRef.current);
      setShowInsight(true);
    } else {
      insightTimeoutRef.current = setTimeout(() => setShowInsight(false), 800);
    }
  }

  function toggleLab(index: number) {
    setLabSelected((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }

  async function runCDSS() {
    if (!keluhanUtama.trim()) return;
    setCdssLoading(true);
    setCdssError("");
    setCdssResult(null);

    // Parse vitals
    const parseTD = (td: string) => {
      const parts = td.replace("/", " ").split(/[\s/]+/);
      return { sbp: parseFloat(parts[0]) || undefined, dbp: parseFloat(parts[1]) || undefined };
    };
    const { sbp, dbp } = vitals.td ? parseTD(vitals.td) : { sbp: undefined, dbp: undefined };

    try {
      const res = await fetch("/api/cdss/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keluhanUtama,
          keluhanTambahan: keluhanTambahan || undefined,
          vitals: {
            sbp, dbp,
            hr: parseFloat(vitals.nadi) || undefined,
            rr: parseFloat(vitals.napas) || undefined,
            temp: parseFloat(vitals.suhu) || undefined,
            spo2: parseFloat(vitals.spo2) || undefined,
            gcs: parseFloat(vitals.gcs) || undefined,
          },
        }),
      });
      const data = await res.json() as CDSSResult;
      setCdssResult(data);
    } catch {
      setCdssError("Gagal menjalankan CDSS. Coba lagi.");
    } finally {
      setCdssLoading(false);
    }
  }

  const labItems = [
    { name: "Hematologi Lengkap", status: "BELUM DIORDER" },
    { name: "C-Reactive Protein (CRP)", status: "BELUM DIORDER" },
    { name: "Foto Thorax AP/PA", status: "BELUM DIORDER" },
  ];

  const isCritical = (val: string, key: string) => {
    const n = parseFloat(val);
    if (isNaN(n)) return false;
    if (key === "suhu" && n >= 38.0) return true;
    if (key === "spo2" && n < 95) return true;
    if (key === "nadi" && (n > 100 || n < 60)) return true;
    return false;
  };

  const vitalFields: { key: keyof typeof vitals; label: string; unit: string }[] = [
    { key: "gcs", label: "GCS", unit: "/15" },
    { key: "td", label: "Tekanan Darah", unit: "mmHg" },
    { key: "nadi", label: "Nadi", unit: "bpm" },
    { key: "napas", label: "Napas", unit: "x/m" },
    { key: "suhu", label: "Suhu", unit: "°C" },
    { key: "spo2", label: "SpO2", unit: "%" },
    { key: "map", label: "MAP", unit: "mmHg" },
  ];

  const examFields: { key: keyof typeof exam; label: string }[] = [
    { key: "kepala", label: "Kepala & Leher" },
    { key: "dada", label: "Dada (Cor & Pulmo)" },
    { key: "perut", label: "Perut (Abdomen)" },
    { key: "ekstremitas", label: "Ekstremitas" },
    { key: "kulit", label: "Kulit" },
    { key: "genitalia", label: "Genitalia" },
  ];

  const filledVitals = Object.values(vitals).filter(Boolean).length;
  const filledExam = Object.values(exam).filter(Boolean).length;
  const progress = Math.round(
    ((!!keluhanUtama ? 1 : 0) + (!!keluhanTambahan ? 0.5 : 0) + (filledVitals / 7) + (filledExam / 6)) / 2.5 * 100
  );

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <div className="architecture-grid">

        {/* Meta header */}
        <div className="meta-header" style={{ color: headerColor, display: "flex", alignItems: "center", gap: 16 }}>
          {headerText}
          <span style={{
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: 13,
            color: "var(--c-asesmen)",
            border: "1px solid var(--c-asesmen)",
            padding: "1px 6px",
            borderRadius: 2,
            animation: "smoothBlink 2s infinite",
          }}>
            IN PROGRESS — {progress}%
          </span>
        </div>

        {/* ─── Left: Clinical Stream ─── */}
        <div className="clinical-stream">
          <div className="stream-line" />

          {/* 01. Anamnesa */}
          <div className="stream-section">
            <div className="section-title">01. Anamnesa</div>
            <div className="blueprint-wrapper">
              <span className="data-label">Keluhan Utama</span>
              <div className="patient-narrative" style={{ marginBottom: 24 }}>
                Pasien datang dengan keluhan{" "}
                <span className="input-draft" style={{ borderBottomColor: draftBorderColor }}>
                  {words.length > 0 ? (
                    words.map((word, i) => (
                      <span key={i} className="blur-word" style={{ animationDelay: `${i * 80}ms` }}>{word}</span>
                    ))
                  ) : (
                    <input
                      type="text"
                      value={keluhanUtama}
                      onChange={(e) => setKeluhanUtama(e.target.value)}
                      placeholder="ketik keluhan..."
                      style={{
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        fontFamily: "var(--font-geist-sans), sans-serif",
                        fontSize: "inherit",
                        fontWeight: 400,
                        color: keluhanUtama ? "var(--text-main)" : "var(--text-muted)",
                        width: keluhanUtama ? `${keluhanUtama.length + 4}ch` : "14ch",
                        minWidth: "10ch",
                      }}
                    />
                  )}
                  {ghostVisible && keluhanUtama.trim() && (
                    <span className="senauto-ghost" onClick={handleSenAutoClick}>
                      ✧ Synthesize with SenAuto
                    </span>
                  )}
                </span>{" "}
                <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                  {keluhanUtama ? "— durasi belum diisi" : "..."}
                </span>
              </div>
              <span className="data-label">Keluhan Tambahan</span>
              <div className="patient-narrative">
                <input
                  type="text"
                  value={keluhanTambahan}
                  onChange={(e) => setKeluhanTambahan(e.target.value)}
                  placeholder="keluhan penyerta, gejala sistemik..."
                  style={{
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px dashed var(--line-base)",
                    outline: "none",
                    fontFamily: "var(--font-geist-sans), sans-serif",
                    fontSize: "inherit",
                    fontWeight: 300,
                    color: keluhanTambahan ? "var(--text-main)" : "var(--text-muted)",
                    width: "100%",
                    paddingBottom: 4,
                  }}
                />
              </div>
            </div>
          </div>

          {/* 02. Riwayat */}
          <div className="stream-section">
            <div className="section-title">02. Riwayat Penyakit &amp; Alergi</div>
            {showEmrLoader && (
              <div className="emr-loader">[SYSTEM: RETRIEVING EMR DATA...]</div>
            )}
            <div className={`history-grid${historyLoaded ? " loaded" : ""}`}>
              <div>
                <div className="history-item">
                  <div className="history-item-title">Riwayat Penyakit Sekarang (RPS)</div>
                  <div className="history-item-val" style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 16 }}>
                    — belum diisi
                  </div>
                </div>
                <div className="history-item">
                  <div className="history-item-title">Riwayat Penyakit Dahulu (RPD)</div>
                  <div className="history-item-val" style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 16 }}>
                    — belum diisi
                  </div>
                </div>
                <div className="history-item">
                  <div className="history-item-title">Riwayat Penyakit Keluarga (RPK)</div>
                  <div className="history-item-val" style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: 16 }}>
                    — belum diisi
                  </div>
                </div>
              </div>
              <div className="allergy-box">
                <span className="data-label" style={{ marginBottom: 16, color: "var(--text-muted)" }}>
                  Alergi Tercatat
                </span>
                {["Obat", "Makanan", "Udara", "Lainnya"].map((type) => (
                  <div key={type} className="allergy-row">
                    <span>{type}</span>
                    <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>—</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 03. Tanda Vital */}
          <div className="stream-section">
            <div className="section-title">03. Tanda Vital &amp; Objektif</div>
            <div className="vitals-matrix">
              {vitalFields.map(({ key, label, unit }) => (
                <div key={key} className={`vital-item${isCritical(vitals[key], key) ? " v-critical" : ""}`}>
                  <span className="v-label">{label}</span>
                  <span className="v-value" style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
                    <input
                      type="text"
                      value={vitals[key]}
                      onChange={(e) => setVitals((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder="—"
                      style={{
                        background: "transparent",
                        border: "none",
                        borderBottom: vitals[key] ? "none" : "1px dashed var(--line-base)",
                        outline: "none",
                        fontFamily: "var(--font-geist-mono), monospace",
                        fontSize: 28,
                        fontWeight: 300,
                        color: isCritical(vitals[key], key) ? "var(--c-critical)" : vitals[key] ? "var(--text-main)" : "var(--text-muted)",
                        width: vitals[key] ? `${vitals[key].length + 1}ch` : "3ch",
                        minWidth: "2.5ch",
                        lineHeight: 1,
                        letterSpacing: "-1px",
                        padding: 0,
                      }}
                    />
                    <span className="v-unit">{unit}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="lab-trigger-container">
              <button className={`lab-ghost-btn${labOpen ? " open" : ""}`} onClick={() => setLabOpen(!labOpen)}>
                {labOpen ? "✧ Usulan Pemeriksaan Lab — Pilih:" : "✧ Usulan Pemeriksaan Lab"}
              </button>
              <div className={`lab-expansion${labOpen ? " open" : ""}`}>
                {labItems.map((item, i) => (
                  <div key={i} className={`lab-item${labSelected[i] ? " selected" : ""}`} onClick={() => toggleLab(i)}>
                    <div className="lab-item-left">{item.name}</div>
                    <span className="lab-status">{item.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Trajectory Canvas */}
          <div className={`trajectory-canvas${trajectoryActive ? " active" : ""}`}>
            <div className="traj-header">
              <span>Trajektori Tekanan Darah — Data Belum Tersedia</span>
              <button className="traj-close" onClick={toggleTrajectory}>[X] TUTUP PANEL</button>
            </div>
            <div className="traj-body">
              <div className="chart-wrapper">
                <svg width="100%" height="100%" viewBox="0 0 500 160" preserveAspectRatio="none">
                  <line x1="0" y1="30" x2="500" y2="30" className="chart-grid-line" />
                  <line x1="0" y1="80" x2="500" y2="80" className="chart-grid-line" />
                  <line x1="0" y1="130" x2="500" y2="130" className="chart-grid-line" />
                  <text x="0" y="25" className="chart-label">150</text>
                  <text x="0" y="75" className="chart-label">120</text>
                  <text x="0" y="125" className="chart-label">90</text>
                  <text x="200" y="85" className="chart-label" style={{ fontSize: 11 }}>— riwayat kunjungan belum ada —</text>
                </svg>
              </div>
              <div className="traj-meds">
                <span className="data-label" style={{ color: "var(--text-muted)" }}>OBAT AKTIF</span>
                <div style={{ fontFamily: "var(--font-geist-sans), sans-serif", fontSize: 14, color: "var(--text-muted)", fontStyle: "italic" }}>
                  — belum ada data obat —
                </div>
              </div>
            </div>
          </div>

          {/* 04. Pemeriksaan Fisik */}
          <div className="stream-section">
            <div className="section-title">04. Pemeriksaan Fisik Head-to-Toe</div>
            <div className="exam-list">
              {examFields.map(({ key, label }) => (
                <div key={key} className="exam-row">
                  <span className="exam-organ">{label}</span>
                  <input
                    type="text"
                    value={exam[key]}
                    onChange={(e) => setExam((p) => ({ ...p, [key]: e.target.value }))}
                    placeholder="ketik hasil pemeriksaan..."
                    className="exam-result"
                    style={{
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px dashed var(--line-base)",
                      outline: "none",
                      color: exam[key] ? "var(--text-main)" : "var(--text-muted)",
                      width: "100%",
                      paddingBottom: 4,
                      fontStyle: exam[key] ? "normal" : "italic",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => void runCDSS()}
            disabled={cdssLoading || !keluhanUtama.trim()}
            style={{
              marginTop: 8,
              padding: "10px 20px",
              background: cdssLoading ? "var(--line-base)" : "var(--c-asesmen)",
              border: "none",
              color: "#fff",
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: 10,
              letterSpacing: "0.12em",
              cursor: cdssLoading || !keluhanUtama.trim() ? "not-allowed" : "pointer",
              opacity: !keluhanUtama.trim() ? 0.4 : 1,
            }}
          >
            {cdssLoading ? "⏳ MEMPROSES CDSS..." : "▶ JALANKAN CDSS ENGINE"}
          </button>

          <input
            type="text"
            className="omni-input"
            placeholder="Ketik kesimpulan asesmen atau ketik '/' untuk perintah..."
          />
        </div>

        {/* ─── Right: Extraction Sidebar ─── */}
        <div className="entity-sidebar">
          <div className="extraction-block">
            <div className="extraction-header">
              <span>AI ENTITY: ANAMNESA</span>
              <span style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 13, color: "var(--text-muted)", animation: "smoothBlink 2s infinite" }}>
                MENUNGGU...
              </span>
            </div>
            <div className="extracted-list">
              {[
                { label: "Keluhan Utama", meta: "PENDING" },
                { label: "Onset / Durasi", meta: "PENDING" },
                { label: "Faktor Pemberatan", meta: "PENDING" },
              ].map((item, i) => (
                <div key={i} className={`entity-tag-item${anamnesaVisible[i] ? " visible" : ""}`}
                  style={anamnesaVisible[i] ? {} : { opacity: 0.2, transform: "none" }}>
                  <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>{item.label}</span>
                  <span className="tag-meta" style={{ color: "var(--text-muted)", opacity: 0.5 }}>{item.meta}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="extraction-block">
            <div className="extraction-header" style={{ color: "var(--text-muted)", borderBottomColor: "var(--line-base)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="ai-pulse-dot" style={{ background: "var(--text-muted)", boxShadow: "none", animation: "none", opacity: 0.3 }} />
                VITALS &amp; EMR ANOMALY
              </span>
            </div>
            <div className="extracted-list">
              {[
                { label: "Tekanan Darah" },
                { label: "Suhu Tubuh" },
                { label: "SpO2" },
                { label: "Status Alergi" },
                { label: "Komorbid" },
              ].map((item, i) => (
                <div key={i} className="entity-tag-item" style={{ opacity: 0.2, transform: "none" }}>
                  <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>{item.label}</span>
                  <span className="tag-meta" style={{ opacity: 0.4 }}>PENDING</span>
                </div>
              ))}
            </div>
          </div>

          {/* CDSS Panel */}
          {(cdssLoading || cdssResult || cdssError) && (
            <div className="extraction-block">
              <div className="extraction-header" style={{ color: cdssResult?.traffic_light === "RED" ? "var(--c-critical)" : cdssResult?.traffic_light === "YELLOW" ? "#E8A838" : "var(--c-asesmen)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="ai-pulse-dot" style={{ background: cdssResult?.traffic_light === "RED" ? "var(--c-critical)" : cdssResult?.traffic_light === "YELLOW" ? "#E8A838" : "var(--c-asesmen)" }} />
                  CDSS ENGINE
                </span>
                {cdssResult && (
                  <span style={{ fontSize: 9, letterSpacing: "0.1em" }}>
                    {cdssResult.traffic_light} · {cdssResult.processing_time_ms}ms · {cdssResult.source.toUpperCase()}
                  </span>
                )}
              </div>

              {cdssLoading && (
                <div style={{ padding: "12px 0", fontFamily: "var(--font-geist-mono), monospace", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", animation: "smoothBlink 1s infinite" }}>
                  MENJALANKAN ISKANDAR ENGINE...
                </div>
              )}

              {cdssError && (
                <div style={{ padding: "8px 0", fontSize: 11, color: "var(--c-critical)" }}>{cdssError}</div>
              )}

              {cdssResult && (
                <div className="extracted-list">
                  {/* Red Flags */}
                  {cdssResult.red_flags.map((rf, i) => (
                    <div key={i} style={{
                      padding: "8px 10px", marginBottom: 6,
                      border: `1px solid ${rf.severity === "emergency" ? "var(--c-critical)" : "#E8A838"}`,
                      background: rf.severity === "emergency" ? "rgba(220,53,69,0.08)" : "rgba(232,168,56,0.08)",
                    }}>
                      <div style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 9, letterSpacing: "0.1em", color: rf.severity === "emergency" ? "var(--c-critical)" : "#E8A838", marginBottom: 4 }}>
                        ⚠ {rf.severity.toUpperCase()} — {rf.condition}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{rf.action}</div>
                    </div>
                  ))}

                  {/* Traffic Light */}
                  <div style={{ padding: "6px 0", marginBottom: 8, fontFamily: "var(--font-geist-mono), monospace", fontSize: 9, letterSpacing: "0.08em" }}>
                    <span style={{ color: cdssResult.traffic_light === "RED" ? "var(--c-critical)" : cdssResult.traffic_light === "YELLOW" ? "#E8A838" : "#4CAF50", marginRight: 6 }}>
                      ● {cdssResult.traffic_light}
                    </span>
                    <span style={{ color: "var(--text-muted)" }}>{cdssResult.traffic_light_reason}</span>
                  </div>

                  {/* Suggestions */}
                  {cdssResult.suggestions.slice(0, 3).map((s) => (
                    <div key={s.rank} className="entity-tag-item visible" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4, padding: "8px 0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
                        <span style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 10, color: "var(--c-asesmen)" }}>
                          #{s.rank} {s.icd10}
                        </span>
                        <span className="tag-meta">{Math.round(s.confidence * 100)}%</span>
                      </div>
                      <div style={{ fontFamily: "var(--font-geist-sans), sans-serif", fontSize: 13, color: "var(--text-main)", fontWeight: 500 }}>{s.nama}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>{s.rationale}</div>
                      {s.recommended_actions.length > 0 && (
                        <div style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }}>
                          → {s.recommended_actions[0]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {showInsight && (
            <div
              className="extraction-block"
              style={{
                opacity: trajectoryActive ? 1 : 0,
                transform: trajectoryActive ? "translateY(0)" : "translateY(10px)",
                transition: "all 0.8s ease",
                display: "flex",
              }}
            >
              <div className="extraction-header" style={{ color: "var(--text-muted)", borderBottomColor: "var(--line-base)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="ai-pulse-dot" style={{ background: "var(--text-muted)", animation: "none", opacity: 0.3 }} />
                  AI TRAJECTORY INSIGHT
                </span>
              </div>
              <div className="insight-text-sidebar" style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                Belum ada riwayat kunjungan sebelumnya. Trajektori akan tersedia setelah data terkumpul.
              </div>
            </div>
          )}
        </div>
      </div>
      <EMRTransferPanel />
    </div>
  );
}
