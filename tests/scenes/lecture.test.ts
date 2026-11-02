import { describe, expect, it } from "vitest";
import {
  ARRIVAL_SPAN,
  BACK_AISLE_ROW,
  CAPACITY,
  DOOR,
  LINES,
  PER_LINE,
  ROOM,
  STAGE,
  STANDING_CAPACITY,
  WALK_SPEED,
  arrivalTime,
  attendanceLabel,
  audienceFrame,
  occupancy,
  placeAudience,
  seatOrder,
  seats,
  settleTime,
  slideAt,
  slidesFor,
  stageSpots,
  walkDuration
} from "../../src/scenes/lecture/auditorium";
import { lectureChannel } from "../../src/scenes/lecture/channel";
import { attendedLecture, hashString, lectureViewFromCampaign, lookForApplicant, type Applicant } from "../../src/scenes/lecture/contract";
import { MOCK_FOUNDERS, mockCampaign, mockLectureView } from "../../src/scenes/lecture/mock";

describe("cadeiras do auditório", () => {
  it("há uma cadeira por lugar, todas distintas e dentro da sala, de frente para o palco", () => {
    const all = seats();
    expect(all).toHaveLength(LINES * PER_LINE);
    expect(new Set(all.map((s) => `${s.col.toFixed(2)},${s.row.toFixed(2)}`)).size).toBe(CAPACITY);
    for (const seat of all) {
      expect(seat.col).toBeGreaterThan(STAGE.col1);
      expect(seat.col).toBeLessThan(ROOM.cols);
      expect(seat.row).toBeGreaterThan(0);
      expect(seat.row).toBeLessThan(BACK_AISLE_ROW);
    }
  });

  it("a capacidade cobre uma palestra de cem presentes", () => {
    expect(CAPACITY).toBeGreaterThanOrEqual(100);
  });

  it("a ordem de enchimento é determinística e cobre todas as cadeiras", () => {
    const a = seatOrder().map((s) => s.index);
    const b = seatOrder().map((s) => s.index);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(CAPACITY);
  });
});

describe("ocupação da plateia", () => {
  const seatsOf = (n: number) => placeAudience(n).map((s) => s.seat);

  it("cada presente ganha um lugar próprio", () => {
    for (const n of [0, 1, 30, 55, 100, CAPACITY]) {
      const spots = placeAudience(n);
      expect(spots).toHaveLength(n);
      expect(new Set(spots.map((s) => `${s.col},${s.row}`)).size).toBe(n);
    }
  });

  it("com mais gente ninguém troca de lugar: quem já estava continua onde estava", () => {
    expect(seatsOf(100).slice(0, 30)).toEqual(seatsOf(30));
  });

  it("30 presentes ocupam a frente mais do que 100", () => {
    const meanLine = (n: number) => {
      const all = seats();
      const ids = seatsOf(n).filter((i): i is number => i !== null);
      return ids.reduce((sum, id) => sum + all[id]!.line, 0) / ids.length;
    };
    expect(meanLine(30)).toBeLessThan(meanLine(100));
    expect(meanLine(30)).toBeLessThan((LINES - 1) / 2);
  });

  it("passando da lotação, o excedente fica em pé no fundo; passando disso, a sala está cheia", () => {
    const spots = placeAudience(CAPACITY + 10);
    const standing = spots.filter((s) => s.seat === null);
    expect(standing).toHaveLength(10);
    const lastSeatCol = Math.max(...seats().map((s) => s.col));
    expect(standing.every((s) => s.col > lastSeatCol)).toBe(true);
    expect(new Set(standing.map((s) => `${s.col.toFixed(2)},${s.row.toFixed(2)}`)).size).toBe(10);
    expect(placeAudience(CAPACITY + STANDING_CAPACITY + 50)).toHaveLength(CAPACITY + STANDING_CAPACITY);
  });

  it("a ocupação vai de 0 a 1", () => {
    expect(occupancy(0)).toBe(0);
    expect(occupancy(CAPACITY / 2)).toBeCloseTo(0.5);
    expect(occupancy(CAPACITY * 3)).toBe(1);
  });
});

describe("entrada da plateia", () => {
  const spot = { col: 8, row: 5 };

  it("antes da hora espera fora da porta e depois senta de frente para o palco", () => {
    expect(audienceFrame(spot, 10, 40, 0).visible).toBe(false);
    const seated = audienceFrame(spot, 10, 40, arrivalTime(10, 40) + walkDuration(spot) + 1);
    expect(seated).toMatchObject({ col: spot.col, row: spot.row, visible: true, walking: false, facing: -1 });
  });

  it("sai da porta, anda pelo corredor do fundo e só então entra na fileira", () => {
    const first = audienceFrame(spot, 0, 40, 0.05);
    expect(first.walking).toBe(true);
    expect(first.row).toBeCloseTo(DOOR.row, 0);
    const aisleEnd = (DOOR.col - spot.col) / WALK_SPEED;
    const inLine = audienceFrame(spot, 0, 40, aisleEnd + 0.3);
    expect(inLine.col).toBeCloseTo(spot.col);
    expect(inLine.row).toBeLessThan(BACK_AISLE_ROW);
  });

  it("a fila inteira entra em poucos segundos, tenha 30 ou 100 pessoas", () => {
    for (const n of [30, 100]) {
      const settle = settleTime(placeAudience(n));
      expect(settle).toBeLessThan(ARRIVAL_SPAN + 6);
      expect(settle).toBeGreaterThan(0);
    }
  });
});

describe("palco e slides", () => {
  it("o apresentador fica no palco, de frente para a plateia, e os outros não se sobrepõem", () => {
    const spots = stageSpots(3);
    for (const s of spots) {
      expect(s.col).toBeGreaterThan(STAGE.col0);
      expect(s.col).toBeLessThan(STAGE.col1);
      expect(s.row).toBeGreaterThan(STAGE.row0);
      expect(s.row).toBeLessThan(STAGE.row1);
      expect(s.facing).toBe(1);
    }
    expect(new Set(spots.map((s) => `${s.col},${s.row}`)).size).toBe(3);
  });

  it("os slides passam no ritmo e dão a volta; o slide forçado manda", () => {
    const slides = slidesFor("Equipe X");
    expect(slides[0]!.title).toBe("Equipe X");
    expect(slideAt(0, slides.length)).toBe(0);
    expect(slideAt(7, slides.length)).toBe(1);
    expect(slideAt(7 * slides.length, slides.length)).toBe(0);
    expect(slideAt(100, slides.length, 3)).toBe(3);
    expect(slideAt(0, slides.length, -1)).toBe(slides.length - 1);
  });

  it("nenhum texto dos slides usa travessão", () => {
    for (const slide of slidesFor("Equipe X")) expect([slide.title, ...slide.lines].join(" ")).not.toContain("—");
  });

  it("o contador diz quantos vieram", () => {
    expect(attendanceLabel(55, 92)).toBe("55 de 92 vieram");
    expect(attendanceLabel(1, 1)).toBe("1 de 1 veio");
    expect(attendanceLabel(30, null)).toBe("30 presentes");
  });
});

describe("leitura da palestra a partir da campanha (stub do contrato da Fase 9)", () => {
  it("só quem apareceu entra na plateia", () => {
    const stages = ["applied", "absent", "lecture", "dynamic", "interview", "approved", "rejected"] as const;
    expect(stages.filter((stage) => attendedLecture({ stage }))).toEqual(["lecture", "dynamic", "interview", "approved", "rejected"]);
  });

  it("a plateia tem os presentes, o total de inscritos e quem está no palco", () => {
    const campaign = mockCampaign(92, 55);
    const view = lectureViewFromCampaign(campaign, MOCK_FOUNDERS.slice(0, 1), "Equipe");
    expect(view.attendees).toHaveLength(55);
    expect(view.registered).toBe(92);
    expect(view.onStage).toHaveLength(1);
    const absentees = new Set(campaign.applicants.filter((a: Applicant) => a.stage === "absent").map((a) => a.id));
    expect(view.attendees.some((p) => absentees.has(p.id))).toBe(false);
  });

  it("o mesmo inscrito tem sempre a mesma aparência, e a camiseta não é a da equipe", () => {
    expect(lookForApplicant("a7")).toEqual(lookForApplicant("a7"));
    expect(hashString("a7")).not.toBe(hashString("a8"));
    for (let i = 0; i < 40; i += 1) expect(lookForApplicant(`a${i}`).shirt).not.toBe(0xff9f2e);
  });

  it("a montagem de dev entrega 30 e 100 presentes", () => {
    expect(mockLectureView(30).attendees).toHaveLength(30);
    expect(mockLectureView(100).attendees).toHaveLength(100);
    expect(mockLectureView(100, undefined, 3).onStage).toHaveLength(3);
  });
});

describe("canal da palestra", () => {
  it("entrega a leitura e o slide aos assinantes e guarda o último valor", () => {
    const views: unknown[] = [];
    const slides: (number | null)[] = [];
    const off = lectureChannel.subscribe(
      (v) => views.push(v),
      (s) => slides.push(s)
    );
    const view = mockLectureView(30);
    lectureChannel.show(view);
    lectureChannel.setSlide(2);
    expect(views).toEqual([view]);
    expect(slides).toEqual([2]);
    expect(lectureChannel.current).toBe(view);
    expect(lectureChannel.slide).toBe(2);
    lectureChannel.show(null);
    expect(lectureChannel.slide).toBeNull();
    off();
    lectureChannel.setSlide(1);
    expect(slides).toEqual([2]);
    lectureChannel.setSlide(null);
  });
});
