// Voos de exemplo, um por desfecho, para o painel de depuração e os testes.
// Números plausíveis para a Classe Regular, escolhidos à mão (não saem da simulação).

import type { FlightTestSession } from "../phase5";
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

const testFlight = (payloadKg: number, density: number, outcome: FlightPlayback["outcome"] = "valid"): FlightPlayback => ({
  ...MOCK_PLAYBACKS[outcome === "damage" ? "damage" : "valid"],
  battery: 1,
  payloadKg,
  densityAltitudeM: density,
  headwindMs: 1.5,
  outcome
});

/** Ensaios de voo de exemplo, um por cenário de local, com uma equipe de três bonecos (dev). */
export const MOCK_TEST_SESSIONS: Record<"aeroclub" | "airstrip" | "farm", FlightTestSession> = {
  aeroclub: {
    venueId: "aeroclub",
    venueName: "Campo do aeroclube",
    crew: [
      { skin: 1, hair: 0, hairColor: 1, shirt: 0xff9f2e, accessory: "glasses" },
      { skin: 3, hair: 3, hairColor: 0, shirt: 0xff9f2e },
      { skin: 0, hair: 1, hairColor: 3, shirt: 0xff9f2e, accessory: "cap" }
    ],
    flights: [testFlight(4, 700), testFlight(6, 700), testFlight(8, 700, "damage")]
  },
  airstrip: {
    venueId: "airstrip",
    venueName: "Pista de aeromodelismo",
    crew: [
      { skin: 2, hair: 2, hairColor: 4, shirt: 0x22c7e6 },
      { skin: 4, hair: 4, hairColor: 0, shirt: 0x22c7e6, accessory: "headband" }
    ],
    flights: [testFlight(5, 900), testFlight(7, 900)]
  },
  farm: {
    venueId: "farm",
    venueName: "Fazenda do ex-integrante",
    crew: [
      { skin: 1, hair: 1, hairColor: 2, shirt: 0x3fd18b },
      { skin: 5, hair: 0, hairColor: 0, shirt: 0x3fd18b, accessory: "glasses" },
      { skin: 2, hair: 3, hairColor: 5, shirt: 0x3fd18b }
    ],
    flights: [testFlight(6, 1100), testFlight(9, 1100, "damage")]
  }
};
