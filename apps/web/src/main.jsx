import "./installBridge"; // must run before @sada/ui is imported
import React from "react";
import { createRoot } from "react-dom/client";
import { App, ContextWrapper } from "@sada/ui";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ContextWrapper>
      <App />
    </ContextWrapper>
  </React.StrictMode>,
);
