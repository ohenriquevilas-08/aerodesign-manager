import { describe, expect, it } from "vitest";
import { entryFromHistory } from "../../src/scenes/tests/fromHistory";
import type { TestHistoryEntry } from "../../src/sim";

const record = (patch: Partial<TestHistoryEntry>): TestHistoryEntry => ({
  at: 100,
  test: "flight",
  label: "Voo com carga incremental",
  densityAltitudeM: 900,
  ok: true,
  summary: "Voou com 5,2 kg.",
  affectedParts: [],
  payloadKg: 5.2,
  ...patch
});

describe("entryFromHistory", () => {
  it("ensaio de bancada vira entrada de bancada com o resultado da simulação", () => {
    const entry = entryFromHistory(record({ test: "structural", ok: false, summary: "A asa rompeu.", payloadKg: null }), "Equipe");
    expect(entry).toMatchObject({ kind: "structural", outcome: "fail", result: "A asa rompeu." });
  });

  it("voo de ensaio válido reaproveita a carga e a Hρ medidas", () => {
    const entry = entryFromHistory(record({}), "Equipe");
    expect(entry?.kind).toBe("flight");
    if (entry?.kind !== "flight") return;
    expect(entry.playback).toMatchObject({ payloadKg: 5.2, densityAltitudeM: 900, outcome: "valid", teamName: "Equipe" });
  });

  it("voo com incidente vira pouso com dano e cita as peças", () => {
    const entry = entryFromHistory(record({ ok: false, affectedParts: ["Trem de pouso"] }), "Equipe");
    if (entry?.kind !== "flight") throw new Error("esperava voo");
    expect(entry.playback.outcome).toBe("damage");
    expect(entry.playback.damagedParts).toEqual(["Trem de pouso"]);
  });

  it("voo filmado não tem animação", () => {
    expect(entryFromHistory(record({ test: "video", payloadKg: null }), "Equipe")).toBeNull();
  });
});
