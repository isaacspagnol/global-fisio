import { describe, expect, it } from "vitest";
import {
  evaColor,
  evaLabel,
  formatDefaults,
  formatDose,
} from "@/lib/types";

describe("Escala EVA", () => {
  it("classifica os rótulos corretamente em toda a faixa 0-10", () => {
    expect(evaLabel(0)).toBe("Sem dor");
    expect(evaLabel(1)).toBe("Dor leve");
    expect(evaLabel(3)).toBe("Dor leve");
    expect(evaLabel(4)).toBe("Dor moderada");
    expect(evaLabel(6)).toBe("Dor moderada");
    expect(evaLabel(7)).toBe("Dor intensa");
    expect(evaLabel(8)).toBe("Dor intensa");
    expect(evaLabel(9)).toBe("Dor máxima");
    expect(evaLabel(10)).toBe("Dor máxima");
  });

  it("retorna cores válidas e progressivamente mais 'quentes'", () => {
    for (let i = 0; i <= 10; i++) {
      expect(evaColor(i)).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(evaColor(0)).toBe(evaColor(2)); // verde
    expect(evaColor(0)).not.toBe(evaColor(10));
    expect(evaColor(10)).toBe("#dc2626"); // vermelho
  });
});

describe("Formatação por tipo de exercício", () => {
  it("séries x reps com carga", () => {
    expect(formatDose({ sets: 3, reps: 12, load_kg: 10 })).toBe("3x12 · 10kg");
    expect(formatDose({ sets: 3, reps: 15 })).toBe("3x15");
  });

  it("séries x tempo (isometria/alongamento)", () => {
    expect(formatDose({ sets: 3, duration_seconds: 30 })).toBe("3x30s");
    expect(formatDose({ sets: 2, duration_seconds: 60 })).toBe("2x1min");
  });

  it("cardio: tempo, velocidade, distância e inclinação", () => {
    expect(
      formatDose({
        duration_seconds: 1200,
        speed_kmh: 6,
        distance_m: 1500,
        incline_pct: 3,
      })
    ).toBe("20min · 6 km/h · 1,5 km · 3% incl.");
    expect(formatDose({ duration_seconds: 600 })).toBe("10min");
    expect(formatDose({ duration_seconds: 600, distance_m: 800 })).toBe(
      "10min · 800 m"
    );
  });

  it("padrões do catálogo por tipo", () => {
    expect(
      formatDefaults({
        measurement_type: "series_reps",
        default_sets: 3,
        default_reps: 12,
        default_duration_seconds: null,
      })
    ).toBe("3x12");
    expect(
      formatDefaults({
        measurement_type: "series_tempo",
        default_sets: 3,
        default_reps: 1,
        default_duration_seconds: 30,
      })
    ).toBe("3x30s");
    expect(
      formatDefaults({
        measurement_type: "cardio",
        default_sets: 1,
        default_reps: 1,
        default_duration_seconds: 600,
      })
    ).toBe("10min");
  });
});
