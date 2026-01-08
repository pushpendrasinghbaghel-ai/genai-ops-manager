import React, { useState, useMemo } from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Strong, Text, Code } from "@dynatrace/strato-components/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { TextInput } from "@dynatrace/strato-components-preview/forms";
import { TimeframeSelector } from "@dynatrace/strato-components-preview/filters";
import type { Timeframe } from "@dynatrace/strato-components-preview/core";
import { DataTable } from "@dynatrace/strato-components-preview/tables";
import { useDql } from "@dynatrace-sdk/react-hooks";
import Colors from "@dynatrace/strato-design-tokens/colors";
import Borders from "@dynatrace/strato-design-tokens/borders";
import BoxShadows from "@dynatrace/strato-design-tokens/box-shadows";
import { ResearchIcon, IdeaIcon, WarningIcon, SecurityIcon } from "@dynatrace/strato-icons";

/**
 * Create a default Timeframe object (last 24 hours)
 */
const createDefaultTimeframe = (): Timeframe => ({
  from: { value: 'now()-24h', type: 'expression', absoluteDate: new Date().toISOString() },
  to: { value: 'now()', type: 'expression', absoluteDate: new Date().toISOString() }
});

/**
 * Get display label for timeframe
 */
const getTimeframeLabel = (timeframe: Timeframe): string => {
  const from = timeframe.from?.value || 'now()-24h';
  if (from === 'now()-24h') return 'Last 24 Hours';
  if (from === 'now()-1h') return 'Last Hour';
  if (from === 'now()-6h') return 'Last 6 Hours';
  if (from === 'now()-12h') return 'Last 12 Hours';
  if (from === 'now()-7d') return 'Last 7 Days';
  if (from === 'now()-30d') return 'Last 30 Days';
  return 'Custom';
};

/**
 * Convert Timeframe to DQL clause
 */
const getTimeframeDqlClause = (timeframe: Timeframe | null): string => {
  if (!timeframe) {
    return 'from: now()-24h, to: now()';
  }
  const fromValue = timeframe.from?.value || 'now()-24h';
  const toValue = timeframe.to?.value || 'now()';
  return `from: ${fromValue}, to: ${toValue}`;
};

type PromptFlag = {
  type: 'pii' | 'hallucination' | 'injection' | 'sensitive' | 'bias';
  severity: 'low' | 'medium' | 'high' | 'critical';
  detail: string;
};

type PromptPattern = {
  promptPreview: string;
  count: number;
  avgTokens: number;
  avgCost: number;
  avgLatency: number;
  model: string;
  flags?: PromptFlag[];
};

/**
 * Analyze prompt for security and compliance issues
 */
const analyzePromptForFlags = (prompt: string): PromptFlag[] => {
  const flags: PromptFlag[] = [];
  const promptLower = prompt.toLowerCase();
  
  // PII Detection
  const ssnPattern = /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/;
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/;
  const creditCardPattern = /\b\d{4}[-. ]?\d{4}[-. ]?\d{4}[-. ]?\d{4}\b/;
  
  if (ssnPattern.test(prompt)) {
    flags.push({ type: 'pii', severity: 'critical', detail: 'SSN detected' });
  }
  if (emailPattern.test(prompt)) {
    flags.push({ type: 'pii', severity: 'high', detail: 'Email detected' });
  }
  if (phonePattern.test(prompt)) {
    flags.push({ type: 'pii', severity: 'medium', detail: 'Phone detected' });
  }
  if (creditCardPattern.test(prompt)) {
    flags.push({ type: 'pii', severity: 'critical', detail: 'Credit card detected' });
  }
  
  // Sensitive content
  if (promptLower.includes('password') || promptLower.includes('secret') || promptLower.includes('api key')) {
    flags.push({ type: 'sensitive', severity: 'high', detail: 'Credentials detected' });
  }
  
  // Prompt injection
  const injectionPatterns = ['ignore all previous', 'ignore previous instructions', 'disregard your instructions',
    'forget your rules', 'you are now', 'jailbreak'];
  for (const pattern of injectionPatterns) {
    if (promptLower.includes(pattern)) {
      flags.push({ type: 'injection', severity: 'critical', detail: 'Injection attempt' });
      break;
    }
  }
  
  // Hallucination risk
  if (promptLower.includes('current') || promptLower.includes('latest') || promptLower.includes('real-time')) {
    flags.push({ type: 'hallucination', severity: 'medium', detail: 'Real-time data query' });
  }
  
  // Bias detection
  if ((promptLower.includes('candidate') || promptLower.includes('hire')) &&
      (promptLower.includes('age') || promptLower.includes('gender') || promptLower.includes('race'))) {
    flags.push({ type: 'bias', severity: 'high', detail: 'Protected characteristics' });
  }
  
  return flags;
};

const InsightCard = ({ 
  type, 
  title, 
  description, 
  action 
}: { 
  type: "warning" | "info" | "success"; 
  title: string; 
  description: string;
  action?: React.ReactNode;
}) => {
  const bgColor = type === "warning" 
    ? Colors.Background.Field.Warning.Default 
    : type === "success" 
    ? Colors.Background.Field.Success.Default 
    : Colors.Background.Field.Primary.Default;
  
  const borderColor = type === "warning"
    ? Colors.Border.Warning.Default
    : type === "success"
    ? Colors.Border.Success.Default
    : Colors.Border.Primary.Default;

  return (
    <Flex
      padding={16}
      gap={12}
      alignItems="flex-start"
      style={{
        background: bgColor,
        borderRadius: Borders.Radius.Container.Default,
        border: `1px solid ${borderColor}`,
        flex: "1 1 300px"
      }}
    >
      {type === "warning" ? <WarningIcon /> : <IdeaIcon />}
      <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
        <Strong>{title}</Strong>
        <Paragraph>{description}</Paragraph>
        {action}
      </Flex>
    </Flex>
  );
};

export const PromptAnalyzer = () => {
  const [timeframe, setTimeframe] = useState<Timeframe>(createDefaultTimeframe());
  const [minCost, setMinCost] = useState("0.01");
  const [searchPattern, setSearchPattern] = useState("");

  // Build DQL time clause from timeframe
  const timeClause = useMemo(() => getTimeframeDqlClause(timeframe), [timeframe]);

  // DQL: Find prompt patterns with high token usage
  const expensivePromptsQuery = `
    fetch spans, ${timeClause}
    | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
    | filter isNotNull(gen_ai.prompt.0.content)
    | fieldsAdd prompt_preview = substring(gen_ai.prompt.0.content, from:0, to:100)
    | fieldsAdd total_tokens = coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0)
    | summarize 
        count = count(),
        avg_input_tokens = avg(coalesce(gen_ai.usage.input_tokens, 0)),
        avg_output_tokens = avg(coalesce(gen_ai.usage.output_tokens, 0)),
        avg_latency = avg(duration) / 1000000,
        by: { prompt_preview, model = gen_ai.request.model }
    | fieldsAdd avg_tokens = avg_input_tokens + avg_output_tokens
    | sort avg_tokens desc
    | limit 50
  `;

  // DQL: Find prompts with high token usage (potentially inefficient)
  const highTokenPromptsQuery = `
    fetch spans, ${timeClause}
    | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
    | filter coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0) > 1000
    | summarize 
        count = count(),
        avg_input_tokens = avg(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
        avg_output_tokens = avg(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
        by: { model = gen_ai.request.model }
    | sort avg_input_tokens desc
  `;

  // DQL: Token efficiency analysis
  const tokenEfficiencyQuery = `
    fetch spans, ${timeClause}
    | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
    | summarize 
        total_input = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
        total_output = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
        request_count = count()
    | fieldsAdd 
        input_output_ratio = if(total_output > 0, then: toDouble(total_input) / toDouble(total_output), else: 0.0),
        avg_input_per_request = toDouble(total_input) / toDouble(request_count),
        avg_output_per_request = toDouble(total_output) / toDouble(request_count)
  `;

  const { data: expensivePrompts, isLoading: expensiveLoading, refetch } = useDql({ query: expensivePromptsQuery });
  const { data: highTokenPrompts, isLoading: highTokenLoading } = useDql({ query: highTokenPromptsQuery });
  const { data: tokenEfficiency, isLoading: efficiencyLoading } = useDql({ query: tokenEfficiencyQuery });

  const isLoading = expensiveLoading || highTokenLoading || efficiencyLoading;

  // Estimate cost per token based on model
  const estimateCost = (model: string, inputTokens: number, outputTokens: number): number => {
    const m = (model || "").toLowerCase();
    let inputRate = 0.001 / 1000;
    let outputRate = 0.002 / 1000;
    if (m.includes("gpt-4o")) { inputRate = 0.0025 / 1000; outputRate = 0.01 / 1000; }
    else if (m.includes("gpt-4")) { inputRate = 0.03 / 1000; outputRate = 0.06 / 1000; }
    else if (m.includes("gpt-3")) { inputRate = 0.0005 / 1000; outputRate = 0.0015 / 1000; }
    else if (m.includes("gemini")) { inputRate = 0.00025 / 1000; outputRate = 0.0005 / 1000; }
    return inputTokens * inputRate + outputTokens * outputRate;
  };

  // Process data for insights (keep numeric)
  const promptPatternsRaw = (expensivePrompts?.records || []).map((record: Record<string, unknown>) => {
    const avgInputTokens = Number(record.avg_input_tokens || 0);
    const avgOutputTokens = Number(record.avg_output_tokens || 0);
    const model = String(record.model || "Unknown");
    const avgCost = estimateCost(model, avgInputTokens, avgOutputTokens);
    return {
      promptPreview: String(record.prompt_preview || "N/A"),
      count: Number(record.count || 0),
      avgTokens: avgInputTokens + avgOutputTokens,
      avgCost,
      avgLatency: Number(record.avg_latency || 0),
      model,
      flags: analyzePromptForFlags(String(record.prompt_preview || "")),
    };
  });

  // Process data for display (formatted strings)
  const promptPatterns = promptPatternsRaw.map((p) => ({
    promptPreview: p.promptPreview.substring(0, 80),
    count: p.count,
    avgTokens: p.avgTokens.toLocaleString(),
    avgCost: `$${p.avgCost.toFixed(5)}`,
    avgLatency: `${p.avgLatency.toFixed(0)}ms`,
    model: p.model,
    security: p.flags && p.flags.length > 0 
      ? `${p.flags.map(f => f.type).join(', ')} (${p.flags[0].severity})`
      : '✓ Clean',
  }));

  const efficiency = tokenEfficiency?.records?.[0] as Record<string, unknown> | undefined;
  const inputOutputRatio = Number(efficiency?.input_output_ratio || 0);
  const avgInputPerRequest = Number(efficiency?.avg_input_per_request || 0);

  // Generate insights
  const insights: { type: "warning" | "info" | "success"; title: string; description: string }[] = [];
  
  // Security insights
  const piiCount = promptPatternsRaw.filter(p => p.flags?.some(f => f.type === 'pii')).length;
  const injectionCount = promptPatternsRaw.filter(p => p.flags?.some(f => f.type === 'injection')).length;
  const biasCount = promptPatternsRaw.filter(p => p.flags?.some(f => f.type === 'bias')).length;
  
  if (piiCount > 0) {
    insights.push({
      type: "warning",
      title: `🔐 PII Detected in ${piiCount} Prompts`,
      description: "Personally identifiable information found in prompts. Review and mask sensitive data for compliance."
    });
  }
  
  if (injectionCount > 0) {
    insights.push({
      type: "warning",
      title: `⚠️ ${injectionCount} Injection Attempts Detected`,
      description: "Prompt injection patterns found. Implement input validation and sanitization."
    });
  }
  
  if (biasCount > 0) {
    insights.push({
      type: "warning",
      title: `⚖️ Bias Risk in ${biasCount} Prompts`,
      description: "Protected characteristics detected in decision contexts. Review for fairness and compliance."
    });
  }
  
  // Cost insights
  if (inputOutputRatio > 5) {
    insights.push({
      type: "warning",
      title: "High Input/Output Ratio Detected",
      description: `Your prompts use ${inputOutputRatio.toFixed(1)}x more input tokens than output. Consider condensing system prompts or using prompt caching.`
    });
  }

  if (avgInputPerRequest > 2000) {
    insights.push({
      type: "warning",
      title: "Large Average Prompt Size",
      description: `Average prompt is ${avgInputPerRequest.toFixed(0)} tokens. Consider chunking or summarizing context to reduce costs.`
    });
  }

  const expensivePattern = promptPatternsRaw.find(p => p.avgCost > 0.1);
  if (expensivePattern) {
    insights.push({
      type: "warning",
      title: "Expensive Prompt Pattern Found",
      description: `Pattern "${expensivePattern.promptPreview.substring(0, 50)}..." averages $${expensivePattern.avgCost.toFixed(4)} per request.`
    });
  }

  if (insights.length === 0 || (insights.length > 0 && !insights.some(i => i.type === 'success'))) {
    insights.push({
      type: "success",
      title: "✅ Prompts Look Good",
      description: "No major security or cost issues detected in your prompt patterns."
    });
  }

  const columns = [
    { 
      id: "promptPreview", 
      header: "Prompt Preview", 
      accessor: "promptPreview",
      autoWidth: false
    },
    { id: "model", header: "Model", accessor: "model", autoWidth: true },
    { id: "count", header: "Count", accessor: "count", autoWidth: true },
    { 
      id: "avgTokens", 
      header: "Avg Tokens", 
      accessor: "avgTokens", 
      autoWidth: true
    },
    { 
      id: "avgCost", 
      header: "Avg Cost", 
      accessor: "avgCost",
      autoWidth: true
    },
    { 
      id: "avgLatency", 
      header: "Avg Latency", 
      accessor: "avgLatency",
      autoWidth: true
    },
    { id: "security", header: "🔒 Security", accessor: "security", autoWidth: true },
  ];

  return (
    <Flex flexDirection="column" padding={32} gap={24}>
      {/* Header */}
      <Flex flexDirection="column" gap={4}>
        <Heading level={2}>🔍 Prompt Pattern Analyzer</Heading>
        <Paragraph>Analyze prompt patterns for security, compliance, cost efficiency, and performance from your Grail trace data.</Paragraph>
      </Flex>

      {/* Filters */}
      <Flex gap={16} alignItems="flex-end" flexWrap="wrap">
        <Flex flexDirection="column" gap={4}>
          <Text>Time Range</Text>
          <TimeframeSelector
            value={timeframe}
            onChange={(tf) => tf && setTimeframe(tf)}
          />
        </Flex>
        <Flex flexDirection="column" gap={4}>
          <Text>Min Cost ($)</Text>
          <TextInput 
            value={minCost} 
            onChange={(val) => setMinCost(val)} 
            placeholder="0.01"
            style={{ width: 100 }}
          />
        </Flex>
        <Button variant="accent" onClick={() => refetch()} disabled={isLoading}>
          <Button.Prefix><ResearchIcon /></Button.Prefix>
          Analyze Patterns
        </Button>
      </Flex>

      {/* Insights */}
      <Flex flexDirection="column" gap={12}>
        <Heading level={4}>💡 AI Insights</Heading>
        <Flex gap={16} flexWrap="wrap">
          {insights.map((insight, idx) => (
            <InsightCard key={idx} type={insight.type} title={insight.title} description={insight.description} />
          ))}
        </Flex>
      </Flex>

      {/* Token Efficiency Summary */}
      {efficiency && (
        <Flex
          padding={16}
          gap={24}
          style={{
            background: Colors.Background.Surface.Default,
            borderRadius: Borders.Radius.Container.Default,
            border: `1px solid ${Colors.Border.Neutral.Default}`
          }}
        >
          <Flex flexDirection="column" gap={4}>
            <Text style={{ color: Colors.Text.Neutral.Subdued }}>Input/Output Ratio</Text>
            <Heading level={4}>{inputOutputRatio.toFixed(2)}x</Heading>
          </Flex>
          <Flex flexDirection="column" gap={4}>
            <Text style={{ color: Colors.Text.Neutral.Subdued }}>Avg Input Tokens/Request</Text>
            <Heading level={4}>{avgInputPerRequest.toFixed(0)}</Heading>
          </Flex>
          <Flex flexDirection="column" gap={4}>
            <Text style={{ color: Colors.Text.Neutral.Subdued }}>Avg Output Tokens/Request</Text>
            <Heading level={4}>{Number(efficiency.avg_output_per_request || 0).toFixed(0)}</Heading>
          </Flex>
        </Flex>
      )}

      {/* Prompt Patterns Table */}
      <Flex flexDirection="column" gap={12}>
        <Heading level={4}>Top Prompt Patterns by Cost</Heading>
        {isLoading ? (
          <Paragraph>Analyzing prompt patterns from Grail...</Paragraph>
        ) : promptPatterns.length > 0 ? (
          <DataTable data={promptPatterns} columns={columns} />
        ) : (
          <Flex
            padding={32}
            justifyContent="center"
            style={{
              background: Colors.Background.Surface.Default,
              borderRadius: Borders.Radius.Container.Default,
              border: `1px solid ${Colors.Border.Neutral.Default}`
            }}
          >
            <Paragraph>No prompt data found matching criteria. Ensure prompt content capture is enabled in your instrumentation.</Paragraph>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
};
