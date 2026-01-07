# GenAI Ops Manager - Strategic Plan

## Vision
**"Day 2 Operations & Optimization"** layer for GenAI workloads on Dynatrace.

While Dynatrace AI Observability provides passive monitoring ("What happened?"), GenAI Ops Manager answers **"What should I DO?"** with actionable insights and control.

## Competitive Differentiation

| Dynatrace AI Obs | GenAI Ops Manager (This App) |
|------------------|------------------------------|
| Displays costs | **Optimizes costs** with recommendations |
| Shows guardrail metrics | **Builds & tests guardrail policies** |
| Monitors agents | **Detects anomalies** (infinite loops) |
| Reactive alerts | **Proactive forecasting** |
| View-only | **Action-oriented** |

## MVP Features (Grail-Powered)

### 1. 🎯 Model Cost Comparison Dashboard
- **DQL:** Query `gen_ai.usage.cost`, `gen_ai.request.model` spans
- **Value:** Compare models by cost, latency, error rate
- **Action:** Get optimization recommendations ("Switch to Claude Haiku for 60% savings")

### 2. 🔬 Prompt Pattern Analyzer
- **DQL:** Analyze `gen_ai.prompt.0.content` patterns
- **Value:** Find expensive/inefficient prompts
- **Action:** Token efficiency insights, cost-per-pattern analysis

### 3. 📈 Cost Forecast & FinOps
- **DQL:** Historical cost trends + Davis Analyzer forecasting
- **Value:** Predict monthly spend, detect anomalies
- **Action:** Budget alerts, "what-if" scenarios

### 4. 🛡️ Guardrail Policy Backtester
- **DQL:** Test regex/keyword patterns against historical prompts
- **Value:** Validate policies before deployment
- **Action:** "This rule would block 2.3% of traffic"

### 5. ⚡ Agent Tool Heatmap
- **DQL:** Analyze `gen_ai.tool.name` spans, detect patterns
- **Value:** Visualize tool usage, detect infinite loops
- **Action:** Alert on runaway agents (>10 calls per trace)

## Data Sources (Grail)

All features query real Dynatrace data:
- `fetch spans | filter gen_ai.system IS NOT NULL`
- `gen_ai.usage.*` - tokens, cost
- `gen_ai.request.*` - model, temperature
- `gen_ai.prompt.*` - prompt content
- `gen_ai.tool.*` - agent tool calls
- `otel.status_code` - errors

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              GenAI Ops Manager App                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │  Model   │ │  Prompt  │ │ Guardrail│ │ Agent  │ │
│  │  Costs   │ │ Analyzer │ │ Tester   │ │ Tools  │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬────┘ │
│       └────────────┴────────────┴───────────┘      │
│                        │                            │
│              ┌─────────▼─────────┐                 │
│              │  useDql() Hook   │                 │
│              │  (Grail Queries) │                 │
│              └─────────┬─────────┘                 │
└────────────────────────┼────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────┐
│                    GRAIL                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐ │
│  │ GenAI   │ │ Token   │ │ Prompt  │ │ Tool Call │ │
│  │ Spans   │ │ Metrics │ │ Content │ │ Spans     │ │
│  └─────────┘ └─────────┘ └─────────┘ └───────────┘ │
└─────────────────────────────────────────────────────┘
```

## Future Roadmap

### Phase 2: Advanced Automation
- Circuit breaker workflows (pause runaway agents)
- Auto-remediation via Dynatrace Workflows
- Slack/email alerts on anomalies

### Phase 3: ML-Powered Insights
- Davis AI integration for forecasting
- Anomaly detection on prompt patterns
- Auto-optimization recommendations

### Phase 4: Governance Suite
- Prompt version control
- A/B testing framework
- Compliance reporting
