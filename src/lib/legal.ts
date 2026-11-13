import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getSeoProfile } from "@/lib/seo";

export interface LegalContext {
  businessName: string;
  tagline: string;
  logoUrl: string | null;
  addressText: string;
  locality: string;
  countryCode: string;
  countryName: string;
  phoneWhatsapp: string;
  whatsappContactUrl: string;
  staffLabel: string;
  currencySymbol: string;
  currencyCode: string;
  isHealthDomain: boolean;
  bookingHorizonDays: number;
  minLeadTimeMinutes: number;
  maxActiveBookings: number;
  minCancelNoticeHours: number;
  updatedAtIso: string;
  updatedAtLabel: string;
}

const COUNTRY_NAMES: Record<string, string> = {
  BO: "Estado Plurinacional de Bolivia",
  MX: "Estados Unidos Mexicanos",
  AR: "República Argentina",
  CL: "República de Chile",
  PE: "República del Perú",
  CO: "República de Colombia",
  ES: "Reino de España",
};

function formatSpanishDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "Noviembre de 2026";
  }
  return parsed.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/La_Paz",
  });
}

/**
 * Loads business identity, contact info, and active booking policy limits for public legal pages.
 */
export const getLegalContext = cache(async (): Promise<LegalContext> => {
  const [seo, settings] = await Promise.all([
    getSeoProfile(),
    prisma.businessSettings.findFirst({ where: { id: 1 } }).catch(() => null),
  ]);

  const cleanDigits = seo.phoneWhatsapp.replace(/\D/g, "") || "59144450000";
  const whatsappText = encodeURIComponent(
    `Hola, me comunico con ${seo.businessName} respecto a información legal / privacidad / mi cuenta de reservas.`
  );
  const isHealthDomain = seo.schemaTypes.some((type) =>
    ["Dentist", "MedicalBusiness", "MedicalClinic"].includes(type)
  );

  return {
    businessName: seo.businessName,
    tagline: seo.tagline,
    logoUrl: seo.logoUrl,
    addressText: seo.addressText,
    locality: seo.locality,
    countryCode: seo.countryCode,
    countryName: COUNTRY_NAMES[seo.countryCode] || COUNTRY_NAMES.BO,
    phoneWhatsapp: seo.phoneWhatsapp,
    whatsappContactUrl: `https://wa.me/${cleanDigits}?text=${whatsappText}`,
    staffLabel: seo.staffLabel,
    currencySymbol: seo.currencySymbol,
    currencyCode: seo.currencyCode,
    isHealthDomain,
    bookingHorizonDays: settings?.bookingHorizonDays ?? 7,
    minLeadTimeMinutes: settings?.minLeadTimeMinutes ?? 30,
    maxActiveBookings: settings?.maxActiveBookings ?? 2,
    minCancelNoticeHours: settings?.minCancelNoticeHours ?? 6,
    updatedAtIso: seo.updatedAtIso,
    updatedAtLabel: formatSpanishDate(seo.updatedAtIso),
  };
});
