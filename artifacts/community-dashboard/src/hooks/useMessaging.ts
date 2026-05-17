import { useCallback, useEffect, useRef, useState } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface DirectMessage {
  id: number;
  threadId: number;
  senderId: number;
  recipientId: number;
  content: string;
  readAt: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface MessageThread {
  id: number;
  participantAId: number;
  participantBId: number;
  createdAt: string;
  lastMessageAt: string;
  otherUser: { id: number; name: string; email: string } | null;
  lastMessage: DirectMessage | null;
  unreadCount: number;
}

type SseEvent =
  | { type: "new_message"; message: DirectMessage; threadId: number }
  | { type: "message_edited"; message: DirectMessage; threadId: number }
  | { type: "message_deleted"; messageId: number; threadId: number }
  | { type: "message_read"; messageId: number; threadId: number };

interface UseMessagingReturn {
  threads: MessageThread[];
  totalUnread: number;
  sendMessage: (recipientId: number, content: string) => Promise<{ message: DirectMessage; thread: MessageThread }>;
  editMessage: (messageId: number, content: string) => Promise<void>;
  deleteMessage: (messageId: number) => Promise<void>;
  markRead: (messageId: number) => Promise<void>;
  fetchThread: (threadId: number) => Promise<DirectMessage[]>;
  onEvent: (handler: (e: SseEvent) => void) => () => void;
  refreshThreads: () => void;
}

export function useMessaging(token: string | null): UseMessagingReturn {
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const eventHandlers = useRef<Set<(e: SseEvent) => void>>(new Set());
  const sseRef = useRef<EventSource | null>(null);

  const headers = useCallback(
    (): HeadersInit => (token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" }),
    [token],
  );

  const loadThreads = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${BASE}/api/messages/threads`, { headers: headers() });
      if (!res.ok) return;
      const data = await res.json() as MessageThread[];
      setThreads(data);
    } catch { /* ignore */ }
  }, [token, headers]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (!token) return;

    const connect = () => {
      const url = new URL(`${BASE}/api/messages/sse`, window.location.origin);
      url.searchParams.set("authorization", `Bearer ${token}`);
      const es = new EventSource(url.toString());
      sseRef.current = es;

      const handleEvent = (raw: MessageEvent) => {
        try {
          const event = JSON.parse(raw.data as string) as SseEvent;
          for (const h of eventHandlers.current) h(event);
          void loadThreads();
        } catch { /* ignore */ }
      };

      es.addEventListener("new_message", handleEvent);
      es.addEventListener("message_edited", handleEvent);
      es.addEventListener("message_deleted", handleEvent);
      es.addEventListener("message_read", handleEvent);

      es.onerror = () => {
        es.close();
        setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      sseRef.current?.close();
    };
  }, [token, loadThreads]);

  const totalUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);

  const sendMessage = useCallback(
    async (recipientId: number, content: string) => {
      const res = await fetch(`${BASE}/api/messages`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ recipientId, content }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to send" })) as { error: string };
        throw new Error(err.error);
      }
      const data = await res.json() as { message: DirectMessage; thread: MessageThread };
      await loadThreads();
      return data;
    },
    [headers, loadThreads],
  );

  const editMessage = useCallback(
    async (messageId: number, content: string) => {
      const res = await fetch(`${BASE}/api/messages/${messageId}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to edit" })) as { error: string };
        throw new Error(err.error);
      }
    },
    [headers],
  );

  const deleteMessage = useCallback(
    async (messageId: number) => {
      const res = await fetch(`${BASE}/api/messages/${messageId}`, {
        method: "DELETE",
        headers: headers(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to delete" })) as { error: string };
        throw new Error(err.error);
      }
    },
    [headers],
  );

  const markRead = useCallback(
    async (messageId: number) => {
      await fetch(`${BASE}/api/messages/${messageId}/read`, {
        method: "POST",
        headers: headers(),
      });
    },
    [headers],
  );

  const fetchThread = useCallback(
    async (threadId: number): Promise<DirectMessage[]> => {
      const res = await fetch(`${BASE}/api/messages/threads/${threadId}`, { headers: headers() });
      if (!res.ok) return [];
      return res.json() as Promise<DirectMessage[]>;
    },
    [headers],
  );

  const onEvent = useCallback((handler: (e: SseEvent) => void) => {
    eventHandlers.current.add(handler);
    return () => eventHandlers.current.delete(handler);
  }, []);

  return { threads, totalUnread, sendMessage, editMessage, deleteMessage, markRead, fetchThread, onEvent, refreshThreads: loadThreads };
}
