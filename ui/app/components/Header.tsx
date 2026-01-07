import React from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "@dynatrace/strato-components-preview/layouts";

export const Header = () => {
  return (
    <AppHeader>
      <AppHeader.NavItems>
        <AppHeader.AppNavLink as={Link} to="/" />
        <AppHeader.NavItem as={Link} to="/models">
          Model Costs
        </AppHeader.NavItem>
        <AppHeader.NavItem as={Link} to="/prompts">
          Prompt Analyzer
        </AppHeader.NavItem>
        <AppHeader.NavItem as={Link} to="/forecast">
          Cost Forecast
        </AppHeader.NavItem>
        <AppHeader.NavItem as={Link} to="/guardrails">
          Guardrails
        </AppHeader.NavItem>
        <AppHeader.NavItem as={Link} to="/agents">
          Agent Tools
        </AppHeader.NavItem>
      </AppHeader.NavItems>
    </AppHeader>
  );
};
