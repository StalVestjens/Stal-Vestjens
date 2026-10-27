import { getSettings } from "./settings";

/** Standaard huisstijl (Stal Vestjens); alles is te overschrijven bij Instellingen › Bedrijf. */
export const BRAND_DEFAULTS = {
  naam: "Stal Vestjens",
  accent: "#0f2980",
  zijbalk: "#0f2980",
};

export type Branding = { naam: string; accent: string; zijbalk: string; zijbalkInk: string; zijbalkMuted: string; accentDonker: string; logoUrl: string };

const hex = (s: string) => (/^#[0-9a-f]{6}$/i.test(s.trim()) ? s.trim().toLowerCase() : "");
const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] as const;
const luminance = (h: string) => { const [r, g, b] = rgb(h).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const shade = (h: string, f: number) => "#" + rgb(h).map((v) => Math.max(0, Math.min(255, Math.round(v * f)))).map((v) => v.toString(16).padStart(2, "0")).join("");
const mix = (h: string, white: number) => "#" + rgb(h).map((v) => Math.round(v + (255 - v) * white)).map((v) => v.toString(16).padStart(2, "0")).join("");

export async function getBranding(): Promise<Branding> {
  const s = await getSettings(["bedrijfsnaam", "kleur_accent", "kleur_zijbalk", "logo_key"]);
  const naam = s.bedrijfsnaam || BRAND_DEFAULTS.naam;
  const accent = hex(s.kleur_accent) || BRAND_DEFAULTS.accent;
  const zijbalk = hex(s.kleur_zijbalk) || accent;
  const donker = luminance(zijbalk) < 0.4;
  return {
    naam,
    accent,
    accentDonker: shade(accent, 0.8),
    zijbalk,
    zijbalkInk: donker ? "#ffffff" : "#1f2a24",
    zijbalkMuted: donker ? mix(zijbalk, 0.6) : shade(zijbalk, 0.45),
    logoUrl: s.logo_key ? "/api/logo?v=" + encodeURIComponent(s.logo_key.slice(-12)) : "/logo.jpg",
  };
}

export const brandingCss = (b: Branding) =>
  `:root{--accent:${b.accent};--accent-dark:${b.accentDonker};--sidebar:${b.zijbalk};--sidebar-ink:${b.zijbalkInk};--sidebar-muted:${b.zijbalkMuted};}`;
