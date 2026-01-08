// GenAI Ops Manager - Enhanced Prompt Analyzer
// Security, Compliance, and Cost Analysis for GenAI Prompts

import React, { useState, useMemo } from "react";
import { Flex, Surface } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Strong, Text } from "@dynatrace/strato-components/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { Select, SelectOption, TextInput } from "@dynatrace/strato-components-preview/forms";
import { DataTable } from "@dynatrace/strato-components-preview/tables";
import { useDql } from "@dynatrace-sdk/react-hooks";
import Colors from "@dynatrace/strato-design-tokens/colors";
import Borders from "@dynatrace/strato-design-tokens/borders";
import { ResearchIcon, IdeaIcon, WarningIcon, SecurityIcon } from "@dynatrace/strato-icons";

type PromptFlag = {
  type: 'pii' | 'hallucination' | 'expensive' | 'repetitive' | 'injection' | 'sensitive' | 'bias';
  severity: 'low' | 'medium' | 'high' | 'critical';
  detail: string;
};

type PromptPattern = {
  id: string;
  promptPreview: string;
  count: number;
  avgTokens: number;
  avgCost: number;
  avgLatency: number;
  model: string;
  provider: string;
  flags: PromptFlag[];
  traceId?: string;
  spanId?: string;
};

/**
 * Analyze prompt for security and compliance issues
 */
const analyzePromptForFlags = (prompt: string, cost: number, tokens: number): PromptFlag[] => {
  const flags: PromptFlag[] = [];
  const promptLower = prompt.toLowerCase();
  
  // PII Detection
  const ssnPattern = /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/;
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/;
  const creditCardPattern = /\b\d{4}[-. ]?\d{4}[-. ]?\d{4}[-. ]?\d{4}\b/;
  const dobPattern = /\b(dob|date of birth|birthdate)\s*[:=]?\s*\d/i;
  const mrnPattern = /\b(mrn|medical record|patient id)\s*[:=]?\s*\d/i;
  
  if (ssnPattern.test(prompt)) {
    flags.push({ type: 'pii', severity: 'critical', detail: 'SSN pattern detected' });
  }
  if (emailPattern.test(prompt)) {
    flags.push({ type: 'pii', severity: 'high', detail: 'Email address detected' });
  }
  if (phonePattern.test(prompt)) {
    flags.push({ type: 'pii', severity: 'medium', detail: 'Phone number detected' });
  }
  if (creditCardPattern.test(prompt)) {
    flags.push({ type: 'pii', severity: 'critical', detail: 'Credit card pattern detected' });
  }
  if (dobPattern.test(prompt) || mrnPattern.test(prompt)) {
    flags.push({ type: 'pii', severity: 'critical', detail: 'PHI/HIPAA data detected' });
  }
  
  // Sensitive content
  if (promptLower.includes('password') || promptLower.includes('secret') || promptLower.includes('api key') || promptLower.includes('token')) {
    flags.push({ type: 'sensitive', severity: 'high', detail: 'Potential credentials in prompt' });
  }
  if (promptLower.includes('patient') || promptLower.includes('diagnosis') || promptLower.includes('symptom')) {
    flags.push({ type: 'sensitive', severity: 'high', detail: 'Medical information detected' });
  }
  
  // Prompt injection
  const injectionPatterns = [
    'ignore all previous', 'ignore previous instructions', 'disregard your instructions',
    'forget your rules', 'you are now', 'new persona', 'jailbreak', 'dan mode', 'developer mode'
  ];
  for (const pattern of injectionPatterns) {
    if (promptLower.includes(pattern)) {
      flags.push({ type: 'injection', severity: 'critical', detail: 'Prompt injection pattern detected' });
      break;
    }
  }
  
  // Cost detection
  if (cost > 0.1) {
    flags.push({ type: 'expensive', severity: 'critical', detail: `Very high cost: $${cost.toFixed(4)}` });
  } else if (cost > 0.05) {
    flags.push({ type: 'expensive', severity: 'high', detail: `High cost: $${cost.toFixed(4)}` });
  } else if (cost > 0.01) {
    flags.push({ type: 'expensive', severity: 'medium', detail: `Elevated cost: $${cost.toFixed(4)}` });
  }
  
  if (tokens > 10000) {
    flags.push({ type: 'expensive', severity: 'high', detail: `Very high tokens: ${tokens.toLocaleString()}` });
  } else if (tokens > 5000) {
    flags.push({ type: 'expensive', severity: 'medium', detail: `High tokens: ${tokens.toLocaleString()}` });
  }
  
  // Hallucination risk
  const realTimePatterns = ['weather currently', 'current stock', 'latest news', 'real-time', 'right now'];
  for (const pattern of realTimePatterns) {
    if (promptLower.includes(pattern)) {
      flags.push({ type: 'hallucination', severity: 'medium', detail: 'Real-time data query - hallucination risk' });
      break;
    }
  }
  
  const factualPatterns = ['exact number of', 'exact figure', 'precise count of', 'how many exactly'];
  for (const pattern of factualPatterns) {
    if (promptLower.includes(pattern)) {
      flags.push({ type: 'hallucination', severity: 'low', detail: 'Asks for precise numbers - verify accuracy' });
      break;
    }
  }
  
  // Bias detection
  if ((promptLower.includes('candidate') || promptLower.includes('resume') || promptLower.includes('hire')) &&
      (promptLower.includes('age') || promptLower.includes('gender') || promptLower.includes('race') || 
       promptLower.includes('nationality') || promptLower.includes('religion'))) {
    flags.push({ type: 'bias', severity: 'high', detail: 'Protected characteristics in hiring context' });
  }
  
  return flags;
};

const InsightCard = ({ 
  type, 
  title, 
  description 
}: { 
  type: "warning" | "info" | "success"; 
  title: string; 
  description: string;
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
      {type === "warning" ? <WarningIcon /> : type === "success" ? <IdeaIcon /> : <SecurityIcon />}
      <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
        <Strong>{title}</Strong>
        <Paragraph>{description}</Paragraph>
      </Flex>
    </Flex>
  );
};

export const PromptAnalyzer = () => {
  const [timeRange, setTimeRange] = useState("24h");
  const [filterType, setFilterType] = useState<'all' | 'pii' | 'injection' | 'expensive' | 'hallucination' | 'bias' | 'sensitive'>('all');
  const [searchPattern, setSearchPattern] = useState("");

  // Enhanced DQL query
  const promptAnalysisQuery = `
    fetch spans, from: now()-${timeRange}
    | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
    | fieldsAdd prompt = coalesce(gen_ai.prompt.1.content, gen_ai.prompt.0.content)
    | filter isNotNull(prompt)
    | fieldsAdd prompt_preview = substring(prompt, from:0, to:200)
    | summarize 
        count = count(),
        avg_input_tokens = avg(coalesce(gen_ai.usage.input_tokens, gen_ai.usage.prompt_tokens, 0)),
        avg_output_tokens = avg(coalesce(gen_ai.usage.output_tokens, gen_ai.usage.completion_tokens, 0)),
        avg_latency = avg(duration) / 1000000,
        sample_trace_id = takeLast(trace.id),
        sample_span_id = takeLast(span.id),
        by: { 
          prompt_preview, 
          model = gen_ai.request.model,
          provider = gen_ai.provider.name
        }
    | fieldsAdd avg_tokens = avg_input_tokens + avg_output_tokens
    | sort count desc
    | limit 100
  `;

  const { data: promptData, isLoading, refetch } = useDql({ query: promptAnalysisQuery });

  // Cost estimation
  const estimateCost = (model: string, inputTokens: number, outputTokens: number): number => {
    const m = (model || "").toLowerCase();
    let inputRate = 0.001 / 1000;
    let outputRate = 0.002 / 1000;
    if (m.includes("gpt-4o")) { inputRate = 0.0025 / 1000; outputRate = 0.01 / 1000; }
    else if (m.includes("gpt-4")) { inputRate = 0.03 / 1000; outputRate = 0.06 / 1000; }
    else if (m.includes("gpt-3")) { inputRate = 0.0005 / 1000; outputRate = 0.0015 / 1000; }
    else if (m.includes("gemini")) { inputRate = 0.00025 / 1000; outputRate = 0.0005 / 1000; }
    else if (m.includes("claude")) { inputRate = 0.003 / 1000; outputRate = 0.015 / 1000; }
    return inputTokens * inputRate + outputTokens * outputRate;
  };

  // Process data
  const promptPatterns = useMemo((): PromptPattern[] => {
    return (promptData?.records || []).map((record: Record<string, unknown>, idx: number) => {
      const avgInputTokens = Number(record.avg_input_tokens || 0);
      const avgOutputTokens = Number(record.avg_output_tokens || 0);
      const avgTokens = avgInputTokens + avgOutputTokens;
      const model = String(record.model || "Unknown");
      const provider = String(record.provider || "Unknown");
      const promptPreview = String(record.prompt_preview || "N/A");
      const count = Number(record.count || 0);
      const avgLatency = Number(record.avg_latency || 0);
      const avgCost = estimateCost(model, avgInputTokens, avgOutputTokens);
      
      const flags = analyzePromptForFlags(promptPreview, avgCost, avgTokens);
      
      if (count >= 15) {
        flags.push({
          type: 'repetitive',
          severity: 'low',
          detail: `${count} identical requests - cache candidate`
        });
      }
      
      return {
        id: `prompt-${idx}`,
        promptPreview,
        count,
        avgTokens,
        avgCost,
        avgLatency,
        model,
        provider,
        flags,
        traceId: String(record.sample_trace_id || ''),
        spanId: String(record.sample_span_id || '')
      };
    });
  }, [promptData]);

  // Calculate stats
  const stats = useMemo(() => {
    const piiCount = promptPatterns.filter(p => p.flags.some(f => f.type === 'pii')).length;
    const injectionCount = promptPatterns.filter(p => p.flags.some(f => f.type === 'injection')).length;
    const expensiveCount = promptPatterns.filter(p => p.flags.some(f => f.type === 'expensive')).length;
    const hallucinationCount = promptPatterns.filter(p => p.flags.some(f => f.type === 'hallucination')).length;
    const biasCount = promptPatterns.filter(p => p.flags.some(f => f.type === 'bias')).length;
    const sensitiveCount = promptPatterns.filter(p => p.flags.some(f => f.type === 'sensitive')).length;
    const repetitiveCount = promptPatterns.filter(p => p.flags.some(f => f.type === 'repetitive')).length;
    const totalFlags = piiCount + injectionCount + expensiveCount + hallucinationCount + biasCount + sensitiveCount;
    
    return {
      total: promptPatterns.length,
      piiCount,
      injectionCount,
      expensiveCount,
      hallucinationCount,
      biasCount,
      sensitiveCount,
      repetitiveCount,
      totalFlags
    };
  }, [promptPatterns]);

  // Filter patterns
  const filteredPatterns = useMemo(() => {
    let filtered = promptPatterns;
    
    if (filterType !== 'all') {
      filtered = filtered.filter(p => p.flags.some(f => f.type === filterType));
    }
    
    if (searchPattern) {
      filtered = filtered.filter(p => 
        p.promptPreview.toLowerCase().includes(searchPattern.toLowerCase()) ||
        p.model.toLowerCase().includes(searchPattern.toLowerCase())
      );
    }
    
    return filtered;
  }, [promptPatterns, filterType, searchPattern]);

  // Generate insights
  const insights = useMemo(() => {
    const result: { type: "warning" | "info" | "success"; title: string; description: string }[] = [];
    
    if (stats.piiCount > 0) {
      result.push({
        type: "warning",
        title: "🔐 PII Detected",
        description: `${stats.piiCount} prompt patterns contain personally identifiable information. Review and mask sensitive data.`
      });
    }
    
    if (stats.injectionCount > 0) {
      result.push({
        type: "warning",
        title: "⚠️ Injection Attempts",
        description: `${stats.injectionCount} prompt patterns show injection attack patterns. Implement input validation.`
      });
    }
    
    if (stats.biasCount > 0) {
      result.push({
        type: "warning",
        title: "⚖️ Bias Risk",
        description: `${stats.biasCount} prompts contain protected characteristics in decision contexts.`
      });
    }
    
    if (stats.hallucinationCount > 0) {
      result.push({
        type: "info",
        title: "🎭 Hallucination Risk",
        description: `${stats.hallucinationCount} prompts request real-time or precise factual data. Consider adding RAG.`
      });
    }
    
    if (stats.expensiveCount > 0) {
      result.push({
        type: "warning",
        title: "💰 High Cost Patterns",
        description: `${stats.expensiveCount} patterns have elevated costs. Consider prompt optimization.`
      });
    }
    
    if (stats.repetitiveCount > 5) {
      result.push({
        type: "info",
        title: "🔄 Cache Opportunities",
        description: `${stats.repetitiveCount} repetitive patterns. Implement semantic caching to reduce costs by up to 90%.`
      });
    }
    
    if (stats.totalFlags === 0 && promptPatterns.length > 0) {
      result.push({
        type: "success",
        title: "✅ Prompts Look Good",
        description: "No security, compliance, or cost issues detected."
      });
    }
    
    return result;
  }, [stats, promptPatterns]);

  // Table data
  const tableData = filteredPatterns.map(p => ({
    promptPreview: p.promptPreview.substring(0, 100),
    model: p.model,
    provider: p.provider,
    count: p.count.toString(),
    avgTokens: p.avgTokens.toLocaleString(),
    avgCost: `$${p.avgCost.toFixed(5)}`,
    avgLatency: `${p.avgLatency.toFixed(0)}ms`,
    flags: p.flags.map(f => `${f.type}(${f.severity})`).join(', ') || '-',
    severity: p.flags.some(f => f.severity === 'critical') ? '🔴 Critical' :
              p.flags.some(f => f.severity === 'high') ? '🟠 High' :
              p.flags.some(f => f.severity === 'medium') ? '🟡 Medium' : 
              p.flags.length > 0 ? '🟢 Low' : '-'
  }));

  const columns = [
    { id: "promptPreview", header: "Prompt Preview", accessor: "promptPreview", autoWidth: false },
    { id: "model", header: "Model", accessor: "model", autoWidth: true },
    { id: "provider", header: "Provider", accessor: "provider", autoWidth: true },
    { id: "count", header: "Count", accessor: "count", autoWidth: true },
    { id: "avgTokens", header: "Avg Tokens", accessor: "avgTokens", autoWidth: true },
    { id: "avgCost", header: "Avg Cost", accessor: "avgCost", autoWidth: true },
    { id: "avgLatency", header: "Latency", accessor: "avgLatency", autoWidth: true },
    { id: "severity", header: "Risk", accessor: "severity", autoWidth: true },
    { id: "flags", header: "Issues", accessor: "flags", autoWidth: false },
  ];

  return (
    <Flex flexDirection="column" padding={32} gap={24}>
      <Flex flexDirection="column" gap={4}>
        <Heading level={2}>🔍 Prompt Security & Analysis</Heading>
        <Paragraph>AI-powered prompt analysis for security, compliance, and cost optimization.</Paragraph>
      </Flex>

      {/* Filters */}
      <Flex gap={16} alignItems="flex-end" flexWrap="wrap">
        <Flex flexDirection="column" gap={4}>
          <Text>Time Range</Text>
          <Select value={timeRange} onChange={(val) => setTimeRange(val as string)}>
            <SelectOption value="1h">Last 1 hour</SelectOption>
            <SelectOption value="6h">Last 6 hours</SelectOption>
            <SelectOption value="24h">Last 24 hours</SelectOption>
            <SelectOption value="7d">Last 7 days</SelectOption>
            <SelectOption value="30d">Last 30 days</SelectOption>
          </Select>
        </Flex>
        <Flex flexDirection="column" gap={4}>
          <Text>Filter by Issue</Text>
          <Select value={filterType} onChange={(val) => setFilterType(val as typeof filterType)}>
            <SelectOption value="all">All Patterns ({stats.total})</SelectOption>
            <SelectOption value="pii">🔐 PII ({stats.piiCount})</SelectOption>
            <SelectOption value="injection">⚠️ Injection ({stats.injectionCount})</SelectOption>
            <SelectOption value="expensive">💰 Expensive ({stats.expensiveCount})</SelectOption>
            <SelectOption value="hallucination">🎭 Hallucination ({stats.hallucinationCount})</SelectOption>
            <SelectOption value="bias">⚖️ Bias ({stats.biasCount})</SelectOption>
            <SelectOption value="sensitive">🔒 Sensitive ({stats.sensitiveCount})</SelectOption>
          </Select>
        </Flex>
        <Flex flexDirection="column" gap={4}>
          <Text>Search</Text>
          <TextInput 
            value={searchPattern} 
            onChange={(val) => setSearchPattern(val)} 
            placeholder="Search prompts..."
            style={{ width: 200 }}
          />
        </Flex>
        <Button variant="accent" onClick={() => refetch()} disabled={isLoading}>
          <Button.Prefix><ResearchIcon /></Button.Prefix>
          Analyze
        </Button>
      </Flex>

      {/* Security Summary */}
      <Flex
        gap={16}
        padding={16}
        style={{
          background: Colors.Background.Surface.Default,
          borderRadius: Borders.Radius.Container.Default,
          border: `1px solid ${Colors.Border.Neutral.Default}`,
          flexWrap: 'wrap'
        }}
      >
        <Flex flexDirection="column" gap={4}>
          <Text style={{ color: Colors.Text.Neutral.Subdued }}>Total Patterns</Text>
          <Heading level={4}>{stats.total}</Heading>
        </Flex>
        <Flex flexDirection="column" gap={4}>
          <Text style={{ color: Colors.Text.Neutral.Subdued }}>🔐 PII Issues</Text>
          <Heading level={4} style={{ color: stats.piiCount > 0 ? Colors.Text.Critical.Default : undefined }}>
            {stats.piiCount}
          </Heading>
        </Flex>
        <Flex flexDirection="column" gap={4}>
          <Text style={{ color: Colors.Text.Neutral.Subdued }}>⚠️ Injection Risks</Text>
          <Heading level={4} style={{ color: stats.injectionCount > 0 ? Colors.Text.Critical.Default : undefined }}>
            {stats.injectionCount}
          </Heading>
        </Flex>
        <Flex flexDirection="column" gap={4}>
          <Text style={{ color: Colors.Text.Neutral.Subdued }}>⚖️ Bias Risks</Text>
          <Heading level={4} style={{ color: stats.biasCount > 0 ? Colors.Text.Warning.Default : undefined }}>
            {stats.biasCount}
          </Heading>
        </Flex>
        <Flex flexDirection="column" gap={4}>
          <Text style={{ color: Colors.Text.Neutral.Subdued }}>💰 Cost Issues</Text>
          <Heading level={4} style={{ color: stats.expensiveCount > 0 ? Colors.Text.Warning.Default : undefined }}>
            {stats.expensiveCount}
          </Heading>
        </Flex>
        <Flex flexDirection="column" gap={4}>
          <Text style={{ color: Colors.Text.Neutral.Subdued }}>🔄 Cache Candidates</Text>
          <Heading level={4}>{stats.repetitiveCount}</Heading>
        </Flex>
      </Flex>

      {/* Insights */}
      {insights.length > 0 && (
        <Flex flexDirection="column" gap={12}>
          <Heading level={4}>💡 Security & Cost Insights</Heading>
          <Flex gap={16} flexWrap="wrap">
            {insights.map((insight, idx) => (
              <InsightCard key={idx} type={insight.type} title={insight.title} description={insight.description} />
            ))}
          </Flex>
        </Flex>
      )}

      {/* Patterns Table */}
      <Flex flexDirection="column" gap={12}>
        <Heading level={4}>Analyzed Prompt Patterns ({filteredPatterns.length})</Heading>
        {isLoading ? (
          <Paragraph>Analyzing prompts from Grail...</Paragraph>
        ) : tableData.length > 0 ? (
          <DataTable data={tableData} columns={columns} />
        ) : (
          <Flex
            padding={32}
            justifyContent="center"
            flexDirection="column"
            alignItems="center"
            gap={12}
            style={{
              background: Colors.Background.Surface.Default,
              borderRadius: Borders.Radius.Container.Default,
              border: `1px solid ${Colors.Border.Neutral.Default}`
            }}
          >
            <SecurityIcon size={48} />
            <Heading level={5}>No Prompt Data Found</Heading>
            <Paragraph>Ensure GenAI services use OpenTelemetry gen_ai.* conventions.</Paragraph>
          </Flex>
        )}
      </Flex>

      {/* Documentation */}
      <Surface style={{ padding: 16, background: Colors.Background.Field.Primary.Default }}>
        <Flex flexDirection="column" gap={8}>
          <Heading level={5}>🔒 Security Detection Categories</Heading>
          <Flex flexDirection="column" gap={4}>
            <Text textStyle="small"><Strong>🔐 PII:</Strong> SSN, email, phone, credit cards, DOB, medical records (HIPAA/PHI)</Text>
            <Text textStyle="small"><Strong>⚠️ Injection:</Strong> Jailbreak attempts, instruction override, role-playing attacks</Text>
            <Text textStyle="small"><Strong>🔒 Sensitive:</Strong> Passwords, API keys, tokens, internal company data</Text>
            <Text textStyle="small"><Strong>⚖️ Bias:</Strong> Protected characteristics in HR/hiring/decision contexts</Text>
            <Text textStyle="small"><Strong>🎭 Hallucination:</Strong> Real-time data requests without grounding/verification</Text>
            <Text textStyle="small"><Strong>💰 Expensive:</Strong> High token/cost patterns needing optimization</Text>
            <Text textStyle="small"><Strong>🔄 Repetitive:</Strong> Patterns repeated 15+ times, cache candidates</Text>
          </Flex>
        </Flex>
      </Surface>
    </Flex>
  );
};
