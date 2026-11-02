import { describe, expect, it } from "vitest";
import { DIMMED_ALPHA, GROUP_MAX, GROUP_MIN, groupEmphasis, groupSizes, observedLabel, observedSet, splitIntoGroups } from "../../src/scenes/event/groups";

describe("tamanho dos grupos da dinâmica", () => {
  it("de 20 a 120 pessoas todo grupo tem 5 ou 6 e ninguém sobra", () => {
    for (let n = 20; n <= 120; n += 1) {
      const sizes = groupSizes(n);
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(n);
      for (const size of sizes) {
        expect(size).toBeGreaterThanOrEqual(GROUP_MIN);
        expect(size).toBeLessThanOrEqual(GROUP_MAX);
      }
    }
  });

  it("usa o menor número de grupos e os tamanhos mais parecidos", () => {
    expect(groupSizes(30)).toEqual([6, 6, 6, 6, 6]);
    expect(groupSizes(31)).toEqual([6, 5, 5, 5, 5, 5]);
    expect(groupSizes(11)).toEqual([6, 5]);
  });

  it("os totais sem divisão exata em 5 a 6 (13, 14, 19) fecham com um grupo de 7, nunca de 4", () => {
    for (const n of [13, 14, 19]) {
      const sizes = groupSizes(n);
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(n);
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(GROUP_MIN);
      expect(Math.max(...sizes)).toBe(7);
    }
  });

  it("poucas pessoas viram um grupo só e zero não gera grupo", () => {
    expect(groupSizes(0)).toEqual([]);
    expect(groupSizes(3)).toEqual([3]);
    expect(groupSizes(8)).toEqual([8]);
  });

  it("splitIntoGroups mantém a ordem e usa os mesmos tamanhos", () => {
    const items = Array.from({ length: 17 }, (_, i) => i);
    const groups = splitIntoGroups(items);
    expect(groups.map((g) => g.length)).toEqual(groupSizes(17));
    expect(groups.flat()).toEqual(items);
  });
});

describe("destaque dos grupos acompanhados", () => {
  it("junta o grupo único antigo com a lista nova, sem repetir", () => {
    expect([...observedSet({ observedGroupId: "g1", observedGroupIds: ["g1", "g4"] })].sort()).toEqual(["g1", "g4"]);
    expect([...observedSet({ observedGroupId: "g2" })]).toEqual(["g2"]);
    expect(observedSet({ observedGroupId: null }).size).toBe(0);
    expect(observedSet(null).size).toBe(0);
  });

  it("sem acompanhados todos os grupos aparecem iguais", () => {
    expect(groupEmphasis(new Set(), "g0")).toEqual({ observed: false, alpha: 1 });
  });

  it("os acompanhados ficam em cheio e os outros esmaecem", () => {
    const observed = new Set(["g1", "g4"]);
    expect(groupEmphasis(observed, "g1")).toEqual({ observed: true, alpha: 1 });
    expect(groupEmphasis(observed, "g4").observed).toBe(true);
    expect(groupEmphasis(observed, "g0")).toEqual({ observed: false, alpha: DIMMED_ALPHA });
  });

  it("rotula quantos grupos o jogador acompanha", () => {
    expect(observedLabel(new Set())).toBe("");
    expect(observedLabel(new Set(["g1"]))).toBe("1 grupo acompanhado");
    expect(observedLabel(new Set(["g1", "g2"]))).toBe("2 grupos acompanhados");
  });
});
