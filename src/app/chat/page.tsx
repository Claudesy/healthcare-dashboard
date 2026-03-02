"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  id: number;
  text: string;
  direction: "outgoing" | "incoming";
  sender: string;
  time: string;
};

type Contact = {
  id: number;
  initials: string;
  name: string;
  role: string;
  online: boolean;
};

const CONTACTS: Contact[] = [
  { id: 1, initials: "dr.A", name: "dr. Arini Dewi", role: "DOKTER UMUM", online: true },
  { id: 2, initials: "Br.S", name: "Bidan Siska", role: "BIDAN", online: true },
  { id: 3, initials: "FRM", name: "Farmasi", role: "APOTEKER", online: false },
  { id: 4, initials: "Lab", name: "Lab Unit", role: "ANALIS", online: true },
];

const INITIAL_MESSAGES: Record<number, Message[]> = {
  1: [
    { id: 1, text: "Dok, pasien RM-88492-A SpO2-nya 92%, sudah saya catat di EMR.", direction: "outgoing", sender: "Saya", time: "09:14" },
    { id: 2, text: "Baik. Berikan O2 nasal kanul 3 L/mnt. Foto thorax segera, saya cek hasilnya nanti.", direction: "incoming", sender: "dr. Arini", time: "09:16" },
    { id: 3, text: "Siap Dok. Sudah diorder lab juga: Hematologi Lengkap + CRP.", direction: "outgoing", sender: "Saya", time: "09:17" },
    { id: 4, text: "Bagus. Monitor tiap 15 menit. Jika SpO2 < 90% langsung hubungi saya.", direction: "incoming", sender: "dr. Arini", time: "09:18" },
  ],
  2: [
    { id: 1, text: "Kak, pasien hamil muda ada di poli hari ini tidak?", direction: "outgoing", sender: "Saya", time: "08:30" },
    { id: 2, text: "Ada 2 pasien ANC pagi ini. Jadwal jam 09.00 dan 10.30.", direction: "incoming", sender: "Bidan Siska", time: "08:32" },
  ],
  3: [
    { id: 1, text: "Mohon cek ketersediaan Amlodipin 10mg, stock terakhir berapa?", direction: "outgoing", sender: "Saya", time: "08:45" },
    { id: 2, text: "Masih ada 45 tablet. Resep baru bisa kami proses.", direction: "incoming", sender: "Farmasi", time: "08:50" },
  ],
  4: [
    { id: 1, text: "Lab, hasil Hematologi RM-88492-A estimasi jam berapa?", direction: "outgoing", sender: "Saya", time: "09:20" },
    { id: 2, text: "Sedang diproses, estimasi 45 menit dari sekarang.", direction: "incoming", sender: "Lab Unit", time: "09:22" },
  ],
};

export default function ChatPage() {
  const [activeContact, setActiveContact] = useState<Contact>(CONTACTS[0]);
  const [messages, setMessages] = useState<Record<number, Message[]>>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeContact]);

  function sendMessage() {
    const text = input.trim();
    if (!text) return;

    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const newMsg: Message = {
      id: Date.now(),
      text,
      direction: "outgoing",
      sender: "Saya",
      time,
    };

    setMessages((prev) => ({
      ...prev,
      [activeContact.id]: [...(prev[activeContact.id] || []), newMsg],
    }));
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const currentMessages = messages[activeContact.id] || [];

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <div className="page-header" style={{ maxWidth: 1200, width: "100%" }}>
        <div className="page-title">Chatbox</div>
        <div className="page-subtitle">Komunikasi Antar Tenaga Kesehatan</div>
      </div>

      <div className="chat-layout">
        {/* Contact List */}
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">Kontak Aktif</div>
          {CONTACTS.map((contact) => (
            <div
              key={contact.id}
              className={`chat-contact${activeContact.id === contact.id ? " active" : ""}`}
              onClick={() => setActiveContact(contact)}
            >
              <div className="chat-contact-avatar">{contact.initials}</div>
              <div>
                <div className="chat-contact-name">{contact.name}</div>
                <div className="chat-contact-role">{contact.role}</div>
              </div>
              {contact.online && <div className="online-dot" />}
            </div>
          ))}
        </div>

        {/* Chat Main */}
        <div className="chat-main">
          <div className="chat-header">
            <div>
              <div className="chat-header-name">{activeContact.name}</div>
              <div className="chat-header-meta">
                {activeContact.role} &nbsp;·&nbsp;{" "}
                {activeContact.online ? (
                  <span style={{ color: "#4ADE80" }}>● ONLINE</span>
                ) : (
                  <span>○ OFFLINE</span>
                )}
              </div>
            </div>
            <div style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 13, color: "var(--text-muted)", letterSpacing: "0.1em" }}>
              PUSKESMAS INTERNAL CHANNEL
            </div>
          </div>

          <div className="chat-messages">
            {currentMessages.map((msg) => (
              <div key={msg.id} className={`chat-msg ${msg.direction}`}>
                <div className="chat-msg-meta">
                  {msg.sender} · {msg.time}
                </div>
                <div className="chat-bubble">{msg.text}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-wrap">
            <textarea
              className="chat-input"
              placeholder="Ketik pesan..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button className="chat-send-btn" onClick={sendMessage}>
              KIRIM
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
