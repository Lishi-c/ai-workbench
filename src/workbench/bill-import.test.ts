import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBillCSV } from "./bill-import.ts";

test("带收/支列：正确区分收入与支出", () => {
  const csv = [
    "交易时间,收/支,金额,交易对方",
    "2026-08-21 10:00:00,支出,32.00,咖啡店",
    "2026-08-21 11:00:00,收入,100.00,工资",
  ].join("\n");
  const rows = parseBillCSV(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].type, "expense");
  assert.equal(rows[0].amount, 32);
  assert.equal(rows[1].type, "income");
  assert.equal(rows[1].amount, 100);
});

test("无收/支列：按金额符号区分收支（回归保护）", () => {
  const csv = [
    "交易时间,金额,交易对方",
    "2026-08-21 10:00:00,-32.00,咖啡店",
    "2026-08-21 11:00:00,100.00,工资",
  ].join("\n");
  const rows = parseBillCSV(csv);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].type, "expense");
  assert.equal(rows[1].type, "income");
});
