// As frases do formulário respeitam o momento da equipe (fase-9.md, ajustes do playtest).

import { describe, expect, it } from "vitest";
import { applyCommand, hasHistory, PHRASES, phrasesFor, type GameState } from "../../src/sim";
import { drawApplicants, beginCampaign, findSelectionFormat } from "../../src/sim/selection";
import { foundedGame } from "./helpers";

const kinds = Object.keys(PHRASES) as (keyof typeof PHRASES)[];
const historyTexts = new Set(kinds.flatMap((kind) => PHRASES[kind].filter((item) => item.requires === "history").map((item) => item.text)));
const foundingTexts = new Set(kinds.flatMap((kind) => PHRASES[kind].filter((item) => item.requires === "founding").map((item) => item.text)));

describe("frases do formulário", () => {
  it("o banco tem frases de história e de equipe nova", () => {
    expect(historyTexts.size).toBeGreaterThan(0);
    expect(foundingTexts.size).toBeGreaterThan(0);
    expect(phrasesFor("referral", false, "referral")).toContain("Um amigo dos fundadores me chamou para participar.");
    expect(phrasesFor("referral", false, "broad")).not.toContain("Um amigo dos fundadores me chamou para participar.");
    expect(phrasesFor("referral", true, "referral")).not.toContain("Um amigo dos fundadores me chamou para participar.");
  });

  it("no Ano 1 nenhuma frase `history` aparece, em nenhum formato", () => {
    const game = foundedGame({ seed: 11, teamName: "T" });
    expect(hasHistory(game)).toBe(false);
    for (const format of ["broad", "technical", "referral", "challenge"]) {
      const begun = beginCampaign(game, format);
      const drawn = drawApplicants(begun, findSelectionFormat(format)!, 200);
      const phrases = drawn.selection!.applicants.map((item) => item.motivationText);
      expect(phrases).toHaveLength(200);
      expect(phrases.filter((text) => historyTexts.has(text))).toEqual([]);
    }
  });

  it("depois da competição as frases `founding` saem e as de história voltam", () => {
    const game = { ...foundedGame({ seed: 11, teamName: "T" }), competition: { phase: "finished" } as unknown as GameState["competition"] };
    expect(hasHistory(game)).toBe(true);
    const drawn = drawApplicants(beginCampaign(game, "referral"), findSelectionFormat("referral")!, 200);
    const phrases = drawn.selection!.applicants.map((item) => item.motivationText);
    expect(phrases.filter((text) => foundingTexts.has(text))).toEqual([]);
    expect(phrases.some((text) => historyTexts.has(text))).toBe(true);
    expect(applyCommand).toBeDefined();
  });
});
