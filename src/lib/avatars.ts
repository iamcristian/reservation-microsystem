// src/lib/avatars.ts

export const DEFAULT_BUSINESS_LOGO = "/avatars/default-business.svg";

export const STAFF_AVATAR_PRESETS = [
  { id: "bot-blurple", label: "Cyber Bot", url: "/avatars/avatar-1.svg" },
  { id: "kitsune-orange", label: "Kitsune", url: "/avatars/avatar-2.svg" },
  { id: "astro-emerald", label: "Astro Cat", url: "/avatars/avatar-3.svg" },
  { id: "gamer-pink", label: "Neo Beat", url: "/avatars/avatar-4.svg" },
  { id: "mage-violet", label: "Night Owl", url: "/avatars/avatar-5.svg" },
  { id: "wolf-cyan", label: "Sky Wolf", url: "/avatars/avatar-6.svg" },
] as const;

export const DEFAULT_STAFF_AVATAR = STAFF_AVATAR_PRESETS[0].url;

export function getRandomStaffAvatar(excludeUrl?: string): string {
  const pool = excludeUrl
    ? STAFF_AVATAR_PRESETS.filter((a) => a.url !== excludeUrl)
    : STAFF_AVATAR_PRESETS;
  const pick =
    pool[Math.floor(Math.random() * pool.length)] || STAFF_AVATAR_PRESETS[0];
  return pick.url;
}
