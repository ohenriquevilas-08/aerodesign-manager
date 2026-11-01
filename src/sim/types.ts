// Contrato de dados da simulação. Tudo aqui é serializável (vai para o save)
// e não depende de DOM, Preact ou Phaser. Ver docs/architecture.md.

/** Disciplinas do relatório 2026 (Regulamento 11.1). Eixo comum entre equipe, projeto e nota. */
export type Discipline =
  | "conceptual"
  | "aerodynamics"
  | "performance"
  | "stability"
  | "loads"
  | "structures"
  | "electrical";

export type RiskLevel = "none" | "low" | "medium" | "high";

/**
 * Custo de qualquer ação (design §8). Sempre exibido na mesma ordem:
 * horas ⏱, créditos ◆, prazo ⌛, risco ⚠.
 */
export interface Cost {
  /** Horas-pessoa consumidas da equipe. */
  hours: number;
  /** Créditos debitados do caixa. */
  credits: number;
  /** Dias de espera no calendário sem ocupar ninguém (entrega, cura, resposta). */
  leadDays: number;
  risk: RiskLevel;
}

export type ClockSpeed = 0 | 1 | 2 | 4;

export interface Clock {
  /** Horas de jogo desde o início da temporada (SEASON_START). */
  hours: number;
  /** 0 = pausado. */
  speed: ClockSpeed;
}

export type Role = "president" | "captain" | "member";

// ---------------------------------------------------------------------------
// Escala da oficina (design §5.5).
// ---------------------------------------------------------------------------

/** Turnos: manhã 8–12, tarde 13–18, noite 19–22, madrugada 22–3 (pertence ao dia em que começa). */
export type ShiftId = "morning" | "afternoon" | "evening" | "overnight";
/** Dia da semana, 0 = domingo. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
/** Turno da grade semanal, ex.: "1-morning" (segunda de manhã). */
export type SlotKey = `${Weekday}-${ShiftId}`;

export interface WorkshopState {
  /** Lugares na oficina por turno (4 no Ano 1). */
  capacity: number;
  /** Quem tem chave: a oficina só abre com um deles no turno. */
  keyHolders: string[];
  /** Quem está escalado em cada turno da semana (ids de integrantes). */
  schedule: Partial<Record<SlotKey, string[]>>;
}

export interface Member {
  id: string;
  name: string;
  role: Role;
  /** Conhecimento tácito por disciplina, 0–100. */
  knowledge: Record<Discipline, number>;
  fabrication: number;
  piloting: number;
  agility: number;
  /** 0–100; captação (rifa, patrocínio) e seletiva. */
  communication: number;
  /** 0–100; multiplica horas e qualidade. */
  motivation: number;
  /** Horas disponíveis por dia em período normal de aulas. */
  hoursPerDay: number;
  /** Semestre previsto de saída, ex.: "2027.2". */
  graduation: string;
  taskId: string | null;
  /**
   * Horas de jogo seguidas em tarefa ativa; acima de BALANCE.motivation.overloadAfterHours
   * a pessoa está sobrecarregada. Recupera quando fica parada.
   */
  workStreakHours: number;
  /** Turnos com aula no semestre (fim de semana e madrugada nunca têm aula). */
  classSlots: SlotKey[];
  /** Área da formação (content/formations.ts); null = novato sem área ou presidente. */
  area: Discipline | null;
}

/** Candidato da seletiva (design §5.2): vira Member com role "member" ao ser convidado. */
export interface Candidate {
  id: string;
  name: string;
  /** Formato da seletiva que trouxe o candidato (content/selection.ts). */
  format: string;
  /** Disciplina em que o candidato chega sabendo algo. */
  focus: Discipline;
  knowledge: Record<Discipline, number>;
  fabrication: number;
  agility: number;
  communication: number;
  motivation: number;
  hoursPerDay: number;
  graduation: string;
  /** Parecer de um capitão, em PT-BR. */
  opinion: string;
  /** Turnos com aula no semestre; passa para o integrante ao contratar. */
  classSlots: SlotKey[];
}

export type PartType = "wing" | "fuselage" | "tail" | "landingGear" | "powertrain" | "electronics";

/** Estados visíveis (design §7.2). Derivados de `condition`. */
export type PartState = "new" | "worn" | "damaged" | "broken";

export interface Part {
  id: string;
  type: PartType;
  label: string;
  /** 0–100. */
  quality: number;
  /** 0–100. */
  condition: number;
  /**
   * Veio fora da especificação de uma loja (ex.: servo falsificado). A equipe só descobre na
   * inspeção de segurança da competição (design §9.2) ou no relatório final.
   */
  counterfeit?: boolean;
}

/** waiting: esperando prazo ⌛ (readyAt); active: consome horas; done: concluída (fica como histórico). */
/** Dedicação escolhida ao iniciar (content/dedication.ts). */
export type TaskDedication = "rush" | "normal" | "careful";

export type TaskStatus = "waiting" | "active" | "done";

export interface Task {
  id: string;
  /** Id do catálogo de ações. */
  actionId: string;
  label: string;
  /** Horas-pessoa totais e já feitas. */
  hoursTotal: number;
  hoursDone: number;
  /** Momento real (horas de jogo) em que a espera termina, sorteado ao iniciar; null se não há espera. Não mostrar. */
  readyAt: number | null;
  /** Momento prometido (prazo nominal do catálogo); é o que a UI mostra. null se não há espera. */
  expectedReadyAt: number | null;
  status: TaskStatus;
  /** Quem está alocado agora (espelha Member.taskId). Vazio depois de concluída. */
  assignees: string[];
  /** Horas trabalhadas por integrante; base de conhecimento e qualidade na conclusão. */
  contributions: Record<string, number>;
  /** Alvo escolhido no start-action (peça, tarefa ou disciplina), se a ação exige. */
  targetId: string | null;
  /** Momento (horas de jogo) da conclusão; null enquanto não termina. */
  doneAt: number | null;
  /** Rápido, normal ou caprichado: já aplicado em hoursTotal; vira bônus de qualidade na conclusão. */
  dedication: TaskDedication;
  /** Horas-pessoa feitas de madrugada (depois da 1h contam em dobro); tiram qualidade na conclusão. */
  overnightHours?: number;
}

export interface InboxMessage {
  id: string;
  at: number;
  from: string;
  title: string;
  body: string;
  read: boolean;
}

/** Motivo da pausa atual. "start": jogo recém-criado; "manual": jogador pausou. */
/** "order": pedido retido ou entregue; "flight": seu voo na competição (replay); "competition": evento da competição ou da CT. */
export type PauseReason =
  | "start"
  | "manual"
  | "task-done"
  | "deadline-soon"
  | "deadline-passed"
  | "order"
  | "flight"
  | "competition";

export interface PauseInfo {
  reason: PauseReason;
  /** Horas de jogo em que pausou. */
  at: number;
  /** Mensagem da inbox que explica a pausa automática, se houver. */
  messageId: string | null;
}

/** Aviso curto de um comando recusado (ex.: sem caixa). `id` muda a cada aviso novo. */
export interface Warning {
  id: number;
  at: number;
  text: string;
}

export interface RivalTeam {
  id: string;
  name: string;
  institution: string;
  acronym: string;
  city: string;
  state: string;
  /** Arquétipo das rivais de destaque; null para o resto do campo. */
  archetype: string | null;
}

// ---------------------------------------------------------------------------
// Fase 3: projeto da aeronave, relatório, lojas e competição (design §6, §8.4, §9).
// ---------------------------------------------------------------------------

/** Escolhas da prancheta (design §6.1). */
export type DesignPhilosophy = "payload" | "light" | "stable";
export type DesignMaterial = "balsa" | "composite" | "mixed";
export type GearHeight = "low" | "high";

export interface AircraftDesign {
  /** Envergadura b, m (1,5 a 4,0; acima de REGULAR_2026.maxSpan gera PD). */
  span: number;
  /** Superfícies sustentadoras N. */
  surfaces: 1 | 2 | 3;
  /** Potência de pico projetada, W (300 a 600; acima de maxPower gera PP). */
  powerW: number;
  philosophy: DesignPhilosophy;
  material: DesignMaterial;
  gear: GearHeight;
}

/** Número que a equipe enxerga: valor central ± margem (design §6.2). */
export interface Estimate {
  value: number;
  /** Meia largura da faixa: o real costuma estar em value ± margin. */
  margin: number;
}

/**
 * Desvios escondidos do avião em relação ao modelo nominal do projeto. Sorteados pela
 * simulação (rngState) quando o projeto é definido e quando peças entram. NUNCA mostrar:
 * a UI só vê `estimatePerformance`.
 */
export interface AircraftHidden {
  /** Multiplicador do peso vazio real sobre o nominal (ex.: 1,08 = 8% mais pesado). */
  emptyWeightFactor: number;
  /** Multiplicador da capacidade de sustentação real (e daí a carga máxima) sobre a nominal. */
  payloadFactor: number;
  /**
   * Erro da opinião da equipe, de −1 a 1, em frações da margem: a estimativa fica em
   * real + bias × margem × BALANCE.aircraft.biasShare. Ensaios sorteiam de novo. Ausente = 0.
   * NUNCA mostrar, como o resto de `hidden`: revelaria o desempenho real.
   */
  bias?: { emptyWeight: number; payload: number; takeoff: number };
}

/** Ensaios acumulados que estreitam a margem de cada estimativa (design §7.3). */
export interface AircraftEvidence {
  emptyWeight: number;
  payload: number;
  takeoff: number;
}

export interface Aircraft {
  design: AircraftDesign;
  hidden: AircraftHidden;
  /** Mudanças de projeto depois do prazo de 27/set (Apêndice 6: penalidade). */
  lateChanges: number;
  /** Ensaios feitos; ausente = nenhum. */
  evidence?: AircraftEvidence;
  /** Momento (horas de jogo) do voo filmado válido; sem ele não voa na competição. */
  flightVideoAt?: number | null;
}

/** Estimativa de desempenho para uma altitude densidade (design §6.2 e §9.4). */
export interface PerformanceEstimate {
  densityAltitudeM: number;
  emptyWeightKg: Estimate;
  maxPayloadKg: Estimate;
  /** Eficiência estrutural carga ÷ peso vazio (7.7). */
  structuralEfficiency: Estimate;
  /** Corrida até sair do chão com a carga máxima estimada, m (obstáculo aos 55 m). */
  takeoffDistanceM: Estimate;
}

/** Reta de previsão de carga (11.6): carga = a × Hρ + b, com patamar opcional. */
export interface PayloadLine {
  a: number;
  b: number;
  cap: number | null;
}

export interface ReportChapter {
  /** Horas investidas em escrita (ação report-chapter com o capítulo como alvo). */
  hours: number;
  /** Ensaios citados (cada ensaio concluído soma nas disciplinas que alimenta). */
  testsCited: number;
}

/** Relatório e Portal da CT (design §6.2, §9.1). */
export interface ReportState {
  chapters: Record<Discipline, ReportChapter>;
  /** Horas investidas nas plantas (10 pts em Conceitual e 10 em Estruturas, 11.1). */
  drawingsHours: number;
  /** Rascunho das previsões; editável até o envio. */
  predictedEmptyWeightKg: number | null;
  payloadLine: PayloadLine | null;
  /** Momento do envio (horas de jogo). Depois disso as previsões ficam congeladas. */
  submittedAt: number | null;
  /** Nota da CT (NR, 0–185), sorteada no envio. null antes. */
  score: number | null;
  /** Nota da apresentação oral (0–40), dada em 17/out. */
  oralScore: number | null;
  /** Horas de ensaio da apresentação oral; ausente = 0. */
  oralPracticeHours?: number;
}

/** Status de um pedido de loja (design §8.4). */
export type OrderStatus = "processing" | "in-transit" | "held-customs" | "delivered";

export type ShippingMode = "standard" | "express";

export interface OrderLine {
  productId: string;
  quantity: number;
  /** Preço unitário pago (promoções mudam o preço da vitrine). */
  unitPrice: number;
}

export interface Order {
  id: string;
  shopId: string;
  lines: OrderLine[];
  shipping: ShippingMode;
  placedAt: number;
  /** Data prometida no checkout (horas de jogo); é o que a UI mostra. */
  expectedAt: number;
  /** Data real sorteada. Não mostrar. */
  arrivesAt: number;
  status: OrderStatus;
  /** Imposto cobrado na fiscalização; enquanto não pago, o pedido fica parado. */
  customsDue: number | null;
  /** Imposto já pago (◆); ausente = o pedido ainda não passou pela fiscalização com imposto. */
  customsPaid?: number;
  deliveredAt: number | null;
}

/** Estado dinâmico das lojas, por anúncio (id `${shopId}:${productId}`, ver listingId). */
export interface ShopsState {
  /** Unidades disponíveis; ausente = sem limite. */
  stock: Record<string, number>;
  /** Promoções ativas: preço e fim (horas de jogo). */
  sales: Record<string, { price: number; until: number }>;
}

/** Desfechos possíveis de uma bateria (design §9.4). */
export type FlightOutcome =
  /** Voo válido: decolou, passou o obstáculo, fez o circuito e pousou dentro da pista. */
  | "valid"
  /** Não saiu do chão antes do obstáculo de 55 m: voo inválido. */
  | "no-takeoff"
  /** Saiu do chão mas passou baixo demais e rompeu a fita do obstáculo: voo inválido. */
  | "tape-break"
  /** Voo válido, mas parou fora da pista: sem BPO. */
  | "landing-out"
  /** Pouso duro: voo pode valer, mas peças saem danificadas. */
  | "damage"
  /** Perda de controle e queda: peças danificadas ou quebradas. */
  | "crash";

/** Em que trecho a queda acontece (só para `crash`). */
export type CrashPhase = "climb" | "circuit" | "approach";

/**
 * Bateria já resolvida, pronta para a FlightScene tocar (docs/architecture.md, "Voo da competição").
 * Mora na sim porque é a simulação que produz; scenes/flight/playback.ts reexporta.
 */
export interface FlightPlayback {
  battery: number;
  teamName: string;
  /** Carga útil embarcada, kg. */
  payloadKg: number;
  /** Altitude densidade do momento, m (Apêndice 4). */
  densityAltitudeM: number;
  /** Vento na pista, m/s: + de proa (contra a corrida), − de cauda. */
  headwindMs: number;
  /** Onde a roda sai do chão, m; null se não decolou. */
  rotationDistanceM: number | null;
  /** Folga sobre o obstáculo de 0,9 m aos 55 m; negativa = rompeu a fita; null se não chegou voando. */
  obstacleClearanceM: number | null;
  outcome: FlightOutcome;
  /** Distância de parada desde o toque, m; null sem pouso. */
  stopDistanceM: number | null;
  /** Retirada rápida de carga, s; null se não houve. */
  unloadTimeS: number | null;
  /** Trecho da queda; só para "crash". Padrão: "circuit". */
  crashPhase?: CrashPhase;
  /** Rótulos das peças afetadas, para o cartão final ("Trem de pouso danificado"). */
  damagedParts?: string[];
}

/** Pontuação de uma bateria (scoring.ts, 7.7). */
export interface BatteryPoints {
  ee: number;
  pee: number;
  fpv: number;
  fpr: number;
  pvoo: number;
  pac: number;
  bpo: number;
  brc: number;
  pd: number;
  pp: number;
  total: number;
  valid: boolean;
}

/** Id da sua equipe nas filas, resultados e placar da competição. */
export const PLAYER_TEAM_ID = "player";

/** Resultado de uma equipe numa bateria. */
export interface BatteryResult {
  battery: number;
  /** PLAYER_TEAM_ID ou id de RivalTeam. */
  teamId: string;
  payloadKg: number;
  densityAltitudeM: number;
  outcome: FlightOutcome;
  /** null quando o voo não chega a ser pontuado (não decolou, rompeu a fita, queda). */
  points: BatteryPoints | null;
  /** Só a sua equipe e as rivais de destaque guardam o replay; o resto do campo, null. */
  playback: FlightPlayback | null;
  /** Momento do voo (horas de jogo). */
  at: number;
}

/** Condições na pista, atualizadas pelo relógio durante a competição (Apêndice 4). */
export interface FieldWeather {
  temperatureK: number;
  pressureHpa: number;
  headwindMs: number;
}

export type CompetitionPhase = "inspection" | "flights" | "finished";

export interface CompetitionState {
  phase: CompetitionPhase;
  /** Bateria em andamento (1, 2, 3...). */
  battery: number;
  /** Ordem de voo da bateria atual (ids de equipe; PLAYER_TEAM_ID incluso se classificado). */
  queue: string[];
  /** Índice da próxima equipe a voar em `queue`. */
  queueIndex: number;
  /** Carga escolhida para a sua próxima decolagem, kg; null = ainda não escolheu. */
  plannedPayloadKg: number | null;
  weather: FieldWeather;
  results: BatteryResult[];
  /** Nota da Competição de Projeto (NR + oral) por equipe, inclusive PLAYER_TEAM_ID. */
  projectScores: Record<string, number>;
  /** Penalidades acumuladas por equipe (Apêndice 6). */
  penalties: Record<string, number>;
  /** Itens da inspeção de segurança reprovados que ainda precisam de correção (design §9.2). */
  inspectionIssues: string[];
  /** Equipes fora de uma bateria (id → número da bateria), ex.: abortou com trem alto e rompeu a fita. */
  suspended?: Record<string, number>;
}

/** Linha do placar (design §9.3: melhor bateria + BCF + projeto − penalidades). */
export interface Standing {
  teamId: string;
  teamName: string;
  bestBattery: number;
  bcf: number;
  project: number;
  penalties: number;
  total: number;
  position: number;
}

export interface GameState {
  version: 5;
  seed: number;
  rngState: number;
  clock: Clock;
  teamName: string;
  credits: number;
  members: Member[];
  /** Conhecimento documentado da equipe por disciplina (piso para todos). */
  documented: Record<Discipline, number>;
  parts: Part[];
  /** Consumíveis em estoque (ex.: balsa), por id de item. */
  stock: Record<string, number>;
  /** Equipamentos permanentes possuídos (ex.: "scale"). */
  equipment: string[];
  tasks: Task[];
  inbox: InboxMessage[];
  rivals: RivalTeam[];
  /** Alcance de divulgação acumulado (cartazes, redes, sala, stand); decai por dia e a seletiva consome. */
  outreach: number;
  /** Candidatos da última seletiva ainda sem resposta. Convite é gratuito. */
  candidates: Candidate[];
  /** Não nulo enquanto o relógio está pausado (speed 0): diz por quê. */
  pause: PauseInfo | null;
  /** Último comando recusado; a UI mostra quando `id` muda. */
  warning: Warning | null;
  /** Contador para ids determinísticos de tarefas, peças, mensagens e avisos. */
  nextId: number;
  /** Avião da equipe; null até o primeiro set-design na prancheta. */
  aircraft: Aircraft | null;
  report: ReportState;
  orders: Order[];
  shops: ShopsState;
  /** null até o dia da competição de voo. */
  competition: CompetitionState | null;
  /** Oficina: lotação, chaves e escala semanal (design §5.5). */
  workshop: WorkshopState;
  /** Notícias do Portal (Fase 4, S5), da mais antiga para a mais nova. */
  news: NewsItem[];
  /** Extrato de tudo que mexeu no caixa ◆ (Fase 4, S6), em ordem cronológica. */
  ledger: LedgerEntry[];
  /** Ensaios concluídos (Fase 4, S6), em ordem cronológica; a leitura é testHistory(). */
  testLog: TestRecord[];
}

// ---------------------------------------------------------------------------
// Fase 4: notícias, extrato e histórico de ensaios.
// ---------------------------------------------------------------------------

export type NewsKind = "promo" | "stock" | "deadline" | "rival";

export interface NewsItem {
  id: string;
  /** Horas de jogo em que saiu. */
  at: number;
  kind: NewsKind;
  title: string;
  body: string;
  /** Loja citada (promoção, estoque), se houver. */
  shopId?: string;
  /** Anúncio citado (`shopId:productId`), se houver. */
  listingId?: string;
}

export type LedgerKind = "order" | "customs" | "raffle" | "sponsor" | "action" | "dev";

export interface LedgerEntry {
  /** Horas de jogo. */
  at: number;
  /** Positivo = entrada, negativo = saída. */
  credits: number;
  kind: LedgerKind;
  label: string;
}

export type TestKind = "structural" | "thrust" | "flight" | "video";

/** Ensaio concluído, guardado para o histórico (testHistory). */
export interface TestRecord {
  at: number;
  test: TestKind;
  /** Altitude densidade do dia (Apêndice 4), m. */
  densityAltitudeM: number;
  /** true = sem incidente. */
  ok: boolean;
  summary: string;
  /** Rótulos das peças que perderam condição no ensaio. */
  affectedParts: string[];
  /** Carga medida no voo de ensaio, kg (só flight); alimenta a reta de previsão. */
  payloadKg: number | null;
}
