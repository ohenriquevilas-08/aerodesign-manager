import { render } from "preact";
import { startAutosave } from "./app/save";
import { startClock, store } from "./app/store";
import "./styles/app.css";
import { Root } from "./ui/Root";

render(<Root />, document.getElementById("app")!);
startAutosave(store);
startClock(store);
