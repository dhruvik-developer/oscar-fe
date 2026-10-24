// Custom branding: an admin-uploaded logo plus a brand colour (detected from
// the logo or picked by hand). Kept in localStorage so the login screen can
// show it before anyone signs in.

const BRANDING_KEY = "evenmore_branding";
const LOGO_MAX_PX = 256;

// CSS variables the brand colour overrides. Removed again on reset so the
// active theme's own values come back.
const BRAND_VARS = [
  "--primary",
  "--primary-dark",
  "--primary-hover",
  "--primary-subtle",
  "--sidebar-bg-from",
  "--sidebar-bg-to",
  "--sidebar-active-bg",
  "--sidebar-border",
  "--brand-primary",
  "--brand-primary-dark",
  "--brand-accent",
  "--brand-active-bg",
  "--brand-glow",
  "--brand-tint",
];

export const EMPTY_BRANDING = { logo: "", color: "", name: "" };

export function loadBranding() {
  try {
    const saved = JSON.parse(localStorage.getItem(BRANDING_KEY) || "null");
    if (saved && typeof saved === "object") return { ...EMPTY_BRANDING, ...saved };
  } catch {}
  return { ...EMPTY_BRANDING };
}

export function saveBranding(branding) {
  try {
    if (!branding.logo && !branding.color && !branding.name) {
      localStorage.removeItem(BRANDING_KEY);
    } else {
      localStorage.setItem(BRANDING_KEY, JSON.stringify(branding));
    }
  } catch {}
}

// ── Colour helpers ─────────────────────────────────────────────
function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }) {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex({ r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 });
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// WCAG relative luminance (0 = black, 1 = white).
function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lin = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function isValidHex(hex) {
  return Boolean(hexToRgb(hex));
}

/**
 * Derive the full theme palette from one brand colour. Lightness is clamped
 * so white button text stays readable even for a pale logo colour.
 */
export function buildBrandPalette(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const { h, s, l } = rgbToHsl(rgb);
  // Greys stay grey instead of being pushed into a (meaningless) hue.
  const sat = s < 10 ? s : clamp(s, 35, 90);
  let light = clamp(l, 34, 52);
  // Bright hues (yellow, lime) need extra darkening for white text.
  while (luminance(hslToHex(h, sat, light)) > 0.3 && light > 22) light -= 2;
  const primary = hslToHex(h, sat, light);
  const dark = hslToHex(h, sat, light - 12);
  const hover = hslToHex(h, sat, light - 7);
  const accent = hslToHex(h, s < 10 ? s : clamp(sat + 5, 40, 95), clamp(light + 14, 50, 68));
  const sideSat = Math.min(sat, 55);
  return {
    "--primary": primary,
    "--primary-dark": dark,
    "--primary-hover": hover,
    "--primary-subtle": rgba(primary, 0.14),
    "--sidebar-bg-from": hslToHex(h, sideSat, 17),
    "--sidebar-bg-to": hslToHex(h, sideSat, 9),
    "--sidebar-active-bg": `linear-gradient(90deg, ${primary} 0%, ${dark} 100%)`,
    "--sidebar-border": rgba(accent, 0.14),
    "--brand-primary": primary,
    "--brand-primary-dark": dark,
    "--brand-accent": accent,
    "--brand-active-bg": `linear-gradient(90deg, ${rgba(primary, 0.9)} 0%, ${rgba(dark, 0.9)} 100%)`,
    "--brand-glow": rgba(primary, 0.35),
    "--brand-tint": rgba(accent, 0.14),
  };
}

// ── Image helpers ──────────────────────────────────────────────
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read this image."));
    img.src = src;
  });
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read this file."));
    reader.readAsDataURL(file);
  });
}

/** Shrink the logo to at most 256px so it fits comfortably in localStorage. */
export async function normalizeLogo(dataUrl) {
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth || LOGO_MAX_PX;
  const h = img.naturalHeight || LOGO_MAX_PX;
  const scale = Math.min(1, LOGO_MAX_PX / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

/**
 * Most common vivid colour in the logo. Transparent, near-white, near-black
 * and grey pixels are skipped; returns "" when the logo has no real colour.
 */
export async function extractDominantColor(dataUrl) {
  const img = await loadImage(dataUrl);
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;
    const { s, l } = rgbToHsl({ r, g, b });
    if (l > 92 || l < 8 || s < 18) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0, weight: 0 };
    bucket.r += r; bucket.g += g; bucket.b += b; bucket.n += 1;
    bucket.weight += 1 + s / 100;
    buckets.set(key, bucket);
  }

  let best = null;
  for (const bucket of buckets.values()) {
    if (!best || bucket.weight > best.weight) best = bucket;
  }
  if (!best) return "";
  return rgbToHex({ r: best.r / best.n, g: best.g / best.n, b: best.b / best.n });
}

// ── Applying to the page ───────────────────────────────────────
let defaultFavicon = null;

function applyFavicon(logo) {
  const link = document.querySelector("link[rel='icon']");
  if (!link) return;
  if (defaultFavicon === null) defaultFavicon = { href: link.href, type: link.type };
  if (logo) {
    link.type = "image/png";
    link.href = logo;
  } else {
    link.type = defaultFavicon.type;
    link.href = defaultFavicon.href;
  }
}

export function applyBranding(branding) {
  const root = document.documentElement;
  BRAND_VARS.forEach((v) => root.style.removeProperty(v));
  const palette = branding?.color ? buildBrandPalette(branding.color) : null;
  if (palette) {
    Object.entries(palette).forEach(([k, v]) => root.style.setProperty(k, v));
  }
  applyFavicon(branding?.logo || "");
}
