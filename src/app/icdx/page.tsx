"use client";

import { useEffect, useMemo, useState } from "react";

interface IcdSearchItem {
  code: string;
  name: string;
  category: string;
}

interface IcdConversionItem {
  modern: string;
  modernResolvedCode: string;
  modernName: string;
  exactModernMatch: boolean;
  legacy: string;
  knownIn2010: boolean;
  knownIn2019: boolean;
  legacyName: string;
}

interface LookupPayload {
  ok: boolean;
  normalizedPrimary?: string;
  results?: IcdSearchItem[];
  rows?: IcdConversionItem[];
  loadedFrom?: {
    "2010": string;
    "2016": string;
    "2019": string;
  };
  extensionSource?: string;
  error?: string;
}

function highlight(text: string, query: string) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <em>{text.slice(idx, idx + query.length)}</em>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function ICDXPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<IcdSearchItem | null>(null);
  const [results, setResults] = useState<IcdSearchItem[]>([]);
  const [conversionRows, setConversionRows] = useState<IcdConversionItem[]>([]);
  const [normalizedPrimary, setNormalizedPrimary] = useState("");
  const [dbInfo, setDbInfo] = useState<LookupPayload["loadedFrom"]>();
  const [extensionSource, setExtensionSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/icdx/lookup?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as LookupPayload;
        if (!payload.ok) {
          throw new Error(payload.error || "Lookup ICD gagal");
        }
        setResults(payload.results ?? []);
        setConversionRows(payload.rows ?? []);
        setNormalizedPrimary(payload.normalizedPrimary ?? "");
        setDbInfo(payload.loadedFrom);
        setExtensionSource(payload.extensionSource ?? "");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Lookup ICD gagal");
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const showNormalizedHint = useMemo(() => {
    const input = query.trim().toUpperCase();
    return Boolean(input && normalizedPrimary && normalizedPrimary !== input);
  }, [query, normalizedPrimary]);

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <div className="page-header" style={{ maxWidth: 980, width: "100%" }}>
        <div className="page-title">ICD-X Finder</div>
        <div className="page-subtitle">Dynamic ICD Database (WHO XML 2010/2016/2019)</div>
      </div>

      <div className="icd-finder" style={{ maxWidth: 980 }}>
        <div className="icd-search-wrap">
          <span className="icd-search-label">Cari Kode / Nama Penyakit</span>
          <input
            className="icd-search"
            type="text"
            placeholder="Contoh: L02.433, J16..20, pneumonia"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {showNormalizedHint && (
            <div
              style={{
                marginTop: 10,
                fontFamily: "var(--font-geist-mono), monospace",
                fontSize: 11,
                letterSpacing: "0.04em",
                color: "var(--text-muted)",
              }}
            >
              Normalisasi ICD-10 2010: {query.trim().toUpperCase()}{" -> "}{normalizedPrimary}
            </div>
          )}
          {dbInfo && (
            <div style={{ marginTop: 8, fontFamily: "var(--font-geist-mono), monospace", fontSize: 10, color: "var(--text-muted)" }}>
              DB: 2010={dbInfo["2010"]} | 2016={dbInfo["2016"]} | 2019={dbInfo["2019"]}
            </div>
          )}
          {extensionSource && (
            <div style={{ marginTop: 4, fontFamily: "var(--font-geist-mono), monospace", fontSize: 10, color: "var(--text-muted)" }}>
              EXT DB: {extensionSource}
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 8,
            marginBottom: 28,
            border: "1px solid var(--line-base)",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              borderBottom: "1px solid var(--line-base)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div style={{ padding: "10px 12px", fontFamily: "var(--font-geist-mono), monospace", fontSize: 11, letterSpacing: "0.08em", color: "var(--text-muted)" }}>
              KODE INPUT (WHO / GOOGLE)
            </div>
            <div style={{ padding: "10px 12px", fontFamily: "var(--font-geist-mono), monospace", fontSize: 11, letterSpacing: "0.08em", color: "var(--text-muted)", borderLeft: "1px solid var(--line-base)" }}>
              ✓ KODE UNTUK PCARE / EPUSKESMAS
            </div>
          </div>

          {conversionRows.length > 0 ? (
            conversionRows.map((row) => (
              <div
                key={`${row.modern}-${row.legacy}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  borderBottom: "1px solid var(--line-base)",
                }}
              >
                <div style={{ padding: "10px 12px", fontFamily: "var(--font-geist-mono), monospace", fontSize: 14, color: "var(--text-main)" }}>
                  {row.modern}
                  {row.modernName && (
                    <span style={{ marginLeft: 8, fontSize: 10, color: "var(--text-muted)" }}>
                      {row.exactModernMatch ? "(exact)" : `(nearest: ${row.modernResolvedCode || "n/a"})`} {row.modernName}
                    </span>
                  )}
                </div>
                <div style={{ padding: "10px 12px", fontFamily: "var(--font-geist-mono), monospace", fontSize: 14, borderLeft: "1px solid var(--line-base)" }}>
                  {row.knownIn2010 ? (
                    <>
                      <span style={{ color: "var(--c-asesmen)", fontWeight: 600 }}>{row.legacy}</span>
                      <span style={{
                        marginLeft: 8,
                        fontSize: 10,
                        background: "var(--c-asesmen)",
                        color: "#000",
                        padding: "1px 6px",
                        borderRadius: 2,
                        letterSpacing: "0.05em",
                      }}>INPUT INI</span>
                      {row.legacyName && (
                        <span style={{ marginLeft: 8, fontSize: 10, color: "var(--text-muted)" }}>{row.legacyName}</span>
                      )}
                    </>
                  ) : (
                    <>
                      <span style={{ color: "var(--c-critical)" }}>{row.legacy}</span>
                      <span style={{
                        marginLeft: 8,
                        fontSize: 10,
                        border: "1px solid var(--c-critical)",
                        color: "var(--c-critical)",
                        padding: "1px 6px",
                        borderRadius: 2,
                      }}>TIDAK ADA DI PCARE</span>
                      <div style={{ marginTop: 4, fontSize: 10, color: "var(--c-critical)", opacity: 0.8 }}>
                        Kode ini belum ada di database ICD-10 2010 yang dipakai PCare/ePuskesmas
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: "12px", fontFamily: "var(--font-geist-sans), sans-serif", fontSize: 14, color: "var(--text-muted)" }}>
              Masukkan kode diagnosis, contoh: <span style={{ fontFamily: "var(--font-geist-mono), monospace" }}>L02.433</span> atau <span style={{ fontFamily: "var(--font-geist-mono), monospace" }}>J16..20</span>
            </div>
          )}
        </div>

        {error && (
          <div style={{ marginBottom: 14, color: "var(--c-critical)", fontFamily: "var(--font-geist-mono), monospace", fontSize: 12 }}>
            Error: {error}
          </div>
        )}

        <div className="icd-results">
          {results.map((item) => (
            <div
              key={item.code}
              className={`icd-result-item${selected?.code === item.code ? " selected" : ""}`}
              onClick={() => setSelected(item.code === selected?.code ? null : item)}
            >
              <span className="icd-code">{item.code}</span>
              <span className="icd-name">{highlight(item.name, query)}</span>
              <span className="icd-category">{item.category}</span>
            </div>
          ))}
          {!loading && results.length === 0 && (
            <div style={{ fontFamily: "var(--font-geist-sans), sans-serif", fontSize: 18, color: "var(--text-muted)", padding: "32px 0", fontStyle: "italic" }}>
              Tidak ada hasil untuk &ldquo;{query}&rdquo;
            </div>
          )}
          {loading && (
            <div style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 12, color: "var(--text-muted)", padding: "16px 0" }}>
              Memuat database ICD...
            </div>
          )}
        </div>

        {selected && (() => {
          const matchedRow = conversionRows.find(
            (r) => r.modern === selected.code || r.modernResolvedCode === selected.code || r.legacy === selected.code,
          );
          return (
            <div className={`icd-selected-panel${selected ? " visible" : ""}`}>
              <div className="data-label" style={{ marginBottom: 16 }}>Kode Dipilih</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 16 }}>
                <span style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 28, color: "var(--c-asesmen)", letterSpacing: "0.05em" }}>
                  {selected.code}
                </span>
                <span style={{ fontFamily: "var(--font-geist-sans), sans-serif", fontSize: 22, fontWeight: 300, color: "var(--text-main)" }}>
                  {selected.name}
                </span>
              </div>
              {matchedRow && matchedRow.legacy !== selected.code && (
                <div style={{
                  marginBottom: 16,
                  padding: "10px 14px",
                  border: matchedRow.knownIn2010 ? "1px solid var(--c-asesmen)" : "1px solid var(--c-critical)",
                  borderRadius: 2,
                  fontFamily: "var(--font-geist-mono), monospace",
                }}>
                  {matchedRow.knownIn2010 ? (
                    <>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.06em" }}>
                        ✓ GUNAKAN KODE INI DI PCARE / EPUSKESMAS
                      </div>
                      <span style={{ fontSize: 22, color: "var(--c-asesmen)", fontWeight: 600 }}>{matchedRow.legacy}</span>
                      {matchedRow.legacyName && (
                        <span style={{ marginLeft: 12, fontSize: 13, color: "var(--text-muted)" }}>{matchedRow.legacyName}</span>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: "var(--c-critical)" }}>
                      ⚠ Kode ini tidak ada di ICD-10 2010 — tidak bisa diinput ke PCare/ePuskesmas
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <span className="tag-meta" style={{ fontSize: 10 }}>{selected.category}</span>
                <span className="tag-meta" style={{ fontSize: 10, color: "var(--c-asesmen)", borderColor: "var(--c-asesmen)" }}>
                  ICD-10 DATABASE
                </span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
