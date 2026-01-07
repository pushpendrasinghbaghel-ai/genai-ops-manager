import '@testing-library/jest-dom';

// Mock the Dynatrace SDK hooks
vi.mock('@dynatrace-sdk/react-hooks', () => ({
  useDql: vi.fn(() => ({
    data: { records: [] },
    isLoading: false,
    refetch: vi.fn(),
  })),
}));

// Mock Strato design system components
vi.mock('@dynatrace/strato-components-preview', () => ({
  AppHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="app-header">{children}</div>,
  Heading: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
  Flex: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Surface: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TitleBar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  Select: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} data-testid="select" />
  ),
  SelectOption: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
  ProgressCircle: () => <div data-testid="progress-circle">Loading...</div>,
  DataTable: ({ data }: { data: unknown[] }) => (
    <table data-testid="data-table">
      <tbody>
        {data.map((_, i) => (
          <tr key={i}>
            <td>Row {i}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
  TableColumn: () => null,
}));

vi.mock('@dynatrace/strato-components-preview/charts', () => ({
  TimeseriesChart: () => <div data-testid="timeseries-chart">Chart</div>,
  BarChart: () => <div data-testid="bar-chart">Bar Chart</div>,
}));

// Mock React Router
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  Route: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Routes: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Navigate: () => null,
}));
