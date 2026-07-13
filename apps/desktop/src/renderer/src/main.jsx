import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import ContextWrapper from "./Context/ContextWrapper";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ContextWrapper>
      <App />
    </ContextWrapper>
  </React.StrictMode>,
);
