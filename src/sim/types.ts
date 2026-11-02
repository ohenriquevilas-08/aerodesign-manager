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

/** Fase 6: o presidente é um aluno (NPC); o jogador é o orientador (GameState.advisor). */
export type Role = "president" | "captain" | "member" | "trainee";

/** Perfil do presidente (Fase 6, S2): o tipo de tarefa que ele puxa. */
export type PresidentAgenda = "report" | "flight" | "funding" | "balanced";

/** A "cara" de um fundador: o que gosta de fazer (content/founders.ts). */
/** "management" e "marketing" são inclinações de gestão (sem área de negócio nem árvore de habilidades: Fase 7). */
export type FounderFlair = "design" | "build" | "fly" | "organize" | "management" | "marketing";

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

/** Fase 8, S5: facilidade escondida numa disciplina; multiplica o ganho de conhecimento. */
export type Aptitude = "slow" | "normal" | "fast";

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
   * Fase 8, S4: energia 0–100. Trabalhar gasta (mais de madrugada); descansar, dormir e o fim de semana
   * recuperam. Abaixo de BALANCE.energy.tiredBelow rende menos; abaixo de exhaustedBelow para.
   */
  energy: number;
  /** Fase 8, S5: o que a pessoa diz gostar (0–2 disciplinas); pode estar errado. */
  statedLikes: Discipline[];
  /** Fase 8, S5: o que ela gosta de verdade (escondido): trabalhar nisso anima. */
  likes: Discipline[];
  /** Fase 8, S5: o que ela detesta (escondido): trabalhar nisso gasta mais energia. */
  dislikes: Discipline[];
  /** Fase 8, S5: facilidade em cada disciplina (escondida até ser revelada). */
  aptitude: Record<Discipline, Aptitude>;
  /** Fase 8, S5: disciplinas cuja facilidade já apareceu (horas de trabalho ou, na Fase 9, a árvore do orientador). */
  revealedAptitude: Discipline[];
  /** Fase 8, S5: horas de trabalho acumuladas por disciplina; revelam a facilidade. */
  studyHours: Record<Discipline, number>;
  /** Turnos com aula no semestre (fim de semana e madrugada nunca têm aula). */
  classSlots: SlotKey[];
  /** Área da formação (content/formations.ts); null = novato sem área ou presidente. */
  area: Discipline | null;
  /** Aparência do boneco isométrico (Fase 5, S3), sorteada ao criar. */
  look: MemberLook;
  /** Fase 6: perfil que o aluno traz se for eleito presidente; só vale para o presidente. */
  agenda?: PresidentAgenda;
  /** Fase 6: o que o fundador gosta de fazer. */
  flair?: FounderFlair;
  /** Fase 6: horas de treino acumuladas na etapa trainee (só trainee). */
  trainingHours?: number;
}

// ---------------------------------------------------------------------------
// Fase 5, S3: aparência dos integrantes (boneco isométrico, docs/phases/fase-5.md C2).
// ---------------------------------------------------------------------------

export type Accessory = "glasses" | "cap" | "headband";

export interface MemberLook {
  /** Tom de pele, índice 0–5 (a paleta fica nas cenas). */
  skin: number;
  /** Estilo de cabelo, 0–4. */
  hair: number;
  /** Cor do cabelo, índice 0–5. */
  hairColor: number;
  /** Cor da camiseta, 0xRRGGBB: sempre a da equipe (TEAM_SHIRT_COLOR). */
  shirt: number;
  /** Ausente = nenhum. */
  accessory?: Accessory;
  /** Fase 7: gênero sorteado com o nome (BALANCE.people.femaleShare); ausente = masculino. */
  female?: boolean;
}

// ---------------------------------------------------------------------------
// Fase 9, S1: seletiva imersiva (docs/phases/fase-9.md). Inscrito não é membro: o perfil completo
// fica escondido em `Applicant.profile` e a UI só lê `applicantView` (o que já foi revelado).
// ---------------------------------------------------------------------------

/** Curso do inscrito (content/selection.ts, COURSES). */
export type CourseId = "aeronautical" | "mechanical" | "electrical" | "computing" | "production";

/**
 * Onde a campanha está (o que vem a seguir):
 * promotion (tarefa de divulgação e abertura) · open (inscrições) · lecture (inscrições fechadas,
 * esperando a palestra) · dynamic (esperando o dia da dinâmica) · shortlist (escolher quem vai para
 * a entrevista) · interview (agendar entrevistas) · interviewing (entrevistas em andamento) ·
 * decision (aprovar).
 */
export type SelectionStage = "promotion" | "open" | "lecture" | "dynamic" | "shortlist" | "interview" | "interviewing" | "decision";

export type ApplicantStage = "applied" | "lecture" | "dynamic" | "interview" | "approved" | "rejected" | "absent";

/** Triagem do jogador: chamar, talvez, não. */
export type ApplicantTag = "call" | "maybe" | "no";

/** Perfil escondido do inscrito: o que vira o Member se for aprovado. */
export interface ApplicantProfile {
  /** Disciplina em que chega sabendo algo. */
  focus: Discipline;
  knowledge: Record<Discipline, number>;
  fabrication: number;
  agility: number;
  communication: number;
  motivation: number;
  hoursPerDay: number;
  graduation: string;
  statedLikes: Discipline[];
  likes: Discipline[];
  dislikes: Discipline[];
  aptitude: Record<Discipline, Aptitude>;
  classSlots: SlotKey[];
  look: MemberLook;
}

export interface InterviewAnswer {
  questionId: string;
  text: string;
}

/** O que a UI já pode saber do inscrito além do formulário. */
export interface ApplicantRevealed {
  /** Presença na palestra; null antes dela. */
  lecture: "present" | "absent" | null;
  /** Compareceu à dinâmica; null antes dela. */
  dynamic: boolean | null;
  /** Respostas da entrevista, na ordem em que apareceram. */
  answers: InterviewAnswer[];
}

export interface Applicant {
  id: string;
  name: string;
  course: CourseId;
  /** Período do curso, 1 a 10. */
  semester: number;
  /** A frase do formulário: "por que quero entrar" (pode enganar). */
  motivationText: string;
  stage: ApplicantStage;
  tag: ApplicantTag | null;
  /** Anotações da dinâmica e da equipe, em PT-BR. */
  notes: string[];
  revealed: ApplicantRevealed;
  /** Perguntas escolhidas para a entrevista (até BALANCE.selection.maxQuestions). */
  questionIds: string[];
  /** Seletiva por indicação: id do integrante que indicou. */
  referredBy?: string;
  /** ESCONDIDO: nunca vai para a UI (use applicantView). */
  profile: ApplicantProfile;
}

/** Entrevistas agendadas: quem entrevista, quem é entrevistado e a tarefa que as conduz. */
export interface InterviewPlan {
  applicantIds: string[];
  memberIds: string[];
  taskId: string;
  /** Quantas já foram feitas (respostas reveladas). */
  done: number;
}

export interface SelectionCampaign {
  id: string;
  /** Formato (content/selection.ts). */
  format: string;
  stage: SelectionStage;
  /** Horas de jogo; null enquanto a divulgação (etapa 1) não terminou. */
  openedAt: number | null;
  closesAt: number | null;
  lectureAt: number | null;
  dynamicDayAt: number | null;
  applicants: Applicant[];
  /** Reservado: as vagas são quantos o jogador aprova (approve-applicants). */
  vacancies: number | null;
  /** Como os inscritos chegam: total sorteado na abertura, extra por divulgação nas inscrições, os que já chegaram e o alcance já contado. */
  arrival: { total: number; extra: number; arrived: number; outreachSeen: number };
  interviews: InterviewPlan | null;
  /** Triagem com o presidente (fase-9.md, ajustes do playtest): etapas já enviadas e o último parecer. */
  triage: TriageState;
}

/** Etapas que só abrem depois da triagem enviada ao presidente: a palestra ("lecture") e a dinâmica ("dynamic"). */
export type TriageGate = "lecture" | "dynamic";

/** O parecer do presidente sobre a triagem: texto curto e até 2 nomes de que ele discorda. */
export interface TriageReview {
  gate: TriageGate;
  opinion: string;
  disagreements: TriageDisagreement[];
}

export interface TriageDisagreement {
  applicantId: string;
  /** Marca que o presidente daria. */
  suggested: ApplicantTag;
  reason: string;
  /** null = ainda esperando; true = aceitou (a marca mudou); false = manteve a sua. */
  accepted: boolean | null;
}

export interface TriageState {
  /** Etapas cuja triagem já foi enviada. */
  sent: TriageGate[];
  review: TriageReview | null;
  /** A etapa que já avisou "falta enviar a triagem" (um aviso só por etapa). */
  nagged: TriageGate[];
}

/** Quem está na dinâmica (espelho enxuto do inscrito para as cenas; ver GameState.candidates). */
export interface DynamicsPerson {
  id: string;
  name: string;
  look: MemberLook;
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
  /**
   * Fase 8, S2: peça fabricada só até uma etapa (0–1 do trabalho). Não voa; uma nova tarefa de
   * fabricar com esta peça como alvo termina o que falta.
   */
  partial?: number;
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
  /** Momento (horas de jogo) em que a tarefa começou. */
  startedAt: number;
  /** Momento (horas de jogo) da conclusão; null enquanto não termina. */
  doneAt: number | null;
  /** Rápido, normal ou caprichado: já aplicado em hoursTotal; vira bônus de qualidade na conclusão. */
  dedication: TaskDedication;
  /** Horas-pessoa feitas de madrugada (depois da 1h contam em dobro); tiram qualidade na conclusão. */
  overnightHours?: number;
  /**
   * Fase 8, S2: quanto a tarefa entrega ao todo, na unidade do efeito (pontos de alcance, inscritos,
   * horas de relatório, 1 = peça inteira); definido ao iniciar. null: só entrega no fim.
   */
  yieldTotal: number | null;
  /** Fase 8, S2: quanto já foi entregue (mesma unidade de yieldTotal); nada é entregue duas vezes. */
  yielded: number;
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
/** "order": pedido retido ou entregue; "flight": seu voo na competição (replay); "competition": evento da competição ou da CT; "flight-test": dia de ensaio de voo agendado. */
export type PauseReason =
  | "start"
  | "manual"
  | "task-done"
  | "deadline-soon"
  | "deadline-passed"
  | "order"
  | "flight"
  | "competition"
  | "flight-test"
  /** Fase 7: dia da dinâmica da seletiva (evento). */
  | "selection-day"
  /** Fase 9: a palestra da seletiva aconteceu (aviso com a presença). */
  | "selection"
  /** Fase 9: a palestra virou evento (chamada "Hoje: ..."). */
  | "selection-lecture"
  /** Fase 9: a triagem da etapa precisa ser enviada ao presidente. */
  | "triage"
  /** Fase 6: uma ação agendada não pôde começar (falta de gente, caixa ou pré-condição). */
  | "scheduled";

export interface PauseInfo {
  reason: PauseReason;
  /** Horas de jogo em que pausou. */
  at: number;
  /** Mensagem da inbox que explica a pausa automática, se houver. */
  messageId: string | null;
  /** Outros motivos que pausaram no mesmo instante, em ordem (o aviso central os põe em fila). */
  also?: { reason: PauseReason; messageId: string }[];
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
export type WingPosition = "high" | "low";

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
  // Fase 5, S1 (design §6.1): engenharia de sistemas.
  /** Corda média aerodinâmica, m. Alongamento = span / chordM (derivado). */
  chordM: number;
  /** Asa alta (estabilidade lateral, efeito pêndulo) ou baixa (efeito solo na corrida). */
  wingPosition: WingPosition;
  /** Volume de cauda horizontal VH = (Sh × lh) / (S × c), ~0,3–0,7. Ignorado na asa voadora. */
  tailVolume: number;
  /** Posição do CG, % da corda média a partir do bordo de ataque. */
  cgPercentMac: number;
  /** Diâmetro da hélice, polegadas; o trem limita o máximo (maxPropDiameterIn). */
  propDiameterIn: number;
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
  bias?: { emptyWeight: number; payload: number; takeoff: number; stability?: number };
  /**
   * Fase 5: desvio de cada subsistema sobre a massa nominal (multiplicador). Ausente = 1.
   * Sorteado no primeiro set-design, como o resto.
   */
  massFactors?: Partial<Record<MassItemId, number>>;
  /** Fase 5: margem estática real − nominal, % CMA (onde o CG cai de fato). Ausente = 0. */
  staticMarginOffset?: number;
}

/** Ensaios acumulados que estreitam a margem de cada estimativa (design §7.3). */
export interface AircraftEvidence {
  emptyWeight: number;
  payload: number;
  takeoff: number;
  /** Fase 5: voos que mostraram onde está o ponto neutro. Ausente = 0. */
  stability?: number;
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
  /** Local do ensaio de voo (content/testVenues.ts); ausente = pista da competição. */
  venueId?: string;
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
  /** Fase 7: pendências da inspeção aceitas com penalidade (ids de inspectionFindings); não travam o voo. */
  waivedIssues?: string[];
  /** Fase 7: bateria em que você declarou a carga (a decisão do bloco). */
  payloadDeclaredFor?: number;
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

// ---------------------------------------------------------------------------
// Fase 6: orientador, agenda do presidente e ações agendadas.
// ---------------------------------------------------------------------------

/** O jogador: professor orientador, permanente de ano para ano. Reputação 0–100, só exibida no Ano 1. */
export interface Advisor {
  name: string;
  reputation: number;
}

/** Um dia do registro da agenda: houve alguma tarefa alinhada em andamento? */
export interface AgendaDay {
  /** Dia de jogo (Math.floor(horas / 24)). */
  day: number;
  hit: boolean;
}

/** Ação do catálogo marcada para começar sozinha em `startAt` (horas de jogo). */
export interface PlannedAction {
  id: string;
  actionId: string;
  /** Horas de jogo (use dateToHours para uma data); precisa estar no futuro ao agendar. */
  startAt: number;
  targetId: string | null;
  dedication: TaskDedication;
  /** Quem entra na tarefa ao começar; vazio = a tarefa nasce sem ninguém alocado. */
  memberIds: string[];
}

export interface GameState {
  version: 11;
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
  /**
   * @deprecated Fase 9: espelho dos participantes da dinâmica (id, nome, aparência), só para
   * src/scenes/event/source.ts até a frente de Cenas (C1) ler `selection`. Vazio fora do evento.
   */
  candidates: DynamicsPerson[];
  /** Fase 9: a campanha de seletiva em andamento (uma por vez); null = nenhuma. */
  selection: SelectionCampaign | null;
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
  /** Ensaios de voo agendados, feitos e cancelados (Fase 5, S2), na ordem em que foram marcados. */
  flightTests: FlightTest[];
  /** Fase 6: o jogador, como professor orientador. */
  advisor: Advisor;
  /** Fase 6: true até o comando found-team (abertura); o relógio fica pausado. */
  founding: boolean;
  /** Fase 6: a tarefa "Leitura do regulamento" foi concluída. */
  regulationRead: boolean;
  /** Fase 6: ações agendadas, em ordem de criação; viram tarefa em `startAt`. */
  plannedActions: PlannedAction[];
  /** Fase 6: últimos dias da agenda do presidente (BALANCE.agenda.logDays). */
  agendaLog: AgendaDay[];
  /** Fase 7: evento imersivo em andamento (ou esperando a chamada); o relógio fica parado. */
  activeEvent: ActiveEvent | null;

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
  /** Fase 5: decolagem de um ensaio agendado, com o replay e o evento de origem. */
  playback?: FlightPlayback;
  flightTestId?: string;
}

// ---------------------------------------------------------------------------
// Fase 5, S1: orçamento de massa, estabilidade e requisitos da missão (design §6).
// ---------------------------------------------------------------------------

/** Subsistemas do orçamento de massa. */
export type MassItemId = "wing" | "fuselage" | "tail" | "landingGear" | "powertrain" | "battery" | "electronics";

export interface MassItem {
  id: MassItemId;
  label: string;
  kg: Estimate;
}

/** Peso estimado por subsistema; `total` é o peso vazio de estimatePerformance. */
export interface MassBudget {
  items: MassItem[];
  total: Estimate;
}

export type RequirementStatus = "ok" | "risk" | "fail";

/** Margem estática e ponto neutro estimados (% CMA a partir do bordo de ataque). */
export interface StabilityEstimate {
  neutralPointPercentMac: Estimate;
  /** Margem estática = ponto neutro − CG. */
  staticMarginPercentMac: Estimate;
  cgPercentMac: number;
  /** Pela faixa STATIC_MARGIN_BANDS, contando a margem de erro. */
  status: RequirementStatus;
}

export type RequirementId = "takeoff-run" | "obstacle-clearance" | "static-margin" | "span" | "power" | "empty-weight";

export interface MissionRequirement {
  id: RequirementId;
  label: string;
  /** Alvo em texto, para a lista: "≤ 55 m", "5–20 % CMA". */
  target: string;
  /** Limites numéricos do alvo, na unidade de `value`. */
  limit: { min?: number; max?: number };
  value: Estimate;
  unit: string;
  /** ok: passa mesmo no pior caso da margem; risk: passa no valor central; fail: não passa. */
  status: RequirementStatus;
}

/** Um lado da comparação de projetos (compareDesigns). */
export interface DesignSnapshot {
  design: AircraftDesign;
  requirements: MissionRequirement[];
  mass: MassBudget;
  stability: StabilityEstimate;
  /** Multiplicador de configuração (7.5): superfícies × envergadura. */
  multiplier: number;
  /** Carga máxima estimada na Hρ da comparação, kg. */
  maxPayloadKg: Estimate;
  /** Nota estimada de uma bateria com a carga-alvo e previsões certeiras (7.7). */
  flightScore: Estimate;
}

export interface DesignComparison {
  densityAltitudeM: number;
  targetPayloadKg: number;
  a: DesignSnapshot;
  b: DesignSnapshot;
}

// ---------------------------------------------------------------------------
// Fase 5, S2: ensaio de voo como evento (design §7.3).
// ---------------------------------------------------------------------------

/** Piloto do ensaio: um integrante ou um piloto contratado. */
export type FlightTestPilot = { memberId: string } | { hired: true };

export type FlightTestStatus = "scheduled" | "done" | "cancelled";

/** Uma decolagem do ensaio, resolvida pelo motor de voo da competição. */
export interface FlightTestTakeoff {
  payloadKg: number;
  outcome: FlightOutcome;
  densityAltitudeM: number;
  at: number;
  playback: FlightPlayback;
}

export interface FlightTest {
  id: string;
  venueId: string;
  /** Dia de jogo (Math.floor(horas / 24)). */
  day: number;
  /** Hora da primeira decolagem (horas de jogo). */
  at: number;
  pilot: FlightTestPilot;
  crew: string[];
  payloadPlanKg: number[];
  filmed: boolean;
  status: FlightTestStatus;
  /** ◆ pagos adiantado (local + piloto contratado); base do reembolso. */
  paidCredits: number;
  /** Quando foi marcado (horas de jogo). */
  scheduledAt: number;
  /** Preenchido no dia, na ordem das decolagens. */
  takeoffs: FlightTestTakeoff[];
  densityAltitudeM: number | null;
  /** Rótulos das peças danificadas no transporte. */
  transportDamage: string[];
  /** Resumo do dia (o mesmo texto da inbox); null antes. */
  summary: string | null;
}

/** Item de upcomingEvents: ensaio agendado ou a competição. */
export interface UpcomingEvent {
  kind: "flight-test" | "competition";
  /** Id do FlightTest ou "competition". */
  id: string;
  at: number;
  title: string;
  /** Dias inteiros até o evento (0 = hoje). */
  daysLeft: number;
  venueId?: string;
}

// ---------------------------------------------------------------------------
// Fase 7, S1: modo evento (docs/phases/fase-7.md).
// ---------------------------------------------------------------------------

export type EventKind = "selection-day" | "selection-lecture" | "flight-test" | "competition";

export type EventBlockKind =
  | "arrival"
  | "briefing"
  | "exhibition"
  | "inspection"
  | "flights"
  | "awards"
  | "reception"
  | "presentation"
  | "process"
  | "questions"
  | "closing"
  | "challenge"
  | "interviews"
  | "deliberation"
  | "travel"
  | "assembly"
  | "takeoff"
  | "teardown";

/** Um bloco da programação do dia. `startsAt` = hora do dia (0–24, fracionária). */
export interface EventBlock {
  id: string;
  startsAt: number;
  label: string;
  kind: EventBlockKind;
}

export interface EventOption {
  id: string;
  label: string;
  /** Custo no formato da casa; `hours` aqui são horas de trabalho do dia (cansam a equipe). */
  cost: Cost;
  hint: string;
  /** Preenchido quando a opção não pode ser escolhida (ex.: falta caixa); o texto é o motivo. */
  blocked?: string;
}

export interface EventDecision {
  id: string;
  prompt: string;
  options: EventOption[];
}

export interface EventLogEntry {
  /** Horas de jogo (relógio do evento). */
  at: number;
  /** Id do bloco em que aconteceu. */
  blockId: string;
  text: string;
  tone: "info" | "good" | "bad";
}

export interface EventSummary {
  title: string;
  lines: string[];
  /** Pontos da sua equipe no evento (competição: melhor bateria); null quando não se aplica. */
  points: number | null;
  /** Peças afetadas (rótulos com o estado). */
  damage: string[];
  /** O que a equipe aprendeu ou ficou sabendo. */
  knowledge: string[];
  /** ◆ gastos nas decisões do evento (o que foi pago antes, como o local do ensaio, não entra). */
  creditsSpent: number;
}

/** Grupo da dinâmica da seletiva (desafio prático). */
export interface DynamicsGroup {
  id: string;
  name: string;
  candidateIds: string[];
  /** Distância do planador na vinda da simulação, m; null antes do desafio. */
  gliderDistanceM: number | null;
}

export interface SelectionDayContext {
  kind: "selection-day";
  /** Inscritos que vieram à dinâmica (ids de Applicant). */
  candidateIds: string[];
  groups: DynamicsGroup[];
  /** Primeiro grupo que você acompanhou de perto (as cenas leem este); null = nenhum ainda. */
  watchedGroupId: string | null;
  /** Grupos acompanhados de perto, em ordem (até BALANCE.selection.watchedGroups). */
  watchedGroupIds: string[];
  /** A escolha dos grupos acabou (atingiu o limite ou você disse "chega"). */
  watchDone: boolean;
  /** Quem travou no desafio; null = ninguém. */
  frozeId: string | null;
  /** true/false depois da decisão; null = não houve. */
  secondChance: boolean | null;
  /** Anotações por inscrito (viram `Applicant.notes` no fechamento). */
  notes: Record<string, string[]>;
  /** Quem os capitães acharam mais interessante (a recomendação deles, sem decisão). */
  captainsPick: string[];
}

/** Palestra de apresentação como evento (fase-9.md, ajustes do playtest). */
export interface SelectionLectureContext {
  kind: "selection-lecture";
  /** Inscritos que vieram (ids de Applicant). */
  attendeeIds: string[];
  registered: number;
  /** O que a apresentação destacou ("project" | "community" | "cv"); null antes da decisão. */
  highlight: string | null;
  /** Como a equipe respondeu às perguntas ("honest" | "sell"); null antes da decisão. */
  answer: string | null;
  /** Soma dos empurrões na motivação dos presentes (para o clima do resumo). */
  mood: number;
}

export interface FlightTestContext {
  kind: "flight-test";
  testId: string;
  /** Decolagens já resolvidas (viram `FlightTest.takeoffs` no fechamento). */
  takeoffs: FlightTestTakeoff[];
  records: TestRecord[];
  transportDamage: string[];
  /** Índice da decolagem cuja rajada já foi tratada; -1 = nenhuma. */
  gustHandled: number;
  /** Rajada em curso: m/s e o que ela faz com o piloto até ser resolvida. */
  gustMs: number;
  /** Ajustes das decisões, valem para a próxima decolagem. */
  pilotPenalty: number;
  payloadCutKg: number;
  /** Atraso acumulado (h) das esperas: vira o relógio do dia. */
  delayHours: number;
  /** Peça com folga que o jogador decidiu não trocar: piora a condição dos voos. */
  loosePart: boolean;
  checkHandled: boolean;
  /** Decisão "encerrar o dia" já oferecida para o índice. */
  damageHandled: number;
  endedEarly: boolean;
  creditsSpent: number;
  /** Linhas do dia, na ordem: viram `FlightTest.summary`. */
  lines: string[];
  /** Condição de cada peça antes do dia (para o resumo de dano). */
  partsBefore: Record<string, number>;
}

export interface CompetitionEventContext {
  kind: "competition";
  /** Próximo slot de voo (índice absoluto de 12 min); null antes do primeiro dia de voo. */
  nextSlot: number | null;
  /** Inspeção: ids de pendências já decididas. */
  inspectionHandled: string[];
  creditsSpent: number;
  /** Condição das peças no começo do evento. */
  partsBefore: Record<string, number>;
  /** Último replay seu, para as cenas (null = nenhum ainda). */
  lastPlayback: FlightPlayback | null;
  /** Bateria da última decisão de reparo oferecida. */
  repairHandled: number;
  knowledge: string[];
}

export type EventContext = SelectionDayContext | SelectionLectureContext | FlightTestContext | CompetitionEventContext;

export interface ActiveEvent {
  id: string;
  kind: EventKind;
  title: string;
  /** Local (ensaio de voo); ausente nos outros. */
  venueId?: string;
  /** false = só a chamada está na tela ("Hoje: ..."); enter-event põe true. */
  entered: boolean;
  /** Dia do evento, de 1 a `totalDays`. */
  day: number;
  totalDays: number;
  /** Horas de jogo da meia-noite do dia 1. */
  startsAtDay: number;
  /** Blocos do dia atual (nos eventos de vários dias, trocam a cada dia). */
  blocks: EventBlock[];
  /** Bloco atual: o próximo a ser resolvido. */
  blockIndex: number;
  pendingDecision: EventDecision | null;
  log: EventLogEntry[];
  /** Preenchido quando o dia (ou o último dia) acabou; close-event só vale com ele. */
  summary: EventSummary | null;
  context: EventContext;
}

