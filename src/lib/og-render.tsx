/* eslint-disable @next/next/no-img-element -- Satori ImageResponse requires standard <img> tags */
import { ImageResponse } from "next/og";
import {
  getBrandInitials,
  getSeoProfile,
  loadSatoriFonts,
  resolveSatoriImageDataUri,
} from "@/lib/seo";

export async function buildBrandIconResponse(
  size: number,
  options: { rounded?: boolean } = {}
) {
  const profile = await getSeoProfile().catch(() => null);
  const businessName = profile?.businessName || "Clínica & Reservas";
  const primaryHex = profile?.themePrimaryHex || "#1F1F23";
  const initials = getBrandInitials(businessName);
  const logoDataUri = await resolveSatoriImageDataUri(profile?.logoUrl);
  const fonts = await loadSatoriFonts();
  const isSmall = size <= 64;
  const radius = options.rounded === false ? 0 : Math.round(size * 0.24);
  const dotSize = Math.max(8, Math.round(size * 0.19));
  const dotOffset = Math.max(4, Math.round(size * 0.1));
  const dotBorder = Math.max(2, Math.round(size * 0.04));

  return new ImageResponse(
    (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: `${radius}px`,
          background: `linear-gradient(145deg, #27272A 0%, ${primaryHex} 55%, #111114 100%)`,
          position: "relative",
          fontFamily: "Plus Jakarta Sans",
        }}
      >
        {logoDataUri ? (
          <div
            style={{
              width: `${Math.round(size * 0.78)}px`,
              height: `${Math.round(size * 0.78)}px`,
              borderRadius: "9999px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              border: `${Math.max(2, Math.round(size * 0.04))}px solid rgba(255,255,255,0.88)`,
              background: "#FFFFFF",
            }}
          >
            <img
              src={logoDataUri}
              alt={businessName}
              width={Math.round(size * 0.78)}
              height={Math.round(size * 0.78)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontSize: Math.round(size * (initials.length > 2 ? 0.34 : 0.42)),
              fontWeight: 700,
              letterSpacing: "-0.03em",
            }}
          >
            {initials}
          </div>
        )}

        {/* Live online booking indicator dot */}
        <div
          style={{
            position: "absolute",
            right: `${dotOffset}px`,
            bottom: `${dotOffset}px`,
            width: `${dotSize}px`,
            height: `${dotSize}px`,
            borderRadius: "9999px",
            background: "#10B981",
            border: `${isSmall ? 2 : dotBorder}px solid #18181B`,
          }}
        />
      </div>
    ),
    {
      width: size,
      height: size,
      fonts: fonts.length ? fonts : undefined,
    }
  );
}

export async function buildOpenGraphResponse() {
  const profile = await getSeoProfile().catch(() => null);
  const businessName = profile?.businessName || "Clínica Dental";
  const tagline = profile?.tagline || "Reserva tu cita en línea en menos de 30 segundos";
  const addressText =
    profile?.addressText || "Av. Simón López esq. Av. Beijing, Cochabamba, Bolivia";
  const locality = profile?.locality || "Cochabamba";
  const staffLabel = profile?.staffLabel || "Doctor(a)";
  const currencySymbol = profile?.currencySymbol || "Bs";
  const primaryHex = profile?.themePrimaryHex || "#1F1F23";
  const services = profile?.services || [];
  const staffCount = profile?.staff?.length || 3;
  const initials = getBrandInitials(businessName);
  const logoDataUri = await resolveSatoriImageDataUri(profile?.logoUrl);
  const fonts = await loadSatoriFonts();

  const titleFontSize =
    businessName.length <= 18 ? 48 : businessName.length <= 28 ? 40 : 34;

  const MAX_OG_SERVICES = 6;
  const visibleServices = services.slice(0, MAX_OG_SERVICES);
  const extraServicesCount = Math.max(0, services.length - MAX_OG_SERVICES);
  const isDenseServices = visibleServices.length >= 5;
  const displayAddress =
    addressText.length > 58 ? `${addressText.slice(0, 57).trimEnd()}…` : addressText;
  const displayTagline =
    tagline.length > 74 ? `${tagline.slice(0, 73).trimEnd()}…` : tagline;

  const specialistSummary = (() => {
    const lower = staffLabel.toLowerCase();
    if (lower.includes("doctor")) {
      return `${staffCount} ${staffCount === 1 ? "doctor disponible" : "doctores disponibles"}`;
    }
    if (lower.includes("barber")) {
      return `${staffCount} ${staffCount === 1 ? "barbero disponible" : "barberos disponibles"}`;
    }
    return `${staffCount} ${staffCount === 1 ? "especialista disponible" : "especialistas disponibles"}`;
  })();

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "52px 56px",
          background: `linear-gradient(135deg, #141418 0%, ${primaryHex} 52%, #11181C 100%)`,
          color: "#FFFFFF",
          position: "relative",
          fontFamily: "Plus Jakarta Sans",
        }}
      >
        {/* Subtle decorative emerald glow orb (top-right) */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            right: "-90px",
            width: "460px",
            height: "460px",
            borderRadius: "9999px",
            background: "radial-gradient(circle, rgba(16,185,129,0.26) 0%, rgba(16,185,129,0) 70%)",
          }}
        />

        {/* Subtle decorative warm zinc glow orb (bottom-left) */}
        <div
          style={{
            position: "absolute",
            bottom: "-140px",
            left: "-100px",
            width: "420px",
            height: "420px",
            borderRadius: "9999px",
            background: "radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)",
          }}
        />

        {/* Top Bar: Live status + Locality */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "9px 18px",
              borderRadius: "9999px",
              background: "rgba(16,185,129,0.14)",
              border: "1px solid rgba(16,185,129,0.42)",
              fontSize: "15px",
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: "#6EE7B7",
            }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "9999px",
                background: "#10B981",
              }}
            />
            <span>RESERVAS EN LÍNEA • CONFIRMACIÓN INMEDIATA</span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 18px",
              borderRadius: "9999px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.16)",
              fontSize: "16px",
              fontWeight: 600,
              color: "#E4E4E7",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 21s-6-5.686-6-10a6 6 0 1 1 12 0c0 4.314-6 10-6 10Z"
                stroke="#10B981"
                strokeWidth="2.2"
              />
              <circle cx="12" cy="11" r="2.2" fill="#10B981" />
            </svg>
            <span>{locality}</span>
          </div>
        </div>

        {/* Main Content Split */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "44px",
            width: "100%",
          }}
        >
          {/* Left Hero Column */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              gap: "24px",
            }}
          >
            {/* Brand Logo + Title */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "24px",
              }}
            >
              <div
                style={{
                  width: "100px",
                  height: "100px",
                  borderRadius: "9999px",
                  border: "3px solid rgba(255,255,255,0.88)",
                  background: "#27272A",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                {logoDataUri ? (
                  <img
                    src={logoDataUri}
                    alt={businessName}
                    width={100}
                    height={100}
                    style={{
                      width: "100px",
                      height: "100px",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: "38px",
                      fontWeight: 700,
                      color: "#FFFFFF",
                    }}
                  >
                    {initials}
                  </span>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    fontSize: `${titleFontSize}px`,
                    fontWeight: 700,
                    lineHeight: 1.08,
                    letterSpacing: "-0.02em",
                    color: "#FFFFFF",
                  }}
                >
                  {businessName}
                </div>
                <div
                  style={{
                    fontSize: "21px",
                    fontWeight: 400,
                    lineHeight: 1.3,
                    color: "#D4D4D8",
                  }}
                >
                  {displayTagline}
                </div>
              </div>
            </div>

            {/* Active Services Strip */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: isDenseServices ? "8px" : "10px",
                alignItems: "center",
              }}
            >
              {visibleServices.length > 0 ? (
                visibleServices.map((svc) => {
                  const maxNameLen = isDenseServices ? 28 : 34;
                  return (
                    <div
                      key={svc.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: isDenseServices ? "8px" : "10px",
                        padding: isDenseServices ? "8px 14px" : "10px 16px",
                        borderRadius: "16px",
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.16)",
                        fontSize: isDenseServices ? "15px" : "16px",
                        fontWeight: 600,
                        color: "#F4F4F5",
                      }}
                    >
                      <span>
                        {svc.name.length > maxNameLen
                          ? `${svc.name.slice(0, maxNameLen - 1).trimEnd()}…`
                          : svc.name}
                      </span>
                      <span
                        style={{
                          color: "#34D399",
                          fontWeight: 700,
                        }}
                      >
                        {`${currencySymbol}${svc.price}`}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "10px 16px",
                    borderRadius: "16px",
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.16)",
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "#F4F4F5",
                  }}
                >
                  Horarios disponibles en tiempo real
                </div>
              )}
              {extraServicesCount > 0 && (
                <div
                  style={{
                    display: "flex",
                    padding: isDenseServices ? "8px 13px" : "10px 14px",
                    borderRadius: "16px",
                    background: "rgba(16,185,129,0.15)",
                    border: "1px solid rgba(16,185,129,0.3)",
                    fontSize: isDenseServices ? "14px" : "15px",
                    fontWeight: 700,
                    color: "#6EE7B7",
                  }}
                >
                  {`+${extraServicesCount} más`}
                </div>
              )}
            </div>
          </div>

          {/* Right Mini-Booking UI Preview Card */}
          <div
            style={{
              width: "355px",
              borderRadius: "28px",
              background: "#FFFFFF",
              color: "#18181B",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              border: "1px solid rgba(255,255,255,0.25)",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}
              >
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#71717A" }}>
                  AGENDA DIGITAL
                </span>
                <span style={{ fontSize: "19px", fontWeight: 700, color: "#18181B" }}>
                  Turnos en vivo
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "9999px",
                  background: "#ECFDF5",
                  color: "#047857",
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                <span>Abierto</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M20 6L9 17L4 12"
                    stroke="#047857"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 14px",
                borderRadius: "16px",
                background: "#F4F4F6",
                fontSize: "14px",
                fontWeight: 600,
                color: "#3F3F46",
              }}
            >
              <span>{specialistSummary}</span>
              <span style={{ color: "#059669", fontWeight: 700 }}>24/7</span>
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
              }}
            >
              <div
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: "14px",
                  background: "#18181B",
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                09:00
              </div>
              <div
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: "14px",
                  background: "#F4F4F6",
                  color: "#18181B",
                  fontSize: "14px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                10:30
              </div>
              <div
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: "14px",
                  background: "#F4F4F6",
                  color: "#18181B",
                  fontSize: "14px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                15:00
              </div>
            </div>

            <div
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: "9999px",
                background: "#18181B",
                color: "#FFFFFF",
                fontSize: "15px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <span>Reservar Cita Ahora</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 12H19M19 12L13 6M19 12L13 18"
                  stroke="#34D399"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Bottom Address & CTA Strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "18px",
            borderTop: "1px solid rgba(255,255,255,0.14)",
            fontSize: "16px",
            color: "#D4D4D8",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "#A1A1AA", fontWeight: 600 }}>Dirección:</span>
            <span style={{ color: "#FFFFFF", fontWeight: 600 }}>{displayAddress}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#34D399", fontWeight: 700 }}>
            <span>Sin llamadas ni esperas</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: fonts.length ? fonts : undefined,
    }
  );
}
