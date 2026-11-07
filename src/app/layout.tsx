import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#1F1F23",
};

export const metadata: Metadata = {
  title: {
    default: "Clínica Dental Sonrisa | Reserva tu Cita en Línea • Cochabamba",
    template: "%s | Reservas en Línea",
  },
  description:
    "Agenda tu cita médica, dental o de estética en menos de 30 segundos. Horarios en tiempo real, confirmación inmediata y ubicación en Cochabamba, Bolivia.",
  keywords: [
    "reservas online cochabamba",
    "citas medicas bolivia",
    "clinica dental cochabamba",
    "agendar turno online",
    "sistema de citas pwa",
  ],
  authors: [{ name: "Clínica Dental Sonrisa" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Reservas",
  },
  openGraph: {
    type: "website",
    locale: "es_BO",
    title: "Clínica Dental Sonrisa — Reserva tu Cita en Segundos",
    description:
      "Elige tu servicio, especialista y horario disponible en tiempo real sin llamadas ni esperas.",
    siteName: "Clínica Dental Sonrisa",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clínica Dental Sonrisa | Reservas Online",
    description:
      "Agenda tu turno desde tu celular en segundos. Ubicación: Av. Simón López esq. Av. Beijing, Cochabamba.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    name: "Clínica Dental Sonrisa",
    description:
      "Clínica odontológica y centro de reservas rápidas en Cochabamba, Bolivia.",
    telephone: "+591-4-4450000",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Av. Simón López esq. Av. Beijing",
      addressLocality: "Cochabamba",
      addressCountry: "BO",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: -17.3713,
      longitude: -66.1742,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
        ],
        opens: "09:00",
        closes: "18:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Saturday",
        opens: "09:00",
        closes: "13:00",
      },
    ],
  };

  return (
    <html lang="es" className="h-full">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#EBEBEF] text-[#1F1F23] antialiased">
        {children}
      </body>
    </html>
  );
}
