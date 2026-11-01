// Desenha a grade num canvas em escala inteira, sem suavização. Serve à UI (PixelAvatar) e ao
// Phaser (textura via addSpriteTexture), então os dois mostram exatamente os mesmos pixels.

import type Phaser from "phaser";
import type { SpriteGrid } from "./types";

/** Pinta a grade em `ctx` com o canto superior esquerdo em (x, y), cada pixel virando `scale` × `scale`. */
export function paintSprite(ctx: CanvasRenderingContext2D, grid: SpriteGrid, scale = 1, x = 0, y = 0) {
  const k = Math.max(1, Math.round(scale));
  const image = ctx.createImageData(grid.width * k, grid.height * k);
  const data = image.data;
  for (let gy = 0; gy < grid.height; gy += 1) {
    for (let gx = 0; gx < grid.width; gx += 1) {
      const i = grid.pixels[gy * grid.width + gx]!;
      if (i === 0) continue;
      const color = grid.palette[i]!;
      for (let dy = 0; dy < k; dy += 1) {
        let o = ((gy * k + dy) * grid.width * k + gx * k) * 4;
        for (let dx = 0; dx < k; dx += 1, o += 4) {
          data[o] = (color >> 16) & 0xff;
          data[o + 1] = (color >> 8) & 0xff;
          data[o + 2] = color & 0xff;
          data[o + 3] = 255;
        }
      }
    }
  }
  // putImageData ignora transparência do que já está no canvas; um canvas de apoio preserva o fundo.
  const scratch = document.createElement("canvas");
  scratch.width = image.width;
  scratch.height = image.height;
  scratch.getContext("2d")!.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scratch, x, y);
}

/** Canvas novo do tamanho exato da grade em escala `scale`. */
export function spriteCanvas(grid: SpriteGrid, scale = 1): HTMLCanvasElement {
  const k = Math.max(1, Math.round(scale));
  const canvas = document.createElement("canvas");
  canvas.width = grid.width * k;
  canvas.height = grid.height * k;
  paintSprite(canvas.getContext("2d")!, grid, k);
  return canvas;
}

/**
 * Registra a grade como textura do Phaser (substitui se a chave já existe). Use escala 1 e aumente o
 * sprite com `setScale` inteiro; o jogo deve rodar com `pixelArt: true` (ou `texture.setFilter(NEAREST)`).
 * A origem dos pés fica em `grid.anchor` (setOrigin(anchor.x / width, anchor.y / height)).
 */
export function addSpriteTexture(textures: Phaser.Textures.TextureManager, key: string, grid: SpriteGrid, scale = 1) {
  if (textures.exists(key)) textures.remove(key);
  return textures.addCanvas(key, spriteCanvas(grid, scale));
}
