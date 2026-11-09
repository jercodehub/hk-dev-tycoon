# HK Dev Tycoon

香港發展商模擬，Phase 1。用地圖買地、起樓、持倉、放租、沽售，一局 12 季。

**娛樂模擬，非投資意見。** Entertainment simulation, not investment advice.

畫面每一筆錢都分開標：

- **遊戲數值 / Game economy** — 現金、地價、建築費、租金、市值、劇本指數。可以輸贏。
- **開放數據 / Open data** — 差餉物業估價署全港售價指數，同港島、九龍、新界私人住宅平均售價（港元／平方米）。只做校準。

差餉署沒有區議會 18 區私人住宅成交價。遊戲不會顯示假的分區官方樓價。揀中沙田，見到嘅開放數據呎價係**新界**，唔係沙田。

## 點玩

`fetch` 讀唔到 `file://`。喺倉庫根目錄開靜態伺服器：

```bash
python3 -m http.server 8080
```

然後開 <http://localhost:8080/> 。

- **教學關 · 沙田**：只可以喺沙田買地。買地、起樓、放租、推進一季收租，教學就完成。
- **自由局**：全港約 400 幅聚合地段。12 季內變現淨資產達到目標。
- 進度寫入呢部瀏覽器嘅 LocalStorage。

地圖係 Leaflet 靜態圓點，每點係約 0.01 度網格入面嘅屋宇署「住宅/綜合用途」樓宇合計，唔係五萬個可點標記。

## 測試

```bash
npm test
```

`node --test` 覆蓋買／起／持倉／放租／沽售、季度 tick、12 季上限、沙田教學限制、存檔，以及「開放數據呎價留喺區域、遊戲數值先吸收分區空置同落成」。

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

- 屋宇署樓宇資料及樓齡紀錄，`hk-bd-opendata-building-information`。住宅篩選係用途「住宅/綜合用途」（座同平台）。
- 差餉物業估價署物業市場統計，`hk-rvd-tsinfo_rvd-property-market-statistics`。分區表只用單位存量、落成量、空置量。樓價只用全港指數同三區平均售價。

遊戲倍率（單位數量、成本比例、租金、指數劇本）喺 `game/balance.json`，全部屬遊戲數值。

## 布局

- `index.html` — 靜態頁
- `game/engine.js` — `{ cash, parcels, tick, goals }`，無 DOM
- `game/balance.json` — 倍率
- `game/main.js` — 地圖同中英 HUD
- `data/parcels.json` — 聚合地段
- `data/market-stats.json` — 差餉署校準
- `test/economy.test.js`
