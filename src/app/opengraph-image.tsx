import { buildOpenGraphResponse } from "@/lib/og-render";

export const dynamic = "force-dynamic";

export const alt = "Reserva tu cita en línea en tiempo real";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function OpenGraphImage() {
  return buildOpenGraphResponse();
}
