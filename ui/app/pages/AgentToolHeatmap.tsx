import React, { useState } from "react";
import { Flex, Grid } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Strong, Text } from "@dynatrace/strato-components/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { Select, SelectOption } from "@dynatrace/strato-components-preview/forms";
import { DataTable } from "@dynatrace/strato-components-preview/tables";
import { useDql } from "@dynatrace-sdk/react-hooks";
import Colors from "@dynatrace/strato-design-tokens/colors";
import Borders from "@dynatrace/strato-design-tokens/borders";
import BoxShadows from "@dynatrace/strato-design-tokens/box-shadows";
import { RefreshIcon, WarningIcon, CheckmarkIcon } from "@dynatrace/strato-icons";

type ToolUsage = {
  toolName: string;
  callCount: number;
  avgDuration: number;
  errorCount: number;
  errorRate: number;
  avgTokens: number;
};

type AgentFlow = {
  agentName: string;
  toolSequence: string;
  count: number;
  avgDuration: number;
};

const HeatmapCell = ({ value, max, label }: { value: number; max: number; label: string }) => {
  const intensity = max > 0 ? value / max : 0;
  const bgColor = intensity > 0.7 
    ? Colors.Background.Field.Critical.Default
    : intensity > 0.4 
    ? Colors.Background.Field.Warning.Default
    : intensity > 0.1
    ? Colors.Background.Field.Success.Default
    : Colors.Background.Surface.Default;

  return (
    <Flex
      padding={12}
      justifyContent="center"
      alignItems="center"
      flexDirection="column"
      gap={4}
      style={{
        background: bgColor,
        borderRadius: Borders.Radius.Container.Default,
        border: `1px solid ${Colors.Border.Neutral.Default}`,
        minWidth: 80,
        minHeight: 60
      }}
    >
      <Strong>{value}</Strong>
      <Text style={{ fontSize: 10, color: Colors.Text.Neutral.Subdued }}>{label}</Text>
    </Flex>
  );
};

export const AgentToolHeatmap = () => {
  const [timeRange, setTimeRange] = useState("24h");

  // DQL: Get tool usage statistics (tools are identified by traceloop.span.kind = "tool")
  const toolUsageQuery = `
    fetch spans, from: now()-${timeRange}
    | filter traceloop.span.kind == "tool"
    | summarize 
        call_count = count(),
        avg_duration = avg(duration) / 1000000,
        error_count = countIf(isNotNull(error.type)),
        by: { tool_name = span.name }
    | fieldsAdd error_rate = toDouble(error_count) / toDouble(call_count) * 100
    | sort call_count desc
    | limit 20
  `;

  // DQL: Get agent-level tool sequences (which tools are called together)
  const agentFlowQuery = `
    fetch spans, from: now()-${timeRange}
    | filter traceloop.span.kind == "tool"
    | summarize 
        tool_sequence = collectDistinct(span.name),
        call_count = count(),
        avg_duration = avg(duration) / 1000000,
        by: { trace_id = trace.id, agent_name = gen_ai.agent.name }
    | summarize 
        count = count(),
        avg_duration = avg(avg_duration),
        by: { agent_name, tool_sequence }
    | sort count desc
    | limit 10
  `;

  // DQL: Tool call frequency over time
  const toolTrendQuery = `
    fetch spans, from: now()-${timeRange}
    | filter traceloop.span.kind == "tool"
    | summarize 
        calls = count(),
        by: { timeframe = bin(start_time, 1h), tool = span.name }
  `;

  // DQL: Detect potential infinite loops (same tool called many times in a trace)
  const loopDetectionQuery = `
    fetch spans, from: now()-${timeRange}
    | filter traceloop.span.kind == "tool"
    | summarize 
        tool_calls = count(),
        by: { trace_id = trace.id, tool_name = span.name }
    | filter tool_calls > 10
    | summarize 
        suspicious_traces = count(),
        max_calls = max(tool_calls),
        by: { tool_name }
    | sort suspicious_traces desc
  `;

  const { data: toolUsage, isLoading: usageLoading, refetch } = useDql({ query: toolUsageQuery });
  const { data: agentFlows, isLoading: flowsLoading } = useDql({ query: agentFlowQuery });
  const { data: loopDetection, isLoading: loopLoading } = useDql({ query: loopDetectionQuery });

  const isLoading = usageLoading || flowsLoading || loopLoading;

  // Process tool usage data
  const tools: ToolUsage[] = (toolUsage?.records || []).map((record: Record<string, unknown>) => ({
    toolName: String(record.tool_name || "Unknown").replace(".tool", ""),
    callCount: Number(record.call_count || 0),
    avgDuration: Number(record.avg_duration || 0),
    errorCount: Number(record.error_count || 0),
    errorRate: Number(record.error_rate || 0),
    avgTokens: 0, // Tools don't have token usage
  }));

  const maxCalls = Math.max(...tools.map(t => t.callCount), 1);

  // Process loop detection
  const suspiciousTools = (loopDetection?.records || []).map((record: Record<string, unknown>) => ({
    toolName: String(record.tool_name || "Unknown"),
    suspiciousTraces: Number(record.suspicious_traces || 0),
    maxCalls: Number(record.max_calls || 0),
  }));

  // Process agent flows
  const flows: AgentFlow[] = (agentFlows?.records || []).map((record: Record<string, unknown>) => ({
    agentName: String(record.agent_name || "Unknown"),
    toolSequence: Array.isArray(record.tool_sequence) ? record.tool_sequence.join(" → ") : String(record.tool_sequence || ""),
    count: Number(record.count || 0),
    avgDuration: Number(record.avg_duration || 0),
  }));

  // Format tools for display
  const toolsForDisplay = tools.map(t => ({
    toolName: t.toolName,
    callCount: t.callCount,
    avgDuration: `${t.avgDuration.toFixed(0)}ms`,
    errorRate: `${t.errorRate.toFixed(2)}%`,
    health: t.errorRate > 10 ? "⚠️ Degraded" : "✅ Healthy",
  }));

  const toolColumns = [
    { id: "toolName", header: "Tool Name", accessor: "toolName", autoWidth: true },
    { id: "callCount", header: "Calls", accessor: "callCount", autoWidth: true },
    { id: "avgDuration", header: "Avg Duration", accessor: "avgDuration", autoWidth: true },
    { id: "errorRate", header: "Error Rate", accessor: "errorRate", autoWidth: true },
    { id: "health", header: "Health", accessor: "health", autoWidth: true },
  ];

  return (
    <Flex flexDirection="column" padding={32} gap={24}>
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center">
        <Flex flexDirection="column" gap={4}>
          <Heading level={2}>Agent Tool Usage Heatmap</Heading>
          <Paragraph>Analyze tool call patterns, detect anomalies, and identify potential infinite loops in your AI agents.</Paragraph>
        </Flex>
        <Flex gap={16} alignItems="center">
          <Select value={timeRange} onChange={(val) => setTimeRange(val as string)}>
            <SelectOption value="1h">Last 1 hour</SelectOption>
            <SelectOption value="24h">Last 24 hours</SelectOption>
            <SelectOption value="7d">Last 7 days</SelectOption>
          </Select>
          <Button variant="default" onClick={() => refetch()} disabled={isLoading}>
            <Button.Prefix><RefreshIcon /></Button.Prefix>
            Refresh
          </Button>
        </Flex>
      </Flex>

      {/* Loop Detection Alert */}
      {suspiciousTools.length > 0 && (
        <Flex
          padding={16}
          gap={12}
          style={{
            background: Colors.Background.Field.Critical.Default,
            borderRadius: Borders.Radius.Container.Default,
            border: `1px solid ${Colors.Border.Critical.Default}`
          }}
        >
          <WarningIcon style={{ color: Colors.Text.Critical.Default }} />
          <Flex flexDirection="column" gap={4}>
            <Strong style={{ color: Colors.Text.Critical.Default }}>⚠️ Potential Infinite Loop Detected</Strong>
            <Paragraph>
              {suspiciousTools.map(t => `"${t.toolName}" was called ${t.maxCalls}+ times in ${t.suspiciousTraces} traces`).join("; ")}. 
              This may indicate runaway agent behavior.
            </Paragraph>
          </Flex>
        </Flex>
      )}

      {/* Tool Usage Heatmap Grid */}
      <Flex flexDirection="column" gap={12}>
        <Heading level={4}>Tool Call Frequency</Heading>
        {isLoading ? (
          <Paragraph>Loading tool usage data from Grail...</Paragraph>
        ) : tools.length > 0 ? (
          <Flex gap={8} flexWrap="wrap">
            {tools.slice(0, 12).map(tool => (
              <HeatmapCell 
                key={tool.toolName} 
                value={tool.callCount} 
                max={maxCalls}
                label={tool.toolName.length > 12 ? tool.toolName.substring(0, 12) + "..." : tool.toolName}
              />
            ))}
          </Flex>
        ) : (
          <Paragraph>No tool call data found. Ensure your agents are instrumented with gen_ai.tool.name spans.</Paragraph>
        )}
      </Flex>

      {/* Tool Usage Table */}
      <Flex flexDirection="column" gap={12}>
        <Heading level={4}>Tool Usage Details</Heading>
        {toolsForDisplay.length > 0 ? (
          <DataTable data={toolsForDisplay} columns={toolColumns} />
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
            <Paragraph>No tool usage data available.</Paragraph>
          </Flex>
        )}
      </Flex>

      {/* Tool Call Distribution Chart */}
      {tools.length > 0 && (
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
          <Heading level={5}>Tool Call Distribution</Heading>
          <Flex flexDirection="column" gap={8}>
            {tools.slice(0, 10).map(t => (
              <Flex key={t.toolName} justifyContent="space-between" alignItems="center" padding={8} style={{ background: Colors.Background.Container.Neutral.Default, borderRadius: 4 }}>
                <Text>{t.toolName}</Text>
                <Strong>{t.callCount.toLocaleString()}</Strong>
              </Flex>
            ))}
          </Flex>
        </Flex>
      )}

      {/* Agent Tool Sequences */}
      <Flex flexDirection="column" gap={12}>
        <Heading level={4}>Common Agent Tool Flows</Heading>
        <Paragraph>Most frequent tool calling sequences observed in agent traces.</Paragraph>
        {flows.length > 0 ? (
          <Flex flexDirection="column" gap={8}>
            {flows.slice(0, 5).map((flow, idx) => (
              <Flex
                key={idx}
                padding={12}
                gap={16}
                alignItems="center"
                style={{
                  background: Colors.Background.Surface.Default,
                  borderRadius: Borders.Radius.Container.Default,
                  border: `1px solid ${Colors.Border.Neutral.Default}`
                }}
              >
                <Flex flexDirection="column" gap={2} style={{ flex: 1 }}>
                  <Strong>{flow.agentName}</Strong>
                  <Text style={{ fontFamily: "monospace", fontSize: 12 }}>{flow.toolSequence}</Text>
                </Flex>
                <Flex flexDirection="column" alignItems="flex-end" gap={2}>
                  <Text>{flow.count} occurrences</Text>
                  <Text style={{ fontSize: 12, color: Colors.Text.Neutral.Subdued }}>{flow.avgDuration.toFixed(0)}ms avg</Text>
                </Flex>
              </Flex>
            ))}
          </Flex>
        ) : (
          <Paragraph>No agent flow data available.</Paragraph>
        )}
      </Flex>
    </Flex>
  );
};
