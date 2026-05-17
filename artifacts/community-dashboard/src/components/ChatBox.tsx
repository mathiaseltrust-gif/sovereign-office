import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, Minus, Send, Pencil, Trash2, Check } from "lucide-react";
import type { DirectMessage } from "@/hooks/useMessaging";
import type { useMessaging } from "@/hooks/useMessaging";

interface Props {
  recipientId: number;
  recipientName: string;
  currentUserId: number;
  messaging: ReturnType<typeof useMessaging>;
  threadId?: number;
  onClose: () => void;
  onUnreadChange?: (count: number) => void;
}

export function ChatBox({
  recipientId,
  recipientName,
  currentUserId,
  messaging,
  threadId: initialThreadId,
  onClose,
  onUnreadChange,
}: Props) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [input, setInput] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [threadId, setThreadId] = useState<number | undefined>(initialThreadId);
  const [unreadIds, setUnreadIds] = useState<Set<number>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadMessages = useCallback(async (tid: number) => {
    const msgs = await messaging.fetchThread(tid);
    setMessages(msgs);
    const newUnread = new Set<number>();
    for (const m of msgs) {
      if (m.recipientId === currentUserId && !m.readAt && !m.deletedAt) {
        newUnread.add(m.id);
      }
    }
    setUnreadIds(newUnread);
    onUnreadChange?.(newUnread.size);
  }, [messaging, currentUserId, onUnreadChange]);

  useEffect(() => {
    if (threadId) {
      void loadMessages(threadId);
    }
  }, [threadId, loadMessages]);

  useEffect(() => {
    const unregister = messaging.onEvent((e) => {
      if (
        (e.type === "new_message" || e.type === "message_edited") &&
        (e.threadId === threadId ||
          (e.type === "new_message" &&
            ((e.message.senderId === recipientId && e.message.recipientId === currentUserId) ||
              (e.message.senderId === currentUserId && e.message.recipientId === recipientId))))
      ) {
        if (!threadId && e.type === "new_message") {
          setThreadId(e.threadId);
        }
        void (threadId || e.threadId ? loadMessages(threadId ?? e.threadId) : Promise.resolve());
      }
      if (e.type === "message_deleted" && e.threadId === threadId) {
        setMessages((prev) => prev.filter((m) => m.id !== e.messageId));
      }
      if (e.type === "message_read" && e.threadId === threadId) {
        setMessages((prev) =>
          prev.map((m) => (m.id === e.messageId ? { ...m, readAt: new Date().toISOString() } : m)),
        );
      }
    });
    return unregister;
  }, [messaging, threadId, recipientId, currentUserId, loadMessages]);

  useEffect(() => {
    if (!collapsed) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, collapsed]);

  useEffect(() => {
    if (collapsed) return;
    const ids = [...unreadIds];
    if (ids.length === 0) return;
    const timer = setTimeout(async () => {
      for (const id of ids) {
        await messaging.markRead(id);
      }
      setUnreadIds(new Set());
      onUnreadChange?.(0);
    }, 800);
    return () => clearTimeout(timer);
  }, [collapsed, unreadIds, messaging, onUnreadChange]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const result = await messaging.sendMessage(recipientId, text);
      setThreadId(result.thread.id);
      setInput("");
      await loadMessages(result.thread.id);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const startEdit = (msg: DirectMessage) => {
    setEditingId(msg.id);
    setEditContent(msg.content);
  };

  const submitEdit = async () => {
    if (!editingId) return;
    try {
      await messaging.editMessage(editingId, editContent);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === editingId
            ? { ...m, content: editContent, editedAt: new Date().toISOString() }
            : m,
        ),
      );
    } finally {
      setEditingId(null);
      setEditContent("");
    }
  };

  const unsend = async (msg: DirectMessage) => {
    await messaging.deleteMessage(msg.id);
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const initials = recipientName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      style={{
        width: 320,
        display: "flex",
        flexDirection: "column",
        borderRadius: "12px 12px 0 0",
        overflow: "hidden",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.08)",
        background: "#fff",
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          background: "#1a3a2a",
          color: "#fff",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          userSelect: "none",
          flexShrink: 0,
        }}
        onClick={() => setCollapsed((v) => !v)}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "#2d5a3d",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <span style={{ flex: 1, fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {recipientName}
        </span>
        {unreadIds.size > 0 && (
          <span
            style={{
              background: "#dc2626",
              color: "#fff",
              borderRadius: "99px",
              padding: "1px 6px",
              fontSize: 10,
              fontWeight: 700,
              minWidth: 16,
              textAlign: "center",
            }}
          >
            {unreadIds.size}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); setCollapsed((v) => !v); }}
          style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 2, opacity: 0.8, display: "flex" }}
          title={collapsed ? "Expand" : "Collapse"}
        >
          <Minus size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 2, opacity: 0.8, display: "flex" }}
          title="Close"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body — hidden when collapsed */}
      {!collapsed && (
        <>
          {/* Messages */}
          <div
            style={{
              flex: 1,
              height: 340,
              overflowY: "auto",
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              background: "#f8f7f4",
            }}
          >
            {messages.length === 0 && (
              <div style={{ textAlign: "center", color: "#9ca3af", paddingTop: 60, fontSize: 12 }}>
                No messages yet. Say hello!
              </div>
            )}
            {messages.map((msg) => {
              const isMine = msg.senderId === currentUserId;
              const isUnread = unreadIds.has(msg.id);
              const canEdit = isMine && !msg.readAt;

              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isMine ? "flex-end" : "flex-start",
                  }}
                >
                  {editingId === msg.id ? (
                    <div style={{ width: "85%", display: "flex", gap: 4 }}>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={2}
                        style={{
                          flex: 1,
                          padding: "4px 8px",
                          borderRadius: 8,
                          border: "1px solid #d1d5db",
                          fontSize: 12,
                          resize: "none",
                          fontFamily: "inherit",
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void submitEdit();
                          }
                          if (e.key === "Escape") {
                            setEditingId(null);
                          }
                        }}
                        autoFocus
                      />
                      <button
                        onClick={() => void submitEdit()}
                        style={{ background: "#1a3a2a", color: "#fff", border: "none", borderRadius: 6, padding: "0 8px", cursor: "pointer", display: "flex", alignItems: "center" }}
                      >
                        <Check size={13} />
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        maxWidth: "85%",
                        background: isMine ? "#1a3a2a" : "#fff",
                        color: isMine ? "#fff" : "#111",
                        borderRadius: isMine ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                        padding: "6px 10px",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.07)",
                        border: isUnread && !isMine ? "1.5px solid #2563eb" : "1.5px solid transparent",
                        wordBreak: "break-word",
                      }}
                    >
                      <div style={{ lineHeight: 1.45 }}>{msg.content}</div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          marginTop: 2,
                          justifyContent: isMine ? "flex-end" : "flex-start",
                        }}
                      >
                        <span style={{ fontSize: 9, opacity: 0.6 }}>{formatTime(msg.createdAt)}</span>
                        {msg.editedAt && <span style={{ fontSize: 9, opacity: 0.5, fontStyle: "italic" }}>(edited)</span>}
                        {isMine && msg.readAt && <Check size={10} style={{ opacity: 0.6 }} />}
                      </div>
                    </div>
                  )}
                  {/* Unsend / Edit actions */}
                  {canEdit && editingId !== msg.id && (
                    <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                      <button
                        onClick={() => startEdit(msg)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 10, display: "flex", alignItems: "center", gap: 2, padding: "1px 4px", borderRadius: 4 }}
                      >
                        <Pencil size={10} /> Edit
                      </button>
                      <button
                        onClick={() => void unsend(msg)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 10, display: "flex", alignItems: "center", gap: 2, padding: "1px 4px", borderRadius: 4 }}
                      >
                        <Trash2 size={10} /> Unsend
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            style={{
              padding: "8px 10px",
              borderTop: "1px solid #e5e7eb",
              display: "flex",
              gap: 6,
              background: "#fff",
              flexShrink: 0,
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              rows={1}
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: 20,
                border: "1px solid #d1d5db",
                fontSize: 13,
                resize: "none",
                fontFamily: "inherit",
                lineHeight: 1.4,
                outline: "none",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              onClick={() => void send()}
              disabled={sending || !input.trim()}
              style={{
                background: sending || !input.trim() ? "#e5e7eb" : "#1a3a2a",
                color: sending || !input.trim() ? "#9ca3af" : "#fff",
                border: "none",
                borderRadius: "50%",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: sending || !input.trim() ? "default" : "pointer",
                flexShrink: 0,
                alignSelf: "flex-end",
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
