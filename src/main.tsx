import { render } from "preact";
import { startClock, store } from "./app/store";
import "./styles/app.css";
import { App } from "./ui/App";

render(<App />, document.getElementById("app")!);
startClock(store);
