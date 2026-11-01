import { render } from "preact";
import { startAutosave } from "./app/save";
import { startClock, store } from "./app/store";
import "./styles/app.css";
import { Root } from "./ui/Root";

render(<Root />, document.getElementById("app")!);
startAutosave(store);
startClock(store);

// Depuração: window.__store no console (só em dev), como window.__flightScene.
if (import.meta.env.DEV) (window as unknown as { __store?: typeof store }).__store = store;
