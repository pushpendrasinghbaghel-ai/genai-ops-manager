import React, { useState, useEffect } from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Strong, Text } from "@dynatrace/strato-components/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { Select, SelectOption, TextInput } from "@dynatrace/strato-components-preview/forms";
import { TimeseriesChart, convertToTimeseries } from "@dynatrace/strato-components-preview/charts";
import { DataTable } from "@dynatrace/strato-components-preview/tables";
import { useDql } from "@dynatrace-sdk/react-hooks";
import Colors from "@dynatrace/strato-design-tokens/colors";
import Borders from "@dynatrace/strato-design-tokens/borders";
import BoxShadows from "@dynatrace/strato-design-tokens/box-shadows";
import { LineChartIcon, RefreshIcon, WarningIcon, MoneyIcon } from "@dynatrace/strato-icons";

const MetricCard = ({ 
  title, 
  current, 
  forecast, 
  change 
}: { 
  title: string; 
  current: string; 
  forecast: string; 
  change: number;
}) => {
  const isIncrease = change > 0;
  const changeColor = isIncrease ? Colors.Text.Critical.Default : Colors.Text.Success.Default;

  return (
    <Flex
      flexDirection="column"
      padding={16}
      gap={12}
      style={{
        border: `1px solid ${Colors.Border.Neutral.Default}`,
        borderRadius: Borders.Radius.Container.Default,
        background: Colors.Background.Surface.Default,
        boxShadow: BoxShadows.Surface.Raised.Rest,
        flex: "1 1 250px"
      }}
    >
      <Text style={{ color: Colors.Text.Neutral.Subdued }}>{title}</Text>
      <Flex justifyContent="space-between" alignItems="flex-end">
        <Flex flexDirection="column" gap={4}>
          <Text style={{ fontSize: 12 }}>Current</Text>
          <Heading level={4}>{current}</Heading>
        </Flex>
        <Flex flexDirection="column" gap={4} alignItems="flex-end">
          <Text style={{ fontSize: 12 }}>Forecast (30d)</Text>
          <Heading level={4} style={{ color: changeColor }}>{forecast}</Heading>
        </Flex>
      </Flex>
      <Flex alignItems="center" gap={4}>
        <Text style={{ color: changeColor, fontSize: 14 }}>
          {isIncrease ? "↑" : "↓"} {Math.abs(change).toFixed(1)}%
        </Text>
        <Text style={{ fontSize: 12, color: Colors.Text.Neutral.Subdued }}>
          {isIncrease ? "increase" : "decrease"} projected
        </Text>
      </Flex>
    </Flex>
  );
};

export const CostForecast = () => {
  const [budgetLimit, setBudgetLimit] = useState("1000");

  // DQL: Historical token usage data for trend analysis
  const historicalCostQuery = `
    fetch spans, from: now()-30d
    | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
    | summarize 
        daily_input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
        daily_output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
        daily_requests = count(),
        by: { day = bin(timestamp, 1d) }
    | fieldsAdd daily_tokens = daily_input_tokens + daily_output_tokens
    | sort day asc
  `;

  // DQL: Token usage by model over time
  const costByModelQuery = `
    fetch spans, from: now()-7d
    | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
    | summarize 
        tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0)),
        by: { bin(timestamp, 1h), model = gen_ai.request.model }
  `;

  // DQL: Current period totals
  const currentTotalsQuery = `
    fetch spans, from: now()-30d
    | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
    | summarize 
        total_input_tokens = sum(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
        total_output_tokens = sum(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
        total_requests = count()
    | fieldsAdd total_tokens = total_input_tokens + total_output_tokens
  `;

  // DQL: Recent week tokens (last 7 days)
  const recentTokensQuery = `
    fetch spans, from: now()-7d
    | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
    | summarize recent_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0))
  `;

  // DQL: Previous week tokens (7-14 days ago)
  const previousTokensQuery = `
    fetch spans, from: now()-14d, to: now()-7d
    | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
    | summarize previous_tokens = sum(coalesce(gen_ai.usage.input_tokens, 0) + coalesce(gen_ai.usage.output_tokens, 0))
  `;

  const { data: historicalData, isLoading: histLoading, refetch } = useDql({ query: historicalCostQuery });
  const { data: costByModel, isLoading: modelLoading } = useDql({ query: costByModelQuery });
  const { data: currentTotals, isLoading: totalsLoading } = useDql({ query: currentTotalsQuery });
  const { data: recentTokensData, isLoading: recentLoading } = useDql({ query: recentTokensQuery });
  const { data: previousTokensData, isLoading: previousLoading } = useDql({ query: previousTokensQuery });

  const isLoading = histLoading || modelLoading || totalsLoading || recentLoading || previousLoading;

  // Estimate cost from tokens (blended rate)
  const estimateCostFromTokens = (inputTokens: number, outputTokens: number): number => {
    // Blended average rate across common models
    const inputRate = 0.002 / 1000; // $0.002 per 1K input tokens (avg)
    const outputRate = 0.006 / 1000; // $0.006 per 1K output tokens (avg)
    return inputTokens * inputRate + outputTokens * outputRate;
  };

  // Process data
  const totals = currentTotals?.records?.[0] as Record<string, unknown> | undefined;
  const totalInputTokens = Number(totals?.total_input_tokens || 0);
  const totalOutputTokens = Number(totals?.total_output_tokens || 0);
  const totalTokens = totalInputTokens + totalOutputTokens;
  const totalRequests = Number(totals?.total_requests || 0);
  const totalCost = estimateCostFromTokens(totalInputTokens, totalOutputTokens);

  const recentTokens = Number((recentTokensData?.records?.[0] as Record<string, unknown>)?.recent_tokens || 0);
  const previousTokens = Number((previousTokensData?.records?.[0] as Record<string, unknown>)?.previous_tokens || 1); // Avoid division by zero
  const weeklyGrowthRate = previousTokens > 0 ? ((recentTokens - previousTokens) / previousTokens) * 100 : 0;

  // Simple linear forecast (30-day projection based on weekly growth)
  const projectedMonthlyCost = totalCost * (1 + (weeklyGrowthRate / 100) * 4);
  const projectedMonthlyTokens = totalTokens * (1 + (weeklyGrowthRate / 100) * 4);
  const projectedMonthlyRequests = totalRequests * (1 + (weeklyGrowthRate / 100) * 4);

  // Budget alert
  const budgetValue = parseFloat(budgetLimit) || 0;
  const isOverBudget = projectedMonthlyCost > budgetValue;
  const budgetPercentage = budgetValue > 0 ? (projectedMonthlyCost / budgetValue) * 100 : 0;

  // Process chart data
  const chartData = historicalData?.records || [];

  return (
    <Flex flexDirection="column" padding={32} gap={24}>
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center">
        <Flex flexDirection="column" gap={4}>
          <Heading level={2}>Cost Forecast & FinOps</Heading>
          <Paragraph>Predict your GenAI spend based on historical Grail data and set budget alerts.</Paragraph>
        </Flex>
        <Button variant="default" onClick={() => refetch()} disabled={isLoading}>
          <Button.Prefix><RefreshIcon /></Button.Prefix>
          Refresh
        </Button>
      </Flex>

      {/* Budget Alert */}
      <Flex gap={16} alignItems="center">
        <Flex flexDirection="column" gap={4}>
          <Text>Monthly Budget Limit ($)</Text>
          <TextInput 
            value={budgetLimit} 
            onChange={(val) => setBudgetLimit(val)} 
            placeholder="1000"
            style={{ width: 150 }}
          />
        </Flex>
        {isOverBudget && (
          <Flex
            padding={12}
            gap={8}
            alignItems="center"
            style={{
              background: Colors.Background.Field.Critical.Default,
              borderRadius: Borders.Radius.Container.Default,
              border: `1px solid ${Colors.Border.Critical.Default}`
            }}
          >
            <WarningIcon style={{ color: Colors.Text.Critical.Default }} />
            <Text style={{ color: Colors.Text.Critical.Default }}>
              Projected cost (${projectedMonthlyCost.toFixed(2)}) exceeds budget by {(budgetPercentage - 100).toFixed(1)}%
            </Text>
          </Flex>
        )}
      </Flex>

      {/* Forecast Cards */}
      <Flex gap={16} flexWrap="wrap">
        <MetricCard 
          title="Monthly Cost" 
          current={`$${totalCost.toFixed(2)}`}
          forecast={`$${projectedMonthlyCost.toFixed(2)}`}
          change={weeklyGrowthRate * 4}
        />
        <MetricCard 
          title="Monthly Tokens" 
          current={totalTokens.toLocaleString()}
          forecast={projectedMonthlyTokens.toLocaleString()}
          change={weeklyGrowthRate * 4}
        />
        <MetricCard 
          title="Monthly Requests" 
          current={totalRequests.toLocaleString()}
          forecast={Math.round(projectedMonthlyRequests).toLocaleString()}
          change={weeklyGrowthRate * 4}
        />
      </Flex>

      {/* Weekly Growth Indicator */}
      <Flex
        padding={16}
        gap={12}
        style={{
          background: weeklyGrowthRate > 20 ? Colors.Background.Field.Warning.Default : Colors.Background.Surface.Default,
          borderRadius: Borders.Radius.Container.Default,
          border: `1px solid ${weeklyGrowthRate > 20 ? Colors.Border.Warning.Default : Colors.Border.Neutral.Default}`
        }}
      >
        <LineChartIcon />
        <Flex flexDirection="column" gap={4}>
          <Strong>Weekly Growth Rate: {weeklyGrowthRate.toFixed(1)}%</Strong>
          <Paragraph>
            {weeklyGrowthRate > 20 
              ? "⚠️ High growth detected. Consider reviewing usage patterns or implementing rate limits."
              : weeklyGrowthRate > 0 
              ? "Usage is growing steadily. Monitor for unexpected spikes."
              : "Usage is stable or declining."}
          </Paragraph>
        </Flex>
      </Flex>

      {/* Historical Cost Chart */}
      <Flex
        flexDirection="column"
        gap={12}
        padding={16}
        style={{
          border: `1px solid ${Colors.Border.Neutral.Default}`,
          borderRadius: Borders.Radius.Container.Default,
          background: Colors.Background.Surface.Default,
        }}
      >
        <Heading level={4}>Historical Cost Trend (Last 30 Days)</Heading>
        {isLoading ? (
          <Paragraph>Loading historical data from Grail...</Paragraph>
        ) : chartData.length > 0 ? (
          <TimeseriesChart
            data={convertToTimeseries(chartData, historicalData?.types || [])}
            gapPolicy="connect"
            variant="area"
          />
        ) : (
          <Paragraph>No historical data available for the selected period.</Paragraph>
        )}
      </Flex>

      {/* Cost by Model Trend */}
      <Flex
        flexDirection="column"
        gap={12}
        padding={16}
        style={{
          border: `1px solid ${Colors.Border.Neutral.Default}`,
          borderRadius: Borders.Radius.Container.Default,
          background: Colors.Background.Surface.Default,
        }}
      >
        <Heading level={4}>Cost by Model (Last 7 Days)</Heading>
        {modelLoading ? (
          <Paragraph>Loading model breakdown from Grail...</Paragraph>
        ) : costByModel?.records && costByModel.records.length > 0 ? (
          <TimeseriesChart
            data={convertToTimeseries(costByModel.records, costByModel.types || [])}
            gapPolicy="connect"
            variant="line"
          />
        ) : (
          <Paragraph>No model-level cost data available.</Paragraph>
        )}
      </Flex>

      {/* Optimization Suggestions */}
      <Flex
        flexDirection="column"
        gap={12}
        padding={16}
        style={{
          background: Colors.Background.Field.Primary.Default,
          borderRadius: Borders.Radius.Container.Default,
          border: `1px solid ${Colors.Border.Primary.Default}`
        }}
      >
        <Flex alignItems="center" gap={8}>
          <MoneyIcon />
          <Heading level={5}>Cost Optimization Suggestions</Heading>
        </Flex>
        <Flex flexDirection="column" gap={8}>
          <Text>• Consider using cheaper models (Claude Haiku, GPT-3.5) for simple tasks</Text>
          <Text>• Enable prompt caching to reduce repeated token costs</Text>
          <Text>• Implement request batching to reduce API overhead</Text>
          <Text>• Review high-frequency patterns in Prompt Analyzer</Text>
          <Text>• Set up circuit breakers for runaway agents</Text>
        </Flex>
      </Flex>
    </Flex>
  );
};
