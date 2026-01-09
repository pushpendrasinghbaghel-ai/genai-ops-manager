import React, { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Strong, Text } from "@dynatrace/strato-components/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { ProgressCircle } from "@dynatrace/strato-components/content";
import { Select, SelectOption } from "@dynatrace/strato-components-preview/forms";
import { useDql } from "@dynatrace-sdk/react-hooks";
import Colors from "@dynatrace/strato-design-tokens/colors";
import Borders from "@dynatrace/strato-design-tokens/borders";
import BoxShadows from "@dynatrace/strato-design-tokens/box-shadows";
import { 
  LineChartIcon, 
  MoneyIcon, 
  SecurityIcon, 
  AIModelIcon, 
  ResearchIcon,
  WarningIcon,
  CheckmarkIcon,
  RefreshIcon
} from "@dynatrace/strato-icons";

// Summary Card Component
const SummaryCard = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color,
  trend
}: { 
  title: string; 
  value: string; 
  subtitle?: string; 
  icon: React.ReactNode;
  color?: string;
  trend?: { value: number; label: string };
}) => (
  <Flex
    flexDirection="column"
    padding={20}
    gap={12}
    style={{
      border: `1px solid ${Colors.Border.Neutral.Default}`,
      borderRadius: Borders.Radius.Container.Default,
      background: Colors.Background.Surface.Default,
      boxShadow: BoxShadows.Surface.Raised.Rest,
      flex: "1 1 220px",
      minWidth: 220
    }}
  >
    <Flex justifyContent="space-between" alignItems="center">
      <Text style={{ color: Colors.Text.Neutral.Subdued }}>{title}</Text>
      {icon}
    </Flex>
    <Heading level={2} style={{ color: color || Colors.Text.Neutral.Default }}>{value}</Heading>
    {subtitle && <Text style={{ fontSize: 12, color: Colors.Text.Neutral.Subdued }}>{subtitle}</Text>}
    {trend && (
      <Flex alignItems="center" gap={4}>
        <Text style={{ 
          color: trend.value > 0 ? Colors.Text.Critical.Default : Colors.Text.Success.Default,
          fontSize: 13 
        }}>
          {trend.value > 0 ? "↑" : "↓"} {Math.abs(trend.value).toFixed(1)}%
        </Text>
        <Text style={{ fontSize: 12, color: Colors.Text.Neutral.Subdued }}>{trend.label}</Text>
      </Flex>
    )}
  </Flex>
);

// Feature Card Component
const FeatureCard = ({ 
  title, 
  description, 
  to, 
  icon,
  status
}: { 
  title: string; 
  description: string; 
  to: string;
  icon: React.ReactNode;
  status?: "healthy" | "warning" | "critical";
}) => {
  const statusColors = {
    healthy: Colors.Border.Success.Default,
    warning: Colors.Border.Warning.Default,
    critical: Colors.Border.Critical.Default,
  };

  return (
    <Flex
      flexDirection="column"
      padding={20}
      gap={16}
      style={{
        border: `1px solid ${status ? statusColors[status] : Colors.Border.Neutral.Default}`,
        borderRadius: Borders.Radius.Container.Default,
        background: Colors.Background.Surface.Default,
        boxShadow: BoxShadows.Surface.Raised.Rest,
        flex: "1 1 280px",
        minWidth: 280
      }}
    >
      <Flex alignItems="center" gap={12}>
        {icon}
        <Heading level={5}>{title}</Heading>
        {status && (
          <Flex 
            alignItems="center" 
            padding={4} 
            style={{ 
              borderRadius: 4, 
              background: status === "healthy" ? Colors.Background.Field.Success.Default : status === "warning" ? Colors.Background.Field.Warning.Default : Colors.Background.Field.Critical.Default 
            }}
          >
            {status === "healthy" ? <CheckmarkIcon /> : <WarningIcon />}
          </Flex>
        )}
      </Flex>
      <Paragraph>{description}</Paragraph>
      <Flex justifyContent="flex-end">
        <Button as={RouterLink} to={to} variant="accent">
          Open →
        </Button>
      </Flex>
    </Flex>
  );
};

export const Home = () => {
  const [timeRange, setTimeRange] = useState<string>("24h");

  // Time range options
  const timeRangeOptions = [
    { value: "1h", label: "Last 1 Hour" },
    { value: "6h", label: "Last 6 Hours" },
    { value: "24h", label: "Last 24 Hours" },
    { value: "7d", label: "Last 7 Days" },
    { value: "30d", label: "Last 30 Days" }
  ];

  // DQL: Get high-level GenAI metrics for dashboard
  const summaryQuery = `
    fetch spans, from: now()-${timeRange}
    | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
    | summarize 
        total_requests = count(),
        total_input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
        total_output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
        avg_latency = avg(duration) / 1000000,
        model_count = countDistinct(gen_ai.request.model)
    | fieldsAdd total_tokens = total_input_tokens + total_output_tokens
  `;

  // DQL: Get model breakdown
  const modelBreakdownQuery = `
    fetch spans, from: now()-${timeRange}
    | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
    | summarize 
        request_count = count(),
        tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0)),
        by: { model = gen_ai.request.model, provider = gen_ai.provider.name }
    | sort request_count desc
    | limit 5
  `;

  // DQL: Get active alerts / anomalies
  const alertsQuery = `
    fetch spans, from: now()-1h
    | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
    | filter isNotNull(error.type)
    | summarize error_count = count(), by: { model = gen_ai.request.model }
    | filter error_count > 5
  `;

  const { data: summary, isLoading: summaryLoading, refetch } = useDql({ query: summaryQuery });
  const { data: modelBreakdown, isLoading: modelLoading } = useDql({ query: modelBreakdownQuery });
  const { data: alerts, isLoading: alertsLoading } = useDql({ query: alertsQuery });

  const isLoading = summaryLoading || modelLoading || alertsLoading;

  // Process summary data
  const summaryData = summary?.records?.[0] as Record<string, unknown> | undefined;
  const totalRequests = Number(summaryData?.total_requests || 0);
  const totalInputTokens = Number(summaryData?.total_input_tokens || 0);
  const totalOutputTokens = Number(summaryData?.total_output_tokens || 0);
  const totalTokens = totalInputTokens + totalOutputTokens;
  const avgLatency = Number(summaryData?.avg_latency || 0);
  const modelCount = Number(summaryData?.model_count || 0);
  
  // Estimate cost from tokens (blended rate)
  const estimateCost = (inputTokens: number, outputTokens: number): number => {
    const inputRate = 0.002 / 1000; // $0.002 per 1K input tokens (avg)
    const outputRate = 0.006 / 1000; // $0.006 per 1K output tokens (avg)
    return inputTokens * inputRate + outputTokens * outputRate;
  };
  const totalCost = estimateCost(totalInputTokens, totalOutputTokens);

  // Process model breakdown
  const topModels = (modelBreakdown?.records || []).slice(0, 5) as Record<string, unknown>[];

  // Process alerts
  const activeAlerts = alerts?.records?.length || 0;

  return (
    <Flex flexDirection="column" padding={32} gap={32}>
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center">
        <Flex flexDirection="column" gap={4}>
          <Heading level={1}>GenAI Ops Manager</Heading>
          <Paragraph>Analyze, optimize, and govern your GenAI workloads with Dynatrace Grail data.</Paragraph>
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
          <Button variant="default" onClick={() => refetch()} disabled={isLoading}>
            <Button.Prefix><RefreshIcon /></Button.Prefix>
            Refresh
          </Button>
        </Flex>
      </Flex>

      {/* Active Alerts Banner */}
      {activeAlerts > 0 && (
        <Flex
          padding={16}
          gap={12}
          alignItems="center"
          style={{
            background: Colors.Background.Field.Critical.Default,
            borderRadius: Borders.Radius.Container.Default,
            border: `1px solid ${Colors.Border.Critical.Default}`
          }}
        >
          <WarningIcon style={{ color: Colors.Text.Critical.Default }} />
          <Flex flexDirection="column" gap={2} style={{ flex: 1 }}>
            <Strong style={{ color: Colors.Text.Critical.Default }}>
              {activeAlerts} model(s) with elevated error rates
            </Strong>
            <Text>Check the Agent Tools page for details on failing models.</Text>
          </Flex>
          <Button as={RouterLink} to="/agents" variant="emphasized">View Details</Button>
        </Flex>
      )}

      {/* Loading State */}
      {isLoading && (
        <Flex justifyContent="center" alignItems="center" padding={40}>
          <ProgressCircle />
          <Text style={{ marginLeft: 12 }}>Loading GenAI metrics...</Text>
        </Flex>
      )}

      {/* Empty State */}
      {!isLoading && totalRequests === 0 && (
        <Flex
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          padding={64}
          gap={16}
          style={{
            border: `1px dashed ${Colors.Border.Neutral.Default}`,
            borderRadius: Borders.Radius.Container.Default,
            background: Colors.Background.Surface.Default
          }}
        >
          <AIModelIcon style={{ fontSize: 48, color: Colors.Text.Neutral.Subdued }} />
          <Heading level={4} style={{ color: Colors.Text.Neutral.Subdued }}>No GenAI Data Found</Heading>
          <Text style={{ textAlign: 'center', maxWidth: 500, color: Colors.Text.Neutral.Subdued }}>
            No GenAI spans found in the selected timeframe. Make sure your applications are instrumented with GenAI observability.
          </Text>
        </Flex>
      )}

      {/* Summary Cards */}
      {!isLoading && totalRequests > 0 && (
        <Flex gap={16} flexWrap="wrap">
          <SummaryCard
            title="Total Requests"
            value={totalRequests.toLocaleString()}
            icon={<LineChartIcon />}
            subtitle="In selected timeframe"
          />
        <SummaryCard
          title="Estimated Cost"
          value={`$${totalCost.toFixed(2)}`}
          icon={<MoneyIcon />}
          color={totalCost > 100 ? Colors.Text.Warning.Default : undefined}
          subtitle="Based on avg token rates"
        />
        <SummaryCard
          title="Total Tokens"
          value={totalTokens > 1000000 ? `${(totalTokens / 1000000).toFixed(1)}M` : totalTokens.toLocaleString()}
          icon={<AIModelIcon />}
          subtitle="Input + Output"
        />
        <SummaryCard
          title="Avg Latency"
          value={`${avgLatency.toFixed(0)}ms`}
          icon={<LineChartIcon />}
          subtitle="Across all models"
        />
        <SummaryCard
          title="Active Models"
          value={modelCount.toString()}
          icon={<AIModelIcon />}
          subtitle="Unique models"
        />
        </Flex>
      )}

      {/* Feature Cards */}
      <Flex flexDirection="column" gap={16}>
        <Heading level={3}>GenAI Ops Tools</Heading>
        <Flex gap={20} flexWrap="wrap">
          <FeatureCard
            title="Model Cost Comparison"
            description="Compare cost, latency, and usage across all your LLM models. Get optimization recommendations."
            to="/models"
            icon={<MoneyIcon style={{ color: Colors.Text.Primary.Default }} />}
            status={totalCost > 100 ? "warning" : "healthy"}
          />
          <FeatureCard
            title="Prompt Pattern Analyzer"
            description="Identify expensive, inefficient, or problematic prompt patterns from your trace data."
            to="/prompts"
            icon={<ResearchIcon style={{ color: Colors.Text.Primary.Default }} />}
          />
          <FeatureCard
            title="Cost Forecast & FinOps"
            description="Predict your GenAI spend based on historical data. Set budget alerts and get optimization tips."
            to="/forecast"
            icon={<LineChartIcon style={{ color: Colors.Text.Primary.Default }} />}
          />
          <FeatureCard
            title="Guardrail Policy Backtester"
            description="Define content policies and test them against historical data before deployment."
            to="/guardrails"
            icon={<SecurityIcon style={{ color: Colors.Text.Primary.Default }} />}
          />
          <FeatureCard
            title="Agent Tool Heatmap"
            description="Analyze tool call patterns, detect anomalies, and identify potential infinite loops."
            to="/agents"
            icon={<AIModelIcon style={{ color: Colors.Text.Primary.Default }} />}
            status={activeAlerts > 0 ? "critical" : "healthy"}
          />
        </Flex>
      </Flex>
    </Flex>
  );
};
