export type BillRow = { type: "income" | "expense"; amount: number; category: string; note: string; date: string; time: string; sourceId: string };

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') { if (line[i + 1] === '"') { current += '"'; i++; } else inQuotes = false; }
      else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { result.push(current); current = ""; }
      else current += ch;
    }
  }
  result.push(current);
  return result;
}

function billAmount(raw: string): number {
  if (!raw) return 0;
  const n = parseFloat(String(raw).replace(/[¥￥,，\s]/g, ""));
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

function billType(typeRaw: string, amountRaw: string): "income" | "expense" {
  const t = typeRaw || "";
  if (t.includes("收入") || t === "收") return "income";
  if (t.includes("支出") || t === "支") return "expense";
  return String(amountRaw || "").trim().startsWith("-") ? "expense" : "income";
}

function billTime(raw: string): { date: string; time: string } {
  const m = String(raw || "").match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?[ T]?(\d{1,2})?:?(\d{2})?/);
  if (!m) return { date: "", time: "" };
  const date = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const time = m[4] ? `${m[4].padStart(2, "0")}:${m[5] ? m[5].padStart(2, "0") : "00"}` : "00:00";
  return { date, time };
}

function billCategory(raw: string, type: "income" | "expense"): string {
  if (type === "income") return "收入";
  const c = raw || "";
  if (/餐饮|美食|早餐|午餐|晚餐|外卖|咖啡|零食|饮料|小吃/.test(c)) return "餐饮";
  if (/购物|商城|淘宝|天猫|京东|拼多多|服饰|日用|超市|百货/.test(c)) return "购物";
  if (/居住|房租|水电|燃气|物业|缴费|话费|充值/.test(c)) return "居住";
  return "其他";
}

export function parseBillCSV(text: string): BillRow[] {
  const lines = text.replace(/\r/g, "").split("\n");
  let header: string[] = [];
  let start = -1;
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const cells = parseCSVLine(lines[i]).map((c) => c.trim());
    if (cells.some((c) => c.includes("交易时间") || c.includes("金额"))) { header = cells; start = i; break; }
  }
  if (start < 0) return [];
  const idx = (names: string[]) => header.findIndex((h) => names.some((n) => h === n || h.includes(n)));
  const timeCol = idx(["交易时间", "交易创建时间", "付款时间", "创建时间"]);
  const amountCol = idx(["金额"]);
  const typeCol = idx(["收/支", "收支", "收入/支出"]);
  const noteCol = idx(["商品说明", "商品名称", "商品", "交易对方", "商户名称"]);
  const catCol = idx(["交易分类", "交易类型", "类型", "分类"]);
  const idCol = idx(["交易号", "交易单号", "交易订单号", "订单号"]);
  if (amountCol < 0) return [];
  const rows: BillRow[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = parseCSVLine(line).map((c) => c.trim());
    if (cells.length <= amountCol && cells.length <= timeCol) continue;
    const amount = billAmount(cells[amountCol]);
    if (amount <= 0) continue;
    const type = billType(typeCol >= 0 ? cells[typeCol] : "", cells[amountCol]);
    const { date, time } = billTime(timeCol >= 0 ? cells[timeCol] : "");
    if (!date) continue;
    const note = (noteCol >= 0 ? cells[noteCol] : "") || (catCol >= 0 ? cells[catCol] : "") || "账单导入";
    const category = billCategory(catCol >= 0 ? cells[catCol] : note, type);
    const sourceId = (idCol >= 0 ? cells[idCol] : "") || `${date}-${time}-${amount}-${note}`;
    rows.push({ type, amount, category, note, date, time, sourceId });
  }
  return rows;
}
