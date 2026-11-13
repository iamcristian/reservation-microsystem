import { buildBrandIconResponse } from "@/lib/og-render";

export const dynamic = "force-dynamic";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default async function AppleIcon() {
  return buildBrandIconResponse(180, { rounded: false });
}
