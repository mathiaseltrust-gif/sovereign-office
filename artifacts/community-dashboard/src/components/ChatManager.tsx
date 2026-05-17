import React, { createContext, useCallback, useContext, useState } from "react";
import { MessageSquare } from "lucide-react";
import { ChatBox } from "./ChatBox";
import { useMessaging } from "@/hooks/useMessaging";

interface OpenChat {
  recipientId: number;
  recipientName: string;
  threadId?: number;
}

interface ChatManagerCtx {
  openChat: (recipientId: number, recipientName: string, threadId?: number) => void;
  totalUnread: number;
}

const ChatManagerContext = createContext<ChatManagerCtx>({
  openChat: () => undefined,
  totalUnread: 0,
});

export function useChatManager() {
  return useContext(ChatManagerContext);
}

const MAX_OPEN = 3;

interface Props {
  currentUserId: number | null;
  token: string | null;
  children: React.ReactNode;
}

export function ChatManagerProvider({ currentUserId, token, children }: Props) {
  const messaging = useMessaging(token);
  const [openChats, setOpenChats] = useState<OpenChat[]>([]);
  const [tray, setTray] = useState<OpenChat[]>([]);
  const [boxUnreads, setBoxUnreads] = useState<Record<number, number>>({});
  const [trayOpen, setTrayOpen] = useState(false);

  const openChat = useCallback((recipientId: number, recipientName: string, threadId?: number) => {
    setOpenChats((prev) => {
      if (prev.find((c) => c.recipientId === recipientId)) return prev;
      if (prev.length >= MAX_OPEN) {
        const overflow = prev[0];
        setTray((t) => (t.find((x) => x.recipientId === overflow.recipientId) ? t : [...t, overflow]));
        return [...prev.slice(1), { recipientId, recipientName, threadId }];
      }
      return [...prev, { recipientId, recipientName, threadId }];
    });
  }, []);

  const closeChat = useCallback((recipientId: number) => {
    setOpenChats((prev) => prev.filter((c) => c.recipientId !== recipientId));
    setBoxUnreads((prev) => {
      const next = { ...prev };
      delete next[recipientId];
      return next;
    });
  }, []);

  const openFromTray = useCallback((chat: OpenChat) => {
    setTray((prev) => prev.filter((c) => c.recipientId !== chat.recipientId));
    openChat(chat.recipientId, chat.recipientName, chat.threadId);
    setTrayOpen(false);
  }, [openChat]);

  const totalUnread = messaging.totalUnread;

  if (!currentUserId || !token) {
    return (
      <ChatManagerContext.Provider value={{ openChat: () => undefined, totalUnread: 0 }}>
        {children}
      </ChatManagerContext.Provider>
    );
  }

  return (
    <ChatManagerContext.Provider value={{ openChat, totalUnread }}>
      {children}

      {/* Floating chat boxes stacked from bottom-right */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          right: 12,
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 8,
          zIndex: 9000,
          pointerEvents: "none",
        }}
      >
        {/* Tray button (appears when chats are pushed out) */}
        {tray.length > 0 && (
          <div style={{ pointerEvents: "all", position: "relative" }}>
            <button
              onClick={() => setTrayOpen((v) => !v)}
              style={{
                background: "#1a3a2a",
                color: "#fff",
                border: "none",
                borderRadius: "12px 12px 0 0",
                padding: "8px 14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <MessageSquare size={14} />
              +{tray.length} more
            </button>
            {trayOpen && (
              <div
                style={{
                  position: "absolute",
                  bottom: "100%",
                  right: 0,
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                  minWidth: 180,
                  overflow: "hidden",
                }}
              >
                {tray.map((chat) => (
                  <button
                    key={chat.recipientId}
                    onClick={() => openFromTray(chat)}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "8px 14px",
                      background: "none",
                      border: "none",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: 13,
                      borderBottom: "1px solid #f3f4f6",
                    }}
                  >
                    {chat.recipientName}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {openChats.map((chat) => (
          <div key={chat.recipientId} style={{ pointerEvents: "all" }}>
            <ChatBox
              recipientId={chat.recipientId}
              recipientName={chat.recipientName}
              currentUserId={currentUserId}
              messaging={messaging}
              threadId={chat.threadId}
              onClose={() => closeChat(chat.recipientId)}
              onUnreadChange={(count) =>
                setBoxUnreads((prev) => ({ ...prev, [chat.recipientId]: count }))
              }
            />
          </div>
        ))}
      </div>
    </ChatManagerContext.Provider>
  );
}
