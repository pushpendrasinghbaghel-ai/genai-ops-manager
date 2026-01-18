import React, { useState } from "react";
import { Flex, Grid } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph, Strong } from "@dynatrace/strato-components/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { TextInput, Switch, Label } from "@dynatrace/strato-components-preview/forms";
import { DataTable } from "@dynatrace/strato-components-preview/tables";
import { useDql } from "@dynatrace-sdk/react-hooks";
import Colors from "@dynatrace/strato-design-tokens/colors";
import Borders from "@dynatrace/strato-design-tokens/borders";

type GuardrailRule = {
  id: string;
  name: string;
  pattern: string;
  enabled: boolean;
  type: "Regex" | "Keyword";
  severity: "Block" | "Audit";
};

const MOCK_RULES: GuardrailRule[] = [
  { id: "1", name: "Block SSN", pattern: "\\d{3}-\\d{2}-\\d{4}", enabled: true, type: "Regex", severity: "Block" },
  { id: "2", name: "No AWS Keys", pattern: "AKIA[0-9A-Z]{16}", enabled: true, type: "Regex", severity: "Block" },
  { id: "3", name: "Competitor Mention", pattern: "competitor_name", enabled: false, type: "Keyword", severity: "Audit" },
];

export const Governance = () => {
    const [rules, setRules] = useState<GuardrailRule[]>(MOCK_RULES);
    const [newPattern, setNewPattern] = useState("");
    const [simulatingRuleId, setSimulatingRuleId] = useState<string | null>(null);
    const [simulationResult, setSimulationResult] = useState<{ruleId: string, matches: number} | null>(null);

    // Dynamic DQL hook usage logic
    // We only fetch when simulatingRuleId is set.
    const activePattern = rules.find(r => r.id === simulatingRuleId)?.pattern || "";
    // Escape backslashes for DQL (backslashes need to be doubled in DQL strings)
    const escapedPattern = activePattern.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const dqlQuery = simulatingRuleId 
        ? `fetch spans, from: now()-24h
           | filter isNotNull(gen_ai.provider.name) OR isNotNull(gen_ai.request.model)
           | filter isNotNull(gen_ai.prompt.0.content)
           | filter matchesPhrase(gen_ai.prompt.0.content, '${escapedPattern}')
           | summarize match_count = count()`
        : null;

    const { data, isLoading } = useDql({
        query: dqlQuery || "", 
    });
    
    // Effect to capture result when data arrives
    React.useEffect(() => {
        if (data && simulatingRuleId) {
             // @ts-ignore
            const count = Number(data.records[0]?.match_count) || 0;
            setSimulationResult({ ruleId: simulatingRuleId, matches: count });
            setSimulatingRuleId(null); // Reset after fetch
        }
    }, [data, simulatingRuleId]);
    
    // Toggle Rule
    const toggleRule = (id: string) => {
        setRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
    };

    // Simulate Rule Impact
    const runSimulation = (id: string) => {
        setSimulationResult(null);
        setSimulatingRuleId(id);
    };

    const columns: any[] = [
        { id: "name", header: "Rule Name", accessor: "name", autoWidth: true },
        { id: "pattern", header: "Pattern", accessor: "pattern", autoWidth: true },
        { id: "type", header: "Type", accessor: "type", autoWidth: true },
        { id: "severity", header: "Action", accessor: "severity", autoWidth: true },
        { 
            id: "enabled", 
            header: "Status", 
            accessor: (row: GuardrailRule) => (
                <Switch 
                  // @ts-ignore
                  checked={row.enabled} 
                  onChange={() => toggleRule(row.id)} />
            ), 
            autoWidth: true 
        },
        {
            id: "actions",
            header: "Impact Analysis",
            accessor: (row: GuardrailRule) => (
                <Flex alignItems="center" gap={8}>
                     <Button 
                        size="condensed" 
                        variant="accent" 
                        onClick={() => runSimulation(row.id)}
                        disabled={isLoading && simulatingRuleId === row.id}
                     >
                        {isLoading && simulatingRuleId === row.id ? "Analyzing..." : "Test on Traffic"}
                     </Button>
                     {simulationResult?.ruleId === row.id && (
                        <Strong style={{ color: simulationResult.matches > 0 ? Colors.Text.Critical.Default : Colors.Text.Neutral.Default }}>
                            {simulationResult.matches} hits (last 24h)
                        </Strong>
                     )}
                </Flex>
            ),
            autoWidth: true
        }
    ];

    return (
        <Flex flexDirection="column" padding={32} gap={32}>
            <Flex flexDirection="column" gap={8}>
                <Heading level={2}>Policy Firewall & Governance</Heading>
                <Paragraph>Define guardrails and validate them against real historical data before enforcing.</Paragraph>
            </Flex>

            <Flex 
                flexDirection="column" 
                padding={24} 
                gap={16}
                style={{
                    border: `1px solid ${Colors.Border.Neutral.Default}`,
                    borderRadius: Borders.Radius.Container.Default,
                    background: Colors.Background.Surface.Default
                }}
            >
                <Flex justifyContent="space-between" alignItems="center">
                    <Heading level={4}>Active Guardrails</Heading>
                    <Button variant="emphasized">Add New Policy</Button>
                </Flex>
                
                <DataTable data={rules} columns={columns} />
            </Flex>
        </Flex>
    );
};
