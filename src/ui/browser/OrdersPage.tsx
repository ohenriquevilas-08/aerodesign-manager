import { store } from "../../app/store";
import { useGame } from "../../app/useGame";
import { clockToDate, findProduct, findShop, formatCountdown, formatDate, type Order, type OrderStatus } from "../../sim";
import { formatNumber } from "../format";
import { ShopMark } from "./ShopLogo";

const STATUS_LABEL: Record<OrderStatus, string> = {
  processing: "Processando",
  "in-transit": "A caminho",
  "held-customs": "Retido na fiscalização",
  delivered: "Entregue"
};

/** "Meus pedidos": rastreio de todas as lojas (design §8.4). Mostra a data prometida, nunca a real. */
export function OrdersPage() {
  const orders = useGame((state) => state.orders);
  const hours = useGame((state) => Math.floor(state.clock.hours));
  const open = orders.filter((order) => order.status !== "delivered").reverse();
  const delivered = orders.filter((order) => order.status === "delivered").reverse();

  return (
    <div class="orders-page">
      <header class="orders-head">
        <h2>Meus pedidos</h2>
        <p>Rastreio unificado. A data é a que a loja prometeu: pode atrasar.</p>
      </header>
      {orders.length === 0 ? (
        <div class="orders-empty">
          <strong>Nenhum pedido ainda.</strong>
          <span>Compras feitas nas lojas aparecem aqui, com previsão de entrega e avisos da fiscalização.</span>
        </div>
      ) : null}
      {open.length > 0 ? <h3 class="orders-group">Em andamento</h3> : null}
      {open.map((order) => (
        <OrderRow key={order.id} order={order} hours={hours} />
      ))}
      {delivered.length > 0 ? <h3 class="orders-group">Entregues</h3> : null}
      {delivered.map((order) => (
        <OrderRow key={order.id} order={order} hours={hours} />
      ))}
    </div>
  );
}

function OrderRow({ order, hours }: { order: Order; hours: number }) {
  const shop = findShop(order.shopId);
  const total = order.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const late = order.status !== "delivered" && hours > order.expectedAt;

  return (
    <article class={`order order-${order.status}`}>
      <ShopMark shopId={order.shopId} size={36} />
      <div class="order-main">
        <div class="order-title">
          <strong>{shop?.name ?? order.shopId}</strong>
          <span class={`order-status status-${order.status}`}>{STATUS_LABEL[order.status]}</span>
        </div>
        <p class="order-items">
          {order.lines
            .map((line) => `${line.quantity}× ${findProduct(line.productId)?.label ?? line.productId}`)
            .join(" · ")}
        </p>
        <p class="order-meta">
          Pedido em {formatDate(clockToDate(order.placedAt))} · {order.shipping === "express" ? "expresso" : "frete normal"} · ◆{" "}
          {formatNumber(total)}
        </p>
      </div>
      <div class="order-when">
        {order.status === "delivered" && order.deliveredAt !== null ? (
          <>
            <span class="order-when-label">Entregue em</span>
            <strong>{formatDate(clockToDate(order.deliveredAt))}</strong>
          </>
        ) : (
          <>
            <span class="order-when-label">{late ? "Previsto para (atrasado)" : "Previsto para"}</span>
            <strong>{formatDate(clockToDate(order.expectedAt))}</strong>
            {!late ? <span class="order-when-count">em {formatCountdown(hours, clockToDate(order.expectedAt))}</span> : null}
          </>
        )}
        {order.status === "held-customs" && order.customsDue !== null ? (
          <button type="button" class="order-pay" onClick={() => store.dispatch({ type: "pay-customs", orderId: order.id })}>
            Pagar imposto ◆ {formatNumber(order.customsDue)}
          </button>
        ) : null}
      </div>
    </article>
  );
}
