// ============================================================
// PKM Dashboard — EPrescriptionModal Component
// src/components/telemedicine/EPrescriptionModal.tsx
// ============================================================

"use client";

import { useState, useCallback } from "react";
import { X, Plus, Trash2, CheckCircle, Printer } from "lucide-react";
import type { AppointmentWithDetails, PrescriptionItem } from "@/types/telemedicine.types";

interface EPrescriptionModalProps {
  open: boolean;
  appointment: AppointmentWithDetails;
  onClose: () => void;
}

const BENTUK_SEDIAAN = ["Tablet", "Kapsul", "Sirup", "Sirup Kering", "Injeksi", "Salep", "Krim", "Tetes Mata", "Tetes Telinga", "Inhaler", "Suppositoria", "Puyer"];
const ATURAN_MINUM_PRESET = ["1x1", "2x1", "3x1", "4x1", "1x½", "2x½", "Jika Perlu (k/p)"];

const EMPTY_ITEM: PrescriptionItem = {
  namaObat: "",
  bentukSediaan: "Tablet",
  dosis: "",
  aturanMinum: "",
  jumlah: 10,
  catatan: "",
};

export function EPrescriptionModal({ open, appointment, onClose }: EPrescriptionModalProps): JSX.Element | null {
  const [items, setItems] = useState<PrescriptionItem[]>([{ ...EMPTY_ITEM }]);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleAddItem = useCallback(() => {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }, []);

  const handleRemoveItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpdateItem = useCallback(<K extends keyof PrescriptionItem>(
    index: number,
    field: K,
    value: PrescriptionItem[K]
  ) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }, []);

  const handleSave = useCallback(async () => {
    const validItems = items.filter((i) => i.namaObat.trim().length > 0);
    if (validItems.length === 0) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/telemedicine/appointments/${appointment.id}/prescription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: validItems }),
      });

      if (!res.ok) throw new Error("Gagal menyimpan resep");
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 1500);
    } catch (err) {
      console.error("[EPrescriptionModal]", err);
    } finally {
      setIsSaving(false);
    }
  }, [items, appointment.id, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-white font-semibold text-lg">Resep Digital (e-Prescription)</h2>
            <p className="text-gray-400 text-sm">
              {appointment.patient.name} — dr. {appointment.doctor.name}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Prescription items */}
          {items.map((item, index) => (
            <div key={index} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-300 text-sm font-semibold">Obat #{index + 1}</span>
                {items.length > 1 && (
                  <button
                    onClick={() => handleRemoveItem(index)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Nama Obat */}
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs mb-1 block">Nama Obat *</label>
                  <input
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500"
                    placeholder="Paracetamol, Amoxicillin..."
                    value={item.namaObat}
                    onChange={(e) => handleUpdateItem(index, "namaObat", e.target.value)}
                  />
                </div>

                {/* Bentuk Sediaan */}
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Bentuk Sediaan</label>
                  <select
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500"
                    value={item.bentukSediaan}
                    onChange={(e) => handleUpdateItem(index, "bentukSediaan", e.target.value)}
                  >
                    {BENTUK_SEDIAAN.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>

                {/* Dosis */}
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Dosis *</label>
                  <input
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500"
                    placeholder="500mg, 250mg/5ml..."
                    value={item.dosis}
                    onChange={(e) => handleUpdateItem(index, "dosis", e.target.value)}
                  />
                </div>

                {/* Aturan Minum */}
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Aturan Minum *</label>
                  <div className="flex gap-2">
                    <select
                      className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-2 py-2 text-white text-sm outline-none focus:border-blue-500"
                      value={ATURAN_MINUM_PRESET.includes(item.aturanMinum) ? item.aturanMinum : ""}
                      onChange={(e) => {
                        if (e.target.value) handleUpdateItem(index, "aturanMinum", e.target.value);
                      }}
                    >
                      <option value="">Pilih...</option>
                      {ATURAN_MINUM_PRESET.map((a) => <option key={a}>{a}</option>)}
                    </select>
                    <input
                      className="w-20 bg-gray-700 border border-gray-600 rounded-lg px-2 py-2 text-white text-sm outline-none focus:border-blue-500"
                      placeholder="custom"
                      value={item.aturanMinum}
                      onChange={(e) => handleUpdateItem(index, "aturanMinum", e.target.value)}
                    />
                  </div>
                </div>

                {/* Jumlah */}
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Jumlah</label>
                  <input
                    type="number"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500"
                    min={1}
                    max={999}
                    value={item.jumlah}
                    onChange={(e) => handleUpdateItem(index, "jumlah", parseInt(e.target.value) || 1)}
                  />
                </div>

                {/* Catatan */}
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs mb-1 block">Catatan</label>
                  <input
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500"
                    placeholder="Diminum sesudah makan, jangan dihancurkan..."
                    value={item.catatan ?? ""}
                    onChange={(e) => handleUpdateItem(index, "catatan", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Add item button */}
          <button
            onClick={handleAddItem}
            className="flex items-center gap-2 w-full py-2.5 border border-dashed border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 rounded-xl text-sm transition-all"
          >
            <Plus size={16} />
            Tambah Obat
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors">
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || saved}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-all"
          >
            {saved ? (
              <><CheckCircle size={16} /> Resep Tersimpan!</>
            ) : isSaving ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Menyimpan...</>
            ) : (
              <><Printer size={16} /> Simpan & Cetak Resep</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
