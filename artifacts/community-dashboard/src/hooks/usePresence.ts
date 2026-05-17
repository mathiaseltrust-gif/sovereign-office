import { useEffect, useRef, useState } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function heartbeat(token: string): Promise<void> {
  try {
    await fetch(`${BASE}/api/messages/presence/heartbeat`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch { /* ignore */ }
}

async function fetchOnlineIds(token: string): Promise<number[]> {
  try {
    const res = await fetch(`${BASE}/api/messages/presence`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json() as { onlineIds: number[] };
    return data.onlineIds ?? [];
  } catch {
    return [];
  }
}

export function usePresence(token: string | null): Set<number> {
  const [onlineIds, setOnlineIds] = useState<Set<number>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) return;

    void heartbeat(token);
    void fetchOnlineIds(token).then((ids) => setOnlineIds(new Set(ids)));

    intervalRef.current = setInterval(async () => {
      await heartbeat(token);
      const ids = await fetchOnlineIds(token);
      setOnlineIds(new Set(ids));
    }, 30000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [token]);

  return onlineIds;
}
