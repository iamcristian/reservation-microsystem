import { redirect } from "next/navigation";
import { HomeClient } from "@/components/HomeClient";
import { getBootstrapPayload } from "@/lib/bootstrap";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser().catch(() => null);
  if (user?.role === "PROVIDER") {
    redirect("/admin");
  }

  let serializedPublicBootstrap = null;
  try {
    const publicPayload = await getBootstrapPayload({ publicOnly: true });
    serializedPublicBootstrap = JSON.parse(JSON.stringify(publicPayload));
  } catch (err) {
    console.error("SSR public bootstrap fallback:", err);
  }

  return <HomeClient initialData={serializedPublicBootstrap} />;
}
