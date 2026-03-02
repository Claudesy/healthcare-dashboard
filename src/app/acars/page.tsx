"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────
type UserDef = {
  id: string;
  name: string;
  role: string;
  color: string;
};

type ChatMessage = {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  text: string;
  time: string;
};

type OnlineUser = {
  userId: string;
  name: string;
  socketId: string;
};

type RoomDef = {
  id: string;
  name: string;
  isGroup: boolean;
  memberIds?: string[]; // undefined = semua user (group umum)
};

// ─── User Roster ──────────────────────────────────────────────────────────────
const USERS: UserDef[] = [
  { id: "ferdi",   name: "dr. Ferdi Iskandar", role: "DOKTER PENANGGUNG JAWAB", color: "#D47A57" },
  { id: "josep",   name: "Josep",               role: "TENAGA KESEHATAN",        color: "#4A90D9" },
  { id: "cahyo",   name: "Cahyo",               role: "TENAGA KESEHATAN",        color: "#4CAF7D" },
  { id: "efildan", name: "Efildan",             role: "TENAGA ADMIN",            color: "#9B59B6" },
  { id: "isip",    name: "Dokter ISIP",         role: "DOKTER INTERNSIP",        color: "#E67E22" },
];

// ─── Room defs ────────────────────────────────────────────────────────────────
const GROUP_ROOM: RoomDef = {
  id: "group__semua",
  name: "Semua Tim",
  isGroup: true,
};

function getRoomId(a: string, b: string) {
  return [a, b].sort().join("__");
}

function now() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ size = 40, ring }: { size?: number; ring?: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", overflow: "hidden",
      flexShrink: 0,
      border: ring ? `2px solid ${ring}` : "2px solid var(--line-base)",
      background: "var(--bg-nav)",
    }}>
      <Image src="/doc.png" alt="avatar" width={size} height={size}
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
    </div>
  );
}

// Avatar stack untuk group
function AvatarStack({ count, colors }: { count: number; colors: string[] }) {
  const show = Math.min(3, count);
  return (
    <div style={{ position: "relative", width: 36 + (show - 1) * 10, height: 36, flexShrink: 0 }}>
      {Array.from({ length: show }).map((_, i) => (
        <div key={i} style={{
          position: "absolute", left: i * 10,
          width: 28, height: 28, borderRadius: "50%", overflow: "hidden",
          border: `2px solid ${colors[i] || "var(--line-base)"}`,
          background: "var(--bg-nav)",
          zIndex: show - i,
        }}>
          <Image src="/doc.png" alt="avatar" width={28} height={28}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AcarsPage() {
  const [currentUser, setCurrentUser]       = useState<UserDef | null>(null);
  const [activeRoomId, setActiveRoomId]     = useState<string | null>(null);
  const [messages, setMessages]             = useState<Record<string, ChatMessage[]>>({});
  const [onlineIds, setOnlineIds]           = useState<Set<string>>(new Set());
  const [unread, setUnread]                 = useState<Record<string, number>>({});
  const [input, setInput]                   = useState("");
  const [typingMap, setTypingMap]           = useState<Record<string, string | null>>({});
  const [connected, setConnected]           = useState(false);

  const socketRef   = useRef<Socket | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);

  // scroll to bottom
  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeRoomId]);

  // join socket when user selected
  useEffect(() => {
    if (!currentUser) return;

    const socket = io();
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("user:join", { userId: currentUser.id, name: currentUser.name });
      // join group room otomatis
      socket.emit("room:join", GROUP_ROOM.id);
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("users:online", (users: OnlineUser[]) => {
      setOnlineIds(new Set(users.map(u => u.userId)));
    });

    socket.on("message:receive", (msg: ChatMessage) => {
      setMessages(prev => {
        const existing = prev[msg.roomId] || [];
        if (existing.find(m => m.id === msg.id)) return prev;
        return { ...prev, [msg.roomId]: [...existing, msg] };
      });
      // unread jika bukan room aktif dan bukan pesan sendiri
      if (msg.senderId !== currentUser.id) {
        setActiveRoomId(ar => {
          if (msg.roomId !== ar) {
            // untuk 1-on-1, key unread = senderId; untuk group = roomId
            const unreadKey = msg.roomId === GROUP_ROOM.id ? GROUP_ROOM.id : msg.senderId;
            setUnread(u => ({ ...u, [unreadKey]: (u[unreadKey] || 0) + 1 }));
          }
          return ar;
        });
      }
    });

    socket.on("typing:start", ({ senderName, roomId }: { senderName: string; roomId: string }) => {
      setTypingMap(t => ({ ...t, [roomId]: senderName }));
    });
    socket.on("typing:stop", ({ roomId }: { roomId: string }) => {
      setTypingMap(t => ({ ...t, [roomId]: null }));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [currentUser]);

  // join room saat ganti room
  useEffect(() => {
    if (!currentUser || !activeRoomId) return;
    socketRef.current?.emit("room:join", activeRoomId);
    setTypingMap(t => ({ ...t, [activeRoomId]: null }));
    const unreadKey = activeRoomId === GROUP_ROOM.id ? GROUP_ROOM.id
      : USERS.find(u => getRoomId(currentUser.id, u.id) === activeRoomId)?.id;
    if (unreadKey) setUnread(u => ({ ...u, [unreadKey]: 0 }));
  }, [activeRoomId, currentUser]);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || !currentUser || !activeRoomId || !socketRef.current) return;

    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      roomId: activeRoomId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      text,
      time: now(),
    };
    socketRef.current.emit("message:send", msg);
    setInput("");

    if (typingTimer.current) clearTimeout(typingTimer.current);
    socketRef.current.emit("typing:stop", { roomId: activeRoomId });
  }, [input, currentUser, activeRoomId]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    if (!currentUser || !activeRoomId || !socketRef.current) return;
    socketRef.current.emit("typing:start", { roomId: activeRoomId, senderName: currentUser.name });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit("typing:stop", { roomId: activeRoomId });
    }, 1500);
  }

  const contacts = currentUser ? USERS.filter(u => u.id !== currentUser.id) : [];
  const currentMessages = activeRoomId ? (messages[activeRoomId] || []) : [];
  const currentTyping = activeRoomId ? typingMap[activeRoomId] : null;

  // info room aktif
  const activeIsGroup = activeRoomId === GROUP_ROOM.id;
  const activeContact = !activeIsGroup && activeRoomId
    ? USERS.find(u => currentUser && getRoomId(currentUser.id, u.id) === activeRoomId)
    : null;

  // ─── Login screen ──────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <div className="page-header" style={{ maxWidth: 1200, width: "100%" }}>
          <div className="page-title">ACARS</div>
          <div className="page-subtitle">Automated Clinical Alert & Response System — Login sebagai siapa?</div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
          gap: 16, maxWidth: 900, width: "100%", marginTop: 8,
        }}>
          {USERS.map(user => (
            <button key={user.id} onClick={() => setCurrentUser(user)}
              style={{
                background: "var(--bg-nav)", border: `1px solid var(--line-base)`,
                borderRadius: 12, padding: "20px 16px", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 12, transition: "border-color 0.2s, transform 0.15s", textAlign: "center",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = user.color;
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line-base)";
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              }}
            >
              <Avatar size={64} ring={user.color} />
              <div>
                <div style={{ fontFamily: "var(--font-geist-sans), sans-serif", fontWeight: 600, fontSize: 13, color: "var(--text-main)", marginBottom: 4 }}>{user.name}</div>
                <div style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 13, letterSpacing: "0.12em", color: "var(--text-muted)" }}>{user.role}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Chat screen ───────────────────────────────────────────────────────────
  const groupUnread = unread[GROUP_ROOM.id] || 0;

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <div className="page-header" style={{ maxWidth: 1200, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div className="page-title">ACARS</div>
          <div className="page-subtitle">Automated Clinical Alert & Response System</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar size={32} ring={currentUser.color} />
          <div>
            <div style={{ fontFamily: "var(--font-geist-sans)", fontSize: 11, fontWeight: 600, color: "var(--text-main)" }}>{currentUser.name}</div>
            <div style={{ fontFamily: "var(--font-geist-mono)", fontSize: 13, color: connected ? "#4ADE80" : "var(--text-muted)", letterSpacing: "0.1em" }}>
              {connected ? "● CONNECTED" : "○ CONNECTING..."}
            </div>
          </div>
          <button
            onClick={() => { setCurrentUser(null); setActiveRoomId(null); setMessages({}); }}
            style={{
              marginLeft: 8, fontFamily: "var(--font-geist-mono), monospace", fontSize: 13,
              letterSpacing: "0.1em", color: "var(--text-muted)", background: "transparent",
              border: "1px solid var(--line-base)", borderRadius: 4, padding: "4px 10px", cursor: "pointer",
            }}
          >GANTI USER</button>
        </div>
      </div>

      <div className="chat-layout">
        {/* Sidebar */}
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            TIM PUSKESMAS
            <span style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 13, color: "var(--text-muted)", fontWeight: 400, letterSpacing: "0.08em" }}>
              {onlineIds.size} ONLINE
            </span>
          </div>

          {/* Group chat */}
          <div
            className={`chat-contact${activeRoomId === GROUP_ROOM.id ? " active" : ""}`}
            onClick={() => setActiveRoomId(GROUP_ROOM.id)}
            style={{ borderBottom: "1px solid var(--line-base)" }}
          >
            <div style={{ position: "relative" }}>
              <AvatarStack count={USERS.length} colors={USERS.map(u => u.color)} />
              {groupUnread > 0 && (
                <span style={{
                  position: "absolute", top: -3, right: -3,
                  width: 15, height: 15, borderRadius: "50%",
                  background: "var(--c-asesmen)", color: "var(--bg-canvas)",
                  fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-geist-mono), monospace", fontWeight: 700,
                  border: "1px solid var(--bg-nav)",
                }}>{groupUnread}</span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div className="chat-contact-name">Semua Tim</div>
              <div className="chat-contact-role">GROUP · {USERS.length} ANGGOTA</div>
            </div>
            <div className="online-dot" style={{ background: "#4ADE80" }} />
          </div>

          {/* Diri sendiri */}
          <div className="chat-contact" style={{ opacity: 0.45, cursor: "default", pointerEvents: "none", marginTop: 4 }}>
            <Avatar size={36} ring={currentUser.color} />
            <div>
              <div className="chat-contact-name">{currentUser.name}</div>
              <div className="chat-contact-role">KAMU</div>
            </div>
          </div>

          <div style={{ height: 1, background: "var(--line-base)", margin: "4px 0", opacity: 0.3 }} />

          {contacts.map(contact => {
            const isOnline = onlineIds.has(contact.id);
            const dmRoom = getRoomId(currentUser.id, contact.id);
            const badge = unread[contact.id] || 0;
            const isActive = activeRoomId === dmRoom;
            return (
              <div
                key={contact.id}
                className={`chat-contact${isActive ? " active" : ""}`}
                onClick={() => setActiveRoomId(dmRoom)}
              >
                <div style={{ position: "relative" }}>
                  <Avatar size={36} ring={isActive ? contact.color : undefined} />
                  {badge > 0 && (
                    <span style={{
                      position: "absolute", top: -3, right: -3,
                      width: 15, height: 15, borderRadius: "50%",
                      background: "var(--c-asesmen)", color: "var(--bg-canvas)",
                      fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "var(--font-geist-mono), monospace", fontWeight: 700,
                      border: "1px solid var(--bg-nav)",
                    }}>{badge}</span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="chat-contact-name">{contact.name}</div>
                  <div className="chat-contact-role">{contact.role}</div>
                </div>
                {isOnline && <div className="online-dot" />}
              </div>
            );
          })}
        </div>

        {/* Main chat */}
        <div className="chat-main">
          {!activeRoomId ? (
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 16, opacity: 0.4,
            }}>
              <AvatarStack count={3} colors={USERS.map(u => u.color)} />
              <div style={{
                fontFamily: "var(--font-geist-mono), monospace", fontSize: 10,
                letterSpacing: "0.2em", color: "var(--text-muted)",
              }}>PILIH KONTAK ATAU GRUP UNTUK MEMULAI</div>
            </div>
          ) : (
            <>
              <div className="chat-header">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {activeIsGroup
                    ? <AvatarStack count={USERS.length} colors={USERS.map(u => u.color)} />
                    : <Avatar size={36} ring={activeContact?.color} />
                  }
                  <div>
                    <div className="chat-header-name">
                      {activeIsGroup ? "Semua Tim" : activeContact?.name}
                    </div>
                    <div className="chat-header-meta">
                      {activeIsGroup
                        ? `GROUP CHAT · ${USERS.length} ANGGOTA · ${onlineIds.size} ONLINE`
                        : (
                          <>
                            {activeContact?.role} &nbsp;·&nbsp;
                            {activeContact && onlineIds.has(activeContact.id)
                              ? <span style={{ color: "#4ADE80" }}>● ONLINE</span>
                              : <span>○ OFFLINE</span>
                            }
                          </>
                        )
                      }
                    </div>
                  </div>
                </div>
                <div style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 13, color: "var(--text-muted)", letterSpacing: "0.1em", textAlign: "right" }}>
                  ACARS<br />PUSKESMAS KEDIRI
                </div>
              </div>

              <div className="chat-messages">
                {currentMessages.length === 0 && (
                  <div style={{
                    textAlign: "center", color: "var(--text-muted)",
                    fontFamily: "var(--font-geist-mono), monospace", fontSize: 10,
                    opacity: 0.4, paddingTop: 40, letterSpacing: "0.1em",
                  }}>— BELUM ADA PESAN —</div>
                )}
                {currentMessages.map(msg => {
                  const isMe = msg.senderId === currentUser.id;
                  const senderUser = USERS.find(u => u.id === msg.senderId);
                  return (
                    <div key={msg.id} className={`chat-msg ${isMe ? "outgoing" : "incoming"}`}>
                      {!isMe && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <Avatar size={22} ring={senderUser?.color} />
                          <span className="chat-msg-meta" style={{ color: senderUser?.color }}>
                            {msg.senderName}
                          </span>
                          <span className="chat-msg-meta">· {msg.time}</span>
                        </div>
                      )}
                      {isMe && (
                        <div className="chat-msg-meta" style={{ textAlign: "right" }}>
                          {msg.senderName} · {msg.time}
                        </div>
                      )}
                      <div className="chat-bubble">{msg.text}</div>
                    </div>
                  );
                })}

                {currentTyping && (
                  <div className="chat-msg incoming">
                    <div className="chat-msg-meta">{currentTyping}</div>
                    <div className="chat-bubble" style={{ opacity: 0.5, fontStyle: "italic" }}>sedang mengetik...</div>
                  </div>
                )}
                <div ref={messagesEnd} />
              </div>

              <div className="chat-input-wrap">
                <textarea
                  className="chat-input"
                  placeholder={activeIsGroup ? "Kirim ke semua tim..." : `Pesan ke ${activeContact?.name}...`}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <button className="chat-send-btn" onClick={sendMessage}>KIRIM</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
