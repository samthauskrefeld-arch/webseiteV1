"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Subscribes to a conversation via apps/realtime (WebSocket). Falls back to polling
 * every 5 s when the realtime server is not reachable. `onEvent` triggers a refetch.
 */
export function useConversationEvents(conversationId: string, onEvent: () => void) {
  const [mode, setMode] = useState<"ws" | "polling">("polling");
  const cb = useRef(onEvent);
  cb.current = onEvent;
  useEffect(() => {
    let ws: WebSocket | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let closed = false;
    const startPolling = () => {
      setMode("polling");
      if (!poll) poll = setInterval(() => cb.current(), 5000);
    };
    const url = process.env.NEXT_PUBLIC_REALTIME_URL;
    if (url) {
      try {
        ws = new WebSocket(`${url}?conversation=${encodeURIComponent(conversationId)}`);
        ws.onopen = () => {
          setMode("ws");
          if (poll) {
            clearInterval(poll);
            poll = null;
          }
        };
        ws.onmessage = () => cb.current();
        ws.onclose = () => !closed && startPolling();
        ws.onerror = () => startPolling();
      } catch {
        startPolling();
      }
    } else startPolling();
    return () => {
      closed = true;
      ws?.close();
      if (poll) clearInterval(poll);
    };
  }, [conversationId]);
  return mode;
}
