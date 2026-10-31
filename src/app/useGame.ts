import { useEffect, useState } from "preact/hooks";
import type { GameState } from "../sim";
import { store } from "./store";

/** Lê uma fatia do estado e re-renderiza só quando ela muda. */
export function useGame<T>(select: (state: GameState) => T): T {
  const [value, setValue] = useState(() => select(store.getState()));
  useEffect(() => store.subscribe((state) => setValue(() => select(state))), []);
  return value;
}
