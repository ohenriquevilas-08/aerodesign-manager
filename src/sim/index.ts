// Ponto de entrada público da simulação. UI e cenas importam daqui, nunca dos arquivos internos.

export * from "./types";
export * from "./scoring";
export * from "./time";
export { applyCommand, type Command } from "./commands";
export { createGame, drawField, DISCIPLINES, FIELD_SIZE } from "./state";
export { canWork, DISCIPLINE_LABELS, effectiveKnowledge, isOverloaded, memberHoursPerDay, motivationFactor } from "./team";
export { partState, PART_STATE_LABELS } from "./parts";
export {
  ACTIONS,
  categoryOf,
  findAction,
  type ActionDef,
  type ActionCategory,
  type ActionEffect,
  type ActionTarget,
  type ActionSkill,
  type Crew,
  type EquipmentItem,
  type StockItem
} from "./content/actions";
export { BALANCE } from "./content/balance";
export { DEFAULT_DESIGN, DESIGN_LIMITS, estimatePerformance, installedParts, missingParts, missingPartsText, PART_TYPE_LABELS } from "./aircraft";
export { estimateReportScore } from "./report";
export { listingPrice, listingStock, type OrderRequest } from "./shop";
export { COMPETITION_START, currentDensityAltitude, inspectionIssues, MIN_TEAMS_AHEAD_TO_REVISE, standings, teamsAhead } from "./competition";
export {
  findListing,
  findProduct,
  findShop,
  LISTINGS,
  listingId,
  PRODUCTS,
  SHOPS,
  type Listing,
  type ProductDef,
  type ProductGrant,
  type Review,
  type ShippingOption,
  type ShopDef,
  type ShopOrigin
} from "./content/shops";
export { DEDICATIONS, findDedication, type Dedication, type DedicationDef } from "./content/dedication";
export { applicantBand, crewQuality, estimateOutcome, outcomeBand, sponsorChance, type OutcomeBand, type OutcomeEstimate } from "./outcome";
export { crewRates, estimateRemainingDays, estimateTaskDays, leadDaysRange } from "./crew";
export { expectedApplicants, missingCast } from "./selection";
export { SELECTION_FORMATS, type SelectionFormat, type SelectionFormatDef } from "./content/selection";
export { REGULAR_2026, REPORT_CHAPTERS } from "./content/regulation2026";
export { OFFICIAL_CALENDAR, SEASON_START, type Deadline } from "./content/calendar2026";
export { TEAM_POOL, type TeamSeed } from "./content/teams";
export { currentShift, slotStatus, suggestSchedule, workshopNow, type SlotStatus } from "./workshop";
export { findShift, parseSlot, SHIFTS, slotKey, WEEKDAYS, type ShiftDef, type WeekdayDef } from "./content/workshop";
