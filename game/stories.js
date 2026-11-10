export const STORIES = [
  {
    id: "deed",
    controversy: true,
    tc: "茶餐廳有人話你幅地釘契未清。無人出示過文件。",
    en: "The cafe says the site's deed is messy. Nobody has produced a paper.",
    choices: [
      { id: "a", tc: "出聲明澄清", en: "Issue a short clarification", rep: 2, cash: 0, flag: "cleared_deed" },
      { id: "b", tc: "唔回應", en: "Stay quiet", rep: -3, cash: 0, flag: "silent_deed" },
    ],
  },
  {
    id: "cage",
    controversy: true,
    tc: "鄰廈外牆多咗個鐵籠。街坊望埋你個地盤。",
    en: "The next block grew a cage on the wall. The street is looking at your site too.",
    choices: [
      { id: "a", tc: "借棚睇一眼", en: "Borrow a scaffold and look", rep: 1, cash: -350000, flag: "scaffold" },
      { id: "b", tc: "話唔關我事", en: "Say it is not yours", rep: -2, cash: 0, flag: "not_mine" },
    ],
  },
  {
    id: "trees",
    controversy: true,
    tc: "門口有張環保請願，要求你少砍兩棵樹。",
    en: "A green petition at the gate asks you to keep two trees.",
    choices: [
      { id: "a", tc: "改圖留樹", en: "Keep the trees", rep: 3, cash: -900000, flag: "kept_trees" },
      { id: "b", tc: "照圖則起", en: "Build as drawn", rep: -2, cash: 0, flag: "as_drawn" },
    ],
  },
  {
    id: "photo",
    controversy: false,
    tc: "有個本地演員想借示範單位影一張相。唔係代言。",
    en: "A local actor wants one photo in the show flat. Not an endorsement.",
    choices: [
      { id: "a", tc: "借佢十分鐘", en: "Lend ten minutes", rep: 2, cash: 0, flag: "photo" },
      { id: "b", tc: "請佢下次先", en: "Ask them to come back", rep: 0, cash: 0, flag: "no_photo" },
    ],
  },
  {
    id: "line",
    controversy: false,
    tc: "財爺喺電視講多句「供應會多」。茶餐廳已經改咗口風。",
    en: "The finance chief says supply will rise. The cafe has already changed its tune.",
    choices: [
      { id: "a", tc: "跟口風", en: "Follow the line", rep: 1, cash: 0, pool: { whale: -2, starter: 2 }, flag: "follow_line" },
      { id: "b", tc: "當佢講天氣", en: "Treat it as weather", rep: 0, cash: 0, flag: "weather" },
    ],
  },
  {
    id: "mocked",
    controversy: false,
    tc: "有人影完示範單位，話廳細得似樣本屋。",
    en: "Someone photographs the show flat and says the living room feels like a sample box.",
    choices: [
      { id: "a", tc: "即晚換佈置", en: "Restyle it tonight", rep: 2, cash: -600000, flag: "restyle" },
      { id: "b", tc: "話風格問題", en: "Call it taste", rep: -2, cash: 0, flag: "style" },
    ],
  },
  {
    id: "ballot",
    controversy: false,
    tc: "入票好旺。有人問你會唔會加多一輪抽籤。",
    en: "The ballot queue is hot. Someone asks if you will add another round.",
    choices: [
      { id: "a", tc: "加一輪", en: "Add a round", rep: 1, cash: 0, pool: { starter: 2 }, flag: "extra_round" },
      { id: "b", tc: "見好就收", en: "Stop while it is good", rep: -1, cash: 500000, pool: { starter: -2 }, flag: "stop_while_ahead" },
    ],
  },
  {
    id: "sweep",
    controversy: false,
    tc: "有大手客一次過問三伙開房。代理叫你而家決定。",
    en: "A buyer asks for three studios at once. The agent wants an answer now.",
    choices: [
      { id: "a", tc: "收住唔拆售", en: "Keep the block together", rep: 1, cash: 0, pool: { whale: -3 }, flag: "hold_block" },
      { id: "b", tc: "乘勢賣", en: "Sell into it", rep: -1, cash: 0, pool: { whale: 2 }, flag: "sell_through" },
    ],
  },
  {
    id: "lamp",
    controversy: true,
    tc: "夜光招牌太猛，對面茶餐廳話刺眼。無人講過邊個批准。",
    en: "The night sign is glaring. The cafe across the street says it hurts their eyes.",
    choices: [
      { id: "a", tc: "調暗個鐘", en: "Dim it for an hour", rep: 2, cash: -200000, flag: "dim_sign" },
      { id: "b", tc: "照亮", en: "Leave it bright", rep: -2, cash: 0, flag: "bright_sign" },
    ],
  },
  {
    id: "truck",
    controversy: true,
    tc: "泥頭車塞住條巷。街坊叫你改路由後門出。",
    en: "A dump truck blocks the lane. The street asks you to leave by the back gate.",
    choices: [
      { id: "a", tc: "改行後門", en: "Use the back gate", rep: 2, cash: -450000, flag: "back_gate" },
      { id: "b", tc: "照行正門", en: "Keep the front lane", rep: -2, cash: 0, flag: "front_lane" },
    ],
  },
  {
    id: "cat",
    controversy: false,
    tc: "地盤出咗隻貓。工人想留低，監工想即刻送走。",
    en: "A cat turned up on site. The crew wants to keep it. The foreman wants it gone.",
    choices: [
      { id: "a", tc: "留一晚", en: "Keep it for a night", rep: 1, cash: 0, flag: "site_cat" },
      { id: "b", tc: "送去茶餐廳", en: "Walk it to the cafe", rep: 0, cash: 0, flag: "cafe_cat" },
    ],
  },
  {
    id: "lift",
    controversy: false,
    tc: "示範單位部電梯音樂太大。有客掩住耳仔行過。",
    en: "The show-flat lift music is too loud. A buyer walks past with a hand over one ear.",
    choices: [
      { id: "a", tc: "關細聲", en: "Turn it down", rep: 1, cash: 0, flag: "quiet_lift" },
      { id: "b", tc: "話氣氛", en: "Call it atmosphere", rep: -1, cash: 0, flag: "loud_lift" },
    ],
  },
  {
    id: "rain",
    controversy: false,
    tc: "落雨，樣板間門口濕滑。有人差啲滑倒。",
    en: "Rain made the show-flat doorway slick. Someone nearly slipped.",
    choices: [
      { id: "a", tc: "即刻鋪地毯", en: "Lay a mat now", rep: 2, cash: -180000, flag: "rain_mat" },
      { id: "b", tc: "等雨停", en: "Wait out the rain", rep: -1, cash: 0, flag: "wait_rain" },
    ],
  },
  {
    id: "tea",
    controversy: false,
    tc: "茶餐廳有人排隊講你個盤。伙計問你請唔請一圍檸茶。",
    en: "The cafe queue is talking about your flats. The waiter asks if you are buying a round of lemon tea.",
    choices: [
      { id: "a", tc: "請一圍", en: "Buy the round", rep: 2, cash: -80000, pool: { starter: 1 }, flag: "lemon_tea" },
    ],
  },
];
