// ============================================================
// PKM Dashboard — ConsultationControls Component
// src/components/telemedicine/ConsultationControls.tsx
// ============================================================

"use client";

import { useState, useCallback } from "react";
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  PhoneOff, FileText, Pill, Share2, ChevronUp
} from "lucide-react";
import { DiagnosisModal } from "./DiagnosisModal";
import { EPrescriptionModal } from "./EPrescriptionModal";
import type { SessionState, AppointmentWithDetails, SessionParticipantRole } from "@/types/telemedicine.types";

interface ConsultationControlsProps {
  sessionState: SessionState;
  participantRole: SessionParticipantRole;
  appointment: AppointmentWithDetails;
  onToggleMic: () => Promise<void>;
  onToggleCamera: () => Promise<void>;
  onToggleScreenShare: () => Promise<void>;
  onEndCall: () => Promise<void>;
}

export function ConsultationControls({
  sessionState,
  participantRole,
  appointment,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onEndCall,
}: ConsultationControlsProps): JSX.Element {
  const [showDiagnosis, setShowDiagnosis] = useState(false);
  const [showPrescription, setShowPrescription] = useState(false);
  const [isEndingCall, setIsEndingCall] = useState(false);

  const isDoctor = participantRole === "DOCTOR";
  const isPatient = participantRole === "PATIENT";

  const handleEndCall = useCallback(async () => {
    if (isEndingCall) return;
    setIsEndingCall(true);
    try {
      await onEndCall();
    } finally {
      setIsEndingCall(false);
    }
  }, [onEndCall, isEndingCall]);

  return (
    <>
      <div className="flex items-center justify-between px-6 py-4 bg-gray-900 border-t border-gray-800">
        {/* Left: Media controls */}
        <div className="flex items-center gap-3">
          <ControlButton
            onClick={onToggleMic}
            active={sessionState.isMicEnabled}
            activeIcon={<Mic size={18} />}
            inactiveIcon={<MicOff size={18} />}
            activeLabel="Mic On"
            inactiveLabel="Mic Off"
            inactiveClass="bg-red-600 hover:bg-red-700"
          />
          <ControlButton
            onClick={onToggleCamera}
            active={sessionState.isCameraEnabled}
            activeIcon={<Video size={18} />}
            inactiveIcon={<VideoOff size={18} />}
            activeLabel="Kamera On"
            inactiveLabel="Kamera Off"
            inactiveClass="bg-red-600 hover:bg-red-700"
          />
          {!isPatient && (
            <ControlButton
              onClick={onToggleScreenShare}
              active={!sessionState.isScreenSharing}
              activeIcon={<Monitor size={18} />}
              inactiveIcon={<MonitorOff size={18} />}
              activeLabel="Bagikan Layar"
              inactiveLabel="Stop Share"
            />
          )}
        </div>

        {/* Center: Clinical actions (dokter only) */}
        {isDoctor && (
          <div className="flex items-center gap-2">
            <ClinicalButton
              icon={<FileText size={16} />}
              label="Diagnosis"
              onClick={() => setShowDiagnosis(true)}
              color="blue"
            />
            <ClinicalButton
              icon={<Pill size={16} />}
              label="Resep"
              onClick={() => setShowPrescription(true)}
              color="emerald"
            />
          </div>
        )}

        {/* Right: End call */}
        <button
          onClick={handleEndCall}
          disabled={isEndingCall}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all"
        >
          <PhoneOff size={18} />
          {isEndingCall ? "Mengakhiri..." : "Akhiri Konsultasi"}
        </button>
      </div>

      {/* Modals — hanya untuk dokter */}
      {isDoctor && (
        <>
          <DiagnosisModal
            open={showDiagnosis}
            appointment={appointment}
            onClose={() => setShowDiagnosis(false)}
          />
          <EPrescriptionModal
            open={showPrescription}
            appointment={appointment}
            onClose={() => setShowPrescription(false)}
          />
        </>
      )}
    </>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────

interface ControlButtonProps {
  onClick: () => void;
  active: boolean;
  activeIcon: React.ReactNode;
  inactiveIcon: React.ReactNode;
  activeLabel: string;
  inactiveLabel: string;
  inactiveClass?: string;
}

function ControlButton({
  onClick,
  active,
  activeIcon,
  inactiveIcon,
  activeLabel,
  inactiveLabel,
  inactiveClass = "bg-gray-700 hover:bg-gray-600",
}: ControlButtonProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={active ? activeLabel : inactiveLabel}
      className={`
        flex items-center justify-center w-11 h-11 rounded-xl text-white transition-all
        ${active ? "bg-gray-700 hover:bg-gray-600" : inactiveClass}
      `}
    >
      {active ? activeIcon : inactiveIcon}
    </button>
  );
}

interface ClinicalButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color: "blue" | "emerald" | "amber";
}

function ClinicalButton({ icon, label, onClick, color }: ClinicalButtonProps): JSX.Element {
  const colorMap = {
    blue: "bg-blue-700 hover:bg-blue-600 border-blue-600",
    emerald: "bg-emerald-700 hover:bg-emerald-600 border-emerald-600",
    amber: "bg-amber-700 hover:bg-amber-600 border-amber-600",
  };

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-medium
        border transition-all ${colorMap[color]}
      `}
    >
      {icon}
      {label}
    </button>
  );
}
