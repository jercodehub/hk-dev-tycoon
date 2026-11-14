import assert from "node:assert/strict";
import test from "node:test";
import { settlementGroups } from "../game/ui/settlement.js";

const t = (_lang, key) => ({
  financeLedger: "Ledger", projectRevenue: "Revenue", buildCost: "Build", cashFlow: "Cash flow",
  currentCash: "Current", settledCash: "Settled", loanRow: "Loan", bankPaid: "Paid",
}[key] || key);
const row = (label, value) => `<div>${label}:${value}</div>`;
const formatHkd = (value) => `$${value}`;
const compactHkd = (value) => `$${value}`;

test("settlement module renders ledger and cash flow without calculating economy values", () => {
  const result = settlementGroups({
    t, row, formatHkd, compactHkd, lang: "en", revenue: 100,
    landLabel: "Land", landCost: 30, buildCost: 40, promo: "", shareLine: "", youLine: "",
    profit: 30, profitClass: "ok", profitSign: "+", currentCash: 50, settledCash: 80, owed: 0, bankPaid: 0,
  });
  assert.match(result.ledger, /Ledger/);
  assert.match(result.ledger, /Revenue/);
  assert.match(result.cashFlow, /Settled/);
  assert.match(result.cashFlow, /\$80/);
});
