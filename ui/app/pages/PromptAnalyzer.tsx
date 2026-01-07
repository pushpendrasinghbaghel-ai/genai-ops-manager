import React, { useState } from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Strong, Text, Code } from "@dynatrace/strato-components/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { Select, SelectOption, TextInput } from "@dynatrace/strato-components-preview/forms";
import { DataTable } from "@dynatrace/strato-components-preview/tables";
import { useDql } from "@dynatrace-sdk/react-hooks";
import Colors from "@dynatrace/strato-design-tokens/colors";
import Borders from "@dynatrace/strato-design-tokens/borders";
import BoxShadows from "@dynatrace/strato-design-tokens/box-shadows";
import { ResearchIcon, IdeaIcon, WarningIcon } from "@dynatrace/strato-icons";

type PromptPattern = {
  promptPreview: string;
  count: number;
  avgTokens: number;
  avgCost: number;
  avgLatency: number;
  model: string;
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
  const [timeRange, setTimeRange] = useState("24h");
  const [minCost, setMinCost] = useState("0.01");
  const [searchPattern, setSearchPattern] = useState("");

  // DQL: Find prompt patterns with high token usage
  const expensivePromptsQuery = `
    fetch spans, from: now()-${timeRange}
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
    fetch spans, from: now()-${timeRange}
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
    fetch spans, from: now()-${timeRange}
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
  }));

  const efficiency = tokenEfficiency?.records?.[0] as Record<string, unknown> | undefined;
  const inputOutputRatio = Number(efficiency?.input_output_ratio || 0);
  const avgInputPerRequest = Number(efficiency?.avg_input_per_request || 0);

  // Generate insights
  const insights: { type: "warning" | "info" | "success"; title: string; description: string }[] = [];
  
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

  if (insights.length === 0) {
    insights.push({
      type: "success",
      title: "Prompts Look Efficient",
      description: "No obvious inefficiencies detected in your prompt patterns."
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
  ];

  return (
    <Flex flexDirection="column" padding={32} gap={24}>
      {/* Header */}
      <Flex flexDirection="column" gap={4}>
        <Heading level={2}>Prompt Pattern Analyzer</Heading>
        <Paragraph>Identify expensive, inefficient, or problematic prompt patterns from your Grail trace data.</Paragraph>
      </Flex>

      {/* Filters */}
      <Flex gap={16} alignItems="flex-end" flexWrap="wrap">
        <Flex flexDirection="column" gap={4}>
          <Text>Time Range</Text>
          <Select value={timeRange} onChange={(val) => setTimeRange(val as string)}>
            <SelectOption value="1h">Last 1 hour</SelectOption>
            <SelectOption value="24h">Last 24 hours</SelectOption>
            <SelectOption value="7d">Last 7 days</SelectOption>
            <SelectOption value="30d">Last 30 days</SelectOption>
          </Select>
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
