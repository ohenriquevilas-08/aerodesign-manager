import { describe, expect, it } from "vitest";
import type { ApplicantView } from "../../src/sim";
import { BALANCE } from "../../src/sim";
import { mockApplicants } from "../../src/scenes/lecture/mock";
import {
  campaignStepIndex,
  filterApplicants,
  funnelSteps,
  inDays,
  interviewCost,
  nextSort,
  NO_FILTER,
  sortApplicants,
  stepIndex,
  tagForKey,
  trainingCost
} from "../../src/ui/selection/model";

const rows = (): ApplicantView[] => {
  const list = mockApplicants(6, 4);
  list[0] = { ...list[0]!, name: "Zélia Souza", tag: "call", semester: 8 };
  list[1] = { ...list[1]!, name: "Álvaro Lima", tag: "no", semester: 2 };
  list[2] = { ...list[2]!, name: "Bruno Dias", tag: null, semester: 5 };
  return list;
};

describe("planilha de inscritos", () => {
  it("as teclas C, T, N e X marcam e limpam; as outras não são da planilha", () => {
    expect(tagForKey("c")).toBe("call");
    expect(tagForKey("T")).toBe("maybe");
    expect(tagForKey("n")).toBe("no");
    expect(tagForKey("x")).toBeNull();
    expect(tagForKey("Backspace")).toBeNull();
    expect(tagForKey("e")).toBeUndefined();
  });

  it("filtra por texto sem acento, etapa e marca", () => {
    const list = rows();
    expect(filterApplicants(list, { ...NO_FILTER, text: "alvaro" }).map((r) => r.name)).toEqual(["Álvaro Lima"]);
    expect(filterApplicants(list, { ...NO_FILTER, stage: "absent" })).toHaveLength(2);
    expect(filterApplicants(list, { ...NO_FILTER, tag: "call" }).map((r) => r.name)).toEqual(["Zélia Souza"]);
    expect(filterApplicants(list, { ...NO_FILTER, tag: "none" })).toHaveLength(4);
  });

  it("ordena por nome, período e marca sem alterar a lista original", () => {
    const list = rows();
    const names = list.map((r) => r.name);
    expect(sortApplicants(list, { column: "name", descending: false })[0]!.name).toBe("Álvaro Lima");
    expect(sortApplicants(list, { column: "semester", descending: true })[0]!.semester).toBe(8);
    expect(sortApplicants(list, { column: "tag", descending: false })[0]!.tag).toBe("call");
    expect(sortApplicants(list, { column: "tag", descending: false }).at(-1)!.tag).toBe("no");
    expect(list.map((r) => r.name)).toEqual(names);
  });

  it("a ordem de chegada invertida põe o último inscrito primeiro", () => {
    const list = rows();
    expect(sortApplicants(list, { column: "arrival", descending: true })[0]).toBe(list.at(-1));
    expect(sortApplicants(list, { column: "arrival", descending: false })[0]).toBe(list[0]);
  });

  it("clicar na mesma coluna inverte; coluna nova começa crescente", () => {
    expect(nextSort({ column: "name", descending: false }, "name")).toEqual({ column: "name", descending: true });
    expect(nextSort({ column: "name", descending: true }, "stage")).toEqual({ column: "stage", descending: false });
  });

  it("as setas andam sem sair da lista", () => {
    expect(stepIndex(-1, 1, 5)).toBe(0);
    expect(stepIndex(-1, -1, 5)).toBe(4);
    expect(stepIndex(4, 1, 5)).toBe(4);
    expect(stepIndex(0, -1, 5)).toBe(0);
    expect(stepIndex(0, 1, 0)).toBe(-1);
  });
});

describe("funil e datas", () => {
  it("o funil afina e marca só as etapas que já aconteceram", () => {
    const steps = funnelSteps({ applicants: 80, present: 60, dynamic: 30, interviewed: 0, approved: 0 }, [], "dynamic");
    expect(steps.map((s) => s.count)).toEqual([80, 60, 30, 0, 0]);
    expect(steps.map((s) => s.reached)).toEqual([true, true, false, false, false]);
    expect(steps[1]!.ratio).toBeCloseTo(0.75);
  });

  it("as etapas da campanha agrupam as do estado", () => {
    expect(campaignStepIndex("promotion")).toBe(0);
    expect(campaignStepIndex("shortlist")).toBe(campaignStepIndex("dynamic"));
    expect(campaignStepIndex("interviewing")).toBe(campaignStepIndex("interview"));
    expect(campaignStepIndex("decision")).toBe(5);
  });

  it("conta dias até a próxima data", () => {
    expect(inDays(100, 100)).toBe("hoje");
    expect(inDays(110, 100)).toBe("amanhã");
    expect(inDays(100 + 24 * 5, 100)).toBe("em 5 dias");
  });
});

describe("custos de entrevista e treinamento", () => {
  it("entrevista custa horas por entrevistador", () => {
    expect(interviewCost(10)).toBe(10 * BALANCE.selection.interviewHours * BALANCE.selection.interviewers);
  });

  it("o treinamento de dez trainees soma 24 h cada e vira sessões de 8 h", () => {
    const cost = trainingCost(10, 0);
    expect(cost.totalHours).toBe(240);
    expect(cost.sessions).toBe(30);
    expect(cost.daysLeft).toBeGreaterThan(0);
  });
});
