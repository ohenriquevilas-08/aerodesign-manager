import { useEffect, useMemo, useRef } from "preact/hooks";
import { composeSprite, paintSprite, genderOf, spriteLookFrom, type SpriteGender, type SpriteLook, type SpritePose, type SpriteView } from "../../scenes/people/sprite";
import type { MemberLook } from "../../sim";

/**
 * Personagem em pixel art num canvas, em escala inteira e sem suavização. Recebe um `SpriteLook`
 * pronto ou um integrante (`id` + `look`, com `gender` opcional), de onde deriva o visual.
 */
export function PixelAvatar({
  look,
  member,
  pose = "stand",
  view = "front-right",
  scale = 2,
  class: className
}: {
  look?: SpriteLook;
  member?: { id: string; look: MemberLook; gender?: SpriteGender };
  pose?: SpritePose;
  view?: SpriteView;
  /** Pixels de tela por pixel da arte (inteiro). */
  scale?: number;
  class?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const resolved = useMemo(
    () => look ?? (member ? spriteLookFrom(member.look, member.gender ?? genderOf(member.look), member.id) : undefined),
    [look, member?.id, member?.look, member?.gender]
  );
  const grid = useMemo(() => (resolved ? composeSprite(resolved, view, pose) : undefined), [resolved, view, pose]);
  const k = Math.max(1, Math.round(scale));

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !grid) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paintSprite(ctx, grid, k);
  }, [grid, k]);

  if (!grid) return null;
  return (
    <canvas
      ref={ref}
      class={className}
      width={grid.width * k}
      height={grid.height * k}
      style={{ imageRendering: "pixelated" }}
      role="img"
      aria-hidden="true"
    />
  );
}
