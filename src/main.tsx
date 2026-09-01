import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { installErrorLogging } from "./lib/errorLogging";
import "./styles/global.css";
import "./styles/editor.css";
import "./styles/app.css";
import "./styles/print.css";

installErrorLogging("main");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
