// Logos das lojas paródia (design §8.4): marca em SVG + palavra em CSS. Cores vêm dos tokens
// --shop-* pela classe .shop-logo[data-shop] (ver phase3.css); aqui só forma.

/** Só o símbolo, para a aba do navegador e listas. */
export function ShopMark({ shopId, size = 28 }: { shopId: string; size?: number }) {
  return (
    <svg class="shop-mark" data-shop={shopId} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      {MARKS[shopId] ?? <circle cx="16" cy="16" r="14" class="mk-brand" />}
    </svg>
  );
}

/** Símbolo + nome com a tipografia da loja. */
export function ShopLogo({ shopId, size = 40 }: { shopId: string; size?: number }) {
  return (
    <span class="shop-logo" data-shop={shopId}>
      <ShopMark shopId={shopId} size={size} />
      {WORDMARKS[shopId] ?? null}
    </span>
  );
}

const MARKS: Record<string, preact.JSX.Element> = {
  // Coroa sobre o "HK": a gorila das importações.
  hobbykong: (
    <>
      <rect x="2" y="6" width="28" height="24" rx="6" class="mk-brand" />
      <path d="M7 9 L10 2 L13 7 L16 1 L19 7 L22 2 L25 9 Z" class="mk-cta" />
      <text x="16" y="25" text-anchor="middle" class="mk-text mk-on-brand">
        HK
      </text>
    </>
  ),
  // Xícara de espresso com vapor.
  aliexpresso: (
    <>
      <rect x="1" y="1" width="30" height="30" rx="8" class="mk-brand" />
      <path d="M8 14 H21 V19 A6 6 0 0 1 15 25 H14 A6 6 0 0 1 8 19 Z" class="mk-on-brand" />
      <path d="M21 15 H23 A3 3 0 0 1 23 21 H20.5" class="mk-stroke-on-brand" />
      <path d="M12 11 C11 9 13 8 12 6 M16 11 C15 9 17 8 16 6" class="mk-stroke-cta" />
    </>
  ),
  // Pipa solta no vento, no lugar do aperto de mão.
  mercadosolto: (
    <>
      <ellipse cx="16" cy="16" rx="15" ry="12" class="mk-brand" />
      <path d="M16 6 L22 14 L16 22 L10 14 Z" class="mk-on-brand" />
      <path d="M16 22 C14 25 18 26 15 30" class="mk-stroke-on-brand" />
    </>
  ),
  // Arco de hangar com um aviãozinho dourado.
  "hangar-aeromodelista": (
    <>
      <path d="M2 29 V17 A14 13 0 0 1 30 17 V29 Z" class="mk-brand" />
      <path d="M9 29 V21 H23 V29" class="mk-stroke-on-brand" />
      <path d="M8 14 L24 14 M16 9 L16 18 M13 18 L19 18" class="mk-stroke-cta" />
    </>
  ),
  // Anéis de crescimento da madeira.
  "balsa-leve": (
    <>
      <circle cx="16" cy="16" r="15" class="mk-brand" />
      <ellipse cx="15" cy="17" rx="10" ry="9" class="mk-stroke-on-brand" />
      <ellipse cx="14.5" cy="17.5" rx="6" ry="5.5" class="mk-stroke-on-brand" />
      <ellipse cx="14" cy="18" rx="2" ry="1.8" class="mk-on-brand" />
    </>
  ),
  // Hexágono com trama de fibra.
  "compositos-vale": (
    <>
      <path d="M16 1 L29 8.5 V23.5 L16 31 L3 23.5 V8.5 Z" class="mk-brand mk-outline-cta" />
      <path d="M8 12 L24 20 M8 20 L24 12 M10 9 L22 23 M10 23 L22 9" class="mk-stroke-cta mk-thin" />
    </>
  ),
  // Etiqueta de preço com o "d".
  "desapega-aero": (
    <>
      <path d="M4 8 A4 4 0 0 1 8 4 H18 L29 15 A2 2 0 0 1 29 17.8 L17.8 29 A2 2 0 0 1 15 29 L4 18 Z" class="mk-brand" />
      <circle cx="10" cy="10" r="2" class="mk-cta" />
      <text x="17" y="22" text-anchor="middle" class="mk-text mk-on-brand">
        d
      </text>
    </>
  )
};

const WORDMARKS: Record<string, preact.JSX.Element> = {
  hobbykong: (
    <span class="wm wm-hobbykong">
      Hobby<b>Kong</b>
    </span>
  ),
  aliexpresso: (
    <span class="wm wm-aliexpresso">
      Ali<b>Expresso</b>
    </span>
  ),
  mercadosolto: (
    <span class="wm wm-mercadosolto">
      mercado
      <b>solto</b>
    </span>
  ),
  "hangar-aeromodelista": (
    <span class="wm wm-hangar">
      <b>Hangar do Aeromodelista</b>
      <small>desde 1987</small>
    </span>
  ),
  "balsa-leve": (
    <span class="wm wm-balsa">
      <b>Balsa Leve</b>
      <small>MADEIRAS</small>
    </span>
  ),
  "compositos-vale": (
    <span class="wm wm-compositos">
      <b>COMPÓSITOS</b>
      <small>DO VALE</small>
    </span>
  ),
  "desapega-aero": (
    <span class="wm wm-desapega">
      desapega<b>.aero</b>
    </span>
  )
};
