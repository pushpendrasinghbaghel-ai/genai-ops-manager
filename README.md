# GenAI Ops Manager

A comprehensive Dynatrace App for monitoring, analyzing, and optimizing Generative AI workloads. Built with React, TypeScript, and the Dynatrace SDK, this app provides real-time visibility into GenAI usage, costs, and performance using Grail data.

![Dynatrace](https://img.shields.io/badge/Dynatrace-1496FF?style=flat&logo=dynatrace&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)

## 🎯 Features

### 📊 Home Dashboard
- **Real-time GenAI metrics**: Total requests, tokens, cost estimates, and unique models
- **Top models by usage**: Quick overview of most-used AI models
- **Navigation cards**: Quick access to all analytics pages

### 💰 Cost Forecast & FinOps
- **Historical cost trends**: 30-day visualization of token usage and estimated costs
- **Weekly growth rate**: Automatic calculation of usage growth trends
- **Budget alerts**: Set budget limits and get warnings when projected costs exceed thresholds
- **Cost by model breakdown**: See which models are driving costs
- **Optimization suggestions**: AI-powered recommendations for cost reduction

### 📈 Model Cost Comparison
- **Side-by-side model analysis**: Compare costs, performance, and usage across different AI models
- **Cost per 1K tokens**: Standardized pricing comparison
- **Performance metrics**: Latency, error rates, and token efficiency
- **Migration recommendations**: Identify opportunities to switch to cheaper alternatives

### 🔍 Prompt Pattern Analyzer
- **Expensive prompt detection**: Find prompts that are costing the most
- **Token efficiency analysis**: Input/output ratio and average token usage
- **AI insights**: Automatic detection of inefficient patterns
- **Optimization recommendations**: Suggestions for prompt engineering improvements

### 🔧 Agent Tool Heatmap
- **Tool usage visualization**: Heatmap of AI agent tool calls
- **Agent flow analysis**: Understand which tools are called together
- **Loop detection**: Identify potential infinite loops in agent workflows
- **Error rate tracking**: Monitor tool reliability

### ⚡ Guardrail Backtester
- **Policy simulation**: Test guardrail policies against historical data
- **Violation detection**: Identify requests that would be blocked
- **Impact analysis**: Understand the effect of policies before deployment
- **Custom threshold testing**: Experiment with different limits

### 💹 Model Arbitrage Simulator
- **Cost optimization scenarios**: Simulate routing strategies across models
- **Performance trade-off analysis**: Balance cost vs quality
- **Savings projections**: Estimate potential cost reductions
- **Model routing recommendations**: Optimize model selection

## 🏗️ Architecture

```
genai-ops-manager/
├── ui/
│   ├── main.tsx              # App entry point
│   └── app/
│       ├── App.tsx           # Main app with routing
│       ├── components/
│       │   ├── Card.tsx      # Reusable card component
│       │   └── Header.tsx    # App header
│       └── pages/
│           ├── Home.tsx                    # Dashboard
│           ├── CostForecast.tsx            # FinOps analytics
│           ├── ModelCostComparison.tsx     # Model comparison
│           ├── PromptAnalyzer.tsx          # Prompt analysis
│           ├── AgentToolHeatmap.tsx        # Agent tools
│           ├── GuardrailBacktester.tsx     # Policy testing
│           └── ModelArbitrageSimulator.tsx # Cost optimization
├── app.config.json           # Dynatrace app configuration
├── package.json              # Dependencies and scripts
└── vitest.config.ts          # Test configuration
```

## 📋 Prerequisites

- Node.js 16.13.0 or higher (Node.js 22 recommended)
- Dynatrace environment with GenAI observability data
- Required OAuth scopes:
  - `storage:spans:read` - For GenAI trace data
  - `storage:logs:read` - For log analysis
  - `storage:buckets:read` - For Grail bucket access
  - `storage:events:read` - For event data
  - `storage:metrics:read` - For metric data

## 🚀 Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/pushpendrasinghbaghel-ai/genai-ops-manager.git
cd genai-ops-manager

# Install dependencies
npm install
```

### Development

```bash
# Start development server
npm run start

# Or specify environment URL
npx dt-app dev --environment-url https://your-tenant.apps.dynatrace.com --open
```

### Build & Deploy

```bash
# Build for production
npm run build

# Deploy to Dynatrace
npm run deploy
```

### Testing

```bash
# Run tests
npm run test

# Run tests once
npm run test:run

# Run with coverage
npm run test:coverage
```

## 📊 DQL Queries

The app uses Dynatrace Query Language (DQL) to fetch GenAI observability data from Grail. Key query patterns:

### GenAI Spans Filter
```dql
fetch spans, from: now()-24h
| filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
```

### Token Usage Aggregation
```dql
| summarize 
    total_input = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
    total_output = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0))
```

### Tool Usage (Agent Spans)
```dql
fetch spans, from: now()-24h
| filter traceloop.span.kind == "tool"
| summarize call_count = count(), by: { tool_name = span.name }
```

## 🧪 Test Coverage

The app includes comprehensive unit tests:

- **DQL Query Validation**: Tests for correct query syntax and patterns
- **Cost Estimation**: Tests for pricing calculations across models
- **App Configuration**: Tests for required OAuth scopes

```bash
npm run test:run

# Output:
# ✓ ui/app/tests/dql-queries.test.ts (15 tests)
# ✓ ui/app/tests/app-config.test.ts (9 tests)
# ✓ ui/app/tests/cost-estimation.test.ts (21 tests)
# Test Files: 3 passed (3)
# Tests: 45 passed (45)
```

## 📁 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run start` | Start development server |
| `npm run build` | Build for production |
| `npm run deploy` | Deploy to Dynatrace |
| `npm run uninstall` | Uninstall from Dynatrace |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Run tests with coverage |
| `npm run lint` | Run ESLint |

## 🔧 Configuration

### app.config.json

```json
{
  "environmentUrl": "https://your-tenant.apps.dynatrace.com/",
  "app": {
    "name": "GenAI Ops Manager",
    "version": "0.0.1",
    "description": "Monitor and optimize GenAI workloads",
    "id": "my.genai.ops.manager",
    "scopes": [
      { "name": "storage:spans:read" },
      { "name": "storage:logs:read" },
      { "name": "storage:buckets:read" },
      { "name": "storage:events:read" },
      { "name": "storage:metrics:read" }
    ]
  }
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📚 Learn More

- [Dynatrace Developer Portal](https://developer.dynatrace.com/)
- [Dynatrace App Toolkit](https://developer.dynatrace.com/develop/app-toolkit/)
- [Strato Design System](https://developer.dynatrace.com/reference/design-system/)
- [DQL Documentation](https://docs.dynatrace.com/docs/platform/grail/dynatrace-query-language)

## 📄 License

This project is licensed under the ISC License.

---

Built with ❤️ for the Dynatrace Platform
