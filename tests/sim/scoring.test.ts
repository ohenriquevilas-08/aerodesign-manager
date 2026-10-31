import { describe, expect, it } from "vitest";
import {
  densityAltitude,
  emptyWeightFactor,
  payloadAccuracyPoints,
  powerPenalty,
  predictedPayload,
  reliabilityBonus,
  reportFactor,
  scoreBattery,
  spanFactor,
  spanPenalty,
  surfacesFactor,
  unloadBonus,
  type BatteryInput
} from "../../src/sim";

describe("fatores de configuração (7.5)", () => {
  it("bonifica asa voadora e três superfícies em relação à convencional", () => {
    expect(surfacesFactor(1)).toBeCloseTo(1.22, 10);
    expect(surfacesFactor(2)).toBeCloseTo(1.0, 10);
    expect(surfacesFactor(3)).toBeCloseTo(1.15, 10);
    expect(surfacesFactor(5)).toBeCloseTo(1.15, 10);
  });

  it("penaliza envergadura com 1,15^(−b)", () => {
    expect(spanFactor(2)).toBeCloseTo(0.7561, 4);
    expect(spanFactor(4)).toBeCloseTo(0.5718, 4);
  });
});

describe("fatores de previsão e relatório", () => {
  it("FPV vale 1,10 com previsão exata e nunca fica abaixo de 0,80", () => {
    expect(emptyWeightFactor(3, 3)).toBeCloseTo(1.1, 10);
    expect(emptyWeightFactor(3, 3.3)).toBeCloseTo(0.95, 10);
    expect(emptyWeightFactor(3, 4.5)).toBe(0.8);
  });

  it("FPR vai de 0,50 (relatório zerado) a 1,00", () => {
    expect(reportFactor(0)).toBe(0.5);
    expect(reportFactor(92.5)).toBeCloseTo(0.875, 10);
    expect(reportFactor(185)).toBe(1);
  });

  it("PAC dá 30 com previsão exata e cai rápido com o erro", () => {
    expect(payloadAccuracyPoints(12, 12)).toBe(30);
    expect(payloadAccuracyPoints(10, 11)).toBeCloseTo(15.24, 2);
    expect(payloadAccuracyPoints(10, 15)).toBe(0);
  });
});

describe("bônus e penalidades", () => {
  it("BRC: 20 até 20 s e zero a partir de 30 s", () => {
    expect(unloadBonus(15)).toBe(20);
    expect(unloadBonus(20)).toBe(20);
    expect(unloadBonus(25)).toBeCloseTo(5.859, 3);
    expect(unloadBonus(30)).toBeCloseTo(0, 2);
    expect(unloadBonus(60)).toBe(0);
  });

  it("PD soma 20 pontos quando o excesso passa de 5 cm", () => {
    expect(spanPenalty(3.9)).toBe(0);
    expect(spanPenalty(4.03)).toBeCloseTo(3, 10);
    expect(spanPenalty(4.1)).toBeCloseTo(30, 10);
  });

  it("PP cobra 0,5 ponto por watt acima de 600 W", () => {
    expect(powerPenalty(550)).toBe(0);
    expect(powerPenalty(650)).toBe(25);
  });

  it("BCF premia duas baterias parecidas", () => {
    expect(reliabilityBonus(100, 100)).toBe(20);
    expect(reliabilityBonus(100, 90)).toBeCloseTo(15, 10);
    expect(reliabilityBonus(100, 70)).toBe(0);
    expect(reliabilityBonus(0, 0)).toBe(0);
  });
});

describe("altitude densidade e reta de previsão (Apêndice 4, 11.6)", () => {
  it("vale zero na atmosfera padrão ao nível do mar e ~1000 m na ISA a 1000 m", () => {
    expect(densityAltitude(288.15, 1013.25)).toBeCloseTo(0, 6);
    expect(densityAltitude(281.65, 898.76)).toBeCloseTo(1000, -1);
  });

  it("avalia a reta e respeita o patamar", () => {
    expect(predictedPayload({ a: -0.002, b: 14, cap: null }, 1000)).toBeCloseTo(12, 10);
    expect(predictedPayload({ a: -0.002, b: 14, cap: 11 }, 1000)).toBe(11);
  });
});

describe("pontuação de uma bateria (7.7)", () => {
  const base: BatteryInput = {
    payload: 12,
    emptyWeight: 4,
    predictedEmptyWeight: 4,
    predictedPayload: 12,
    reportScore: 185,
    surfaces: 2,
    span: 2,
    peakPower: 550,
    stoppedInside: true,
    unloadSeconds: 15
  };

  it("soma PVOO, PAC, BPO e BRC", () => {
    const score = scoreBattery(base);
    expect(score.ee).toBe(3);
    expect(score.pee).toBe(150);
    expect(score.pvoo).toBeCloseTo(1.1 * 150 * 0.75614, 2);
    expect(score.pac).toBe(30);
    expect(score.bpo).toBe(6);
    expect(score.brc).toBe(20);
    expect(score.total).toBeCloseTo(124.76 + 30 + 6 + 20, 1);
    expect(score.valid).toBe(true);
  });

  it("descarta a carga acima do peso máximo de 20 kg", () => {
    expect(scoreBattery({ ...base, payload: 18 }).ee).toBe(4);
  });

  it("invalida voo com menos de 5 kg", () => {
    expect(scoreBattery({ ...base, payload: 4, predictedPayload: 4 }).valid).toBe(false);
  });

  it("invalida voo com retirada de carga acima de 10 minutos", () => {
    const score = scoreBattery({ ...base, unloadSeconds: 601 });
    expect(score.brc).toBe(0);
    expect(score.valid).toBe(false);
  });
});
