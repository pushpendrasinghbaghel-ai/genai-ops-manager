import React, { useState } from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Strong, Text, Code } from "@dynatrace/strato-components/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { TextInput, Switch, Select, SelectOption, Label } from "@dynatrace/strato-components-preview/forms";
import { DataTable } from "@dynatrace/strato-components-preview/tables";
import { useDql } from "@dynatrace-sdk/react-hooks";
import Colors from "@dynatrace/strato-design-tokens/colors";
import Borders from "@dynatrace/strato-design-tokens/borders";
import BoxShadows from "@dynatrace/strato-design-tokens/box-shadows";
import { SecurityIcon, PlayIcon, PlusIcon, DeleteIcon, WarningIcon, CheckmarkIcon } from "@dynatrace/strato-icons";

type GuardrailRule = {
  id: string;
  name: string;
  pattern: string;
  type: "regex" | "keyword" | "dql";
  action: "block" | "audit" | "alert";
  enabled: boolean;
};

type BacktestResult = {
  ruleId: string;
  matches: number;
  sampleMatches: string[];
  estimatedImpact: string;
};

const PRESET_RULES: GuardrailRule[] = [
  { id: "1", name: "Block SSN", pattern: "\\d{3}-\\d{2}-\\d{4}", type: "regex", action: "block", enabled: true },
  { id: "2", name: "Block AWS Keys", pattern: "AKIA[0-9A-Z]{16}", type: "regex", action: "block", enabled: true },
  { id: "3", name: "Block Credit Cards", pattern: "\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}", type: "regex", action: "block", enabled: false },
  { id: "4", name: "Competitor Mention", pattern: "competitor|rival|alternative", type: "keyword", action: "audit", enabled: false },
  { id: "5", name: "Code Snippet Detected", pattern: "def |function |class |import ", type: "keyword", action: "audit", enabled: true },
];

const PolicyCard = ({ 
  rule, 
  onToggle, 
  onBacktest, 
  backtestResult,
  isLoading 
}: { 
  rule: GuardrailRule; 
  onToggle: () => void;
  onBacktest: () => void;
  backtestResult?: BacktestResult;
  isLoading: boolean;
}) => {
  const actionColors = {
    block: Colors.Text.Critical.Default,
    audit: Colors.Text.Warning.Default,
    alert: Colors.Text.Primary.Default,
  };

  return (
    <Flex
      flexDirection="column"
      padding={16}
      gap={12}
      style={{
        border: `1px solid ${rule.enabled ? Colors.Border.Primary.Default : Colors.Border.Neutral.Default}`,
        borderRadius: Borders.Radius.Container.Default,
        background: rule.enabled ? Colors.Background.Field.Primary.Default : Colors.Background.Surface.Default,
        boxShadow: BoxShadows.Surface.Raised.Rest,
      }}
    >
      <Flex justifyContent="space-between" alignItems="center">
        <Flex alignItems="center" gap={8}>
          <SecurityIcon style={{ color: rule.enabled ? Colors.Text.Primary.Default : Colors.Text.Neutral.Subdued }} />
          <Strong>{rule.name}</Strong>
          <Text 
            style={{ 
              fontSize: 11, 
              padding: "2px 6px", 
              borderRadius: 4, 
              background: Colors.Background.Container.Neutral.Default,
              color: actionColors[rule.action]
            }}
          >
            {rule.action.toUpperCase()}
          </Text>
        </Flex>
        <Switch value={rule.enabled} onChange={onToggle} />
      </Flex>
      
      <Flex alignItems="center" gap={8}>
        <Text style={{ fontSize: 11, color: Colors.Text.Neutral.Subdued }}>
          {rule.type === "regex" ? "Regex" : rule.type === "keyword" ? "Keyword" : "DQL"}:
        </Text>
        <Code style={{ fontSize: 11 }}>{rule.pattern}</Code>
      </Flex>

      <Flex gap={8} alignItems="center">
        <Button 
          size="condensed" 
          variant="accent" 
          onClick={onBacktest}
          disabled={isLoading}
        >
          <Button.Prefix><PlayIcon /></Button.Prefix>
          {isLoading ? "Testing..." : "Backtest on Traffic"}
        </Button>
        
        {backtestResult && (
          <Flex alignItems="center" gap={8}>
            {backtestResult.matches > 0 ? (
              <Flex alignItems="center" gap={4}>
                <WarningIcon style={{ color: Colors.Text.Warning.Default }} />
                <Text style={{ color: Colors.Text.Warning.Default }}>
                  Would match <Strong>{backtestResult.matches}</Strong> requests
                </Text>
              </Flex>
            ) : (
              <Flex alignItems="center" gap={4}>
                <CheckmarkIcon style={{ color: Colors.Text.Success.Default }} />
                <Text style={{ color: Colors.Text.Success.Default }}>No matches found</Text>
              </Flex>
            )}
          </Flex>
        )}
      </Flex>

      {backtestResult && backtestResult.matches > 0 && backtestResult.sampleMatches.length > 0 && (
        <Flex 
          flexDirection="column" 
          gap={4} 
          padding={8}
          style={{ 
            background: Colors.Background.Container.Neutral.Default,
            borderRadius: Borders.Radius.Container.Default,
            maxHeight: 100,
            overflow: "auto"
          }}
        >
          <Text style={{ fontSize: 11, color: Colors.Text.Neutral.Subdued }}>Sample matches:</Text>
          {backtestResult.sampleMatches.slice(0, 3).map((match, idx) => (
            <Code key={idx} style={{ fontSize: 10 }}>{match.substring(0, 80)}...</Code>
          ))}
        </Flex>
      )}
    </Flex>
  );
};

export const GuardrailBacktester = () => {
  const [rules, setRules] = useState<GuardrailRule[]>(PRESET_RULES);
  const [activeBacktest, setActiveBacktest] = useState<string | null>(null);
  const [backtestResults, setBacktestResults] = useState<Record<string, BacktestResult>>({});
  const [timeRange, setTimeRange] = useState("24h");
  
  // New rule form
  const [newRuleName, setNewRuleName] = useState("");
  const [newRulePattern, setNewRulePattern] = useState("");
  const [newRuleType, setNewRuleType] = useState<"regex" | "keyword">("keyword");
  const [newRuleAction, setNewRuleAction] = useState<"block" | "audit" | "alert">("audit");

  // Dynamic DQL for backtesting
  const activeRule = rules.find(r => r.id === activeBacktest);
  const backtestQuery = activeRule 
    ? `
      fetch spans, from: now()-${timeRange}
      | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
      | filter isNotNull(gen_ai.prompt.0.content)
      | filter matchesPhrase(gen_ai.prompt.0.content, "${activeRule.pattern.replace(/"/g, '\\"')}")
      | summarize 
          match_count = count()
    `
    : "";

  // Also query for total prompts to calculate impact
  const totalPromptsQuery = `
    fetch spans, from: now()-${timeRange}
    | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
    | filter isNotNull(gen_ai.prompt.0.content)
    | summarize total_count = count()
  `;

  const { data: backtestData, isLoading: backtestLoading } = useDql({ 
    query: backtestQuery || "fetch logs | limit 0" 
  });
  const { data: totalData } = useDql({ query: totalPromptsQuery });

  // Process backtest results
  React.useEffect(() => {
    if (backtestData && activeBacktest) {
      const record = backtestData.records?.[0] as Record<string, unknown> | undefined;
      const totalRecord = totalData?.records?.[0] as Record<string, unknown> | undefined;
      const matchCount = Number(record?.match_count || 0);
      const totalCount = Number(totalRecord?.total_count || 1);
      const impactPercent = ((matchCount / totalCount) * 100).toFixed(2);

      setBacktestResults(prev => ({
        ...prev,
        [activeBacktest]: {
          ruleId: activeBacktest,
          matches: matchCount,
          sampleMatches: Array.isArray(record?.sample) ? record.sample.map(String) : [],
          estimatedImpact: `${impactPercent}% of traffic`
        }
      }));
      setActiveBacktest(null);
    }
  }, [backtestData, activeBacktest, totalData]);

  const toggleRule = (id: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const runBacktest = (id: string) => {
    setActiveBacktest(id);
  };

  const addRule = () => {
    if (!newRuleName || !newRulePattern) return;
    
    const newRule: GuardrailRule = {
      id: Date.now().toString(),
      name: newRuleName,
      pattern: newRulePattern,
      type: newRuleType,
      action: newRuleAction,
      enabled: false,
    };
    
    setRules([...rules, newRule]);
    setNewRuleName("");
    setNewRulePattern("");
  };

  const deleteRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const enabledRules = rules.filter(r => r.enabled);
  const disabledRules = rules.filter(r => !r.enabled);

  return (
    <Flex flexDirection="column" padding={32} gap={24}>
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center">
        <Flex flexDirection="column" gap={4}>
          <Heading level={2}>Guardrail Policy Backtester</Heading>
          <Paragraph>Define content policies and test them against your historical Grail data before deployment.</Paragraph>
        </Flex>
        <Select value={timeRange} onChange={(val) => setTimeRange(val as string)}>
          <SelectOption value="1h">Last 1 hour</SelectOption>
          <SelectOption value="24h">Last 24 hours</SelectOption>
          <SelectOption value="7d">Last 7 days</SelectOption>
          <SelectOption value="30d">Last 30 days</SelectOption>
        </Select>
      </Flex>

      {/* Summary */}
      <Flex gap={16} flexWrap="wrap">
        <Flex
          padding={16}
          gap={8}
          alignItems="center"
          style={{
            background: Colors.Background.Field.Success.Default,
            borderRadius: Borders.Radius.Container.Default,
            border: `1px solid ${Colors.Border.Success.Default}`,
            flex: "1 1 200px"
          }}
        >
          <SecurityIcon style={{ color: Colors.Text.Success.Default }} />
          <Text><Strong>{enabledRules.length}</Strong> active rules</Text>
        </Flex>
        <Flex
          padding={16}
          gap={8}
          alignItems="center"
          style={{
            background: Colors.Background.Field.Warning.Default,
            borderRadius: Borders.Radius.Container.Default,
            border: `1px solid ${Colors.Border.Warning.Default}`,
            flex: "1 1 200px"
          }}
        >
          <Text><Strong>{enabledRules.filter(r => r.action === "block").length}</Strong> blocking policies</Text>
        </Flex>
        <Flex
          padding={16}
          gap={8}
          alignItems="center"
          style={{
            background: Colors.Background.Surface.Default,
            borderRadius: Borders.Radius.Container.Default,
            border: `1px solid ${Colors.Border.Neutral.Default}`,
            flex: "1 1 200px"
          }}
        >
          <Text><Strong>{disabledRules.length}</Strong> draft rules</Text>
        </Flex>
      </Flex>

      {/* Add New Rule */}
      <Flex
        flexDirection="column"
        gap={16}
        padding={16}
        style={{
          border: `1px solid ${Colors.Border.Neutral.Default}`,
          borderRadius: Borders.Radius.Container.Default,
          background: Colors.Background.Surface.Default,
        }}
      >
        <Heading level={5}>Add New Policy Rule</Heading>
        <Flex gap={16} flexWrap="wrap" alignItems="flex-end">
          <Flex flexDirection="column" gap={4} style={{ flex: "1 1 200px" }}>
            <Label>Rule Name</Label>
            <TextInput 
              value={newRuleName} 
              onChange={setNewRuleName} 
              placeholder="e.g., Block API Keys"
            />
          </Flex>
          <Flex flexDirection="column" gap={4} style={{ flex: "2 1 300px" }}>
            <Label>Pattern</Label>
            <TextInput 
              value={newRulePattern} 
              onChange={setNewRulePattern} 
              placeholder="e.g., api_key|secret|password"
            />
          </Flex>
          <Flex flexDirection="column" gap={4}>
            <Label>Type</Label>
            <Select value={newRuleType} onChange={(val) => setNewRuleType(val as "regex" | "keyword")}>
              <SelectOption value="keyword">Keyword</SelectOption>
              <SelectOption value="regex">Regex</SelectOption>
            </Select>
          </Flex>
          <Flex flexDirection="column" gap={4}>
            <Label>Action</Label>
            <Select value={newRuleAction} onChange={(val) => setNewRuleAction(val as "block" | "audit" | "alert")}>
              <SelectOption value="audit">Audit</SelectOption>
              <SelectOption value="block">Block</SelectOption>
              <SelectOption value="alert">Alert</SelectOption>
            </Select>
          </Flex>
          <Button variant="accent" onClick={addRule} disabled={!newRuleName || !newRulePattern}>
            <Button.Prefix><PlusIcon /></Button.Prefix>
            Add Rule
          </Button>
        </Flex>
      </Flex>

      {/* Active Rules */}
      <Flex flexDirection="column" gap={12}>
        <Heading level={4}>Active Policies</Heading>
        {enabledRules.length > 0 ? (
          <Flex flexDirection="column" gap={12}>
            {enabledRules.map(rule => (
              <PolicyCard
                key={rule.id}
                rule={rule}
                onToggle={() => toggleRule(rule.id)}
                onBacktest={() => runBacktest(rule.id)}
                backtestResult={backtestResults[rule.id]}
                isLoading={backtestLoading && activeBacktest === rule.id}
              />
            ))}
          </Flex>
        ) : (
          <Paragraph>No active policies. Enable a draft rule below to activate it.</Paragraph>
        )}
      </Flex>

      {/* Draft Rules */}
      <Flex flexDirection="column" gap={12}>
        <Heading level={4}>Draft Policies</Heading>
        {disabledRules.length > 0 ? (
          <Flex flexDirection="column" gap={12}>
            {disabledRules.map(rule => (
              <PolicyCard
                key={rule.id}
                rule={rule}
                onToggle={() => toggleRule(rule.id)}
                onBacktest={() => runBacktest(rule.id)}
                backtestResult={backtestResults[rule.id]}
                isLoading={backtestLoading && activeBacktest === rule.id}
              />
            ))}
          </Flex>
        ) : (
          <Paragraph>No draft policies. Add a new rule above.</Paragraph>
        )}
      </Flex>

      {/* Export Config */}
      <Flex
        padding={16}
        gap={12}
        style={{
          background: Colors.Background.Field.Primary.Default,
          borderRadius: Borders.Radius.Container.Default,
          border: `1px solid ${Colors.Border.Primary.Default}`
        }}
      >
        <Flex flexDirection="column" gap={4} style={{ flex: 1 }}>
          <Strong>Export Policy Configuration</Strong>
          <Paragraph>
            Export your guardrail policies as JSON for use in your backend enforcement layer or Dynatrace Workflows.
          </Paragraph>
        </Flex>
        <Button variant="default" onClick={() => {
          const config = JSON.stringify(rules.filter(r => r.enabled), null, 2);
          navigator.clipboard.writeText(config);
        }}>
          Copy Config to Clipboard
        </Button>
      </Flex>
    </Flex>
  );
};
