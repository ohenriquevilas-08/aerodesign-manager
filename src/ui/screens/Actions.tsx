import { ACTIONS, type ActionCategory } from "../../sim";
import { ActionCard, CostLegend } from "../components/CostTag";

// Tela provisória: catálogo de ações agrupado pelas moedas (design §8.2). Sem botões até
// a simulação ganhar os comandos de tarefa.
const GROUPS: { category: ActionCategory; title: string; note: string }[] = [
  { category: "hours", title: "Só horas", note: "Ocupam gente, não gastam caixa. Captação gera créditos." },
  { category: "credits", title: "Só créditos", note: "Não ocupam ninguém, mas quase sempre esperam entrega." },
  { category: "both", title: "Horas + créditos", note: "Fabricar, reparar e voar: gente e dinheiro ao mesmo tempo." }
];

export function Actions() {
  return (
    <div class="screen">
      <header class="screen-head">
        <h1 class="screen-title">Ações</h1>
        <CostLegend />
      </header>
      <div class="columns-3">
        {GROUPS.map((group) => {
          const actions = ACTIONS.filter((action) => action.category === group.category);
          return (
            <section key={group.category} class="panel">
              <h2 class="panel-title">
                {group.title} <span class="panel-count">{actions.length}</span>
              </h2>
              <div class="panel-body stack">
                <p class="muted">{group.note}</p>
                {actions.map((action) => (
                  <ActionCard key={action.id} action={action} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
