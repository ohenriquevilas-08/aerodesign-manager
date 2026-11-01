// Tom de cada loja (design §8.4: "logo, cores, tom do texto"). Só copy; dados ficam em sim/content/shops.ts.

export interface ShopVoice {
  /** Faixa de destaque no topo da vitrine. */
  banner: string;
  /** Botão de adicionar ao carrinho. */
  cta: string;
  /** Nome do carrinho. */
  cart: string;
  /** Botão de fechar o pedido. */
  checkout: string;
  emptyCart: string;
  /** Estoque curto (n unidades). */
  stockLow: (count: number) => string;
  soldOut: string;
  /** Sem limite de estoque. */
  inStock: string;
  /** Rótulo da faixa de prazo na vitrine. */
  lead: string;
  reviews: string;
}

const DEFAULT_VOICE: ShopVoice = {
  banner: "",
  cta: "Adicionar ao carrinho",
  cart: "Carrinho",
  checkout: "Fechar pedido",
  emptyCart: "Carrinho vazio.",
  stockLow: (count) => `${count} em estoque`,
  soldOut: "Esgotado",
  inStock: "Em estoque",
  lead: "Chega em",
  reviews: "Avaliações"
};

export const SHOP_VOICE: Record<string, ShopVoice> = {
  hobbykong: {
    banner: "FLASH DEALS TODO DIA!!! FRETE DIRETO DE HONG KONG",
    cta: "BUY NOW!!",
    cart: "Cart",
    checkout: "CHECKOUT!!",
    emptyCart: "Your cart is empty. Kong is sad.",
    stockLow: (count) => `ONLY ${count} LEFT!!`,
    soldOut: "SOLD OUT",
    inStock: "In stock (global warehouse)",
    lead: "Envio internacional:",
    reviews: "Reviews"
  },
  aliexpresso: {
    banner: "SUPER OFERTA · Frete grátis · Mais de 10 mil vendidos no mundo",
    cta: "Comprar agora",
    cart: "Carrinho",
    checkout: "Pagar agora",
    emptyCart: "Seu carrinho está vazio. Que tal um servo por ◆ 90?",
    stockLow: (count) => `Restam ${count}`,
    soldOut: "Indisponível",
    inStock: "Disponível",
    lead: "Entrega estimada:",
    reviews: "Avaliações de compradores"
  },
  mercadosolto: {
    banner: "Vendedores do Brasil todo. Chega rapidinho.",
    cta: "Adicionar ao carrinho",
    cart: "Carrinho",
    checkout: "Continuar a compra",
    emptyCart: "Seu carrinho está vazio.",
    stockLow: (count) => `Estoque disponível: ${count}`,
    soldOut: "Sem estoque no momento",
    inStock: "Estoque disponível",
    lead: "Chega entre",
    reviews: "Opiniões sobre o produto"
  },
  "hangar-aeromodelista": {
    banner: "Peças originais, com nota fiscal e garantia. Atendimento por quem voa.",
    cta: "Incluir no pedido",
    cart: "Seu pedido",
    checkout: "Finalizar pedido",
    emptyCart: "Nenhum item no pedido.",
    stockLow: (count) => `${count} ${count === 1 ? "unidade" : "unidades"} na loja`,
    soldOut: "Aguardando reposição",
    inStock: "Pronta entrega",
    lead: "Despacho e entrega:",
    reviews: "Depoimentos de equipes"
  },
  "balsa-leve": {
    banner: "Lâminas selecionadas uma a uma, por densidade. Madeira certa para cada peça.",
    cta: "Separar lote",
    cart: "Lotes separados",
    checkout: "Fechar encomenda",
    emptyCart: "Nenhum lote separado.",
    stockLow: (count) => `${count} ${count === 1 ? "lote" : "lotes"} secos no galpão`,
    soldOut: "Secando: volta em breve",
    inStock: "Lotes no galpão",
    lead: "Entrega em",
    reviews: "Quem já cortou"
  },
  "compositos-vale": {
    banner: "FIBRA DE CARBONO · FIBRA DE VIDRO · RESINAS EPÓXI",
    cta: "Adicionar",
    cart: "Orçamento",
    checkout: "Confirmar orçamento",
    emptyCart: "Orçamento vazio.",
    stockLow: (count) => `${count} em estoque`,
    soldOut: "Sob encomenda",
    inStock: "Em estoque",
    lead: "Prazo:",
    reviews: "Referências"
  },
  "desapega-aero": {
    banner: "Peças de equipes que se formaram. Negocie direto com quem voou.",
    cta: "Eu quero!",
    cart: "Combinados",
    checkout: "Combinar retirada",
    emptyCart: "Nada combinado ainda.",
    stockLow: () => "Peça única",
    soldOut: "Vendido",
    inStock: "Disponível",
    lead: "Retirada em",
    reviews: "O que o vendedor diz"
  }
};

export function voiceOf(shopId: string): ShopVoice {
  return SHOP_VOICE[shopId] ?? DEFAULT_VOICE;
}
