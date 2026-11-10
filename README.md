# HK Dev Tycoon

香港發展商模擬，Phase 3。一局 **20 個項目**。每一個項目係：揀地 → 起樓 → 售樓 → 資金回籠 → 一則短故事。

**娛樂模擬，非投資意見。** Entertainment simulation, not investment advice.

畫面只留決策：現金、聲譽、市況（辣／鬆）、項目 n/20、下一步。售樓再加飯碗同客池剩餘。唔顯示開放數據來源、唔重複經濟標語、唔顯示舊存檔重置提示。

## 點玩

`fetch` 讀唔到 `file://`。喺倉庫根目錄開靜態伺服器：

```bash
python3 -m http.server 8080
```

然後開 <http://localhost:8080/> 。

- 開公司：改名，揀標誌同顏色。
- 每個項目四個選擇：**地皮 A / B / C / 唔買（下次再投）**。地皮有口語區味（近大學、偏遠上車、核心／豪區），同埋貴、平、合理。
- 政府推地**無分成**，之後爭議故事會密啲。市建局同地鐵有分成。
- 起樓先拉 bar 分配五種戶型（開房 280 呎、一房 350、兩房 450、三房 600、特色戶 1000）。畫面即時顯示已用同剩餘可建面積；超額唔可以確認。可以一撳用預設再改。
- 市況每三個項目翻一次。鬆：大手同開房旺，可能有西餅客一次掃 2–3 伙。辣：上車同自住相對穩，投資客縮。
- 起樓可以改項目名。預設跟區同區味，可以改。
- 售樓前先揀賣貴、合理、賣平。畫面即時預估會唔會賣晒、大約剩幾多、邊種戶型難清。賣貴利潤厚、轉換差、兩房飯碗易裂；賣平清得快、利潤薄。
- 售樓顯示客池剩餘、兩房飯碗（食得起／兩房食唔起）。飯碗裂只係兩房高過上車預算。示範單位要錢。打氣要撳完先至可以結算。賣唔晒可以減價清，或者留貨凍住現金到下一個項目，旁邊有大約聲譽同凍結現金。
- 聲譽旁邊有一句口碑，跟開價同質素累積。HUD 可以打開項目紀錄。
- 項目之間有「地產香港」短選，會加減聲譽、現金，偶爾郁一個客池。
- 進度寫入呢部瀏覽器嘅 LocalStorage（`hk-dev-tycoon-v3`，存檔版本 4，舊 Phase 3 存檔會升級）。

## 測試

```bash
npm test
```

`node --test` 覆蓋戶型 GFA、客池消耗、辣／鬆、區味、飯碗、示範單位、餘貨、西餅客、政府地無分成、故事加減、20 個項目，同畫面唔輸出已禁用標籤。Phase 1 季度引擎仍然喺 `game/engine.js`，測試照跑，頁面已經唔再用季度時鐘。

## 更新校準數據

要網絡。會重抓差餉署 CSV 同屋宇署樓宇資料，再寫入 `data/market-stats.json` 同 `data/parcels.json`。呢啲檔只做內部校準，畫面唔顯示來源標籤。

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

- 屋宇署樓宇資料及樓齡紀錄，`hk-bd-opendata-building-information`。地圖唔係揀地。
- 差餉物業估價署物業市場統計，`hk-rvd-tsinfo_rvd-property-market-statistics`。樓價只用全港指數同三區平均售價做內部比例。

倍率喺 `game/campaign-balance.json`。

## 布局

- `index.html` — 靜態頁
- `game/campaign.js` — 20 個項目嘅純函數，無 DOM
- `game/campaign-balance.json` — 倍率
- `game/main.js` — 一屏 HUD、公司、揀地、戶型拉 bar、售樓、資金回籠
- `game/stories.js` — 地產香港短選
- `game/engine.js` — Phase 1 季度模型，淨係留畀測試
- `data/market-stats.json` — 內部校準
- `test/campaign.test.js`、`test/phase3.test.js`、`test/economy.test.js`
