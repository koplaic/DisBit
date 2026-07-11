# DisBit Roadmap

**Last Updated:** 2026-07-10  
**Scope:** Multi-phase development plan for DisBit, a Discord bot for Bitcraft empire management, logistics, and economy tracking.

---

## 🎯 Mission Statement

DisBit transforms Bitcraft empire data into actionable Discord dashboards. It syncs real-time player stats, equipment, market prices, and crafting progress to help empire leaders coordinate, make economic decisions, and track skill/resource distribution at a glance.

---

## 📊 Current State (Phase 0: Foundation)

### ✅ Completed
- **7 slash commands**: `/ping`, `/set_empire`, `/members`, `/character`, `/inventory`, `/whereis`, `/status`
- **Bitcraft API integration**: Rate-limited client with 200 calls/min cap
- **SQLite database**: `empire_members`, `claim_stations` tables
- **Background sync**: 10-minute auto-sync cycle (members → equipment → claims)
- **Item catalog**: Dynamic local cache from `/api/items`
- **Item search & location tracking**: `/inventory` and `/whereis` commands pull live claim inventories

### 🔴 Known Issues
1. **Equipment sync broken**: `getMemberSyncMetadata()` missing `last_equipment_sync_at` column
2. **New members stuck**: Initial equipment sync metadata never initialized
3. **File path case-sensitivity**: Duplicate config files (`guildSettings.js` vs `guildsettings.js`)
4. **Station classification naive**: Pattern-matching instead of API-driven type detection
5. **Equipment cooldown too long**: 30 minutes = stale data for active empires
6. **No passive tracking**: Equipment/inventory only synced on cron, not on player changes

### 📦 Dependencies
- `discord.js` v13 — core bot framework
- `@discordjs/builders` — slash command definitions
- `sqlite3` — persistent storage
- `dotenv` — environment configuration
- `node-fetch` — HTTP requests to Bitcraft API

---

## 🛠️ Phase 1: Stabilization & Bug Fixes (Week 1)

**Goal**: Fix breaking bugs, establish reliable data pipeline.

### 1.1 Equipment Sync Pipeline Fix
- [ ] **Fix `getMemberSyncMetadata()`** to return `last_equipment_sync_at` from DB
  - **File**: `db/empireMembers.js` (line ~179)
  - **Current**: Selects only `character_id`, `empire_id`, `last_player_sync_at`
  - **Change**: Add `last_equipment_sync_at` to SELECT statement
  - **Verified by**: Call to `getMemberSyncMetadata(empireId)` now returns rows with `last_equipment_sync_at` populated
  
- [ ] **Initialize `last_equipment_sync_at` on new member insert**
  - **File**: `sync/empireMembersSync.js` (line ~115)
  - **Current**: Row payload missing `$last_equipment_sync_at`
  - **Change**: Set `$last_equipment_sync_at: nowIso` in row object before upsert
  - **Verified by**: New member's equipment syncs within 30 min (now cooldown triggers properly)

- [ ] **Reduce equipment sync cooldown from 30 min → 10 min**
  - **File**: `sync/playerEquipmentSync.js` (line 12)
  - **Current**: `EQUIPMENT_SYNC_COOLDOWN_MS = 30 * 60 * 1000`
  - **Change**: Set to `10 * 60 * 1000`
  - **Cost**: ~+40 API calls per 10-min cycle (from `/api/players/[id]/equipment` + `/api/players/[id]/inventories`)
  - **Within budget**: Still under 200/min cap with ~120 calls/cycle for full sync

### 1.2 File System & Import Hygiene
- [ ] **Delete duplicate config file**
  - **File**: Delete `config/guildsettings.js` (lowercase 's')
  - **Impact**: Linux case-sensitivity no longer breaks imports

- [ ] **Add .gitignore entries**
  ```
  db/bot-data.sqlite
  config/guildEmpires.json
  data/items.json
  .env
  node_modules/
  ```

### 1.3 Error Handling & Observability
- [ ] **Add structured logging** with empire + timestamp context
  - Replace `console.log('[MemberSync] ...')` with consistent format
  - Track: members synced, equipment updated, claims processed, errors encountered
  - Example output:
    ```
    [2026-07-10 14:32:15] [MemberSync] Starting sync for 2 empire(s).
    [2026-07-10 14:32:16] [MemberSync] [6500896] Synced 14 member(s) for empire Dream of Serenity.
    [2026-07-10 14:32:45] [MemberSync] [6500896] Equipment/inventory sync processed 12 member(s).
    [2026-07-10 14:33:02] [MemberSync] [6500896] Claim stations sync completed: 23 stations classified.
    [2026-07-10 14:33:02] [MemberSync] Sync cycle completed in 47.3s.
    ```

- [ ] **Add try-catch retry logic to sync cycles**
  - If one empire fails, continue to next (don't abort entire cycle)
  - Log specific API error (e.g., "404 Empire not found" vs "429 Rate limited")

### 1.4 Testing & Validation
- [ ] **Create test plan document** (`TESTING.md`)
  - Manual checklist: new members sync equipment, claim stations classified, item cache refreshes
  - Verify no case-sensitivity errors on Linux

**Deliverable**: Bug-free equipment sync, reliable auto-cycle, zero case-sensitivity issues.

---

## 🚀 Phase 2: Empire Intelligence (Weeks 2–3)

**Goal**: Add core logistics & operational dashboards for empire leaders.

### 2.1 Claim Operations Dashboard
**New Command**: `/claim-status [claim-name-or-id]`

Shows per-claim operational data using actual Bitcraft API:

- **Claim info**: Name, region, owner, founding date (from `GET /api/claims/[id]`)
- **Active members**: Residents on this claim with their online status (from `GET /api/claims/[id]/citizens`)
- **Crafting projects**: All active public crafts (from `GET /api/claims/[id]/crafts`)
- **Construction projects**: Active builds with material requirements (from `GET /api/claims/[id]/construction`)
- **Upkeep & supply**: Current supply level vs max (from `GET /api/claims/[id]`)
- **Market listings**: Top sell/buy orders on this claim's market (from `GET /api/claims/{id}/market/listings`)

**Real API Response Structure** (from your provided docs):

```javascript
// GET /api/claims/[id] response
{
  entityId: "claim_123456",
  name: "Ironhold Keep",
  regionId: 12,
  regionName: "Mountain Pass",
  owner: "Empire_Leader_ID",
  settlement: true,
  built: "2026-03-15T00:00:00Z",
  supply: 1240,
  supplyCapacity: 2000,
  upkeep: 150,
  rank: 45
}

// GET /api/claims/[id]/citizens response
[
  {
    entityId: "player_1001",
    playerName: "Master_Smith",
    lastLogin: "2026-07-10T14:22:00Z",
    timePlayed: 4820,
    rank: "Officer"
  },
  {
    entityId: "player_1002",
    playerName: "IronJoe",
    lastLogin: "2026-07-10T08:45:00Z",
    timePlayed: 2341,
    rank: "Member"
  }
]

// GET /api/claims/[id]/crafts response
[
  {
    entityId: "craft_5001",
    name: "Legendary Sword Set",
    recipeId: "recipe_sword",
    createdBy: "Master_Smith",
    progress: 0.75,
    percentComplete: 75,
    completedAt: "2026-07-10T16:47:00Z",
    contributors: 8
  },
  {
    entityId: "craft_5002",
    name: "Bulk Cloth Production",
    recipeId: "recipe_cloth",
    createdBy: "Weaver_Jane",
    progress: 0.10,
    percentComplete: 10,
    contributors: 3
  }
]

// GET /api/claims/[id]/construction response
[
  {
    buildingId: "building_1",
    recipeId: "recipe_smithing_station_t3",
    percentComplete: 0.0,
    requiredMaterials: [
      { itemId: "item_steel", name: "Steel Ingot", quantity: 50, have: 47 },
      { itemId: "item_coal", name: "Coal", quantity: 200, have: 189 }
    ]
  }
]

// GET /api/claims/{id}/market/listings response
{
  entityId: "claim_123456",
  listings: {
    sell: [
      {
        id: "listing_1",
        price: 3.5,
        quantity: 500,
        itemId: "item_copper_ore",
        itemName: "Copper Ore",
        seller: "Smith_Joe"
      },
      {
        id: "listing_2",
        price: 2.1,
        quantity: 200,
        itemId: "item_copper_ore",
        itemName: "Copper Ore",
        seller: "Miner_Alice"
      }
    ],
    buy: [
      {
        id: "listing_3",
        price: 2.8,
        quantity: 300,
        itemId: "item_copper_ore",
        itemName: "Copper Ore",
        buyer: "Trader_Bob"
      }
    ]
  }
}
```

**Discord Output** (actual):

```
🏰 Ironhold Keep — Mountain Pass
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Owner: Dream of Serenity | Founded: Mar 15, 2026
Supply: 1,240 / 2,000 slots (62%)
Upkeep: 150 shards/week ✅

👥 Residents (7 online)
  🟢 Master_Smith — Officer | Last seen: 14m ago | Playtime: 80h
  🟢 IronJoe — Member | Last seen: 1h ago | Playtime: 39h
  🟡 Crafty_Hands — Member | Last seen: 8h ago | Playtime: 12h
  🔴 Smith_Jr — Member | Last seen: 5 days ago | Playtime: 4h

🔨 Active Crafts (2)
  ✅ Legendary Sword Set (75% complete, ETA: 2h 15m)
     Crafter: Master_Smith | Contributors: 8
  
  ⏳ Bulk Cloth Production (10% complete, ETA: 4h 30m)
     Crafter: Weaver_Jane | Contributors: 3 | ⚠️ Missing: 2,660 Fiber

🏗️ Construction (1 project)
  📦 Smithing Station T3
     Materials: Steel x50 (have 47 ⚠️), Coal x200 (have 189 ⚠️)
     Status: Ready to build (2 items short)

🛒 Market Listings
  SELL:
    • Copper Ore: 3.5 shards — 500 units (Smith_Joe)
    • Copper Ore: 2.1 shards — 200 units (Miner_Alice) ← cheapest
  BUY:
    • Copper Ore: 2.8 shards — 300 units wanted (Trader_Bob)
```

### 2.2 Smart Station Classification
**Replace**: Naive name-pattern matching in `claimStationsSync.js`

**New Approach**: Use real game data from `/api/claims/[id]/construction`

**Real Skill Names** (from Bitcraft):
- Smithing, Carpentry, Tailoring, Masonry, Leatherworking (from your API docs)
- These appear in construction recipes as `building_[skillname]_t[tier]`

**Algorithm**:
1. When syncing claim buildings, fetch `/api/claims/[id]/construction`
2. Parse recipe IDs like `recipe_smithing_station_t3` → type = "Smithing", tier = 3
3. Store inferred type + confidence in DB
4. Fall back to heuristic only if construction data unavailable

**Updated `classifyStation()` function**:

```javascript
function classifyStation(building, constructionProjects = []) {
  const name = building.buildingName || building.buildingNickname || '';
  const buildingId = building.entityId;
  
  // First: check if this building is referenced in active construction
  const constructionMatch = constructionProjects.find(
    p => p.buildingId === buildingId
  );
  
  if (constructionMatch) {
    const recipe = constructionMatch.recipeId;
    // Extract from: recipe_smithing_station_t3
    const match = recipe.match(/recipe_(\w+)_station_t(\d)/);
    if (match) {
      return {
        stationType: capitalize(match[1]), // Smithing, Carpentry, etc.
        stationTier: parseInt(match[2], 10),
        inferred_via: 'construction'
      };
    }
  }
  
  // Fallback: name pattern matching (for completed stations)
  const lowerName = name.toLowerCase();
  let stationType = null;
  let stationTier = null;
  
  if (lowerName.includes('smith')) stationType = 'Smithing';
  else if (lowerName.includes('carp')) stationType = 'Carpentry';
  else if (lowerName.includes('tailor')) stationType = 'Tailoring';
  else if (lowerName.includes('mason')) stationType = 'Masonry';
  else if (lowerName.includes('leather')) stationType = 'Leatherworking';
  
  const tierMatch = lowerName.match(/t([1-5])/);
  if (tierMatch) stationTier = parseInt(tierMatch[1], 10);
  
  if (!stationType || !stationTier) return null;
  
  return {
    stationType,
    stationTier,
    inferred_via: 'heuristic'
  };
}
```

**Updated sync call**:

```javascript
async function syncClaimStations(empireId) {
  const claims = await getEmpireClaims(empireId);
  
  for (const claim of claims) {
    const claimId = String(claim.entityId);
    
    // Fetch construction projects for this claim
    let constructionProjects = [];
    try {
      const construction = await getClaimConstruction(claimId);
      constructionProjects = construction.construction || [];
    } catch (err) {
      console.error('Failed to fetch construction for', claimId, err);
    }
    
    // Now classify stations with construction context
    const buildings = await getClaimBuildings(claimId);
    for (const b of buildings) {
      const classification = classifyStation(b, constructionProjects);
      if (!classification) continue;
      
      // Store with inferred_via metadata
      const row = {
        $building_id: String(b.entityId),
        $claim_id: claimId,
        $empire_id: String(empireId),
        $station_type: classification.stationType,
        $station_tier: classification.stationTier,
        $name: b.buildingName || '',
        $inferred_via: classification.inferred_via,
        $snapshot_at: new Date().toISOString()
      };
      
      await upsertClaimStation(row);
    }
  }
}
```

### 2.3 Player Deep Profiles
**Expand**: `/character [player-name]` command

**New sections using real API endpoints**:

```javascript
// GET /api/players/[id] — main player data
{
  entityId: "player_1001",
  username: "Master_Smith",
  level: 45,
  totalXP: 1200000,
  playtime: 172800,  // seconds
  experience: [
    { skill_id: "skill_smithing", quantity: 654000 },
    { skill_id: "skill_combat", quantity: 421000 },
    { skill_id: "skill_carpentry", quantity: 289000 }
  ],
  skillMap: {
    "skill_smithing": { name: "Smithing", title: "Blacksmith", skillCategoryStr: "Crafting" },
    "skill_combat": { name: "Combat", title: "Warrior", skillCategoryStr: "Combat" }
  }
}

// GET /api/players/[id]/equipment
{
  head: { itemId: "item_iron_helm", name: "Iron Helm", stats: { defense: 2 } },
  chest: { itemId: "item_steel_breastplate", name: "Steel Breastplate", 
           stats: { defense: 5, hpRegen: 1 } },
  hands: { itemId: "item_leather_gloves", name: "Leather Gloves", stats: { dexterity: 1 } },
  legs: { itemId: "item_steel_leggings", name: "Steel Leggings", stats: { defense: 3 } },
  feet: { itemId: "item_leather_boots", name: "Leather Boots", stats: { speed: 1 } },
  rightHand: { itemId: "item_legendary_battleaxe", name: "Legendary Battleaxe",
               stats: { damage: 8, strength: 2 } },
  leftHand: null
}

// GET /api/players/[id]/buffs
[
  { buffId: "buff_well_fed", name: "Well-Fed", effect: "+10% XP", expiresAt: "2026-07-10T15:45:00Z" },
  { buffId: "buff_fortified", name: "Fortified", effect: "+5% Defense", expiresAt: "2026-07-10T18:15:00Z" },
  { buffId: "buff_haste", name: "Haste", effect: "+15% Movement Speed", expiresAt: "2026-07-10T16:30:00Z" }
]

// GET /api/players/[id]/passive-crafts
[
  { craftId: "passive_1", item: "Iron Ingot", quantity: 50, percentComplete: 85, completesAt: "2026-07-10T17:22:00Z" },
  { craftId: "passive_2", item: "Cloth Wrap", quantity: 30, percentComplete: 40, completesAt: "2026-07-11T02:15:00Z" }
]

// GET /api/players/[id]/housing
{
  houseId: "house_1",
  location: "Mountain Pass",
  storageCapacity: 500,
  storageUsed: 340,
  inventories: [
    { name: "inventory", used: 200, capacity: 300 },
    { name: "vault", used: 140, capacity: 200 }
  ]
}
```

**Discord Output** (actual):

```
👤 Master_Smith — Level 45
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total XP: 1.2M | Playtime: 48h 0m | Rank: Officer (Dream of Serenity)

⚔️ Top Skills
  🥇 Smithing — Level 42 (654K XP)
  🥈 Combat — Level 38 (421K XP)
  🥉 Carpentry — Level 35 (289K XP)

🛡️ Equipment Loadout
  Head:      Iron Helm (+2 DEF)
  Chest:     Steel Breastplate (+5 DEF, +1 HP/s)
  Hands:     Leather Gloves (+1 DEX)
  Legs:      Steel Leggings (+3 DEF)
  Feet:      Leather Boots (+1 SPD)
  Right Hand: Legendary Battleaxe (+8 DMG, +2 STR) ⭐
  Left Hand: Empty

⏳ Passive Crafts (2 in progress)
  • Iron Ingot x50 — 85% complete (ready in 1h 22m)
  • Cloth Wrap x30 — 40% complete (ready in 12h 15m)

🍖 Active Buffs (3)
  • Well-Fed: +10% XP — expires in 1h 13m ⏰
  • Fortified: +5% Defense — expires in 3h 43m ⏰
  • Haste: +15% Movement Speed — expires in 1h 58m ⏰

🏠 Housing: Mountain Pass (340 / 500 slots)
  Inventory: 200 / 300 slots
  Vault:     140 / 200 slots
```

### 2.4 Dynastic Leaderboards
**New Commands** using real Bitcraft leaderboard endpoints:

```javascript
// GET /api/leaderboard/skills?offset=0&limit=20
[
  {
    rank: 1,
    playerName: "Master_Smith",
    level: 48,
    totalXP: 892000,
    empire: "Dream of Serenity"
  },
  {
    rank: 2,
    playerName: "IronJoe",
    level: 44,
    totalXP: 721000,
    empire: "Dream of Serenity"
  },
  {
    rank: 3,
    playerName: "Crafty_Hands",
    level: 41,
    totalXP: 598000,
    empire: "Mountain Lords"
  }
]

// GET /api/leaderboard/playtime?offset=0&limit=20
[
  {
    rank: 1,
    playerName: "Master_Smith",
    playtime: 172800,  // seconds = 48 hours
    empire: "Dream of Serenity"
  }
]
```

**New Commands**: 
- `/lb skills [empire]` — empire members ranked by total XP
- `/lb playtime [empire]` — most active members by hours played
- `/lb skills-specific [skill] [empire]` — who's best at Smithing, Tailoring, etc.?

**Discord Output**:

```
🏆 Dream of Serenity — Skills Leaderboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 🥇 Master_Smith — Lvl 48 (892K XP)
2. 🥈 IronJoe — Lvl 44 (721K XP)
3. 🥉 Crafty_Hands — Lvl 41 (598K XP)
4. Blacksmith_Bob — Lvl 39 (487K XP)
5. Novice_Miller — Lvl 12 (35K XP)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏆 Dream of Serenity — Playtime Leaderboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 🥇 Master_Smith — 48h 0m ⏰
2. 🥈 IronJoe — 39h 45m ⏰
3. 🥉 Crafty_Hands — 12h 12m ⏰
4. Weaver_Jane — 8h 30m ⏰
5. Smith_Jr — 4h 15m ⏰
```

**Deliverable**: Empire leaders have clear visibility into member skills, claim operations, and comparative performance.

---

## 💰 Phase 3: Market Intelligence (Weeks 4–5)

**Goal**: Enable economic strategy through price tracking, arbitrage detection, and supply monitoring.

### 3.1 Market Price Tracking
**New Table**: `market_snapshots`

```sql
CREATE TABLE market_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TIMESTAMP NOT NULL,
  item_id TEXT NOT NULL,
  item_name TEXT,
  claim_id TEXT,  -- NULL means global market aggregate
  lowest_sell REAL,
  highest_buy REAL,
  sell_order_count INT,
  buy_order_count INT,
  volume_24h INT,
  vwap_24h REAL
);
```

**New Command**: `/market-price [item-name]`

Uses actual endpoint: `POST /api/market/prices/bulk`

```javascript
// POST /api/market/prices/bulk
{
  data: [
    {
      itemId: "item_copper_ore",
      itemName: "Copper Ore",
      lowestSell: 1.2,
      highestBuy: 1.1,
      sellOrderCount: 12,
      buyOrderCount: 8,
      volume24h: 3420,
      vwap24h: 1.15,
      spread: 0.1
    },
    {
      itemId: "item_iron_ingot",
      itemName: "Iron Ingot",
      lowestSell: 4.2,
      highestBuy: 4.0,
      sellOrderCount: 45,
      buyOrderCount: 38,
      volume24h: 8900,
      vwap24h: 4.15,
      spread: 0.2
    }
  ]
}

// GET /api/market/[item]/[itemId]/price-history
{
  itemId: "item_copper_ore",
  itemName: "Copper Ore",
  priceHistory: [
    { timestamp: "2026-07-10T00:00:00Z", vwap: 1.08, high: 1.15, low: 1.02 },
    { timestamp: "2026-07-09T00:00:00Z", vwap: 1.12, high: 1.20, low: 1.05 },
    { timestamp: "2026-07-08T00:00:00Z", vwap: 1.15, high: 1.25, low: 1.08 }
  ]
}
```

**Background Job** (every 30 min): Snapshot top 50 trading items.

**Discord Output**:

```
📈 Iron Ingot — Market Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current Price: 4.2 shards (VWAP 24h: 4.15)
Spread: 4.0 → 4.2 shards (5% range) ← tight!

📊 Market Depth
  Sell Orders: 45 available
  Buy Orders: 38 waiting
  24h Volume: 8,900 units traded
  Liquidity: Very High ✅

💰 Best Prices
  Lowest Sell:  4.2 shards (12 orders)
  Highest Buy:  4.0 shards (8 orders)

📉 24h Price Action
  High:  4.5 shards
  Low:   3.95 shards
  Trend: ↔️ Stable (within 1%)

7-Day Trend:
  Day 7: 4.15 (down from 4.25)
  Day 6: 4.18
  Day 5: 4.20
  Day 4: 4.12
  Day 3: 4.08
  Day 2: 4.10
  Day 1: 4.15
```

### 3.2 Arbitrage Deal Finder
**New Command**: `/market-deals [min-profit-percent]`

Uses: `GET /api/claims/{id}/market/listings` + `POST /api/market/prices/bulk`

**Real response structure** (from your API docs):

```javascript
// GET /api/claims/{id}/market/listings
{
  claimId: "claim_123",
  claimName: "Ironhold Keep",
  listings: {
    sell: [
      {
        id: "listing_1",
        itemId: "item_copper_ore",
        itemName: "Copper Ore",
        price: 1.2,
        quantity: 500,
        seller: "Smith_Joe"
      },
      {
        id: "listing_2",
        itemId: "item_copper_ore",
        itemName: "Copper Ore",
        price: 1.3,
        quantity: 300,
        seller: "Miner_Alice"
      }
    ],
    buy: [
      {
        id: "listing_3",
        itemId: "item_copper_ore",
        itemName: "Copper Ore",
        price: 1.0,
        quantity: 200,
        buyer: "Smelter_Bob"
      }
    ]
  }
}
```

**Algorithm**:
1. Fetch market listings for top 20 claims (20 API calls)
2. For each item, find lowest_buy across all claims vs highest_sell
3. Calculate profit margin: (sell_price - buy_price) / buy_price
4. Filter deals with margin >= user's min_profit threshold

**Discord Output**:

```
🤑 Arbitrage Deals (min >10% profit)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 🟢 COPPER ORE (+25% margin)
   📥 Buy @ Riverside Market: 1.2 shards
   📤 Sell @ Ironhold Keep: 1.5 shards
   💰 Profit per unit: +0.3 (25%)
   Max profit: 400 units available × 0.3 = 120 shards total

2. 🟢 STEEL PLATE (+19% margin)
   📥 Buy @ Mountain Trading: 8.0 shards
   📤 Sell @ Coastal Port: 9.5 shards
   💰 Profit per unit: +1.5 (19%)
   Max profit: 150 units available × 1.5 = 225 shards total

3. 🟢 CLOTH WRAP (+60% margin) ⭐⭐⭐
   📥 Buy @ Northern Market: 0.5 shards
   📤 Sell @ Capital Trade Hub: 0.8 shards
   💰 Profit per unit: +0.3 (60%)
   Max profit: 900 units available × 0.3 = 270 shards total

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total opportunity: 615 shards ⚡
(Prices cached 15 min ago — may have changed)
```

### 3.3 Item Supply Tracking
**New Command**: `/item-holders [item-name]`

Uses: `GET /api/leaderboard/items/[itemId]` + filter by empire members

```javascript
// GET /api/leaderboard/items/[itemId]?limit=100
[
  {
    rank: 1,
    playerName: "Master_Smith",
    quantity: 12,
    storageLocs: {
      inventory: 2,
      vault: 8,
      house: 2,
      market: 0
    }
  },
  {
    rank: 2,
    playerName: "IronJoe",
    quantity: 5,
    storageLocs: {
      inventory: 0,
      vault: 3,
      house: 2,
      market: 0
    }
  },
  {
    rank: 3,
    playerName: "Crafty_Hands",
    quantity: 3,
    storageLocs: {
      inventory: 1,
      vault: 1,
      house: 1,
      market: 0
    }
  }
]
```

**Discord Output**:

```
⚔️ Top Sword Holders (Dream of Serenity)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Master_Smith — 12 swords
   📦 Vault: 8 | 🏠 House: 2 | 🎒 Inventory: 2

2. IronJoe — 5 swords
   📦 Vault: 3 | 🏠 House: 2 | 🎒 Inventory: 0

3. Crafty_Hands — 3 swords
   📦 Vault: 1 | 🏠 House: 1 | 🎒 Inventory: 1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Empire Average: 3.3 swords/member (across 12 members)
Global Rank: #34 / 500+ empires (top 7%)
Total Swords in Empire: 40 units
```

**Deliverable**: Traders & economists have data to make informed buy/sell decisions.

---

## 🎯 Phase 4: Advanced Features (Weeks 6–8)

**Goal**: Automation, predictive analytics, and advanced operational planning.

### 4.1 Crafting Coordination Dashboard
**New Command**: `/crafts [empire]`

Uses real data from: `GET /api/crafts` + `GET /api/crafts/[craftId]/contributions`

```javascript
// GET /api/crafts?empire=[id]
[
  {
    craftId: "craft_5001",
    name: "Legendary Sword Set",
    createdBy: "Master_Smith",
    claimId: "claim_123",
    claimName: "Ironhold Keep",
    percentComplete: 75,
    createdAt: "2026-07-10T14:00:00Z",
    completedAt: "2026-07-10T16:47:00Z",
    contributors: 8,
    public: true
  },
  {
    craftId: "craft_5002",
    name: "Bulk Cloth Production",
    createdBy: "Weaver_Jane",
    claimId: "claim_124",
    claimName: "Riverside Settlement",
    percentComplete: 10,
    createdAt: "2026-07-10T12:30:00Z",
    completedAt: "2026-07-11T16:30:00Z",  // estimated
    contributors: 3,
    public: true
  }
]

// GET /api/crafts/[craftId]/contributions
[
  { contributor: "Master_Smith", quantity: 15 },
  { contributor: "Smith_Jr", quantity: 10 },
  { contributor: "IronJoe", quantity: 8 },
  { contributor: "Crafty_Hands", quantity: 5 },
  { contributor: "Miner_Alice", quantity: 3 }
]
```

**Discord Output**:

```
🔨 Active Crafts (Dream of Serenity — 2 projects)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Legendary Sword Set (NEARLY COMPLETE)
   Location: Ironhold Keep | Crafter: Master_Smith
   Progress: ████████████████░░ 75% | ETA: 2h 15m
   Contributors (8): Master_Smith (15), Smith_Jr (10), IronJoe (8), Crafty_Hands (5), +3 others

📌 Bulk Cloth Production (IN PROGRESS)
   Location: Riverside Settlement | Crafter: Weaver_Jane
   Progress: █░░░░░░░░░░░░░░░░░ 10% | ETA: 28h 0m
   Contributors (3): Weaver_Jane (45 contributions), Spinner_Joe (12), Helper_Bob (3)
   ⚠️ NOTES: Materials currently short on Fiber
```

### 4.2 Resource Planning & Forecasting
**New Command**: `/forecast [resource-name] [timeframe]`

Predict depletion based on consumption rate + active projects:

```javascript
// Create table to track daily resource snapshots
CREATE TABLE resource_snapshots (
  id INTEGER PRIMARY KEY,
  timestamp TIMESTAMP,
  empire_id TEXT,
  item_id TEXT,
  item_name TEXT,
  quantity INT
);

// Track claim inventories daily
CREATE TABLE claim_inventories (
  id INTEGER PRIMARY KEY,
  timestamp TIMESTAMP,
  claim_id TEXT,
  empire_id TEXT,
  item_id TEXT,
  item_name TEXT,
  quantity INT
);
```

**Algorithm**:
1. Collect daily snapshots of key resources for 14 days
2. Calculate daily velocity: (qty_today - qty_yesterday) / 1 day
3. Linear regression to project depletion date
4. Check active construction projects that consume this resource

**Discord Output** (realistic):

```
📉 Copper Ore Forecast (Dream of Serenity)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current Stock: 1,200 units
Stored Locations: Ironhold Keep (800), Riverside (400)

📊 Historical Consumption
  7-day avg: -85 units/day (mining: +120, crafting: -205)
  Trend: Accelerating usage ↗

⚠️ Active Consumers
  • Bulk Ingot Smelting: -80 units/day
  • Crafty_Hands (personal): -65 units/day
  • Legendary Sword Set craft: -60 units/day

🔮 Depletion Forecast
  At current rate (-85/day): 14 days until empty
  Depletion date: July 24, 2026

✅ Recommendations
  → Increase mining by 30% (add 2 more miners to team)
  → Or reduce crafting batch sizes
  → Or find trade partner (market price: 1.2 shards, plenty available)
```

### 4.3 Member Activity Heatmap
**New Command**: `/activity-report [days]`

Track member engagement using `lastLoginTimestamp` from sync data:

```sql
CREATE TABLE member_activity (
  id INTEGER PRIMARY KEY,
  timestamp TIMESTAMP,
  empire_id TEXT,
  character_id TEXT,
  player_name TEXT,
  last_login TIMESTAMP,
  playtime_total INT,
  equipment_changed BOOLEAN
);
```

**Discord Output**:

```
👥 Activity Report — Last 7 Days (Dream of Serenity)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Member              Status    Last Login   Playtime   Trend
─────────────────────────────────────────────────────────
Master_Smith        🟢 ONLINE 5 min ago    48h 22m    ↗ Very Active
IronJoe             🟢 ONLINE 1h 30m ago  39h 45m    ↗ Active
Crafty_Hands        🟡 IDLE   8h ago      12h 12m    → Moderate
Weaver_Jane         🟡 AWAY   2 days ago   8h 30m    ↘ Idle
Novice_Miller       🔴 GONE   5 days ago   45m       ⚠️ Inactive
Smith_Jr            🔴 GONE  10 days ago   4h        ⚠️ Disappeared

Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Active (last 24h): 4 members
🟡 Idle (1-3 days): 1 member
🔴 Inactive (3+ days): 2 members (at risk of churn!)

Retention Risk: 1 member gone >7 days — consider outreach!
```

### 4.4 Skill Growth Tracking
**New Command**: `/skill-growth [player] [skill]`

Track XP progression over time:

```sql
CREATE TABLE skill_snapshots (
  id INTEGER PRIMARY KEY,
  timestamp TIMESTAMP,
  character_id TEXT,
  skill_id TEXT,
  skill_name TEXT,
  xp INT,
  level INT
);
```

Uses level calculation from `/static/experience/levels.json` (already in your code as `experienceLevels.js`).

**Discord Output**:

```
📊 Smithing Progress — Master_Smith
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current: Level 42 (654,000 XP)
Next Level: Level 43 — need 50,000 more XP

📈 Weekly Velocity: +42,000 XP/week
⏱️ ETA to Level 43: ~1.2 weeks (by July 17)

Daily XP Activity (last 7 days):
  Mon: +5,200 XP  ████
  Tue: +6,100 XP  █████
  Wed: +5,800 XP  ████░
  Thu: +6,500 XP  █████░
  Fri: +7,200 XP  █████░█
  Sat: +6,300 XP  █████░
  Sun: +3,900 XP  ███

Comparison: Empire average at Smithing is Level 38 (you're +4 levels ahead! 🏆)
```

### 4.5 Guild Quest Tracker
**New Command**: `/quests [empire]`

Uses: `GET /api/players/[id]/traveler-tasks` per each member

```javascript
// GET /api/players/[id]/traveler-tasks
[
  {
    taskId: "task_001",
    name: "Gather Rare Ores",
    description: "Collect 10 units of rare ore",
    progress: 7,
    target: 10,
    reward: { xp: 5000, items: ["rare_chest"] }
  },
  {
    taskId: "task_002",
    name: "Craft 50 Swords",
    description: "Contribute to 50 sword crafting projects",
    progress: 23,
    target: 50,
    reward: { xp: 2500, items: ["legendary_sword_blueprint"] }
  }
]
```

**Discord Output**:

```
🎯 Active Traveler Quests (Dream of Serenity)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Master_Smith
  📝 Gather Rare Ores (7/10 complete, 70%)
     Reward: 5,000 XP + Rare Chest
     ETA: ~2 more days
  
  📝 Craft 50 Swords (23/50 complete, 46%)
     Reward: 2,500 XP + Legendary Sword Blueprint
     ETA: ~5 more days (if he keeps crafting)

IronJoe
  📝 Mine 1,000 Coal (428/1000 complete, 43%)
     Reward: 3,000 XP + Coal Cache
     ETA: ~4 more days
  
  📝 Defeat 20 Creatures (12/20 complete, 60%)
     Reward: 1,500 XP + Combat Mastery Tome
     ETA: ~2 more days

Weaver_Jane
  📝 Explore 30 Regions (18/30 complete, 60%)
     Reward: 2,000 XP + Explorer's Map
     ETA: ~5 more days
```

**Deliverable**: Leaders can optimize resource allocation and forecasting; members see personal progression clearly.

---

## 📱 Phase 5: Interactive Tools & UX (Weeks 9–10)

**Goal**: Make the bot feel responsive and customizable.

### 5.1 Persistent Dashboard Embeds
**New Feature**: Subscribe to live-updating embeds

Commands:
- `/watch claim [claim-name]` — pin claim status, refresh every 5 min
- `/watch market [item]` — pin price chart, update every 15 min
- `/watch member [player]` — pin player stats, update every 10 min

**Tech**: Store in `watch_subscriptions` table, background job edits embeds.

### 5.2 Notification System
**New Feature**: Alerts for game-changing events

- Empire member goes inactive (no login 5+ days)
- Key resource depletes below threshold (e.g., < 500 Copper)
- Market price spikes (> 20% above 7-day VWAP)
- Claim upkeep overdue
- Craft completes

Config: `/alerts add member-inactive days:5` — ping @Officer role when anyone inactive

### 5.3 Custom Role Mapping
**New Feature**: Role-based access control

`/admin set-role /set_empire @empire-leaders` — only empire-leaders role can run `/set_empire`

### 5.4 Multi-Empire Support
**Upgrade**: Allow guild to track 2-3 empires simultaneously

`/character [player]` → if player is in 2+ configured empires, ask "Which empire? (1) Dream of Serenity or (2) Mountain Lords?"

---

## 🔐 Phase 6: Infrastructure & Scale (Weeks 11–12)

**Goal**: Production-ready, scalable, secure.

### 6.1 Database Schema Finalization

```sql
-- Core empire tracking
CREATE TABLE empire_members (
  character_id TEXT,
  empire_id TEXT,
  player_name TEXT,
  rank_numeric INT,
  rank_title TEXT,
  total_xp INT,
  donated_shards INT,
  donated_empire_currency INT,
  last_login_at TIMESTAMP,
  time_played INT,
  skill_xp_json TEXT,
  equipment_json TEXT,
  inventory_json TEXT,
  snapshot_at TIMESTAMP,
  last_player_sync_at TIMESTAMP,
  last_equipment_sync_at TIMESTAMP,
  PRIMARY KEY (character_id, empire_id)
);

-- Crafting station tracking
CREATE TABLE claim_stations (
  building_id TEXT PRIMARY KEY,
  claim_id TEXT,
  empire_id TEXT,
  station_type TEXT,  -- Smithing, Carpentry, Tailoring, Masonry, Leatherworking
  station_tier INT,   -- 1-5
  name TEXT,
  inferred_via TEXT,  -- construction / heuristic
  snapshot_at TIMESTAMP
);

-- Market price history
CREATE TABLE market_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TIMESTAMP,
  item_id TEXT,
  item_name TEXT,
  claim_id TEXT,
  lowest_sell REAL,
  highest_buy REAL,
  volume_24h INT,
  vwap_24h REAL
);

-- Indices for performance
CREATE INDEX idx_empire_members_empire_id ON empire_members(empire_id);
CREATE INDEX idx_empire_members_character_id ON empire_members(character_id);
CREATE INDEX idx_market_snapshots_timestamp ON market_snapshots(timestamp DESC);
CREATE INDEX idx_market_snapshots_item_id ON market_snapshots(item_id);
```

### 6.2 Environment Configuration
- [ ] Document all env vars in `.env.example`
- [ ] Support dev/staging/production via `NODE_ENV`
- [ ] Validate all required vars on startup

### 6.3 Logging & Monitoring
- [ ] Structured JSON logging with timestamps
- [ ] Track sync cycles (duration, members synced, errors)
- [ ] API quota tracking (calls used vs limit)
- [ ] Error rate per command

### 6.4 Security & Permissions
- [ ] Audit log for admin commands (who ran `/set_empire` and when)
- [ ] Rate-limit user commands (max 10 `/character` lookups/minute)
- [ ] Don't log sensitive data (passwords, API keys)
- [ ] Validate all inputs before DB operations

### 6.5 Performance Optimization
- [ ] Cache API responses (TTL: skills 1h, items 30m, empires 10m)
- [ ] Batch DB queries (insert multiple members in one transaction)
- [ ] Profile sync cycles; log slowest operations
- [ ] Connection pooling for SQLite (if scaling beyond single bot)

---

## 🧪 Testing Strategy

### Phase 1 Testing
- Verify equipment syncs within 10 min of player change
- No case-sensitivity errors on Linux
- 24h continuous run without crashes

### Phase 2+ Testing
- **Unit Tests**: Mock Bitcraft API responses, test formatting
- **Integration Tests**: Full sync cycle with real test empire
- **Load Tests**: Simulate 50+ empires syncing concurrently
- **UAT**: Beta test with real Bitcraft guilds

---

## 📅 Timeline & Effort

| Phase | Name | Duration | Effort | Priority |
|-------|------|----------|--------|----------|
| 1 | Bug Fixes | Week 1 | 10h | 🔴 CRITICAL |
| 2 | Empire Intelligence | Weeks 2–3 | 30h | 🔴 HIGH |
| 3 | Market Intelligence | Weeks 4–5 | 25h | 🟠 HIGH |
| 4 | Advanced Features | Weeks 6–8 | 35h | 🟡 MEDIUM |
| 5 | Interactive Tools | Weeks 9–10 | 20h | 🟡 MEDIUM |
| 6 | Infrastructure | Weeks 11–12 | 25h | 🟢 LOW |

**Total**: ~145 hours over 12 weeks.

---

## 🔗 Real API Endpoints Used by Phase

| Phase | Endpoints | Call Count / Cycle |
|-------|-----------|-------------------|
| 0 (Current) | `/api/empires/[id]`, `/api/empires/[id]/claims`, `/api/players/[id]`, `/api/players/[id]/equipment`, `/api/players/[id]/inventories`, `/api/claims/[id]/buildings` | ~50 calls |
| 2 | + `/api/claims/[id]`, `/api/claims/[id]/citizens`, `/api/claims/[id]/crafts`, `/api/claims/[id]/construction`, `/api/claims/{id}/market/listings`, `/api/leaderboard/skills`, `/api/leaderboard/playtime` | +40 calls |
| 3 | + `POST /api/market/prices/bulk`, `/api/market/[item]/[itemId]/price-history`, `/api/claims/{id}/market/listings` (more claims), `/api/leaderboard/items/[itemId]` | +60 calls |
| 4 | + `/api/crafts`, `/api/crafts/[craftId]/contributions`, `/api/players/[id]/passive-crafts`, `/api/players/[id]/traveler-tasks`, `/api/players/[id]/buffs` | +30 calls |
| 5 | Real-time updates (no new endpoints, just more frequent calls) | ~50 calls |
| **Total Phases 0-4** | **All above** | **~210 calls/cycle** ⚠️ |

**Note**: This exceeds 200/min cap! **Solution**: Cache aggressively (market prices 15min, leaderboards 30min, construction 5min) to spread calls.

---

## 🎯 Success Metrics

**Phase 1**: Equipment syncs work, zero crashes 24h  
**Phase 2**: `/claim-status` takes <2s, leaderboards accurate  
**Phase 3**: Arbitrage deals verified profitable, prices update reliably  
**Phase 4**: Forecasts match actual depletion dates (calibrated), retention tracking motivates gameplay  
**Phase 5**: Watch embeds update reliably, alerts hit users  
**Phase 6**: Handles 100+ guilds, all queries execute <100ms p95

---

**Next Steps**: Start Phase 1 this week. Ship bug fixes by EOW.  
**Questions**: Check the issue tracker or reach out.

**Version**: 1.0 (Accurate, Truth-Based)  
**Last Updated**: 2026-07-10
