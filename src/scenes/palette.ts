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
  /** Cenários dos locais de ensaio (céu, chão e construções), espelhados em --venue-*. */
  venueClubTop: 0x1a4a6e, // --venue-club-top
  venueClubBottom: 0x5a98b8, // --venue-club-bottom
  venueStripTop: 0x244a5a, // --venue-strip-top
  venueStripBottom: 0x7fa89a, // --venue-strip-bottom
  venueFarmTop: 0x3a3550, // --venue-farm-top
  venueFarmBottom: 0xc98a5a, // --venue-farm-bottom
  venueGrass: 0x1d4a3a, // --venue-grass
  venueSoil: 0x4a3c2a, // --venue-soil
  venueWall: 0x6a7f8f, // --venue-wall
  venueRoof: 0x3b4a58, // --venue-roof
  venueBarn: 0x8a3a35, // --venue-barn
  venueTrunk: 0x3a2a1c, // --venue-trunk
  venueLeaves: 0x1f5a3a, // --venue-leaves
  /** Tons de pele e de cabelo dos bonecos (MemberLook), espelhados em --skin-N e --hair-N. */
  skin: [0xffdcbd, 0xf0b48a, 0xd08b5b, 0xa66a3f, 0x7a4a2b, 0x52301c],
  hair: [0x1c1410, 0x4a2c17, 0x8a5a2b, 0xd2a45a, 0xb5472b, 0x9aa5ad],
  /** Roupa e acabamento do boneco, espelhados em --avatar-pants e --avatar-shoe. */
  pants: 0x1f4762, // --avatar-pants (igual a --border)
  shoe: 0x08121c, // --avatar-shoe (igual a --bg)
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
