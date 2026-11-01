import { describe, expect, it } from "vitest";
import {
  balloonDots,
  DOOR_START,
  DOOR,
  ENTRY_GAP,
  arrivalTime,
  entranceDuration,
  entranceOrder,
  entryTime,
  founderFrame,
  speakerView,
  standSlots
} from "../../src/scenes/intro/staging";

describe("encenação da abertura", () => {
  it("dá um lugar distinto a cada fundador, de frente para a mesa", () => {
    for (const count of [1, 3, 4, 6]) {
      const slots = standSlots(count);
      expect(slots).toHaveLength(count);
      expect(new Set(slots.map((s) => `${s.col.toFixed(2)},${s.row}`)).size).toBe(count);
    }
  });

  it("centraliza a fileira: lugares simétricos em torno do mesmo centro", () => {
    const slots = standSlots(4);
    expect(slots[0]!.col + slots[3]!.col).toBeCloseTo(slots[1]!.col + slots[2]!.col);
    expect(slots.every((s) => s.row === slots[0]!.row)).toBe(true);
  });

  it("passa a quinta pessoa para uma fileira de trás", () => {
    const slots = standSlots(5);
    expect(slots[4]!.row).toBeLessThan(slots[0]!.row);
  });

  it("entra primeiro quem para mais fundo, sem cruzar ninguém", () => {
    const order = entranceOrder(4);
    expect([...order].sort()).toEqual([0, 1, 2, 3]);
    const slots = standSlots(4);
    expect(slots[order[0]!]!.col).toBeGreaterThan(slots[order[3]!]!.col);
    expect(entryTime(order[0]!, 4)).toBe(0);
    expect(entryTime(order[1]!, 4)).toBeCloseTo(ENTRY_GAP);
  });

  it("antes da hora o fundador espera fora da sala; depois da chegada fica parado de frente para a mesa", () => {
    const order = entranceOrder(3);
    const last = order[2]!;
    expect(founderFrame(last, 3, 0).visible).toBe(false);
    const done = founderFrame(last, 3, entranceDuration(3) + 1);
    expect(done).toMatchObject({ visible: true, walking: false, facing: -1 });
    expect({ col: done.col, row: done.row }).toEqual(standSlots(3)[last]!);
  });

  it("anda pela linha da porta e só então vira para a mesa", () => {
    const first = entranceOrder(3)[0]!;
    const mid = founderFrame(first, 3, 0.8);
    expect(mid).toMatchObject({ visible: true, walking: true, facing: 1 });
    expect(mid.row).toBeCloseTo(DOOR.row);
    expect(mid.col).toBeGreaterThan(DOOR_START.col);
  });

  it("chega no tempo esperado e a duração cobre o último a chegar", () => {
    const end = entranceDuration(4);
    expect(end).toBe(Math.max(...[0, 1, 2, 3].map((i) => arrivalTime(i, 4))));
    expect(founderFrame(0, 4, end).walking).toBe(false);
  });

  it("valida o índice de quem fala", () => {
    expect(speakerView(3, 1).index).toBe(1);
    expect(speakerView(3, 3).index).toBeNull();
    expect(speakerView(3, -1).index).toBeNull();
    expect(speakerView(3, null).index).toBeNull();
    expect(speakerView(0, 0).index).toBeNull();
  });

  it("anima os pontinhos do balão em ciclo de 1 a 3", () => {
    expect([0, 0.34, 0.67, 1].map(balloonDots)).toEqual([1, 2, 3, 1]);
  });
});
