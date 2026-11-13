// src/app/api/events/route.ts
import {
  RealtimeEventPayload,
  subscribeRealtimeEvents,
} from "@/lib/realtime-events";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const encoder = new TextEncoder();

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
          if (cleanup) cleanup();
        }
      };

      const sendEvent = (payload: RealtimeEventPayload) => {
        safeEnqueue(`data: ${JSON.stringify(payload)}\n\n`);
      };

      sendEvent({ type: "CONNECTED", timestamp: Date.now() });

      const unsubscribe = subscribeRealtimeEvents(sendEvent);
      const keepalive = setInterval(() => {
        safeEnqueue(": keepalive\n\n");
      }, 20000);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepalive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Stream already closed by client abort
        }
      };

      req.signal.addEventListener("abort", () => {
        if (cleanup) cleanup();
      });
    },
    cancel() {
      if (cleanup) cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
