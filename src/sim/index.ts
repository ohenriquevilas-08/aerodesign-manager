// Ponto de entrada público da simulação. UI e cenas importam daqui, nunca dos arquivos internos.

export * from "./types";
export * from "./scoring";
export * from "./time";
export { applyCommand, type Command } from "./commands";
export { deserializeState, SAVE_VERSION, serializeState } from "./save";
export { createGame, DEFAULT_ADVISOR_NAME, drawField, DISCIPLINES, FIELD_SIZE } from "./state";
export {
  canWork,
  DISCIPLINE_LABELS,
  effectiveKnowledge,
  energyFactor,
  energyQualityFactor,
  isExhausted,
  isOverloaded,
  memberHoursPerDay,
  motivationFactor,
  rosterMembers,
  traineeProgress
} from "./team";
export { energyDrainPerHour, energyOutlook, energyRecoveryPerHour, type EnergyOutlook, type EnergyTrend } from "./energy";
export {
  APTITUDE_LABELS,
  aptitudeFactor,
  drawBaseKnowledge,
  drawPreferences,
  isAptitudeRevealed,
  revealAptitude,
  revealText,
  type Preferences
} from "./aptitude";
export { closeTask, taskKeeps } from "./tasks";
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
  type YieldMode,
  type EquipmentItem,
  type StockItem
} from "./content/actions";
export { BALANCE } from "./content/balance";
export {
  aspectRatio,
  DEFAULT_DESIGN,
  designProblem,
  DESIGN_LIMITS,
  estimateDesign,
  estimatePerformance,
  installedParts,
  MASS_ITEM_LABELS,
  MASS_ITEMS,
  massBudget,
  maxPropDiameterIn,
  missingParts,
  missingPartsText,
  PART_TYPE_LABELS,
  stabilityEstimate,
  staticMarginStatus,
  wingAreaM2
} from "./aircraft";
export { compareDesigns, defaultTargetPayload, missionRequirements } from "./engineering";
export {
  cancelFlightTest,
  flightTestCost,
  flightTestCredits,
  scheduleProblem,
  upcomingEvents,
  venueDensityAltitude,
  venueWeather,
  type ScheduleFlightTestRequest
} from "./flightTests";
export { findVenue, TEST_VENUES, type TestVenue, type VenueScenery } from "./content/testVenues";
export { drawLook, LOOK_OPTIONS, TEAM_SHIRT_COLOR } from "./looks";
export {
  estimateReportScore,
  reportChecklist,
  submitBlocker,
  type ChapterChecklist,
  type ChapterState,
  type PredictionState,
  type ReportChecklist
} from "./report";
export { listingPrice, listingStock, type OrderRequest } from "./shop";
export {
  COMPETITION_START,
  currentDensityAltitude,
  inspectionFindings,
  inspectionIssues,
  MIN_TEAMS_AHEAD_TO_REVISE,
  standings,
  teamsAhead,
  type InspectionFinding
} from "./competition";
export { eventView, type EventBlockView, type EventStage, type EventView } from "./events";
export { drawPerson } from "./naming";
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
export { crewEfficiency, crewRates, positionShare, estimateRemainingDays, estimateTaskDays, leadDaysRange, taskEta, type TaskEta } from "./crew";
export {
  applicantView,
  applicantViews,
  arrivalFraction,
  expectedApplicants,
  funnelCounts,
  interviewHours,
  interviewQuestionList,
  interviewSpread,
  isReferralCampaign,
  missingCast,
  referralAskYield,
  referralBase,
  selectionView,
  selectionWindow,
  SELECTION_STAGE_LABELS,
  type ApplicantView,
  type FunnelCounts,
  type SelectionView
} from "./selection";
export { pauseNotices, type NoticeTarget, type PauseNotice } from "./pauseNotice";
export { groupCountFor } from "./eventSelection";
export { COURSES, findCourse, SELECTION_FORMATS, type CourseDef, type SelectionFormat, type SelectionFormatDef } from "./content/selection";
export { INTERVIEW_QUESTIONS, findQuestion, type InterviewQuestion } from "./content/interviewQuestions";
export { hasHistory, PHRASES, phrasesFor, type PhraseDef, type PhraseKind, type PhraseRequires } from "./content/applicantPhrases";
export { REGULAR_2026, REPORT_CHAPTERS } from "./content/regulation2026";
export {
  ACADEMIC_PERIODS,
  OFFICIAL_CALENDAR,
  REGULATION_DATE,
  SEASON_START,
  TRAINEE_END,
  TRAINEE_START,
  type AcademicPeriod,
  type Deadline,
  type DeadlineKind
} from "./content/season2026";
export { AGENDAS, findAgenda, FOUNDERS, type AgendaDef, type FounderDef } from "./content/founders";
export {
  actionProblem,
  advisorView,
  daysToRegulation,
  defaultFounding,
  FOUNDER_IDS,
  presidentView,
  regulationPublished,
  REGULATION_HOURS,
  traineesOf,
  type AdvisorView,
  type AgendaStatus,
  type FoundTeamRequest,
  type PresidentView
} from "./season";
export {
  calendarMonth,
  seasonOverview,
  SEASON_MONTHS,
  type CalendarDay,
  type CalendarFlightTest,
  type CalendarMonth,
  type CalendarOrder,
  type CalendarPlanned,
  type CalendarTask,
  type ScheduleActionRequest,
  type SeasonMonth
} from "./calendar";
export { TEAM_POOL, type TeamSeed } from "./content/teams";
export { formationView, type FormationAreaView, type FormationView } from "./formation";
export { DEFAULT_CATEGORY, FORMATIONS, type FormationArea, type FormationCategory } from "./content/formations";
export { financeSummary, LEDGER_LABELS, type FinanceBucket, type FinanceSummary } from "./ledger";
export { testHistory, TEST_LABELS, type TestHistory, type TestHistoryEntry } from "./testlog";
export { addNews, newsFeed, promoEndsAt } from "./news";
export { SELLER_REVIEWS, sellerReview, type SellerComment, type SellerReview } from "./content/sellerReviews";
export { currentShift, slotStatus, suggestSchedule, workshopNow, type SlotStatus } from "./workshop";
export { findShift, parseSlot, SHIFTS, slotKey, WEEKDAYS, type ShiftDef, type WeekdayDef } from "./content/workshop";
