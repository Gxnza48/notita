import React from "react";
import ReactDOM from "react-dom/client";
import QuickCaptureApp from "./QuickCaptureApp";
import "./styles/global.css";
import "./styles/quickcapture.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QuickCaptureApp />
  </React.StrictMode>,
);
