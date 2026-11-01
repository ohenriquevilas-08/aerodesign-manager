import { store } from "../../app/store";
import { useGame } from "../../app/useGame";
import { clockToDate, financeSummary, findShop, formatDate, formatTime, LEDGER_LABELS, type FinanceSummary, type LedgerKind } from "../../sim";
import { formatNumber } from "../format";
import { useDerived } from "../hooks";

// Tela Finanças (U6): caixa, entradas e saídas por categoria e por mês, extrato e impostos pendentes.

const n = formatNumber;
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-03" → "mar/2026". */
function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return `${MONTHS[Number(month) - 1] ?? month}/${year}`;
}

export function Finance() {
  const summary = useDerived((state) => financeSummary(state), []);
  const ledger = useGame((state) => state.ledger);
  const orders = useGame((state) => state.orders);
  const credits = useGame((state) => state.credits);
  const pending = orders.filter((order) => order.status === "held-customs" && order.customsDue !== null);
  const statement = [...ledger].reverse().slice(0, 60);

  return (
    <div class="screen">
      <header class="screen-head">
        <h1 class="screen-title">Finanças</h1>
        <div class="stat-row">
          <div class="stat">
            <span class="stat-label">Caixa</span>
            <strong class="text-credits">◆ {n(credits)}</strong>
          </div>
          <div class="stat">
            <span class="stat-label">Entradas</span>
            <strong class="text-in">+ {n(summary.income)}</strong>
          </div>
          <div class="stat">
            <span class="stat-label">Saídas</span>
            <strong class="text-out">− {n(summary.expense)}</strong>
          </div>
        </div>
      </header>
      <div class="finance-grid">
        <div class="stack scroll-col">
          <ByKind summary={summary} />
          <ByMonth summary={summary} />
        </div>
        <div class="stack scroll-col">
          <section class="panel">
            <h2 class="panel-title">
              Impostos pendentes <span class="panel-count">{pending.length}</span>
            </h2>
            <div class="panel-body stack-tight">
              {pending.length === 0 ? <p class="muted">Nenhum pedido retido na fiscalização.</p> : null}
              {pending.map((order) => (
                <div key={order.id} class="finance-pending">
                  <span>
                    {findShop(order.shopId)?.name ?? order.shopId}
                    <small class="muted"> · pedido de {formatDate(clockToDate(order.placedAt))}</small>
                  </span>
                  <button type="button" class="order-pay" onClick={() => store.dispatch({ type: "pay-customs", orderId: order.id })}>
                    Pagar ◆ {n(order.customsDue!)}
                  </button>
                </div>
              ))}
            </div>
          </section>
          <section class="panel">
            <h2 class="panel-title">
              Extrato <span class="panel-count">{ledger.length}</span>
            </h2>
            <div class="panel-body">
              {statement.length === 0 ? (
                <p class="muted">Nada movimentou o caixa ainda.</p>
              ) : (
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Quando</th>
                      <th>Descrição</th>
                      <th class="num">◆</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.map((entry, i) => {
                      const date = clockToDate(entry.at);
                      return (
                        <tr key={entry.at + entry.label + i}>
                          <td>
                            {formatDate(date)} {formatTime(date)}
                          </td>
                          <td>
                            {entry.label}
                            <small class="muted"> · {LEDGER_LABELS[entry.kind]}</small>
                          </td>
                          <td class={`num ${entry.credits >= 0 ? "text-in" : "text-out"}`}>
                            {entry.credits >= 0 ? "+" : "−"} {n(Math.abs(entry.credits))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ByKind({ summary }: { summary: FinanceSummary }) {
  const kinds = (Object.keys(summary.byKind) as LedgerKind[]).sort(
    (a, b) => summary.byKind[b]!.income + summary.byKind[b]!.expense - (summary.byKind[a]!.income + summary.byKind[a]!.expense)
  );
  const max = Math.max(1, ...kinds.map((kind) => Math.max(summary.byKind[kind]!.income, summary.byKind[kind]!.expense)));
  return (
    <section class="panel">
      <h2 class="panel-title">Por categoria</h2>
      <div class="panel-body stack-tight">
        {kinds.length === 0 ? <p class="muted">Sem movimento ainda.</p> : null}
        {kinds.map((kind) => (
          <FlowRow key={kind} label={LEDGER_LABELS[kind]} income={summary.byKind[kind]!.income} expense={summary.byKind[kind]!.expense} max={max} />
        ))}
      </div>
    </section>
  );
}

function ByMonth({ summary }: { summary: FinanceSummary }) {
  const max = Math.max(1, ...summary.byMonth.map((month) => Math.max(month.income, month.expense)));
  return (
    <section class="panel">
      <h2 class="panel-title">Por mês</h2>
      <div class="panel-body stack-tight">
        {summary.byMonth.length === 0 ? <p class="muted">Sem movimento ainda.</p> : null}
        {summary.byMonth.map((month) => (
          <FlowRow key={month.month} label={monthLabel(month.month)} income={month.income} expense={month.expense} max={max} net={month.net} />
        ))}
      </div>
    </section>
  );
}

/** Duas barras (entrada e saída) na mesma escala; os valores sempre escritos ao lado. */
function FlowRow({ label, income, expense, max, net }: { label: string; income: number; expense: number; max: number; net?: number }) {
  return (
    <div class="flow-row">
      <div class="flow-head">
        <span>{label}</span>
        {net !== undefined ? <strong class={net >= 0 ? "text-in" : "text-out"}>{net >= 0 ? "+" : "−"} {n(Math.abs(net))}</strong> : null}
      </div>
      <div class="flow-bar" title={`Entradas ${n(income)}`}>
        <span class="flow-fill is-in" style={{ width: `${(income / max) * 100}%` }} />
        <small>+ {n(income)}</small>
      </div>
      <div class="flow-bar" title={`Saídas ${n(expense)}`}>
        <span class="flow-fill is-out" style={{ width: `${(expense / max) * 100}%` }} />
        <small>− {n(expense)}</small>
      </div>
    </div>
  );
}
