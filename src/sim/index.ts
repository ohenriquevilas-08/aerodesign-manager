// Ponto de entrada público da simulação. UI e cenas importam daqui, nunca dos arquivos internos.

export * from "./types";
export * from "./scoring";
export * from "./time";
export { applyCommand, type Command } from "./commands";
export { createGame, drawField, DISCIPLINES, FIELD_SIZE } from "./state";
export { ACTIONS, categoryOf, type ActionDef, type ActionCategory } from "./content/actions";
export { REGULAR_2026, REPORT_CHAPTERS } from "./content/regulation2026";
export { OFFICIAL_CALENDAR, SEASON_START, type Deadline } from "./content/calendar2026";
export { TEAM_POOL, type TeamSeed } from "./content/teams";
