import React, { useState } from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Strong, Text } from "@dynatrace/strato-components/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { Select, SelectOption } from "@dynatrace/strato-components-preview/forms";
import { DataTable } from "@dynatrace/strato-components-preview/tables";
import { useDql } from "@dynatrace-sdk/react-hooks";
import Colors from "@dynatrace/strato-design-tokens/colors";
import Borders from "@dynatrace/strato-design-tokens/borders";
import BoxShadows from "@dynatrace/strato-design-tokens/box-shadows";
import { MoneyIcon, RefreshIcon } from "@dynatrace/strato-icons";

// Summary Card Component
const SummaryCard = ({ 
  title, 
  value, 
  subtitle,
  color
}: { 
  title: string; 
  value: string; 
  subtitle?: string;
  color?: string;
}) => (
  <Flex
    flexDirection="column"
    padding={16}
    gap={8}
    style={{
      border: `1px solid ${Colors.Border.Neutral.Default}`,
      borderRadius: Borders.Radius.Container.Default,
      background: Colors.Background.Surface.Default,
      boxShadow: BoxShadows.Surface.Raised.Rest,
      flex: "1 1 180px",
      minWidth: 180
    }}
  >
    <Text style={{ color: Colors.Text.Neutral.Subdued, fontSize: 13 }}>{title}</Text>
    <Heading level={3} style={{ color: color || Colors.Text.Neutral.Default }}>{value}</Heading>
    {subtitle && <Text style={{ fontSize: 12, color: Colors.Text.Neutral.Subdued }}>{subtitle}</Text>}
  </Flex>
);

// Cost estimation function based on tokens (avg market rates)
const estimateCost = (inputTokens: number, outputTokens: number, model?: string): number => {
  // Different pricing tiers by model family
  const modelLower = (model || "").toLowerCase();
  let inputRate = 0.002; // per 1K tokens
  let outputRate = 0.006;
  
  if (modelLower.includes("gpt-4o")) {
    inputRate = 0.0025;
    outputRate = 0.01;
  } else if (modelLower.includes("gpt-4")) {
    inputRate = 0.03;
    outputRate = 0.06;
  } else if (modelLower.includes("gpt-3.5")) {
    inputRate = 0.0005;
    outputRate = 0.0015;
  } else if (modelLower.includes("claude-3-opus")) {
    inputRate = 0.015;
    outputRate = 0.075;
  } else if (modelLower.includes("claude-3-sonnet")) {
    inputRate = 0.003;
    outputRate = 0.015;
  } else if (modelLower.includes("claude")) {
    inputRate = 0.001;
    outputRate = 0.005;
  } else if (modelLower.includes("gemini")) {
    inputRate = 0.00025;
    outputRate = 0.0005;
  } else if (modelLower.includes("ollama") || modelLower.includes("llama")) {
    inputRate = 0;
    outputRate = 0;
  }
  
  return (inputTokens / 1000) * inputRate + (outputTokens / 1000) * outputRate;
};

export const ModelCostComparison = () => {
  const [timeRange, setTimeRange] = useState<string>("24h");

  const timeRangeOptions = [
    { value: "1h", label: "Last 1 Hour" },
    { value: "6h", label: "Last 6 Hours" },
    { value: "24h", label: "Last 24 Hours" },
    { value: "7d", label: "Last 7 Days" },
    { value: "30d", label: "Last 30 Days" }
  ];

  // DQL: Get model statistics
  const modelStatsQuery = `
    fetch spans, from: now()-${timeRange}
    | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
    | summarize 
        requests = count(),
        total_input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
        total_output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
        avg_latency_ms = avg(duration) / 1000000,
        error_count = countIf(isNotNull(error.type)),
        by: { model = gen_ai.request.model }
    | fieldsAdd total_tokens = total_input_tokens + total_output_tokens
  `;

  // DQL: Get total aggregates
  const totalsQuery = `
    fetch spans, from: now()-${timeRange}
    | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
    | summarize 
        total_requests = count(),
        total_input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
        total_output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
        avg_latency_ms = avg(duration) / 1000000
    | fieldsAdd total_tokens = total_input_tokens + total_output_tokens
  `;

  const { data: modelStats, isLoading: statsLoading, refetch: refetchStats } = useDql({ query: modelStatsQuery });
  const { data: totals, isLoading: totalsLoading, refetch: refetchTotals } = useDql({ query: totalsQuery });

  const isLoading = statsLoading || totalsLoading;
  const refetch = () => { refetchStats(); refetchTotals(); };

  // Process model data
  const tableData = (modelStats?.records || []).map((record: Record<string, unknown>) => {
    const model = String(record.model || "unknown");
    const requests = Number(record.requests || 0);
    const inputTokens = Number(record.total_input_tokens || 0);
    const outputTokens = Number(record.total_output_tokens || 0);
    const tokens = inputTokens + outputTokens;
    const avgLatency = Number(record.avg_latency_ms || 0);
    const errorCount = Number(record.error_count || 0);
    const errorRate = requests > 0 ? (errorCount / requests) * 100 : 0;
    const cost = estimateCost(inputTokens, outputTokens, model);
    
    return { model, requests, tokens, inputTokens, outputTokens, cost, avgLatency, errorRate };
  }).sort((a: { cost: number }, b: { cost: number }) => b.cost - a.cost);

  // Process totals
  const totalsData = totals?.records?.[0] as Record<string, unknown> | undefined;
  const totalRequests = Number(totalsData?.total_requests || 0);
  const totalInputTokens = Number(totalsData?.total_input_tokens || 0);
  const totalOutputTokens = Number(totalsData?.total_output_tokens || 0);
  const totalTokens = totalInputTokens + totalOutputTokens;
  const totalCost = estimateCost(totalInputTokens, totalOutputTokens);
  const avgLatency = Number(totalsData?.avg_latency_ms || 0);

  // Find most expensive model
  const mostExpensive = tableData.length > 0 ? tableData[0] : null;

  // Table columns
  const columns = [
    { id: "model", header: "Model", accessor: "model", autoWidth: true },
    { id: "requests", header: "Requests", accessor: "requests", autoWidth: true },
    { id: "tokens", header: "Total Tokens", accessor: (row: typeof tableData[0]) => row.tokens.toLocaleString(), autoWidth: true },
    { id: "cost", header: "Est. Cost", accessor: (row: typeof tableData[0]) => `$${row.cost.toFixed(4)}`, autoWidth: true },
    { id: "costPerReq", header: "Cost/Request", accessor: (row: typeof tableData[0]) => `$${(row.cost / Math.max(row.requests, 1)).toFixed(6)}`, autoWidth: true },
    { id: "avgLatency", header: "Avg Latency", accessor: (row: typeof tableData[0]) => `${row.avgLatency.toFixed(0)}ms`, autoWidth: true },
    { id: "errorRate", header: "Error Rate", accessor: (row: typeof tableData[0]) => (
      <Text style={{ color: row.errorRate > 5 ? Colors.Text.Critical.Default : Colors.Text.Success.Default }}>
        {row.errorRate.toFixed(2)}%
      </Text>
    ), autoWidth: true }
  ];

  return (
    <Flex flexDirection="column" padding={32} gap={24}>
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center">
        <Flex flexDirection="column" gap={4}>
          <Heading level={1}>Model Cost Comparison</Heading>
          <Paragraph>Compare LLM models by cost, latency, and usage. Data from Dynatrace Grail.</Paragraph>
        </Flex>
        <Flex gap={16} alignItems="center">
          <Select
            value={timeRange}
            onChange={(value) => setTimeRange(value as string)}
            style={{ minWidth: 160 }}
          >
            {timeRangeOptions.map((opt) => (
              <SelectOption key={opt.value} value={opt.value}>{opt.label}</SelectOption>
            ))}
          </Select>
          <Button variant="default" onClick={refetch} disabled={isLoading}>
            <Button.Prefix><RefreshIcon /></Button.Prefix>
            Refresh
          </Button>
        </Flex>
      </Flex>

      {/* Summary Cards */}
      <Flex gap={16} flexWrap="wrap">
        <SummaryCard title="Total Requests" value={totalRequests.toLocaleString()} subtitle={`Last ${timeRange}`} />
        <SummaryCard title="Total Tokens" value={totalTokens.toLocaleString()} subtitle="Input + Output" />
        <SummaryCard title="Total Cost" value={`$${totalCost.toFixed(2)}`} subtitle={`Last ${timeRange}`} color={Colors.Text.Warning.Default} />
        <SummaryCard title="Avg Latency" value={`${avgLatency.toFixed(0)}ms`} subtitle="Across all models" />
      </Flex>

      {/* Optimization Recommendation */}
      {mostExpensive && mostExpensive.cost > 0.01 && (
        <Flex
          padding={16}
          gap={12}
          alignItems="center"
          style={{
            background: Colors.Background.Field.Warning.Default,
            borderRadius: Borders.Radius.Container.Default,
            border: `1px solid ${Colors.Border.Warning.Default}`
          }}
        >
          <MoneyIcon style={{ color: Colors.Text.Warning.Default }} />
          <Flex flexDirection="column" gap={2} style={{ flex: 1 }}>
            <Strong style={{ color: Colors.Text.Warning.Default }}>
              Cost Optimization Opportunity
            </Strong>
            <Paragraph>
              <Strong>{mostExpensive.model}</Strong> is your highest-cost model at ${mostExpensive.cost.toFixed(4)} 
              ({mostExpensive.requests} requests). Consider using a smaller model for simple tasks.
            </Paragraph>
          </Flex>
        </Flex>
      )}

      {/* Model Comparison Table */}
      {tableData.length > 0 ? (
        <Flex flexDirection="column" gap={16}>
          <Heading level={3}>Model Breakdown</Heading>
          <DataTable
            data={tableData}
            columns={columns}
            sortable
          />
        </Flex>
      ) : (
        <Flex
          padding={32}
          justifyContent="center"
          alignItems="center"
          style={{
            background: Colors.Background.Surface.Default,
            borderRadius: Borders.Radius.Container.Default,
            border: `1px solid ${Colors.Border.Neutral.Default}`
          }}
        >
          <Paragraph>No GenAI span data found. Ensure your LLM applications are instrumented with OpenTelemetry/OpenLLMetry.</Paragraph>
        </Flex>
      )}

      {/* Cost Breakdown Charts */}
      <Flex gap={16} flexWrap="wrap">
        <Flex
          flexDirection="column"
          gap={16}
          padding={20}
          style={{
            flex: "1 1 400px",
            border: `1px solid ${Colors.Border.Neutral.Default}`,
            borderRadius: Borders.Radius.Container.Default,
            background: Colors.Background.Surface.Default
          }}
        >
          <Heading level={4}>Cost Distribution by Model</Heading>
          {tableData.slice(0, 5).map((model: typeof tableData[0]) => (
            <Flex key={model.model} alignItems="center" gap={12}>
              <Text style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{model.model}</Text>
              <Flex style={{ width: 200, background: Colors.Background.Field.Neutral.Default, borderRadius: 4, height: 12 }}>
                <Flex style={{ 
                  width: `${totalCost > 0 ? (model.cost / totalCost) * 100 : 0}%`, 
                  background: Colors.Charts.Categorical.Color01.Default, 
                  borderRadius: 4 
                }} />
              </Flex>
              <Text style={{ minWidth: 60, textAlign: "right" }}>${model.cost.toFixed(4)}</Text>
            </Flex>
          ))}
        </Flex>
        <Flex
          flexDirection="column"
          gap={16}
          padding={20}
          style={{
            flex: "1 1 400px",
            border: `1px solid ${Colors.Border.Neutral.Default}`,
            borderRadius: Borders.Radius.Container.Default,
            background: Colors.Background.Surface.Default
          }}
        >
          <Heading level={4}>Request Distribution by Model</Heading>
          {tableData.slice(0, 5).map((model: typeof tableData[0]) => (
            <Flex key={model.model} alignItems="center" gap={12}>
              <Text style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{model.model}</Text>
              <Flex style={{ width: 200, background: Colors.Background.Field.Neutral.Default, borderRadius: 4, height: 12 }}>
                <Flex style={{ 
                  width: `${totalRequests > 0 ? (model.requests / totalRequests) * 100 : 0}%`, 
                  background: Colors.Charts.Categorical.Color02.Default, 
                  borderRadius: 4 
                }} />
              </Flex>
              <Text style={{ minWidth: 60, textAlign: "right" }}>{model.requests}</Text>
            </Flex>
          ))}
        </Flex>
      </Flex>
    </Flex>
  );
};
