// Voos de exemplo, um por desfecho, para o painel de depuração e os testes.
// Números plausíveis para a Classe Regular, escolhidos à mão (não saem da simulação).

import type { FlightOutcome, FlightPlayback } from "./playback";

const base = {
  battery: 1,
  teamName: "Nova Equipe AeroDesign",
  densityAltitudeM: 820,
  headwindMs: 2.5
};

export const MOCK_PLAYBACKS: Record<FlightOutcome, FlightPlayback> = {
  valid: {
    ...base,
    payloadKg: 6.4,
    rotationDistanceM: 41.5,
    obstacleClearanceM: 1.1,
    outcome: "valid",
    stopDistanceM: 34,
    unloadTimeS: 17.6
  },
  "no-takeoff": {
    ...base,
    battery: 2,
    payloadKg: 8.9,
    densityAltitudeM: 1240,
    headwindMs: 0.4,
    rotationDistanceM: null,
    obstacleClearanceM: null,
    outcome: "no-takeoff",
    stopDistanceM: null,
    unloadTimeS: null
  },
  "tape-break": {
    ...base,
    battery: 2,
    payloadKg: 8.1,
    densityAltitudeM: 1180,
    headwindMs: 1.2,
    rotationDistanceM: 51.2,
    obstacleClearanceM: -0.25,
    outcome: "tape-break",
    stopDistanceM: 31,
    unloadTimeS: null
  },
  "landing-out": {
    ...base,
    battery: 3,
    payloadKg: 7,
    headwindMs: -1.5,
    rotationDistanceM: 44,
    obstacleClearanceM: 0.6,
    outcome: "landing-out",
    stopDistanceM: 62,
    unloadTimeS: 24.3
  },
  damage: {
    ...base,
    battery: 3,
    payloadKg: 7.2,
    rotationDistanceM: 45.8,
    obstacleClearanceM: 0.45,
    outcome: "damage",
    stopDistanceM: 18,
    unloadTimeS: 31.5,
    damagedParts: ["Trem de pouso danificado", "Hélice quebrada"]
  },
  crash: {
    ...base,
    battery: 4,
    payloadKg: 8.4,
    densityAltitudeM: 1320,
    rotationDistanceM: 52.6,
    obstacleClearanceM: 0.12,
    outcome: "crash",
    crashPhase: "climb",
    stopDistanceM: null,
    unloadTimeS: null,
    damagedParts: ["Asa quebrada", "Fuselagem danificada", "Eletrônica danificada"]
  }
};
