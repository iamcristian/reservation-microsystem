import type { Metadata } from "next";
import { getSeoProfile } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoProfile();

  return {
    title: "Panel de Profesionales y Administración",
    description: `Gestión interna de agenda, horarios y servicios de ${seo.businessName}.`,
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  };
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
