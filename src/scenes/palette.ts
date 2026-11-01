// Espelho de src/styles/tokens.css para as cenas Phaser (que não leem CSS).
// O comentário de cada linha diz de qual token o valor vem.
export const palette = {
  bg: 0x08121c, // --bg
  bgGrid: 0x0d1c2a, // --bg-grid
  panel: 0x102233, // --panel
  panelRaised: 0x15304a, // --panel-raised
  border: 0x1f4762, // --border
  borderStrong: 0x2b6585, // --border-strong
  floor: 0x0f2232,
  floorLine: 0x1f4762, // --border
  bench: 0x15304a, // --panel-raised
  benchTop: 0x2b6585, // --border-strong
  accent: 0x22c7e6, // --accent
  highlight: 0xff9f2e, // --highlight
  ok: 0x3fd18b, // --ok
  warn: 0xffc23d, // --warn
  danger: 0xff5a5f, // --danger
  blueprint: 0x0d3a66, // --blueprint
  blueprintGrid: 0x1b5588, // --blueprint-grid
  night: 0x03070d, // --night
  lamp: 0xffd98a, // --lamp
  /** --text como número, para Graphics. */
  ink: 0xe4f0f7,
  /** --text-muted como número, para Graphics. */
  inkMuted: 0x8ba7bb,
  /** --text-dim como número, para Graphics. */
  inkDim: 0x5b7489,
  text: "#e4f0f7", // --text
  textMuted: "#8ba7bb", // --text-muted
  textDim: "#5b7489" // --text-dim
} as const;

/** Converte uma cor numérica da paleta em "#rrggbb" para estilos de Text. */
export function css(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** Escurece uma cor da paleta (0 = igual, 1 = preto), para as faces laterais de volumes isométricos. */
export function shade(color: number, amount: number): number {
  const k = 1 - amount;
  const r = Math.round(((color >> 16) & 0xff) * k);
  const g = Math.round(((color >> 8) & 0xff) * k);
  const b = Math.round((color & 0xff) * k);
  return (r << 16) | (g << 8) | b;
}

// Espelho de --font-display, --font-body e --font-mono.
export const fonts = {
  display: "Barlow Condensed",
  body: "Inter",
  mono: "JetBrains Mono"
} as const;
