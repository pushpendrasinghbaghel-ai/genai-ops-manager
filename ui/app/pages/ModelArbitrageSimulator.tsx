import React, { useState } from "react";
import { Flex } from "@dynatrace/strato-components/layouts";
import { Heading, Paragraph } from "@dynatrace/strato-components/typography";
import { Button } from "@dynatrace/strato-components/buttons";
import { TextArea, Checkbox, Select, SelectOption } from "@dynatrace/strato-components-preview/forms";
import { DataTable } from "@dynatrace/strato-components-preview/tables";
import { useDql } from "@dynatrace-sdk/react-hooks";

// Mock data for simulation
const MODELS = [
  { id: "gpt-4", name: "GPT-4", costPer1k: 0.03, latencyFactor: 1.5, quality: "High" },
  { id: "claude-haiku", name: "Claude Haiku", costPer1k: 0.00025, latencyFactor: 0.3, quality: "Medium" },
  { id: "gemini-pro", name: "Gemini Pro", costPer1k: 0.000125, latencyFactor: 0.5, quality: "High" },
];

type SimulationResult = {
  modelName: string;
  cost: string;
  latency: string;
  quality: string;
  estimatedTokens: number;
};

export const ModelArbitrageSimulator = () => {
    const [mode, setMode] = useState<"manual" | "grail">("manual");
    const [prompt, setPrompt] = useState("");
    const [selectedModels, setSelectedModels] = useState<string[]>(MODELS.map(m => m.id));
    const [results, setResults] = useState<SimulationResult[]>([]);

    // Grail Logic: Fetch last 100 log records that look like LLM prompts
    // Note: useDql does not support 'disabled', so we conditionally use the hook output or manage state differently.
    // However, to keep it simple, we'll just not query if mode is manual, 
    // but hooks must be unconditional. We can pass a dummy query or empty string if mode is off?
    // Actually SDK behavior: empty query does nothing or error.
    // Better strategy: Always fetch but ignore if mode is manual? 
    // Or better: valid empty query for no-op if manual.
    const query = mode === "grail" ? "fetch logs, scanLimitGBytes: 1 | filter matchesPhrase(content, 'prompt') | limit 10" : "";
    
    const { data: grailData, isLoading: isGrailLoading, refetch: refetchGrail } = useDql({
        query: query
    });

    const handleSimulate = () => {
        let inputTokens = 0;
        let outputTokens = 150; 

        if (mode === "manual") {
            inputTokens = prompt.length / 4;
        } else if (mode === "grail" && grailData) {
            // Aggregate tokens from fetched real data
             // @ts-ignore
            const totalContentLength = grailData.records.reduce((acc, record) => acc + (record.content?.toString().length || 0), 0);
            inputTokens = totalContentLength / 4;
            // @ts-ignore
            outputTokens = 150 * grailData.records.length; // Simulate responses for ALL records
        }
        
        const newResults = MODELS.filter(m => selectedModels.includes(m.id)).map(model => {
            const totalTokens = inputTokens + outputTokens;
            const cost = (totalTokens / 1000) * model.costPer1k;
            const latency = 200 + (outputTokens * 10 * model.latencyFactor) + (Math.random() * 100);
            
            return {
                modelName: model.name,
                cost: `$${cost.toFixed(5)}`,
                latency: `${Math.round(latency)}ms`,
                quality: model.quality,
                estimatedTokens: Math.round(totalTokens)
            };
        });
        setResults(newResults);
    };

    const columns: any[] = [
      { id: "modelName", header: "Model", accessor: "modelName", autoWidth: true },
      { id: "cost", header: "Estimated Cost", accessor: "cost", autoWidth: true },
      { id: "latency", header: "Est. Latency", accessor: "latency", autoWidth: true },
      { id: "quality", header: "Quality Tier", accessor: "quality", autoWidth: true },
      { id: "estimatedTokens", header: "Total Tokens", accessor: "estimatedTokens", autoWidth: true },
    ];

    return (
        <Flex flexDirection="column" padding={32} gap={32}>
            <Heading level={2}>Model Arbitrage Simulator</Heading>
            <Paragraph>Test your prompts and simulate cost vs. performance trade-offs across different models.</Paragraph>

            <Flex flexDirection="column" gap={16}>
                <Heading level={4}>1. Choose Simulation Source</Heading>
                <Flex gap={16}>
                     <Select 
                        value={mode} 
                        onChange={(id) => setMode(id as "manual" | "grail")}
                     >
                        <SelectOption value="manual">Manual Entry (Type a prompt)</SelectOption>
                        <SelectOption value="grail">Replay Traffic (Fetch from Dynatrace)</SelectOption>
                     </Select>
                </Flex>

                {mode === "manual" && (
                    <TextArea
                        placeholder="Describe your task here..."
                        value={prompt}
                        onChange={(value) => setPrompt(value)}
                        rows={6}
                    />
                )}
                {mode === "grail" && (
                     <Paragraph>
                        Will fetch and replay the last 10 detected prompts from Dynatrace logs against selected models to calculate total cost.
                        {isGrailLoading && " Loading data from Grail..."}
                        {grailData && " Data loaded."}
                     </Paragraph>
                )}
            </Flex>

            <Flex flexDirection="column" gap={16}>
                <Heading level={4}>2. Select Models</Heading>
                 <Flex gap={16}>
                    {MODELS.map(model => (
                        <Checkbox
                            key={model.id}
                            // @ts-ignore
                            checked={selectedModels.includes(model.id)}
                            onChange={(checked) => {
                                if (checked) {
                                    setSelectedModels([...selectedModels, model.id]);
                                } else {
                                    setSelectedModels(selectedModels.filter(id => id !== model.id));
                                }
                            }}
                        >
                            {model.name}
                        </Checkbox>
                    ))}
                </Flex>
            </Flex>
            
            <Button variant="accent" onClick={handleSimulate} disabled={!prompt}>Run Simulation</Button>

            {results.length > 0 && (
                <Flex flexDirection="column" gap={16} paddingTop={32}>
                   <Heading level={4}>Simulation Results</Heading>
                    <DataTable data={results} columns={columns} />
                </Flex>
            )}
        </Flex>
    );
};
