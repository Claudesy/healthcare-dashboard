// ============================================================
// PKM Dashboard — VideoRoom Component
// src/components/telemedicine/VideoRoom.tsx
// ============================================================

"use client";

import { useEffect, useCallback } from "react";
import {
  LiveKitRoom,
  VideoConference,
  ControlBar,
  RoomAudioRenderer,
  GridLayout,
  ParticipantTile,
  useTracks,
  LayoutContextProvider,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { useLiveKitSession } from "@/hooks/useLiveKitSession";
import { ConsultationControls } from "./ConsultationControls";
import { NetworkQualityBadge } from "./NetworkQualityBadge";
import { ConsultationTimer } from "./ConsultationTimer";
import type { AppointmentWithDetails, SessionParticipantRole } from "@/types/telemedicine.types";

interface VideoRoomProps {
  appointment: AppointmentWithDetails;
  participantRole: SessionParticipantRole;
  onSessionComplete: (appointmentId: string) => void;
}

export function VideoRoom({
  appointment,
  participantRole,
  onSessionComplete,
}: VideoRoomProps): JSX.Element {
  const {
    room,
    sessionState,
    participants,
    connect,
    disconnect,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    error,
  } = useLiveKitSession({
    appointmentId: appointment.id,
    participantRole,
    onSessionEnd: () => onSessionComplete(appointment.id),
  });

  // Auto-connect saat komponen mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleEndCall = useCallback(async () => {
    await disconnect();
    onSessionComplete(appointment.id);
  }, [disconnect, onSessionComplete, appointment.id]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-950 text-white p-8 rounded-xl">
        <div className="text-red-400 text-5xl mb-4">⚠️</div>
        <h3 className="text-xl font-semibold mb-2">Gagal Terhubung</h3>
        <p className="text-gray-400 text-center mb-6">{error}</p>
        <button
          onClick={connect}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  if (sessionState.isConnecting) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-950 text-white">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-300">Menghubungkan ke ruang konsultasi...</p>
        <p className="text-gray-500 text-sm mt-2">
          dr. {appointment.doctor.name}
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full bg-gray-950 rounded-xl overflow-hidden">
      {/* Header Info */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 z-10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white text-sm font-medium">
            Konsultasi — {appointment.patient.name}
          </span>
          <span className="text-gray-400 text-xs">
            dr. {appointment.doctor.name}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <NetworkQualityBadge quality={sessionState.networkQuality} />
          <ConsultationTimer elapsedSeconds={sessionState.elapsedSeconds} />
          <span className="text-gray-400 text-xs">
            {sessionState.participantCount} peserta
          </span>
        </div>
      </div>

      {/* Video Grid — menggunakan LiveKit Components langsung */}
      <div className="flex-1 relative">
        {room && sessionState.isConnected ? (
          <LiveKitRoom room={room} data-lk-theme="default" style={{ height: "100%" }}>
            <LayoutContextProvider>
              <div style={{ height: "100%" }}>
                <GridLayout
                  tracks={useTracks([
                    { source: Track.Source.Camera, withPlaceholder: true },
                    { source: Track.Source.ScreenShare, withPlaceholder: false },
                  ])}
                  style={{ height: "calc(100% - 60px)" }}
                >
                  <ParticipantTile />
                </GridLayout>
                <RoomAudioRenderer />
              </div>
            </LayoutContextProvider>
          </LiveKitRoom>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Menunggu koneksi...</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <ConsultationControls
        sessionState={sessionState}
        participantRole={participantRole}
        appointment={appointment}
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
        onToggleScreenShare={toggleScreenShare}
        onEndCall={handleEndCall}
      />
    </div>
  );
}
