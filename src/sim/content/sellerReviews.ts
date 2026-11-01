// Avaliações de vendedor por loja (Fase 4, S5). Conteúdo fixo, paródia, ligado ao risco real da
// loja (falsificado, atraso, fiscalização) sem revelar o número: a nota e os comentários contam a
// história; o risco de verdade continua em content/shops.ts e BALANCE.shop. A nota de uma loja
// mais arriscada nunca é maior que a de uma menos arriscada (testado em tests/sim/news.test.ts).

import { BALANCE } from "./balance";
import { LISTINGS, findShop } from "./shops";

export interface SellerComment {
  author: string;
  stars: number;
  text: string;
}

export interface SellerReview {
  /** Nota do vendedor, 0–5. */
  rating: number;
  /** Quantas avaliações a loja diz ter (só vitrine). */
  count: number;
  comments: SellerComment[];
}

export const SELLER_REVIEWS: Record<string, SellerReview> = {
  "hangar-aeromodelista": {
    rating: 4.8,
    count: 1240,
    comments: [
      { author: "EESC-UESP Alfa", stars: 5, text: "Chegou antes do prazo e a ficha bate com a bancada." },
      { author: "Keep Climbing", stars: 5, text: "Caro, mas a inspeção da CT passa sem dor de cabeça." },
      { author: "Monteverde", stars: 4, text: "Estoque curto. Compre cedo." }
    ]
  },
  "compositos-vale": {
    rating: 4.7,
    count: 530,
    comments: [
      { author: "Harpia-Real AeroDesign", stars: 5, text: "Tecido uniforme, entregue no prazo." },
      { author: "Nexus AeroDesign", stars: 5, text: "Resina fresca e embalagem de verdade." }
    ]
  },
  "balsa-leve": {
    rating: 4.6,
    count: 410,
    comments: [
      { author: "Atena AeroDesign", stars: 5, text: "Densidade conferida na balança, confere com o rótulo." },
      { author: "Apolo", stars: 4, text: "Demora um pouco mais na semana de provas, mas chega." }
    ]
  },
  mercadosolto: {
    rating: 4.1,
    count: 3820,
    comments: [
      { author: "Coxilha AeroDesign", stars: 4, text: "Vendedor respondeu rápido e mandou nota fiscal." },
      { author: "Losango Aéreo AeroDesign", stars: 4, text: "Depende do vendedor, mas aqui deu certo." },
      { author: "comprador_sp", stars: 2, text: "Veio com dois dias a mais do que o anúncio dizia." }
    ]
  },
  "desapega-aero": {
    rating: 3.7,
    count: 96,
    comments: [
      { author: "ex-capitão Carcarás", stars: 4, text: "Voou duas competições. Faz barulho, mas gira." },
      { author: "calouro_2025", stars: 3, text: "O desgaste era maior que a foto mostrava." },
      { author: "Pteranodon AeroDesign", stars: 3, text: "Vale pelo preço, mas teste antes de confiar." }
    ]
  },
  hobbykong: {
    rating: 3.5,
    count: 2210,
    comments: [
      { author: "Flaming Duck", stars: 3, text: "Produto bom, mas ficou dez dias parado na fiscalização." },
      { author: "AeroSerra", stars: 4, text: "Barato e funciona. Conte com a alfândega." },
      { author: "Hawks AeroDesign", stars: 2, text: "Prometeram 3 semanas, vieram 6." }
    ]
  },
  aliexpresso: {
    rating: 2.6,
    count: 15870,
    comments: [
      { author: "usuario_83921", stars: 5, text: "Ótimo produto recomendo." },
      { author: "Jacutinga AeroDesign", stars: 1, text: "Servo sem marca. A CT reprovou na inspeção." },
      { author: "Condores AeroDesign", stars: 1, text: "Dizia 600 W. Na bancada deu 470. E o prazo? Dois meses." }
    ]
  }
};

export function sellerReview(shopId: string): SellerReview | null {
  return SELLER_REVIEWS[shopId] ?? null;
}

/**
 * Risco real de comprar na loja (0 a ~1): falsificado, atraso e fiscalização. Só para ordenar e
 * testar o conteúdo acima; a UI nunca mostra este número.
 */
export function sellerRisk(shopId: string): number {
  const shop = findShop(shopId);
  if (!shop) return 0;
  const listings = LISTINGS.filter((item) => item.shopId === shopId);
  const counterfeit = Math.max(0, ...listings.map((item) => item.counterfeitChance));
  const customs = Math.max(0, ...listings.map((item) => item.customsChance));
  const lateness = BALANCE.shop.lateness[shop.origin] ?? 0;
  return counterfeit + lateness + customs * 0.5 + (shop.origin === "used" ? 0.05 : 0);
}
