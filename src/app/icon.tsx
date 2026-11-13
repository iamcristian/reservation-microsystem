import { buildBrandIconResponse } from "@/lib/og-render";

export const dynamic = "force-dynamic";

export function generateImageMetadata() {
  return [
    {
      id: "48",
      size: { width: 48, height: 48 },
      contentType: "image/png",
    },
    {
      id: "96",
      size: { width: 96, height: 96 },
      contentType: "image/png",
    },
    {
      id: "192",
      size: { width: 192, height: 192 },
      contentType: "image/png",
    },
    {
      id: "512",
      size: { width: 512, height: 512 },
      contentType: "image/png",
    },
  ];
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const rawId = Number(await id);
  const size = [48, 96, 192, 512].includes(rawId) ? rawId : 96;
  return buildBrandIconResponse(size, { rounded: true });
}
