// Controles reutilizáveis das telas: controle deslizante, botões segmentados e barra de nível.

import type { ComponentChildren } from "preact";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Texto exibido ao lado do rótulo, já com unidade. */
  display: string;
  onChange: (value: number) => void;
  /** Destaca o valor quando passa de um limite do regulamento. */
  alert?: boolean;
  hint?: ComponentChildren;
  disabled?: boolean;
}

export function Slider({ label, value, min, max, step, display, onChange, alert, hint, disabled }: SliderProps) {
  return (
    <label class={`slider${alert ? " is-alert" : ""}${disabled ? " is-disabled" : ""}`}>
      <span class="slider-head">
        <span class="slider-label">{label}</span>
        <span class="slider-value">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onInput={(event) => onChange(Number(event.currentTarget.value))}
      />
      {hint ? <span class="slider-hint">{hint}</span> : null}
    </label>
  );
}

interface SegmentedProps<T extends string | number> {
  label: string;
  value: T;
  options: readonly { value: T; label: string; sub?: string }[];
  onChange: (value: T) => void;
}

export function Segmented<T extends string | number>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div class="segmented-field">
      <span class="slider-label">{label}</span>
      <div class="segmented" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
            {option.sub ? <small>{option.sub}</small> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

interface MeterProps {
  /** 0–100. */
  value: number;
  /** Piso de conhecimento documentado, 0–100 (marcador na barra). */
  floor?: number;
  tone?: "accent" | "highlight" | "ok" | "warn" | "danger";
  label?: string;
}

export function Meter({ value, floor, tone = "accent", label }: MeterProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <span
      class={`meter meter-${tone}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
    >
      <span class="meter-fill" style={{ width: `${clamped}%` }} />
      {floor !== undefined && floor > 0 ? <span class="meter-floor" style={{ left: `${Math.min(100, floor)}%` }} /> : null}
    </span>
  );
}
