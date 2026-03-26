import { Layout } from './components/Layout';
import { WorkflowCanvas } from './components/canvas/WorkflowCanvas';
import { NodeConfigPanel } from './components/panels/NodeConfigPanel';
import { ExecutionLogPanel } from './components/panels/ExecutionLogPanel';
import { useExecutionOverlay } from './hooks/useExecutionOverlay';

function AppInner() {
  useExecutionOverlay();
  return (
    <Layout
      canvas={<WorkflowCanvas />}
      configPanel={<NodeConfigPanel />}
      executionLog={<ExecutionLogPanel />}
    />
  );
}

export default function App() {
  return <AppInner />;
}
