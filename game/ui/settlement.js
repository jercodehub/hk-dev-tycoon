export function settlementGroups({
  t,
  row,
  formatHkd,
  compactHkd,
  lang,
  revenue,
  landLabel,
  landCost,
  buildCost,
  promo,
  shareLine,
  youLine,
  profit,
  profitClass,
  profitSign,
  currentCash,
  settledCash,
  owed,
  bankPaid,
}) {
  const ledger = `<div class="settlement-group"><h3>${t(lang, "financeLedger")}</h3>
    ${row(t(lang, "projectRevenue"), `+${formatHkd(revenue)}`)}
    ${row(landLabel, `−${formatHkd(landCost)}`)}
    ${row(t(lang, "buildCost"), `−${formatHkd(buildCost)}`)}
    ${promo}${shareLine}${youLine}
    <div class="big-profit ${profitClass}">${profitSign}${formatHkd(profit)}</div>
  </div>`;
  const cashFlow = `<div class="settlement-group"><h3>${t(lang, "cashFlow")}</h3>
    ${row(t(lang, "currentCash"), compactHkd(currentCash))}
    ${row(t(lang, "settledCash"), compactHkd(settledCash))}
    ${owed > 0 ? row(t(lang, "stillOwed"), compactHkd(owed)) : row(t(lang, "loanRow"), compactHkd(0))}
    ${bankPaid > 0 ? row(t(lang, "bankPaid"), compactHkd(bankPaid)) : ""}
  </div>`;
  return { ledger, cashFlow };
}
