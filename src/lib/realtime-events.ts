// src/lib/realtime-events.ts
import { EventEmitter } from "node:events";

export type RealtimeEventType =
  | "CONNECTED"
  | "APPOINTMENT_CREATED"
  | "APPOINTMENT_CANCELLED"
  | "APPOINTMENT_UPDATED"
  | "SCHEDULE_UPDATED";

export interface RealtimeEventPayload {
  type: RealtimeEventType;
  appointmentId?: string;
  staffId?: string;
  customerName?: string;
  serviceName?: string;
  startAt?: string;
  status?: string;
  cancelledBy?: "STAFF" | "CUSTOMER";
  timestamp?: number;
}

const globalForRealtime = globalThis as unknown as {
  realtimeEmitter?: EventEmitter;
};

function getEmitter(): EventEmitter {
  if (!globalForRealtime.realtimeEmitter) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(200);
    globalForRealtime.realtimeEmitter = emitter;
  }
  return globalForRealtime.realtimeEmitter;
}

const CHANNEL = "reservas:realtime";

export function emitRealtimeEvent(payload: RealtimeEventPayload): void {
  const emitter = getEmitter();
  emitter.emit(CHANNEL, {
    ...payload,
    timestamp: payload.timestamp ?? Date.now(),
  });
}

export function subscribeRealtimeEvents(
  listener: (payload: RealtimeEventPayload) => void
): () => void {
  const emitter = getEmitter();
  emitter.on(CHANNEL, listener);
  return () => {
    emitter.off(CHANNEL, listener);
  };
}
