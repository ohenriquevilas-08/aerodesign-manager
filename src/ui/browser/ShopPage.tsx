import { store } from "../../app/store";
import { useGame } from "../../app/useGame";
import {
  clockToDate,
  formatCountdown,
  findProduct,
  sellerReview,
  LISTINGS,
  listingId,
  listingPrice,
  listingStock,
  type Listing,
  type ShippingMode,
  type ShopDef
} from "../../sim";
import { CostTag } from "../components/CostTag";
import { formatNumber, RISK_LABEL } from "../format";
import { useDerived } from "../hooks";
import { canAdd, cartSummary, changeQuantity, listingRisk, listingRiskNotes, rangeText, shippedLead, type Cart } from "./cart";
import { ShopLogo } from "./ShopLogo";
import { voiceOf } from "./voice";

const ORIGIN_LABEL: Record<ShopDef["origin"], string> = {
  national: "Loja nacional",
  import: "Importação",
  used: "Usados"
};

interface Shelf {
  productId: string;
  price: number | null;
  stock: number | null;
  /** Fim da promoção ativa (horas de jogo); null sem promoção. */
  saleUntil: number | null;
}

/** Vitrine + carrinho de uma loja (design §8.4). */
export function ShopPage({
  shop,
  cart,
  shipping,
  onCart,
  onShipping,
  onOrdered
}: {
  shop: ShopDef;
  cart: Cart;
  shipping: ShippingMode;
  onCart: (cart: Cart) => void;
  onShipping: (mode: ShippingMode) => void;
  onOrdered: () => void;
}) {
  const listings = LISTINGS.filter((item) => item.shopId === shop.id);
  const shelf = useDerived(
    (state): Shelf[] =>
      listings.map((item) => {
        const price = listingPrice(state, shop.id, item.productId);
        const sale = state.shops.sales[listingId(shop.id, item.productId)];
        return {
          productId: item.productId,
          price,
          stock: listingStock(state, shop.id, item.productId),
          saleUntil: sale && price !== null && price < item.price ? sale.until : null
        };
      }),
    [shop.id]
  );
  const voice = voiceOf(shop.id);

  return (
    <div class="shop" data-shop={shop.id}>
      <header class="shop-header">
        <ShopLogo shopId={shop.id} />
        <div class="shop-search" aria-hidden="true">
          Buscar em {shop.name}…
        </div>
        <span class="shop-origin">{ORIGIN_LABEL[shop.origin]}</span>
      </header>
      <SellerReviews shopId={shop.id} />
      <div class="shop-banner">
        <strong>{voice.banner}</strong>
        <span>{shop.tagline}</span>
      </div>
      <div class="shop-body">
        <div class="shop-grid">
          {listings.map((item, i) => (
            <ProductCard
              key={item.productId}
              listing={item}
              shop={shop}
              shelf={shelf[i]!}
              inCart={cart[item.productId] ?? 0}
              onAdd={() => onCart(changeQuantity(cart, item.productId, 1, shelf[i]!.stock))}
            />
          ))}
        </div>
        <CartPanel
          shop={shop}
          listings={listings}
          shelf={shelf}
          cart={cart}
          shipping={shipping}
          onCart={onCart}
          onShipping={onShipping}
          onOrdered={onOrdered}
        />
      </div>
    </div>
  );
}

function ProductCard({
  listing,
  shop,
  shelf,
  inCart,
  onAdd
}: {
  listing: Listing;
  shop: ShopDef;
  shelf: Shelf;
  inCart: number;
  onAdd: () => void;
}) {
  const product = findProduct(listing.productId)!;
  const voice = voiceOf(shop.id);
  const now = useGame((state) => Math.floor(state.clock.hours));
  const soldOut = shelf.stock === 0;
  const risk = listingRisk(listing);
  const standard = shippedLead(listing.leadDays, shop.shipping.standard?.leadFactor ?? 1);
  const express = shop.shipping.express ? shippedLead(listing.leadDays, shop.shipping.express.leadFactor) : null;

  return (
    <article class={`product${soldOut ? " is-sold-out" : ""}`}>
      <div class="product-photo" data-kind={product.grant.kind} aria-hidden="true">
        <ProductIcon productId={product.id} />
        {shelf.saleUntil !== null ? <span class="product-flag">Promoção</span> : null}
        {listing.usedCondition ? <span class="product-flag is-used">Usado</span> : null}
      </div>
      <div class="product-info">
        <h3 class="product-name">{product.label}</h3>
        <p class="product-spec">{product.spec}</p>
        <Stars rating={listing.rating} count={listing.reviews.length} />
        <div class="product-price">
          {shelf.saleUntil !== null ? <s>◆ {formatNumber(listing.price)}</s> : null}
          <strong>◆ {shelf.price === null ? "—" : formatNumber(shelf.price)}</strong>
        </div>
        {shelf.saleUntil !== null ? (
          <p class="product-sale">Termina em {formatCountdown(now, clockToDate(shelf.saleUntil))}</p>
        ) : null}
        <p class="product-stock">
          {soldOut ? voice.soldOut : shelf.stock === null ? voice.inStock : voice.stockLow(shelf.stock)}
        </p>
        <p class="product-lead">
          ⌛ {voice.lead} {rangeText(standard)}
          {express ? <span> · expresso {rangeText(express)}</span> : null}
        </p>
        <div class={`product-risk risk-${risk}`}>
          <span class="product-risk-level">⚠ Risco {RISK_LABEL[risk]}</span>
          <ul>
            {listingRiskNotes(listing, shop).map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
        {listing.reviews.length > 0 ? (
          <details class="product-reviews">
            <summary>
              {voice.reviews} ({listing.reviews.length})
            </summary>
            {listing.reviews.map((review) => (
              <blockquote key={review.author + review.text}>
                <Stars rating={review.stars} />
                <p>“{review.text}”</p>
                <cite>{review.author}</cite>
              </blockquote>
            ))}
          </details>
        ) : null}
        <button type="button" class="shop-cta" disabled={soldOut || !canAdd({ [listing.productId]: inCart }, listing.productId, shelf.stock)} onClick={onAdd}>
          {voice.cta}
          {inCart > 0 ? <span class="shop-cta-count">{inCart}</span> : null}
        </button>
      </div>
    </article>
  );
}

function CartPanel({
  shop,
  listings,
  shelf,
  cart,
  shipping,
  onCart,
  onShipping,
  onOrdered
}: {
  shop: ShopDef;
  listings: Listing[];
  shelf: Shelf[];
  cart: Cart;
  shipping: ShippingMode;
  onCart: (cart: Cart) => void;
  onShipping: (mode: ShippingMode) => void;
  onOrdered: () => void;
}) {
  const credits = useGame((state) => state.credits);
  const voice = voiceOf(shop.id);
  const mode = shop.shipping[shipping] ? shipping : "standard";
  const lines = listings
    .map((listing, i) => ({ listing, quantity: cart[listing.productId] ?? 0, unitPrice: shelf[i]!.price ?? listing.price, stock: shelf[i]!.stock }))
    .filter((line) => line.quantity > 0);
  const summary = cartSummary(shop, lines, mode);
  const short = summary.total > credits;

  const checkout = () => {
    const before = store.getState().orders.length;
    store.dispatch({
      type: "place-order",
      shopId: shop.id,
      lines: lines.map((line) => ({ productId: line.listing.productId, quantity: line.quantity })),
      shipping: mode
    });
    if (store.getState().orders.length > before) onOrdered();
  };

  return (
    <aside class="shop-cart" aria-label={voice.cart}>
      <h3 class="shop-cart-title">
        {voice.cart}
        {summary.items > 0 ? <span class="shop-cart-badge">{summary.items}</span> : null}
      </h3>
      {lines.length === 0 ? <p class="shop-cart-empty">{voice.emptyCart}</p> : null}
      {lines.map((line) => (
        <div key={line.listing.productId} class="cart-line">
          <span class="cart-line-name">{findProduct(line.listing.productId)!.label}</span>
          <span class="cart-qty">
            <button type="button" aria-label="Tirar um" onClick={() => onCart(changeQuantity(cart, line.listing.productId, -1, line.stock))}>
              −
            </button>
            <span>{line.quantity}</span>
            <button
              type="button"
              aria-label="Pôr mais um"
              disabled={!canAdd(cart, line.listing.productId, line.stock)}
              onClick={() => onCart(changeQuantity(cart, line.listing.productId, 1, line.stock))}
            >
              +
            </button>
          </span>
          <span class="cart-line-price">◆ {formatNumber(line.quantity * line.unitPrice)}</span>
        </div>
      ))}
      {lines.length > 0 ? (
        <>
          <fieldset class="shipping-options">
            <legend>Frete</legend>
            {(["standard", "express"] as const).map((option) => {
              const def = shop.shipping[option];
              if (!def) return null;
              const lead = cartSummary(shop, lines, option).lead;
              return (
                <label key={option} class="shipping-option">
                  <input type="radio" name={`shipping-${shop.id}`} checked={mode === option} onChange={() => onShipping(option)} />
                  <span class="shipping-name">{def.label}</span>
                  <span class="shipping-meta">
                    {def.credits > 0 ? `◆ ${formatNumber(def.credits)}` : "grátis"}
                    {lead ? ` · ${rangeText(lead)}` : ""}
                  </span>
                </label>
              );
            })}
            {!shop.shipping.express ? <p class="shipping-note">Sem frete expresso nesta loja.</p> : null}
          </fieldset>
          <div class="cart-sum">
            <span>Itens</span>
            <span>◆ {formatNumber(summary.subtotal)}</span>
            <span>Frete</span>
            <span>{summary.shipping > 0 ? `◆ ${formatNumber(summary.shipping)}` : "grátis"}</span>
          </div>
          <div class="cart-total">
            <span>Total</span>
            <CostTag
              cost={{ hours: 0, credits: summary.total, leadDays: summary.lead?.max ?? 0, risk: summary.risk }}
              lead={summary.lead ? { min: summary.lead.min, promised: summary.lead.max, max: summary.lead.max } : null}
            />
          </div>
          <p class="cart-note">
            Prazo é promessa da loja: o real pode passar do máximo. Caixa da equipe: ◆ {formatNumber(credits)}.
          </p>
          {short ? <p class="cart-short">Faltam ◆ {formatNumber(summary.total - credits)} no caixa.</p> : null}
          <button type="button" class="shop-cta shop-checkout" disabled={short} onClick={checkout}>
            {voice.checkout}
          </button>
        </>
      ) : null}
    </aside>
  );
}

/** Estrelas 0–5 com preenchimento parcial. */
export function Stars({ rating, count }: { rating: number; count?: number }) {
  return (
    <span class="stars" title={`${formatNumber(rating, 1)} de 5`}>
      <span class="stars-track" aria-hidden="true">
        ★★★★★
        <span class="stars-fill" style={{ width: `${(rating / 5) * 100}%` }}>
          ★★★★★
        </span>
      </span>
      <span class="stars-value">{formatNumber(rating, 1)}</span>
      {count !== undefined ? (
        <span class="stars-count">
          ({count} {count === 1 ? "avaliação" : "avaliações"})
        </span>
      ) : null}
    </span>
  );
}

/** Ilustração simples do produto, no lugar da foto. Cores herdadas da loja. */
function ProductIcon({ productId }: { productId: string }) {
  const shapes: Record<string, preact.JSX.Element> = {
    motor: (
      <>
        <rect x="14" y="16" width="26" height="22" rx="4" class="pi-body" />
        <rect x="40" y="24" width="10" height="6" rx="2" class="pi-detail" />
        <path d="M50 10 L54 27 L50 44 L46 27 Z" class="pi-accent" />
        <path d="M18 20 V34 M24 20 V34 M30 20 V34 M36 20 V34" class="pi-line" />
      </>
    ),
    servos: (
      <>
        <rect x="12" y="18" width="34" height="20" rx="3" class="pi-body" />
        <rect x="8" y="24" width="42" height="4" rx="1" class="pi-detail" />
        <circle cx="38" cy="18" r="5" class="pi-accent" />
        <path d="M38 18 L52 12" class="pi-line pi-thick" />
      </>
    ),
    balsa: (
      <>
        <path d="M8 34 L44 20 L56 26 L20 40 Z" class="pi-body" />
        <path d="M8 34 L8 38 L20 44 L20 40 Z M20 40 L56 26 L56 30 L20 44 Z" class="pi-detail" />
        <path d="M18 34 L48 23 M24 36 L52 25" class="pi-line" />
      </>
    ),
    roll: (
      <>
        <ellipse cx="16" cy="28" rx="6" ry="14" class="pi-detail" />
        <rect x="16" y="14" width="34" height="28" class="pi-body" />
        <ellipse cx="50" cy="28" rx="6" ry="14" class="pi-accent" />
        <path d="M22 14 L40 42 M30 14 L48 42 M22 42 L40 14 M30 42 L48 14" class="pi-line" />
      </>
    ),
    resin: (
      <>
        <rect x="10" y="18" width="20" height="26" rx="3" class="pi-body" />
        <rect x="34" y="24" width="16" height="20" rx="3" class="pi-detail" />
        <rect x="13" y="12" width="14" height="6" rx="1" class="pi-accent" />
        <rect x="37" y="19" width="10" height="5" rx="1" class="pi-accent" />
      </>
    ),
    scale: (
      <>
        <rect x="8" y="34" width="48" height="10" rx="3" class="pi-body" />
        <rect x="12" y="28" width="40" height="6" rx="2" class="pi-detail" />
        <rect x="24" y="37" width="16" height="5" rx="1" class="pi-accent" />
      </>
    ),
    stand: (
      <>
        <rect x="8" y="40" width="48" height="6" rx="2" class="pi-body" />
        <rect x="16" y="20" width="6" height="20" class="pi-detail" />
        <rect x="16" y="16" width="22" height="10" rx="3" class="pi-body" />
        <path d="M44 6 L47 21 L44 36 L41 21 Z" class="pi-accent" />
      </>
    )
  };
  const kind = productId.startsWith("motor")
    ? "motor"
    : productId.startsWith("balsa")
      ? "balsa"
      : productId === "carbon-fiber"
        ? "roll"
        : productId === "thrust-stand"
          ? "stand"
          : productId;
  return (
    <svg viewBox="0 0 64 52" class="product-icon">
      {shapes[kind] ?? <circle cx="32" cy="26" r="16" class="pi-body" />}
    </svg>
  );
}

/** Avaliação do vendedor (S5): nota e comentários; o risco real da loja nunca aparece como número. */
function SellerReviews({ shopId }: { shopId: string }) {
  const review = sellerReview(shopId);
  if (!review) return null;
  return (
    <details class="seller-reviews">
      <summary>
        <Stars rating={review.rating} count={review.count} /> · avaliações do vendedor
      </summary>
      {review.comments.map((comment) => (
        <blockquote key={comment.author + comment.text}>
          <Stars rating={comment.stars} />
          <p>“{comment.text}”</p>
          <cite>{comment.author}</cite>
        </blockquote>
      ))}
    </details>
  );
}
