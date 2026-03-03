// ============================================================
// PKM Dashboard — DiagnosisModal Component
// Terintegrasi dengan modul ICD-X Converter
// src/components/telemedicine/DiagnosisModal.tsx
// ============================================================

"use client";

import { useState, useCallback } from "react";
import { z } from "zod";
import { X, Search, CheckCircle, AlertCircle } from "lucide-react";
import type { AppointmentWithDetails } from "@/types/telemedicine.types";

interface DiagnosisModalProps {
  open: boolean;
  appointment: AppointmentWithDetails;
  onClose: () => void;
}

interface IcdSearchResult {
  code: string;       // ICD-10: A09.0
  description: string;
  inaCBGsCode?: string;
  pCareCode?: string;
}

const diagnosisSchema = z.object({
  anamnesis: z.string().min(10, "Minimal 10 karakter"),
  pemeriksaanFisik: z.string().min(5, "Minimal 5 karakter"),
  diagnosaKode: z.string().min(3, "Pilih kode ICD-10"),
  diagnosaLabel: z.string().min(3, "Label diagnosis wajib diisi"),
  tatalaksana: z.string().min(10, "Minimal 10 karakter"),
  perluRujukan: z.boolean(),
  rujukanTujuan: z.string().optional(),
});

type DiagnosisForm = z.infer<typeof diagnosisSchema>;

export function DiagnosisModal({ open, appointment, onClose }: DiagnosisModalProps): JSX.Element | null {
  const [form, setForm] = useState<Partial<DiagnosisForm>>({ perluRujukan: false });
  const [icdSearch, setIcdSearch] = useState("");
  const [icdResults, setIcdResults] = useState<IcdSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof DiagnosisForm, string>>>({});
  const [saved, setSaved] = useState(false);

  const handleIcdSearch = useCallback(async (query: string) => {
    if (query.length < 2) { setIcdResults([]); return; }
    setIsSearching(true);
    try {
      // Panggil modul ICD-X Converter yang sudah ada
      const res = await fetch(`/api/icd-converter/search?q=${encodeURIComponent(query)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setIcdResults(data.data ?? []);
      }
    } catch {
      setIcdResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSelectIcd = useCallback((result: IcdSearchResult) => {
    setForm((prev) => ({
      ...prev,
      diagnosaKode: result.code,
      diagnosaLabel: result.description,
    }));
    setIcdSearch(`${result.code} — ${result.description}`);
    setIcdResults([]);
  }, []);

  const handleSave = useCallback(async () => {
    const parsed = diagnosisSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: typeof errors = {};
      parsed.error.errors.forEach((e) => {
        const field = e.path[0] as keyof DiagnosisForm;
        fieldErrors[field] = e.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/telemedicine/appointments/${appointment.id}/diagnosis`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (!res.ok) throw new Error("Gagal menyimpan diagnosis");
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1500);
    } catch (err) {
      console.error("[DiagnosisModal]", err);
    } finally {
      setIsSaving(false);
    }
  }, [form, appointment.id, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-white font-semibold text-lg">Input Diagnosis</h2>
            <p className="text-gray-400 text-sm">{appointment.patient.name} — {appointment.patient.noRm}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Keluhan / Anamnesis */}
          <Field label="Anamnesis *" error={errors.anamnesis}>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-blue-500"
              rows={3}
              placeholder="Keluhan utama, riwayat penyakit sekarang..."
              value={form.anamnesis ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, anamnesis: e.target.value }))}
            />
          </Field>

          {/* Pemeriksaan Fisik */}
          <Field label="Pemeriksaan Fisik *" error={errors.pemeriksaanFisik}>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-blue-500"
              rows={3}
              placeholder="TD: 120/80 mmHg, Nadi: 80x/mnt, RR: 20x/mnt..."
              value={form.pemeriksaanFisik ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, pemeriksaanFisik: e.target.value }))}
            />
          </Field>

          {/* ICD-10 Search — integrasi dengan ICD-X Converter */}
          <Field label="Diagnosis (ICD-10) *" error={errors.diagnosaKode}>
            <div className="relative">
              <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg px-3 focus-within:border-blue-500">
                <Search size={14} className="text-gray-400 mr-2 shrink-0" />
                <input
                  type="text"
                  className="flex-1 py-2.5 bg-transparent text-white text-sm outline-none placeholder-gray-500"
                  placeholder="Cari kode ICD-10... (contoh: diare, hipertensi, A09)"
                  value={icdSearch}
                  onChange={(e) => {
                    setIcdSearch(e.target.value);
                    handleIcdSearch(e.target.value);
                  }}
                />
                {isSearching && (
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              {icdResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-10 overflow-hidden">
                  {icdResults.map((r) => (
                    <button
                      key={r.code}
                      onClick={() => handleSelectIcd(r)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-700 transition-colors border-b border-gray-700 last:border-0"
                    >
                      <span className="text-blue-400 font-mono text-xs font-semibold">{r.code}</span>
                      <span className="text-white text-sm ml-2">{r.description}</span>
                      {r.pCareCode && (
                        <span className="text-gray-400 text-xs ml-2">(P-Care: {r.pCareCode})</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>

          {/* Tatalaksana */}
          <Field label="Tatalaksana *" error={errors.tatalaksana}>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-blue-500"
              rows={3}
              placeholder="Terapi farmakologi dan non-farmakologi..."
              value={form.tatalaksana ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, tatalaksana: e.target.value }))}
            />
          </Field>

          {/* Rujukan */}
          <div className="flex items-center gap-3">
            <input
              id="rujukan"
              type="checkbox"
              className="w-4 h-4 accent-blue-500"
              checked={form.perluRujukan}
              onChange={(e) => setForm((p) => ({ ...p, perluRujukan: e.target.checked }))}
            />
            <label htmlFor="rujukan" className="text-gray-300 text-sm">Perlu rujukan ke fasilitas lanjutan</label>
          </div>

          {form.perluRujukan && (
            <Field label="Tujuan Rujukan" error={errors.rujukanTujuan}>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                placeholder="RSUD, Poli Spesialis..."
                value={form.rujukanTujuan ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, rujukanTujuan: e.target.value }))}
              />
            </Field>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || saved}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-all"
          >
            {saved ? (
              <><CheckCircle size={16} /> Tersimpan!</>
            ) : isSaving ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Menyimpan...</>
            ) : (
              "Simpan Diagnosis"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FIELD WRAPPER ────────────────────────────────────────────
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div>
      <label className="text-gray-300 text-sm font-medium block mb-1.5">{label}</label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-red-400 text-xs mt-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}
