import { AppShell } from "@/components/app-shell";
import { ResearchConsole } from "@/components/research-console";

export default function DebugPage() {
  return (
    <AppShell title="MCP 调试">
      <ResearchConsole />
    </AppShell>
  );
}
