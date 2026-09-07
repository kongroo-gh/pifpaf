import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LanguageProvider } from "./i18n";
import "./styles.css";

const container = document.getElementById("root");
if (container === null) throw new Error("#root が見つかりません");

createRoot(container).render(
  <StrictMode>
    {/* 受け皿は一番外に置く。中で何が落ちても、真っ黒ではなく理由が出る */}
    <ErrorBoundary>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ErrorBoundary>
  </StrictMode>
);
