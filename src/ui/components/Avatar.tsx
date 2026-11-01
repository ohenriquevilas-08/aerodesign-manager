import { css } from "../../scenes/palette";
import { AVATAR_BOUNDS, avatarShapes, type AvatarPose } from "../../scenes/people/avatar";
import { lookFor, type MemberLook } from "../../scenes/phase5";

const { minX, maxX, minY, maxY } = AVATAR_BOUNDS;

/**
 * Retrato isométrico do integrante em SVG: os mesmos polígonos de `scenes/people/avatar.ts` que o hangar
 * desenha no Phaser, então carta e hangar mostram o mesmo boneco. `member` sem `look` recebe a aparência estável do stub.
 */
export function Avatar({
  member,
  look,
  pose = "stand",
  size = 72,
  facing = 1,
  class: className
}: {
  member?: { id: string; look?: MemberLook };
  look?: MemberLook;
  pose?: AvatarPose;
  /** Altura em px. */
  size?: number;
  facing?: 1 | -1;
  class?: string;
}) {
  const resolved = look ?? (member ? lookFor(member) : lookFor({ id: "?" }));
  const shapes = avatarShapes(resolved, pose, { facing, phase: pose === "work" ? 0.5 : 0 });
  const width = ((maxX - minX) / (maxY - minY)) * size;
  return (
    <svg
      class={className}
      width={width}
      height={size}
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      role="img"
      aria-hidden="true"
    >
      {shapes.map((shape, i) => {
        const points = shape.points.map(([x, y]) => `${x},${y}`).join(" ");
        return shape.line ? (
          <polygon key={i} points={points} fill="none" stroke={css(shape.fill)} stroke-width="1" />
        ) : (
          <polygon key={i} points={points} fill={css(shape.fill)} />
        );
      })}
    </svg>
  );
}
