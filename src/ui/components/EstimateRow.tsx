import type { Estimate } from "../../sim";
import { formatNumber } from "../format";

/** Linha "rótulo · valor ± margem"; "—" enquanto a simulação não estima (design §6.2). */
export function EstimateRow({
  label,
  value,
  unit,
  digits
}: {
  label: string;
  value: Estimate | null | undefined;
  unit?: string;
  digits: number;
}) {
  return (
    <div class="estimate">
      <span class="muted">{label}</span>
      {value ? (
        <strong>
          {formatNumber(value.value, digits)}
          <span class="estimate-margin">
            {" "}
            ± {formatNumber(value.margin, digits)}
            {unit ? ` ${unit}` : ""}
          </span>
        </strong>
      ) : (
        <strong class="estimate-empty">—</strong>
      )}
    </div>
  );
}
