import { useState } from "preact/hooks";
import { useGame } from "../../app/useGame";
import { findShop, SHOPS, type ShippingMode } from "../../sim";
import type { Cart } from "../browser/cart";
import { OrdersPage } from "../browser/OrdersPage";
import { ShopLogo, ShopMark } from "../browser/ShopLogo";
import { ShopPage } from "../browser/ShopPage";
import { formatNumber } from "../format";

// Navegador do jogo (design §8.4 e §11): compras como nos sites do celular do GTA V.
// Abas por loja, carrinho por loja, checkout com frete e a aba "Meus pedidos" com o rastreio.

type Page = "home" | "orders" | string;

interface BrowserMemory {
  page: Page;
  carts: Record<string, Cart>;
  shipping: Record<string, ShippingMode>;
}

// Sobrevive à troca de tela; não é estado do jogo (o pedido só existe depois do checkout).
let memory: BrowserMemory = { page: "home", carts: {}, shipping: {} };

const HOME_URL = "aeronet://inicio";
const ORDERS_URL = "aeronet://meus-pedidos";

export function Browser() {
  const [state, setState] = useState(memory);
  const update = (patch: Partial<BrowserMemory>) => setState((previous) => (memory = { ...previous, ...patch }));
  const go = (page: Page) => update({ page });

  const openOrders = useGame((game) => game.orders.filter((order) => order.status !== "delivered").length);
  const held = useGame((game) => game.orders.some((order) => order.status === "held-customs"));
  const shop = findShop(state.page);
  const url = shop ? `https://${shop.domain}/` : state.page === "orders" ? ORDERS_URL : HOME_URL;

  return (
    <div class="screen">
      <div class="browser">
        <div class="browser-tabs" role="tablist" aria-label="Abas do navegador">
          <BrowserTab active={state.page === "home"} onClick={() => go("home")} label="Início">
            <span class="browser-tab-icon is-home" aria-hidden="true">
              ⌂
            </span>
          </BrowserTab>
          {SHOPS.map((item) => {
            const count = Object.values(state.carts[item.id] ?? {}).reduce((sum, value) => sum + value, 0);
            return (
              <BrowserTab key={item.id} active={state.page === item.id} onClick={() => go(item.id)} label={item.name} badge={count || null}>
                <ShopMark shopId={item.id} size={16} />
              </BrowserTab>
            );
          })}
          <BrowserTab
            active={state.page === "orders"}
            onClick={() => go("orders")}
            label="Meus pedidos"
            badge={openOrders || null}
            alert={held}
          >
            <span class="browser-tab-icon" aria-hidden="true">
              ▤
            </span>
          </BrowserTab>
        </div>
        <div class="browser-bar">
          <button type="button" class="browser-btn" aria-label="Início" onClick={() => go("home")}>
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
              onOrdered={() => update({ carts: { ...state.carts, [shop.id]: {} }, page: "orders" })}
            />
          ) : state.page === "orders" ? (
            <OrdersPage />
          ) : (
            <HomePage onOpen={go} />
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
  children
}: {
  active: boolean;
  label: string;
  badge?: number | null;
  alert?: boolean;
  onClick: () => void;
  children: preact.ComponentChildren;
}) {
  return (
    <button type="button" role="tab" class="browser-tab" aria-selected={active} title={label} onClick={onClick}>
      {children}
      <span class="browser-tab-label">{label}</span>
      {badge ? <span class={`browser-tab-badge${alert ? " is-alert" : ""}`}>{badge}</span> : null}
    </button>
  );
}

function HomePage({ onOpen }: { onOpen: (page: Page) => void }) {
  const credits = useGame((state) => state.credits);
  return (
    <div class="browser-home">
      <div class="browser-home-head">
        <span class="browser-home-brand">AeroNet</span>
        <p>Onde a equipe compra. Mesmo produto, preço, prazo e risco diferentes em cada loja.</p>
        <span class="browser-home-credits">Caixa da equipe: ◆ {formatNumber(credits)}</span>
      </div>
      <div class="browser-home-grid">
        {SHOPS.map((item) => (
          <button key={item.id} type="button" class="shop-tile" data-shop={item.id} onClick={() => onOpen(item.id)}>
            <ShopLogo shopId={item.id} size={34} />
            <span class="shop-tile-tagline">{item.tagline}</span>
            <span class="shop-tile-domain">{item.domain}</span>
          </button>
        ))}
        <button type="button" class="shop-tile is-orders" onClick={() => onOpen("orders")}>
          <strong>Meus pedidos</strong>
          <span class="shop-tile-tagline">Rastreio de todas as lojas e impostos da fiscalização.</span>
          <span class="shop-tile-domain">aeronet://meus-pedidos</span>
        </button>
      </div>
    </div>
  );
}
