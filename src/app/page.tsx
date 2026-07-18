import { ResearchConsole } from "@/components/research-console";

export default function Home() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 max-w-3xl">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          MCP Research Console
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Amazon 用户调研工作台
        </h1>
        <p className="mt-3 text-muted-foreground">
          手动调用 SellerSprite 与 Sif 的远程 MCP 工具，统一清洗、按日去重并写入飞书多维表格。
        </p>
      </div>
      <ResearchConsole />
    </main>
  );
}
