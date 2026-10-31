import Phaser from "phaser";
import { useEffect, useRef } from "preact/hooks";
import { store } from "../app/store";
import { palette } from "../scenes/palette";

interface Props {
  /** Classe da cena; recebe { store } em init(). */
  scene: new () => Phaser.Scene;
  sceneKey: string;
}

/** Monta um Phaser.Game dentro do painel e o destrói ao sair da tela. */
export function PhaserStage({ scene, sceneKey }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      backgroundColor: palette.bg,
      scale: { mode: Phaser.Scale.RESIZE, width: host.current.clientWidth, height: host.current.clientHeight },
      banner: false,
      // Sem som no Ano 1 (design §12); o áudio do Phaser gerava erro de AudioContext fechado ao trocar de tela.
      audio: { noAudio: true }
    });
    game.scene.add(sceneKey, scene, true, { store });
    return () => game.destroy(true);
  }, [scene, sceneKey]);

  return <div class="stage" ref={host} />;
}
