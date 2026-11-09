export const STORIES = [
  {
    id: "headline",
    tc: "記者問你樓市點睇。你唔使做預測，講一句就得。",
    en: "A reporter asks where the market goes. You do not owe a forecast. One line is enough.",
    choices: [
      { id: "a", tc: "話「我哋照起」", en: "Say you will keep building", rep: 2, cash: 0, flag: "boast" },
      { id: "b", tc: "話「睇實現金」", en: "Say you watch the cash", rep: 1, cash: 0, flag: "prudent" },
    ],
  },
  {
    id: "tea",
    tc: "地盤隔離茶檔老闆叫你坐低。佢話附近漏水傳聞好多。",
    en: "The cafe beside the site waves you over. Leak rumours are doing the rounds.",
    choices: [
      { id: "a", tc: "坐低聽", en: "Sit and listen", rep: 2, cash: 0, flag: "listened" },
      { id: "b", tc: "搖頭趕工", en: "Wave it off and rush", rep: -1, cash: 0, flag: "rushed" },
    ],
  },
  {
    id: "rain",
    tc: "暴雨打完，有人把地盤相放上網，字幕寫住你公司個名。",
    en: "After the rain, someone posts site photos with your company name in the caption.",
    choices: [
      { id: "a", tc: "即晚回應", en: "Reply the same night", rep: 3, cash: 0, flag: "replied" },
      { id: "b", tc: "當睇唔到", en: "Pretend you missed it", rep: -3, cash: 0, flag: "ignored" },
    ],
  },
  {
    id: "bonus",
    tc: "伙計話就快交樓，想有少少完工利是。",
    en: "The crew is near handover and asks for a small completion bonus.",
    choices: [
      { id: "a", tc: "派利是", en: "Pay the bonus", rep: 2, cash: -400000, flag: "bonus" },
      { id: "b", tc: "賣完先算", en: "Wait until the flats sell", rep: -1, cash: 0, flag: "bonus_later" },
    ],
  },
  {
    id: "dinner",
    tc: "代理商會請你食飯。席上多半會談回佣慣例。",
    en: "The agency association invites you to dinner. Commission habits will come up.",
    choices: [
      { id: "a", tc: "去食", en: "Go", rep: 1, cash: -250000, flag: "dinner" },
      { id: "b", tc: "推咗", en: "Decline", rep: 0, cash: 0, flag: "skipped_dinner" },
    ],
  },
  {
    id: "station",
    tc: "區內有人當「車站會近啲」係事實。茶餐廳已經咁講。",
    en: "People in the district talk as if a closer station were already decided. The cafe certainly does.",
    choices: [
      { id: "a", tc: "唔評論", en: "No comment", rep: 0, cash: 0, flag: "no_comment" },
      { id: "b", tc: "話有站先算", en: "Say it counts only if it is built", rep: 1, cash: 0, flag: "wait_and_see" },
    ],
  },
  {
    id: "sunday",
    tc: "星期日售樓處好靜。你睇完模型，放下一個項目再算。",
    en: "Sunday at the sales office is quiet. You look at the model and leave the next project for later.",
    choices: [
      { id: "go", tc: "繼續", en: "Continue", rep: 0, cash: 0, flag: "quiet_sunday" },
    ],
  },
];
