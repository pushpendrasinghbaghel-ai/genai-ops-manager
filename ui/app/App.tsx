import { Page } from "@dynatrace/strato-components-preview/layouts";
import React from "react";
import { Route, Routes } from "react-router-dom";
import { Header } from "./components/Header";
import { Home } from "./pages/Home";
import { ModelCostComparison } from "./pages/ModelCostComparison";
import { PromptAnalyzer } from "./pages/PromptAnalyzer";
import { CostForecast } from "./pages/CostForecast";
import { GuardrailBacktester } from "./pages/GuardrailBacktester";
import { AgentToolHeatmap } from "./pages/AgentToolHeatmap";
import { ModelArbitrageSimulator } from "./pages/ModelArbitrageSimulator";

export const App = () => {
  return (
    <Page>
      <Page.Header>
        <Header />
      </Page.Header>
      <Page.Main>
        <Routes>
          {/* Home Dashboard */}
          <Route path="/" element={<Home />} />
          
          {/* MVP Features */}
          <Route path="/models" element={<ModelCostComparison />} />
          <Route path="/prompts" element={<PromptAnalyzer />} />
          <Route path="/forecast" element={<CostForecast />} />
          <Route path="/guardrails" element={<GuardrailBacktester />} />
          <Route path="/agents" element={<AgentToolHeatmap />} />
          
          {/* Legacy / Utility Pages */}
          <Route path="/simulator" element={<ModelArbitrageSimulator />} />
        </Routes>
      </Page.Main>
    </Page>
  );
};
