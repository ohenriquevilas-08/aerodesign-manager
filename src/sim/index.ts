// Ponto de entrada público da simulação. UI e cenas importam daqui, nunca dos arquivos internos.

export * from "./types";
export * from "./scoring";
export * from "./time";
export { applyCommand, type Command } from "./commands";
export { createGame, drawField, DISCIPLINES, FIELD_SIZE } from "./state";
export { DISCIPLINE_LABELS, effectiveKnowledge, isOverloaded, memberHoursPerDay, motivationFactor } from "./team";
export { partState, PART_STATE_LABELS } from "./parts";
export {
  ACTIONS,
  categoryOf,
  findAction,
  type ActionDef,
  type ActionCategory,
  type ActionEffect,
  type ActionTarget,
  type EquipmentItem,
  type StockItem
} from "./content/actions";
export { BALANCE } from "./content/balance";
export { REGULAR_2026, REPORT_CHAPTERS } from "./content/regulation2026";
export { OFFICIAL_CALENDAR, SEASON_START, type Deadline } from "./content/calendar2026";
export { TEAM_POOL, type TeamSeed } from "./content/teams";
