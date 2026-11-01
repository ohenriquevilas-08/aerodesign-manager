import { useGame } from "../../app/useGame";
import { clockToDate, findShop, formatCountdown, formatDate, formatTime, OFFICIAL_CALENDAR, type NewsKind } from "../../sim";

const KIND_LABEL: Record<NewsKind, string> = {
  promo: "Promoção",
  stock: "Estoque",
  deadline: "Prazo",
  rival: "Competição"
};

/** Portal de notícias (S5): o que mudou no mercado e no calendário, da mais nova para a mais antiga. */
export function NewsPage({ onOpen }: { onOpen: (siteId: string) => void }) {
  const news = useGame((state) => state.news);
  const hours = useGame((state) => Math.floor(state.clock.hours));
  const feed = [...news].reverse();
  const nextDeadline = OFFICIAL_CALENDAR.find((item) => item.date > clockToDate(hours));

  return (
    <div class="news-page">
      <header class="news-head">
        <h2>Aero Notícias</h2>
        <p>Promoção relâmpago, estoque acabando e prazo chegando. Quem lê, compra na hora certa.</p>
        {nextDeadline ? (
          <span class="news-next">
            Próximo marco: {nextDeadline.title} · {formatDate(nextDeadline.date)} · faltam {formatCountdown(hours, nextDeadline.date)}
          </span>
        ) : null}
      </header>
      {feed.length === 0 ? (
        <div class="orders-empty">
          <strong>Sem notícias por enquanto.</strong>
          <span>As manchetes aparecem conforme o tempo passa.</span>
        </div>
      ) : null}
      {feed.map((item) => {
        const shop = item.shopId ? findShop(item.shopId) : null;
        const date = clockToDate(item.at);
        return (
          <article key={item.id} class={`news-item kind-${item.kind}`}>
            <div class="news-meta">
              <span class="news-tag">{KIND_LABEL[item.kind]}</span>
              <span>
                {formatDate(date)} · {formatTime(date)}
              </span>
            </div>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
            {shop ? (
              <button type="button" class="news-link" onClick={() => onOpen(shop.id)}>
                Abrir {shop.name}
              </button>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
