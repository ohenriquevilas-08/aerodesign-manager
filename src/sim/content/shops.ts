// Lojas do navegador do jogo (design §8.4). Paródias de onde as equipes reais compram.
// Valores são provisórios: o balanceamento acontece no protótipo.
// A identidade visual de cada loja (cores, logo) mora na UI; aqui só dados.

import type { PartType, ShippingMode } from "../types";
import type { EquipmentItem, StockItem } from "./actions";

export type ShopOrigin = "national" | "import" | "used";

export interface ShippingOption {
  label: string;
  /** Créditos ◆ do frete, por pedido. */
  credits: number;
  /** Multiplica o prazo do anúncio (expresso < 1). */
  leadFactor: number;
}

export interface ShopDef {
  id: string;
  name: string;
  /** Endereço mostrado na barra do navegador. */
  domain: string;
  tagline: string;
  origin: ShopOrigin;
  /** null = a loja não oferece essa modalidade. */
  shipping: Record<ShippingMode, ShippingOption | null>;
  /** Imposto cobrado na fiscalização, como fração do valor do pedido, quando taxado. */
  customsRate: number;
}

/** O que o produto vira ao chegar. */
export type ProductGrant =
  | { kind: "part"; part: PartType; label: string }
  | { kind: "stock"; item: StockItem; amount: number }
  | { kind: "equipment"; item: EquipmentItem };

export interface ProductDef {
  id: string;
  label: string;
  /** Linha técnica curta para a vitrine. */
  spec: string;
  grant: ProductGrant;
}

export interface Review {
  /** Equipe paródia ou apelido de usuário. */
  author: string;
  stars: number;
  text: string;
}

/** Um produto à venda numa loja. Id do anúncio: listingId(shopId, productId). */
export interface Listing {
  shopId: string;
  productId: string;
  price: number;
  /** Prazo prometido na vitrine, dias. O real é sorteado e pode passar do máximo. */
  leadDays: { min: number; max: number };
  /** Qualidade de origem da peça (0–100): média e variação ±. */
  quality: { mean: number; spread: number };
  /** Chance de o pedido ser retido na fiscalização (importados). */
  customsChance: number;
  /** Chance de vir fora da especificação (ex.: servo falsificado reprova na inspeção, §9.2). */
  counterfeitChance: number;
  /** Peça usada: condição sorteada nesta faixa; null = nova. */
  usedCondition: { min: number; max: number } | null;
  /** Estoque inicial; null = sem limite. */
  initialStock: number | null;
  /** Média das avaliações, 0–5. */
  rating: number;
  reviews: Review[];
}

export const SHOPS: readonly ShopDef[] = [
  {
    id: "hobbykong",
    name: "HobbyKong",
    domain: "hobbykong.hk",
    tagline: "Motores, baterias e hélices direto de Hong Kong",
    origin: "import",
    shipping: {
      standard: { label: "Correio internacional", credits: 40, leadFactor: 1 },
      express: { label: "Courier expresso", credits: 160, leadFactor: 0.5 }
    },
    customsRate: 0.6
  },
  {
    id: "aliexpresso",
    name: "AliExpresso",
    domain: "aliexpresso.com",
    tagline: "Tudo. Barato. Um dia chega.",
    origin: "import",
    shipping: {
      standard: { label: "Frete grátis", credits: 0, leadFactor: 1 },
      express: null
    },
    customsRate: 0.6
  },
  {
    id: "mercadosolto",
    name: "Mercado Solto",
    domain: "mercadosolto.com.br",
    tagline: "Vendedores do Brasil todo",
    origin: "national",
    shipping: {
      standard: { label: "Envio normal", credits: 25, leadFactor: 1 },
      express: { label: "Chega amanhã", credits: 70, leadFactor: 0.35 }
    },
    customsRate: 0
  },
  {
    id: "hangar-aeromodelista",
    name: "Hangar do Aeromodelista",
    domain: "hangardoaeromodelista.com.br",
    tagline: "Originais, com nota e garantia",
    origin: "national",
    shipping: {
      standard: { label: "Transportadora", credits: 35, leadFactor: 1 },
      express: { label: "Sedex", credits: 80, leadFactor: 0.5 }
    },
    customsRate: 0
  },
  {
    id: "balsa-leve",
    name: "Balsa Leve Madeiras",
    domain: "balsaleve.com.br",
    tagline: "Lâminas e blocos selecionados por densidade",
    origin: "national",
    shipping: {
      standard: { label: "Transportadora", credits: 30, leadFactor: 1 },
      express: { label: "Expresso", credits: 90, leadFactor: 0.5 }
    },
    customsRate: 0
  },
  {
    id: "compositos-vale",
    name: "Compósitos do Vale",
    domain: "compositosdovale.com.br",
    tagline: "Fibras e resinas para quem leva peso a sério",
    origin: "national",
    shipping: {
      standard: { label: "Transportadora", credits: 40, leadFactor: 1 },
      express: { label: "Expresso", credits: 110, leadFactor: 0.5 }
    },
    customsRate: 0
  },
  {
    id: "desapega-aero",
    name: "Desapega Aero",
    domain: "desapega.aero",
    tagline: "Peças de quem já se formou",
    origin: "used",
    shipping: {
      standard: { label: "Retirada com o vendedor", credits: 0, leadFactor: 1 },
      express: null
    },
    customsRate: 0
  }
];

export const PRODUCTS: readonly ProductDef[] = [
  { id: "motor-600", label: "Motor 600 W", spec: "Brushless outrunner, 600 W de pico", grant: { kind: "part", part: "powertrain", label: "Motor 600 W" } },
  { id: "motor-450", label: "Motor 450 W", spec: "Brushless outrunner, 450 W de pico, mais leve", grant: { kind: "part", part: "powertrain", label: "Motor 450 W" } },
  { id: "servos", label: "Kit de servos comerciais", spec: "4 servos digitais, engrenagem metálica", grant: { kind: "part", part: "electronics", label: "Servos comerciais" } },
  { id: "balsa-light", label: "Balsa leve (lote)", spec: "Densidade 80–110 kg/m³", grant: { kind: "stock", item: "balsa-light", amount: 1 } },
  { id: "balsa", label: "Balsa média (lote)", spec: "Densidade 120–160 kg/m³", grant: { kind: "stock", item: "balsa", amount: 1 } },
  { id: "balsa-hard", label: "Balsa dura (lote)", spec: "Densidade 170–220 kg/m³", grant: { kind: "stock", item: "balsa-hard", amount: 1 } },
  { id: "carbon-fiber", label: "Fibra de carbono (rolo)", spec: "Tecido 200 g/m², 1 m²", grant: { kind: "stock", item: "carbon-fiber", amount: 1 } },
  { id: "resin", label: "Resina epóxi (kit)", spec: "1 kg + endurecedor; validade curta depois de aberta", grant: { kind: "stock", item: "resin", amount: 1 } },
  { id: "scale", label: "Balança de precisão", spec: "Até 30 kg, resolução de 1 g", grant: { kind: "equipment", item: "scale" } },
  { id: "thrust-stand", label: "Bancada de tração", spec: "Mede tração, corrente e potência do grupo motopropulsor", grant: { kind: "equipment", item: "thrust-stand" } }
];

const listing = (
  shopId: string,
  productId: string,
  price: number,
  lead: [number, number],
  quality: [number, number],
  extra: Partial<Pick<Listing, "customsChance" | "counterfeitChance" | "usedCondition" | "initialStock">>,
  rating: number,
  reviews: Review[]
): Listing => ({
  shopId,
  productId,
  price,
  leadDays: { min: lead[0], max: lead[1] },
  quality: { mean: quality[0], spread: quality[1] },
  customsChance: extra.customsChance ?? 0,
  counterfeitChance: extra.counterfeitChance ?? 0,
  usedCondition: extra.usedCondition ?? null,
  initialStock: extra.initialStock ?? null,
  rating,
  reviews
});

export const LISTINGS: readonly Listing[] = [
  // HobbyKong: barato, longe, pode ser taxado.
  listing("hobbykong", "motor-600", 300, [15, 30], [70, 10], { customsChance: 0.35 }, 4.2, [
    { author: "Tucanuçu", stars: 5, text: "Chegou em 3 semanas, potência bate com a bancada." },
    { author: "Flaming Duck", stars: 3, text: "Ficou 10 dias na fiscalização. Motor bom." }
  ]),
  listing("hobbykong", "motor-450", 240, [15, 30], [70, 10], { customsChance: 0.35 }, 4.0, [
    { author: "Hawks AeroDesign", stars: 4, text: "Leve e honesto. Pena o prazo." }
  ]),
  listing("hobbykong", "servos", 170, [15, 30], [65, 12], { customsChance: 0.35 }, 3.9, [
    { author: "AeroSerra", stars: 4, text: "Um dos quatro veio com folga na engrenagem." }
  ]),
  // AliExpresso: muito barato, muito longe, loteria.
  listing("aliexpresso", "motor-600", 220, [25, 50], [55, 25], { customsChance: 0.25, counterfeitChance: 0.15 }, 3.4, [
    { author: "usuario_83921", stars: 5, text: "Ótimo produto recomendo." },
    { author: "Condores AeroDesign", stars: 1, text: "Dizia 600 W. Na bancada deu 470." }
  ]),
  listing("aliexpresso", "servos", 90, [25, 50], [45, 25], { customsChance: 0.25, counterfeitChance: 0.3 }, 3.1, [
    { author: "Jacutinga AeroDesign", stars: 2, text: "Servo sem marca. A CT reprovou na inspeção." },
    { author: "comprador_bh", stars: 4, text: "Pelo preço tá ótimo." }
  ]),
  listing("aliexpresso", "carbon-fiber", 120, [25, 50], [50, 20], { customsChance: 0.25 }, 3.6, [
    { author: "Pteranodon AeroDesign", stars: 3, text: "Gramatura não bate, mas dá pra usar em reforço." }
  ]),
  // Mercado Solto: nacional, depende do vendedor.
  listing("mercadosolto", "motor-600", 380, [5, 10], [65, 15], { initialStock: 3 }, 4.1, [
    { author: "Losango Aéreo AeroDesign", stars: 4, text: "Vendedor respondeu rápido, nota fiscal ok." }
  ]),
  listing("mercadosolto", "servos", 230, [4, 9], [62, 15], { initialStock: 5 }, 4.0, [
    { author: "Coxilha AeroDesign", stars: 4, text: "Originais, caixa lacrada." }
  ]),
  listing("mercadosolto", "scale", 160, [4, 8], [70, 10], {}, 4.3, [
    { author: "IVoa AeroDesign", stars: 5, text: "Calibrada de fábrica, salvou nosso peso vazio." }
  ]),
  // Hangar do Aeromodelista: caro, rápido, confiável, estoque curto.
  listing("hangar-aeromodelista", "motor-600", 480, [3, 6], [85, 5], { initialStock: 2 }, 4.8, [
    { author: "EESC-UESP Alfa", stars: 5, text: "Compramos aqui há anos. Nunca falhou." }
  ]),
  listing("hangar-aeromodelista", "motor-450", 400, [3, 6], [85, 5], { initialStock: 2 }, 4.7, [
    { author: "Monteverde", stars: 5, text: "Exatamente o que diz a ficha." }
  ]),
  listing("hangar-aeromodelista", "servos", 290, [3, 5], [85, 5], { initialStock: 4 }, 4.8, [
    { author: "Keep Climbing", stars: 5, text: "Servo com certificado. Inspeção sem dor de cabeça." }
  ]),
  listing("hangar-aeromodelista", "scale", 200, [3, 5], [85, 5], {}, 4.6, []),
  listing("hangar-aeromodelista", "thrust-stand", 520, [5, 8], [85, 5], { initialStock: 1 }, 4.9, [
    { author: "Uai, Sô! Voa!!! AeroDesign", stars: 5, text: "Sem bancada a gente chutava a potência. Nunca mais." }
  ]),
  // Balsa Leve Madeiras.
  listing("balsa-leve", "balsa-light", 220, [5, 9], [75, 10], { initialStock: 4 }, 4.6, [
    { author: "Atena AeroDesign", stars: 5, text: "Leve de verdade. Cuidado ao lixar." }
  ]),
  listing("balsa-leve", "balsa", 150, [5, 9], [75, 10], {}, 4.5, []),
  listing("balsa-leve", "balsa-hard", 140, [5, 9], [75, 10], {}, 4.4, [
    { author: "Apolo", stars: 4, text: "Boa para longarina e trem." }
  ]),
  // Compósitos do Vale.
  listing("compositos-vale", "carbon-fiber", 260, [6, 10], [85, 5], {}, 4.7, [
    { author: "Harpia-Real AeroDesign", stars: 5, text: "Tecido uniforme, sem fio solto." }
  ]),
  listing("compositos-vale", "resin", 110, [6, 10], [85, 5], {}, 4.5, [
    { author: "Nexus AeroDesign", stars: 4, text: "Ótima, mas abriu tem que usar logo." }
  ]),
  // Desapega Aero: usado, barato, condição incerta.
  listing("desapega-aero", "motor-600", 160, [2, 4], [65, 15], { usedCondition: { min: 30, max: 90 }, initialStock: 1 }, 3.8, [
    { author: "ex-capitão Carcarás", stars: 4, text: "Voou duas competições. Rolamento faz barulho, mas gira." }
  ]),
  listing("desapega-aero", "servos", 80, [2, 4], [60, 15], { usedCondition: { min: 20, max: 85 }, initialStock: 1 }, 3.5, []),
  listing("desapega-aero", "scale", 70, [2, 4], [70, 10], { usedCondition: { min: 50, max: 95 }, initialStock: 1 }, 4.0, [])
];

export function listingId(shopId: string, productId: string): string {
  return `${shopId}:${productId}`;
}

export function findShop(id: string): ShopDef | undefined {
  return SHOPS.find((shop) => shop.id === id);
}

export function findProduct(id: string): ProductDef | undefined {
  return PRODUCTS.find((product) => product.id === id);
}

export function findListing(shopId: string, productId: string): Listing | undefined {
  return LISTINGS.find((item) => item.shopId === shopId && item.productId === productId);
}
