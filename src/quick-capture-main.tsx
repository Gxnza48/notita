import React from "react";
import ReactDOM from "react-dom/client";
import QuickCaptureApp from "./QuickCaptureApp";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { installErrorLogging } from "./lib/errorLogging";
import "./styles/global.css";
import "./styles/quickcapture.css";

installErrorLogging("quick-capture");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QuickCaptureApp />
    </ErrorBoundary>
  </React.StrictMode>,
);
