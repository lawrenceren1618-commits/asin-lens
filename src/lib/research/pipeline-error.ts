export type PipelineStage =
  | "mcp"
  | "clean"
  | "verify"
  | "db"
  | "report"
  | "export";

export type PipelineIssue = {
  id: string;
  asin?: string;
  market?: string;
  stage: PipelineStage;
  code: string;
  message: string;
  /** Concrete next step for the operator */
  hint: string;
};

export const STAGE_LABEL: Record<PipelineStage, string> = {
  mcp: "采集源",
  clean: "清洗",
  verify: "核对",
  db: "入库",
  report: "报告生成",
  export: "导出/推送",
};

const HINTS: Record<string, string> = {
  MCP_SOURCE_FAILED:
    "检查该 MCP 源的密钥与网络；可在「数据规则」里调整源优先级，先用可用源。",
  VERIFY_NO_SIGNAL:
    "返回里没有标题/价格/销量等有效字段。核对 MCP 原始结果，或换优先级更高的源。",
  VERIFY_SCHEMA:
    "清洗后的字段类型不符合规范。查看报错字段，对照源数据格式。",
  VERIFY_NEGATIVE:
    "出现负值。检查源数据单位与符号，必要时在规则里改用另一源的该字段。",
  DB_WRITE:
    "数据库写入失败。检查 DATABASE_URL 与表结构是否已初始化。",
  REPORT_VERIFY:
    "报告规范数据未通过核对。打开报告页查看异常列表结构。",
  UNKNOWN: "记下 ASIN 与阶段，逐项排查；修好一项后可重新采集该 ASIN。",
};

export function issueId(parts: {
  asin?: string;
  stage: PipelineStage;
  code: string;
  message: string;
}): string {
  return [parts.asin ?? "-", parts.stage, parts.code, parts.message.slice(0, 80)].join("|");
}

export function makeIssue(input: {
  asin?: string;
  market?: string;
  stage: PipelineStage;
  code: string;
  message: string;
  hint?: string;
}): PipelineIssue {
  return {
    id: issueId(input),
    asin: input.asin,
    market: input.market,
    stage: input.stage,
    code: input.code,
    message: input.message,
    hint: input.hint ?? HINTS[input.code] ?? HINTS.UNKNOWN,
  };
}

/** Map thrown Error / verify text into a actionable issue. */
export function issueFromCollectError(
  asin: string,
  market: string,
  error: unknown,
): PipelineIssue {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("清洗/核对未通过") || message.includes("核对未通过")) {
    if (message.includes("无有效业务字段")) {
      return makeIssue({
        asin,
        market,
        stage: "verify",
        code: "VERIFY_NO_SIGNAL",
        message,
      });
    }
    if (message.includes("不能为负")) {
      return makeIssue({
        asin,
        market,
        stage: "verify",
        code: "VERIFY_NEGATIVE",
        message,
      });
    }
    return makeIssue({
      asin,
      market,
      stage: "verify",
      code: "VERIFY_SCHEMA",
      message,
    });
  }

  if (/database|postgres|ECONN|drizzle/i.test(message)) {
    return makeIssue({
      asin,
      market,
      stage: "db",
      code: "DB_WRITE",
      message,
    });
  }

  if (/SellerSprite|Sif|MCP|fetch|timeout|401|403/i.test(message)) {
    return makeIssue({
      asin,
      market,
      stage: "mcp",
      code: "MCP_SOURCE_FAILED",
      message,
    });
  }

  return makeIssue({
    asin,
    market,
    stage: "clean",
    code: "UNKNOWN",
    message,
  });
}
