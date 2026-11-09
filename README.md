# HK Dev Tycoon

香港發展商模擬，Phase 2。一局 **20 個項目**。每一個項目係：揀地 → 起樓 → 售樓 → 資金回籠。頭 1–2 個項目係教學。

**娛樂模擬，非投資意見。** Entertainment simulation, not investment advice.

畫面每一筆錢都分開標：

- **遊戲數值 / Game economy** — 現金、聲譽、地段檔次、投地尺價、建築費、購買力、叫價、分成、賺蝕。可以賺，亦可以蝕。
- **開放數據 / Open data** — 差餉物業估價署全港售價指數，同港島、九龍、新界私人住宅平均售價（港元／平方米）。只做校準。

差餉署沒有區議會 18 區私人住宅成交價。遊戲裡的分區尺價係**遊戲數值**：用區域開放數據呎價同空置率（單位數量）鬆散校準，**不是**差餉署或 data.gov.hk 的官方分區樓價。揀中沙田，開放數據呎價仍然係**新界**。

## 點玩

`fetch` 讀唔到 `file://`。喺倉庫根目錄開靜態伺服器：

```bash
python3 -m http.server 8080
```

然後開 <http://localhost:8080/> 。

- 開公司：改名，揀預設標誌同顏色。
- 每個項目有四個一撳選擇：**地皮A / 地皮B / 地皮C / 唔買（下次再投）**。地圖只係氣氛，唔係揀地。
- 地皮會標 **貴 / 平 / 合理**，對比而家嘅遊戲市況。
- 地皮種類會輪住：市建局重建（多數市區、溢價、售後分成）、地鐵發展物業（新發展區或市區、地鐵分成）、政府推地（各區、分成較少）。
- 起樓揀承建商：精盡建築（最平、高漏水、有機會爛尾要另覓承接）、灰門建築、新晶建築。
- 售樓係一個 CSS 動畫小遊戲：代理、廣告、大手客同散戶、回佣，同埋有限次、越撳越冇力的 **打氣**。太平會蝕，太貴會沽唔晒。
- 資金回籠先至結現金、未售存貨、聲譽同夥伴分成。
- 項目之間有一兩句中英故事。第 20 個項目之後見總結：現金、聲譽、售出單位、故事旗。
- 進度寫入呢部瀏覽器嘅 LocalStorage（`hk-dev-tycoon-v2`）。舊 Phase 1 存檔會重置，並顯示一行提示。

每一步樓價郁動，都會推郁投地尺價、建築費同買家購買力。

## 測試

```bash
npm test
```

`node --test` 覆蓋 Phase 2 市況 tick、地皮 A/B/C／唔買、可建面積同單位、承建商爛尾、售樓漏斗（代理、廣告、大手／散戶、回佣、打氣）、夥伴分成、20 個項目，同 LocalStorage 版本升級。Phase 1 季度引擎仍然喺 `game/engine.js`，測試照跑，但頁面已經唔再用季度時鐘。

## 更新開放數據

要網絡。會重抓差餉署 CSV 同屋宇署樓宇資料，再寫入 `data/market-stats.json` 同 `data/parcels.json`。

```bash
python3 scripts/refresh_data.py
```

已有本機檔就可以唔下載：

```bash
python3 scripts/refresh_data.py \
  --buildings /path/to/buildings.json \
  --stock-csv /path/to/district-stock.csv \
  --prices-csv /path/to/1.2M.csv \
  --index-csv /path/to/1.4M.csv
```

`scripts/build_market_stats.py` 若果平均售價出現 18 區鍵，會拒絕寫出。

## 數據來源

- 屋宇署樓宇資料及樓齡紀錄，`hk-bd-opendata-building-information`。Phase 2 地圖唔再用呢批點做揀地。
- 差餉物業估價署物業市場統計，`hk-rvd-tsinfo_rvd-property-market-statistics`。分區表只用單位存量、落成量、空置量。樓價只用全港指數同三區平均售價。

遊戲倍率（地段檔次、地價同建築費佔比、承建商、銷情、指數路徑）喺 `game/campaign-balance.json`，全部屬遊戲數值。

## 布局

- `index.html` — 靜態頁
- `game/campaign.js` — 20 個項目嘅純函數，無 DOM
- `game/campaign-balance.json` — Phase 2 倍率
- `game/main.js` — 中英 HUD、公司、揀地、起樓、售樓動畫、資金回籠
- `game/engine.js` — Phase 1 季度模型，淨係留畀測試
- `data/market-stats.json` — 差餉署校準
- `test/campaign.test.js`、`test/economy.test.js`
