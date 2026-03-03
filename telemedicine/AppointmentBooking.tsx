// ============================================================
// PKM Dashboard — AppointmentBooking Component
// src/components/telemedicine/AppointmentBooking.tsx
// ============================================================

"use client";

import { useState, useCallback, useEffect } from "react";
import { Calendar, Clock, Video, Phone, MessageSquare, User, ChevronRight } from "lucide-react";
import type { ConsultationType, CreateAppointmentInput } from "@/types/telemedicine.types";

interface Doctor {
  id: string;
  name: string;
  spesialisasi: string;
  nip: string;
}

interface Patient {
  id: string;
  name: string;
  noRm: string;
  noBpjs?: string;
}

interface DoctorSlot {
  date: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

interface AppointmentBookingProps {
  preselectedPatientId?: string;
  onSuccess: (appointmentId: string) => void;
  onCancel: () => void;
}

const CONSULTATION_TYPE_OPTIONS: Array<{
  value: ConsultationType;
  label: string;
  icon: React.ReactNode;
  desc: string;
}> = [
  { value: "VIDEO", label: "Video Call", icon: <Video size={16} />, desc: "Konsultasi tatap muka virtual" },
  { value: "AUDIO", label: "Telepon", icon: <Phone size={16} />, desc: "Konsultasi via telepon" },
  { value: "CHAT", label: "Chat", icon: <MessageSquare size={16} />, desc: "Pesan teks & foto" },
];

export function AppointmentBooking({
  preselectedPatientId,
  onSuccess,
  onCancel,
}: AppointmentBookingProps): JSX.Element {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [slots, setSlots] = useState<DoctorSlot[]>([]);

  const [form, setForm] = useState<Partial<CreateAppointmentInput>>({
    patientId: preselectedPatientId,
    consultationType: "VIDEO",
    durationMinutes: 15,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load dokter
  useEffect(() => {
    fetch("/api/users?role=DOKTER&limit=50")
      .then((r) => r.json())
      .then((d) => setDoctors(d.data?.users ?? []))
      .catch(() => {});
  }, []);

  // Load pasien (jika belum ada preselected)
  useEffect(() => {
    if (preselectedPatientId) return;
    fetch("/api/patients?limit=50")
      .then((r) => r.json())
      .then((d) => setPatients(d.data?.patients ?? []))
      .catch(() => {});
  }, [preselectedPatientId]);

  // Load slot ketika dokter dipilih
  useEffect(() => {
    if (!form.doctorId) return;
    setIsLoading(true);
    fetch(`/api/telemedicine/slots?doctorId=${form.doctorId}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.data?.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setIsLoading(false));
  }, [form.doctorId]);

  const handleSubmit = useCallback(async () => {
    if (!form.patientId || !form.doctorId || !form.scheduledAt) {
      setError("Mohon lengkapi semua data yang diperlukan");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/telemedicine/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? "Gagal membuat appointment");
      }

      onSuccess(data.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setIsSaving(false);
    }
  }, [form, onSuccess]);

  // Group slots by date
  const slotsByDate = slots.reduce<Record<string, DoctorSlot[]>>((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    acc[slot.date].push(slot);
    return acc;
  }, {});

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden">
      {/* Progress Steps */}
      <div className="flex items-center px-6 py-4 border-b border-gray-700 bg-gray-800">
        {[
          { num: 1, label: "Pilih Dokter & Pasien" },
          { num: 2, label: "Pilih Jadwal" },
          { num: 3, label: "Keluhan & Konfirmasi" },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center">
            <div className={`
              flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold
              ${step === s.num ? "bg-blue-600 text-white" : step > s.num ? "bg-green-600 text-white" : "bg-gray-700 text-gray-400"}
            `}>
              {step > s.num ? "✓" : s.num}
            </div>
            <span className={`ml-2 text-sm ${step === s.num ? "text-white" : "text-gray-500"}`}>
              {s.label}
            </span>
            {i < 2 && <ChevronRight size={16} className="mx-3 text-gray-600" />}
          </div>
        ))}
      </div>

      <div className="p-6">
        {/* ── STEP 1: Pilih Dokter & Pasien ── */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Pilih Dokter */}
            <div>
              <label className="text-gray-300 text-sm font-medium block mb-2">Dokter *</label>
              <div className="grid grid-cols-2 gap-2">
                {doctors.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => setForm((p) => ({ ...p, doctorId: doc.id }))}
                    className={`
                      flex items-center gap-3 p-3 rounded-xl border text-left transition-all
                      ${form.doctorId === doc.id
                        ? "bg-blue-900/40 border-blue-500 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500"}
                    `}
                  >
                    <div className="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center shrink-0">
                      <User size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{doc.name}</p>
                      <p className="text-xs text-gray-400">{doc.spesialisasi}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Pilih Pasien */}
            {!preselectedPatientId && (
              <div>
                <label className="text-gray-300 text-sm font-medium block mb-2">Pasien *</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                  value={form.patientId ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, patientId: e.target.value }))}
                >
                  <option value="">-- Pilih Pasien --</option>
                  {patients.map((pt) => (
                    <option key={pt.id} value={pt.id}>
                      {pt.name} (No. RM: {pt.noRm})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Tipe Konsultasi */}
            <div>
              <label className="text-gray-300 text-sm font-medium block mb-2">Tipe Konsultasi</label>
              <div className="flex gap-2">
                {CONSULTATION_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setForm((p) => ({ ...p, consultationType: opt.value }))}
                    className={`
                      flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs transition-all
                      ${form.consultationType === opt.value
                        ? "bg-blue-900/40 border-blue-500 text-blue-300"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"}
                    `}
                  >
                    {opt.icon}
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-gray-500 text-center leading-tight">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Pilih Jadwal ── */}
        {step === 2 && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : Object.keys(slotsByDate).length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Calendar size={32} className="mx-auto mb-3 opacity-50" />
                <p>Tidak ada slot tersedia untuk dokter ini</p>
              </div>
            ) : (
              Object.entries(slotsByDate).map(([date, daySlots]) => (
                <div key={date}>
                  <p className="text-gray-400 text-xs mb-2">
                    {new Date(date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {daySlots.map((slot) => {
                      const slotIso = `${date}T${slot.startTime}:00+07:00`;
                      const isSelected = form.scheduledAt === slotIso;
                      return (
                        <button
                          key={slot.startTime}
                          disabled={!slot.isAvailable}
                          onClick={() => setForm((p) => ({ ...p, scheduledAt: slotIso }))}
                          className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all
                            ${!slot.isAvailable
                              ? "bg-gray-800/50 border-gray-700 text-gray-600 cursor-not-allowed"
                              : isSelected
                              ? "bg-blue-600 border-blue-500 text-white"
                              : "bg-gray-800 border-gray-700 text-gray-300 hover:border-blue-500"}
                          `}
                        >
                          <Clock size={12} />
                          {slot.startTime}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── STEP 3: Keluhan & Konfirmasi ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="text-gray-300 text-sm font-medium block mb-1.5">Keluhan Utama</label>
              <textarea
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm resize-none outline-none focus:border-blue-500"
                rows={3}
                placeholder="Ceritakan keluhan yang ingin dikonsultasikan..."
                value={form.keluhanUtama ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, keluhanUtama: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm font-medium block mb-1.5">No. SEP BPJS (Opsional)</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                placeholder="Nomor SEP peserta BPJS..."
                value={form.bpjsNomorSEP ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, bpjsNomorSEP: e.target.value }))}
              />
            </div>
            {error && (
              <p className="text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={step === 1 ? onCancel : () => setStep((s) => (s - 1) as 1 | 2)}
            className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
          >
            {step === 1 ? "Batal" : "← Kembali"}
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as 2 | 3)}
              disabled={(step === 1 && (!form.doctorId || !form.patientId)) || (step === 2 && !form.scheduledAt)}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-all"
            >
              Lanjut →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-all"
            >
              {isSaving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Menyimpan...</>
              ) : (
                "✅ Buat Appointment"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
