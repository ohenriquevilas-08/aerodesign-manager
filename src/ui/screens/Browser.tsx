import { useState } from "preact/hooks";
import { useGame } from "../../app/useGame";
import { findProduct, findShop, LISTINGS, type ShippingMode } from "../../sim";
import type { Cart } from "../browser/cart";
import { NewsPage } from "../browser/NewsPage";
import { OrdersPage } from "../browser/OrdersPage";
import { ShopLogo, ShopMark } from "../browser/ShopLogo";
import { ShopPage } from "../browser/ShopPage";
import { bookmarks, NEWS_SITE, ORDERS_SITE, siteInfo } from "../browser/sites";
import { formatNumber } from "../format";

// Navegador do jogo (design §8.4 e §11): compras como nos sites do celular do GTA V.
// Só os sites abertos ganham aba (com ✕); a página inicial tem favoritos e busca de produto.

type Page = "home" | string;

interface BrowserMemory {
  /** Sites abertos, na ordem das abas. */
  tabs: string[];
  page: Page;
  carts: Record<string, Cart>;
  shipping: Record<string, ShippingMode>;
}

// Sobrevive à troca de tela; não é estado do jogo (o pedido só existe depois do checkout).
let memory: BrowserMemory = { tabs: [], page: "home", carts: {}, shipping: {} };

const HOME_URL = "aeronet://inicio";

export function Browser() {
  const [state, setState] = useState(memory);
  const update = (patch: Partial<BrowserMemory>) => setState((previous) => (memory = { ...previous, ...patch }));

  const open = (id: string) => update({ tabs: state.tabs.includes(id) ? state.tabs : [...state.tabs, id], page: id });
  const home = () => update({ page: "home" });
  const close = (id: string) => {
    const index = state.tabs.indexOf(id);
    const tabs = state.tabs.filter((item) => item !== id);
    const page = state.page === id ? (tabs[Math.min(index, tabs.length - 1)] ?? "home") : state.page;
    update({ tabs, page });
  };

  const openOrders = useGame((game) => game.orders.filter((order) => order.status !== "delivered").length);
  const held = useGame((game) => game.orders.some((order) => order.status === "held-customs"));
  const shop = findShop(state.page);
  const url = state.page === "home" ? HOME_URL : (siteInfo(state.page)?.url ?? HOME_URL);

  return (
    <div class="screen">
      <div class="browser">
        <div class="browser-tabs" role="tablist" aria-label="Abas do navegador">
          {state.tabs.map((id) => {
            const site = siteInfo(id);
            if (!site) return null;
            const count = Object.values(state.carts[id] ?? {}).reduce((sum, value) => sum + value, 0);
            const badge = id === ORDERS_SITE ? openOrders || null : count || null;
            return (
              <BrowserTab
                key={id}
                active={state.page === id}
                label={site.title}
                badge={badge}
                alert={id === ORDERS_SITE && held}
                onClick={() => update({ page: id })}
                onClose={() => close(id)}
              >
                {findShop(id) ? (
                  <ShopMark shopId={id} size={16} />
                ) : (
                  <span class="browser-tab-icon" aria-hidden="true">
                    {id === NEWS_SITE ? "✎" : "▤"}
                  </span>
                )}
              </BrowserTab>
            );
          })}
          <button type="button" class="browser-newtab" aria-label="Nova aba" title="Nova aba (página inicial)" onClick={home}>
            +
          </button>
        </div>
        <div class="browser-bar">
          <button type="button" class="browser-btn" aria-label="Início" onClick={home}>
            ⌂
          </button>
          <div class="browser-address" aria-label="Endereço">
            <svg class="browser-lock" width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
              <rect x="1" y="5" width="8" height="7" rx="1.5" />
              <path d="M3 5 V3.5 A2 2 0 0 1 7 3.5 V5" />
            </svg>
            {url}
          </div>
        </div>
        <div class="browser-page">
          {shop ? (
            <ShopPage
              key={shop.id}
              shop={shop}
              cart={state.carts[shop.id] ?? {}}
              shipping={state.shipping[shop.id] ?? "standard"}
              onCart={(cart) => update({ carts: { ...state.carts, [shop.id]: cart } })}
              onShipping={(mode) => update({ shipping: { ...state.shipping, [shop.id]: mode } })}
              onOrdered={() =>
                update({
                  carts: { ...state.carts, [shop.id]: {} },
                  tabs: state.tabs.includes(ORDERS_SITE) ? state.tabs : [...state.tabs, ORDERS_SITE],
                  page: ORDERS_SITE
                })
              }
            />
          ) : state.page === ORDERS_SITE ? (
            <OrdersPage />
          ) : state.page === NEWS_SITE ? (
            <NewsPage onOpen={open} />
          ) : (
            <HomePage onOpen={open} />
          )}
        </div>
      </div>
    </div>
  );
}

function BrowserTab({
  active,
  label,
  badge,
  alert,
  onClick,
  onClose,
  children
}: {
  active: boolean;
  label: string;
  badge?: number | null;
  alert?: boolean;
  onClick: () => void;
  onClose: () => void;
  children: preact.ComponentChildren;
}) {
  return (
    <div class="browser-tab-wrap" data-active={active}>
      <button type="button" role="tab" class="browser-tab" aria-selected={active} title={label} onClick={onClick}>
        {children}
        <span class="browser-tab-label">{label}</span>
        {badge ? <span class={`browser-tab-badge${alert ? " is-alert" : ""}`}>{badge}</span> : null}
      </button>
      <button type="button" class="browser-tab-close" aria-label={`Fechar ${label}`} onClick={onClose}>
        ✕
      </button>
    </div>
  );
}

/** Minúsculas e sem acento, para a busca. */
const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function HomePage({ onOpen }: { onOpen: (siteId: string) => void }) {
  const credits = useGame((state) => state.credits);
  const [query, setQuery] = useState("");
  const term = normalize(query.trim());
  const results = term
    ? LISTINGS.map((listing) => ({ listing, product: findProduct(listing.productId), shop: findShop(listing.shopId) }))
        .filter(({ product, shop }) => product && shop && normalize(`${product.label} ${product.spec}`).includes(term))
        .sort((a, b) => a.listing.price - b.listing.price)
    : [];

  return (
    <div class="browser-home">
      <div class="browser-home-head">
        <span class="browser-home-brand">AeroNet</span>
        <p>Onde a equipe compra. Mesmo produto, preço, prazo e risco diferentes em cada loja.</p>
        <span class="browser-home-credits">Caixa da equipe: ◆ {formatNumber(credits)}</span>
        <input
          type="search"
          class="browser-search"
          placeholder="Buscar produto em todas as lojas (ex.: motor, hélice, servo)"
          aria-label="Buscar produto"
          value={query}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
      </div>
      {term ? (
        <div class="search-results">
          {results.length === 0 ? <p class="muted">Nada encontrado para “{query}”.</p> : null}
          {results.map(({ listing, product, shop }) => (
            <button key={`${listing.shopId}:${listing.productId}`} type="button" class="search-row" onClick={() => onOpen(listing.shopId)}>
              <ShopMark shopId={listing.shopId} size={24} />
              <span class="search-name">
                {product!.label}
                <small>{shop!.name}</small>
              </span>
              <strong>◆ {formatNumber(listing.price)}</strong>
            </button>
          ))}
        </div>
      ) : (
        <div class="browser-home-grid">
          {bookmarks().map((site) => (
            <button key={site.id} type="button" class={`shop-tile${findShop(site.id) ? "" : " is-orders"}`} data-shop={findShop(site.id) ? site.id : undefined} onClick={() => onOpen(site.id)}>
              {findShop(site.id) ? <ShopLogo shopId={site.id} size={34} /> : <strong>{site.title}</strong>}
              <span class="shop-tile-tagline">{site.blurb}</span>
              <span class="shop-tile-domain">{site.url.replace("https://", "")}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
