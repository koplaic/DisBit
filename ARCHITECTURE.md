# DisBit Architecture v2

**Status**: Blueprint (ready for implementation)  
**Created**: 2026-07-11  
**Scope**: Complete redesign with clean separation of concerns

---

## 🏗️ Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Discord.js Bot (main.js)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │  Command Layer   │  │  Auto-Sync Cycle │  │ Alert System     │ │
│  │  (/commands)     │  │  (/sync/index.js)│  │ (/alerts)        │ │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘ │
│           │                     │                      │            │
│           └─────────────────────┼──────────────────────┘            │
│                                 │                                   │
│           ┌─────────────────────▼────────────────────┐             │
│           │    Service Layer (/services)             │             │
│           │  - ClaimsService                         │             │
│           │  - MembersService                        │             │
│           │  - InventoryService                      │             │
│           │  - MarketService                         │             │
│           │  - etc.                                  │             │
│           └─────────────────────┬────────────────────┘             │
│                                 │                                   │
│           ┌─────────────────────▼────────────────────┐             │
│           │    Repository Layer (/repos)             │             │
│           │  - ClaimsRepo                            │             │
│           │  - MembersRepo                           │             │
│           │  - InventoryRepo                         │             │
│           │  - etc.                                  │             │
│           └─────────────────────┬────────────────────┘             │
│                                 │                                   │
│           ┌─────────────────────▼────────────────────┐             │
│           │    Data Access Layer (/db)               │             │
│           │  - SQLite Connection Pool                │             │
│           │  - Query Builders                        │             │
│           │  - Schema Migrations                     │             │
│           └─────────────────────┬────────────────────┘             │
│                                 │                                   │
└─────────────────────────────────┼──────────────────────────────────┘
                                  │
                                  │ (3-tier isolation)
                                  │
        ┌─────────────────────────▼────────────────────┐
        │    Bitcraft API Client (/api)                │
        │  - Rate limiter (200/min)                    │
        │  - Error retry logic                         │
        │  - Response parsing                          │
        └─────────────────────────┬────────────────────┘
                                  │
                                  ▼
                        Bitcraft API (live)
```

---

## 📁 File Structure

```
disbit/
├── main.js                          # Bot entry point
├── .env.example                     # Template
├── package.json
├── ROADMAP.md                       # Phase planning
├── ARCHITECTURE.md                  # This file
│
├── api/                             # Bitcraft API Client
│   ├── bitjitaClient.js            # All API calls
│   ├── rateLimiter.js              # 200/min cap enforcement
│   └── errors.js                   # API error types
│
├── db/                              # Data Access Layer
│   ├── sqlite.js                   # Connection + pool
│   ├── migrations/                 # Schema versions
│   │   ├── 001_initial_schema.sql
│   │   └── 002_phase_0_5.sql
│   ├── queryBuilder.js             # SQL helpers
│   └── index.js                    # Initialize all tables
│
├── repos/                           # Repository Layer
│   ├── ClaimsRepo.js               # Claims CRUD + queries
│   ├── MembersRepo.js              # Empire members
│   ├── InventoryRepo.js            # Item tracking
│   ├── StationsRepo.js             # Station data
│   ├── MarketRepo.js               # Price history
│   └── index.js                    # Export all repos
│
├── services/                        # Business Logic Layer
│   ├── ClaimsService.js            # Claims operations
│   ├── MembersService.js           # Member operations
│   ├── InventoryService.js         # Inventory aggregation
│   ├── MarketService.js            # Price analysis
│   ├── StationService.js           # Station classification
│   └── index.js                    # Export all services
│
├── sync/                            # Auto-Sync Orchestration
│   ├── index.js                    # Main sync cycle (10min)
│   ├── syncClaims.js               # Step 1: Fetch claims metadata
│   ├── syncMembers.js              # Step 2: Fetch empire members
│   ├── syncEquipment.js            # Step 3: Fetch player equipment
│   ├── syncStations.js             # Step 4: Classify stations
│   ├── logger.js                   # Structured logging
│   └── errors.js                   # Sync error types
│
├── commands/                        # Discord Commands
│   ├── ping.js
│   ├── set_empire.js
│   ├── members.js
│   ├── character.js
│   ├── inventory.js
│   ├── claims.js                   # NEW
│   ├── claim_status.js             # NEW
│   ├── whereis.js
│   ├── status.js
│   └── index.js                    # Command loader
│
├── alerts/                          # Alert System
│   ├── index.js                    # Alert daemon
│   ├── memberInactivity.js         # Inactive detection
│   ├── resourceAlert.js            # Low resource warning
│   └── priceSpike.js               # Market alerts
│
├── config/                          # Configuration
│   ├── guildSettings.js            # Guild → Empire mapping
│   ├── categories.js               # Item categories
│   └── levels.js                   # Experience levels
│
├── utils/                           # Shared Utilities
│   ├── formatting.js               # Discord embeds
│   ├── time.js                     # Date/time helpers
│   ├── validation.js               # Input sanitization
│   └── cache.js                    # TTL cache wrapper
│
└── __tests__/                       # Test Suite (future)
    ├── api.test.js
    ├── repos.test.js
    ├── services.test.js
    └── sync.test.js
```

---

## 🔄 Data Flow

### Sync Cycle (10-minute auto-run)

```
START (10-minute interval)
  │
  ├─→ syncClaims.js
  │    ├─ GET /api/empires/[id]/claims
  │    ├─ GET /api/claims/[id] (per claim)
  │    ├─ GET /api/claims/[id]/citizens (per claim)
  │    ├─ GET /api/claims/[id]/construction (per claim)
  │    └─ ClaimsRepo.upsertClaim() × N
  │
  ├─→ syncMembers.js
  │    ├─ GET /api/empires/[id]/members
  │    └─ MembersRepo.upsertMember() × N
  │
  ├─→ syncEquipment.js
  │    ├─ GET /api/players/[id]/equipment (per member)
  │    ├─ GET /api/players/[id]/inventories (per member)
  │    └─ InventoryRepo.upsertSnapshot() × N
  │
  ├─→ syncStations.js
  │    ├─ GET /api/claims/[id]/buildings (per claim)
  │    ├─ Use cached /api/claims/[id]/construction from step 1
  │    ├─ StationService.classifyStation() (construction-driven)
  │    └─ StationsRepo.upsertStation() × M
  │
  └─→ LOG & SCHEDULE NEXT (in 10 min)

Error handling: Try-catch per step; log error; continue next step
Rate limiting: Spreads calls across 10-minute window
```

### Command Execution Flow

```
User: /character Master_Smith
  │
  ├─→ Command Handler (/commands/character.js)
  │    ├─ Validate input
  │    ├─ Get guildId → find configured empire
  │    └─ Call MembersService.getCharacterProfile()
  │
  ├─→ Service Layer (MembersService.js)
  │    ├─ MembersRepo.getByName(playerName)
  │    ├─ InventoryService.getPlayerInventory(characterId)
  │    ├─ MarketService.getPlayerHoldings(characterId) [future]
  │    └─ Format response data
  │
  ├─→ Repository Layer
  │    └─ Direct DB queries with QueryBuilder helpers
  │
  └─→ Format & Send Discord Embed
       └─ Use formatting.js for consistent styling
```

---

## 📦 Layer Responsibilities

### API Layer (`/api`)
**Purpose**: All Bitcraft API communication  
**Exports**: Async functions, one per endpoint  
**Error Handling**: Retry logic (exponential backoff), rate limit awareness

```javascript
// api/bitjitaClient.js
async function getEmpireClaims(empireId) { ... }
async function getClaimById(claimId) { ... }
async function getClaimCitizens(claimId) { ... }
// ... one function per endpoint
```

**Never**: Parse data, write to DB, throw unhandled errors

---

### Database Layer (`/db`)
**Purpose**: SQLite connection, schema, migrations  
**Exports**: Initialized connection pool, QueryBuilder class

```javascript
// db/sqlite.js
module.exports = {
  query: async (sql, params) => { ... },  // Execute raw SQL
  exec: async (sql) => { ... },           // Batch operations
  close: async () => { ... }
};

// db/queryBuilder.js
class QueryBuilder {
  select(table) { ... }
  where(field, op, value) { ... }
  orderBy(field, dir) { ... }
  limit(n) { ... }
  build() { return { sql, params }; }
}
```

**Never**: Business logic, caching, duplicate connection pools

---

### Repository Layer (`/repos`)
**Purpose**: Data access abstraction (CRUD + common queries)  
**Exports**: Classes with async methods

```javascript
// repos/ClaimsRepo.js
class ClaimsRepo {
  async upsertClaim(row) { ... }
  async getClaimsForEmpire(empireId) { ... }
  async getClaimById(claimId) { ... }
  async getClaimCitizens(claimId) { ... }
  async deleteOutdatedSnapshots(olderThan) { ... }
}
module.exports = new ClaimsRepo();
```

**Never**: Call API, format for display, contain business logic

---

### Service Layer (`/services`)
**Purpose**: Business logic, orchestration, data transformation  
**Exports**: Classes with async methods

```javascript
// services/StationService.js
class StationService {
  classifyStation(building, constructionProjects) {
    // Parse construction recipe ID → station type/tier
    // Fall back to heuristic if needed
    // Return { stationType, stationTier, confidence }
  }

  async getStationsForClaim(claimId) {
    // Use StationsRepo.getStationsForClaim()
    // Group by type, sort by tier
    // Return organized structure
  }
}
```

**Never**: Write to DB directly, call API, format Discord messages

---

### Sync Layer (`/sync`)
**Purpose**: Orchestrate multi-step data collection  
**Files**: One per logical step + main orchestrator

```javascript
// sync/index.js
async function runSyncCycle() {
  const empires = getConfiguredEmpires();
  for (const empire of empires) {
    await syncClaims(empire.id);      // Step 1
    await syncMembers(empire.id);     // Step 2
    await syncEquipment(empire.id);   // Step 3
    await syncStations(empire.id);    // Step 4
  }
  scheduleNextCycle(10 * 60 * 1000);  // 10 min
}
```

**Error handling**: Log per step; continue if one fails  
**Logging**: Structured JSON with timestamps, empire ID, counts

---

### Command Layer (`/commands`)
**Purpose**: User interaction handlers  
**Exports**: `{ data, execute }`

```javascript
// commands/character.js
module.exports = {
  data: new SlashCommandBuilder()
    .setName('character')
    .setDescription('...')
    .addStringOption(...),
  
  async execute(interaction) {
    // 1. Validate & get empire ID
    // 2. Call service
    // 3. Format embed
    // 4. Send
  }
};
```

**Never**: Query DB directly, call API directly, log sensitive data

---

## 🗄️ Database Schema

### Core Tables

```sql
-- Empires (reference only, not synced)
CREATE TABLE empires (
  empire_id TEXT PRIMARY KEY,
  name TEXT,
  snapshot_at TIMESTAMP
);

-- Claims (Phase 0.5: NEW as first-class entity)
CREATE TABLE claims (
  claim_id TEXT PRIMARY KEY,
  empire_id TEXT NOT NULL,
  name TEXT NOT NULL,
  region_id INTEGER,
  region_name TEXT,
  owner_id TEXT,
  settlement BOOLEAN,
  upkeep INTEGER,
  supply INTEGER,
  supply_capacity INTEGER,
  rank INTEGER,
  built_at TEXT,
  snapshot_at TIMESTAMP NOT NULL,
  FOREIGN KEY (empire_id) REFERENCES empires(empire_id),
  INDEX idx_empire_id (empire_id)
);

-- Claim Citizens
CREATE TABLE claim_citizens (
  claim_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  player_name TEXT,
  is_citizen BOOLEAN DEFAULT 1,
  last_seen_at TIMESTAMP,
  snapshot_at TIMESTAMP NOT NULL,
  PRIMARY KEY (claim_id, character_id),
  FOREIGN KEY (claim_id) REFERENCES claims(claim_id),
  INDEX idx_character_id (character_id)
);

-- Empire Members
CREATE TABLE empire_members (
  character_id TEXT PRIMARY KEY,
  empire_id TEXT NOT NULL,
  player_name TEXT,
  rank_numeric INTEGER,
  rank_title TEXT,
  total_xp INTEGER,
  donated_shards INTEGER,
  last_login_at TIMESTAMP,
  playtime_seconds INTEGER,
  skill_xp_json TEXT,
  equipment_json TEXT,
  inventory_json TEXT,
  home_claim_id TEXT,
  snapshot_at TIMESTAMP NOT NULL,
  last_player_sync_at TIMESTAMP,
  last_equipment_sync_at TIMESTAMP,
  FOREIGN KEY (empire_id) REFERENCES empires(empire_id),
  FOREIGN KEY (home_claim_id) REFERENCES claims(claim_id),
  INDEX idx_empire_id (empire_id)
);

-- Stations (classified from buildings)
CREATE TABLE stations (
  building_id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  empire_id TEXT NOT NULL,
  station_type TEXT NOT NULL,    -- Smithing, Carpentry, Tailoring, etc.
  station_tier INTEGER NOT NULL, -- 1-5
  name TEXT,
  inferred_via TEXT,             -- 'construction' or 'heuristic'
  snapshot_at TIMESTAMP NOT NULL,
  FOREIGN KEY (claim_id) REFERENCES claims(claim_id),
  FOREIGN KEY (empire_id) REFERENCES empires(empire_id),
  INDEX idx_claim_id (claim_id),
  INDEX idx_empire_id (empire_id)
);

-- Inventory Snapshots (per member per claim)
CREATE TABLE inventory_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id TEXT NOT NULL,
  claim_id TEXT,
  inventory_json TEXT,
  snapshot_at TIMESTAMP NOT NULL,
  FOREIGN KEY (character_id) REFERENCES empire_members(character_id),
  FOREIGN KEY (claim_id) REFERENCES claims(claim_id),
  INDEX idx_character_id (character_id),
  INDEX idx_claim_id (claim_id),
  INDEX idx_snapshot_at (snapshot_at DESC)
);

-- Market Price Snapshots (for Phase 3)
CREATE TABLE market_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL,
  item_name TEXT,
  lowest_sell REAL,
  highest_buy REAL,
  sell_order_count INTEGER,
  buy_order_count INTEGER,
  volume_24h INTEGER,
  vwap_24h REAL,
  snapshot_at TIMESTAMP NOT NULL,
  INDEX idx_item_id (item_id),
  INDEX idx_snapshot_at (snapshot_at DESC)
);

-- Guild Settings (Discord <→ Empire mapping)
CREATE TABLE guild_settings (
  guild_id TEXT PRIMARY KEY,
  empire_id TEXT NOT NULL,
  empire_name TEXT,
  alert_channel_id TEXT,
  configured_at TIMESTAMP NOT NULL,
  UNIQUE (guild_id, empire_id)
);
```

---

## 🚀 Implementation Order

### Week 1: Foundation
- [ ] Create `/api`, `/db`, `/repos` layer structure
- [ ] Implement bitjitaClient v2 with all real endpoints
- [ ] Create schema migrations
- [ ] Implement ClaimsRepo, MembersRepo, StationsRepo
- [ ] Write unit tests for repos with mock DB

### Week 2: Services & Sync
- [ ] Implement all services (Claims, Members, Inventory, Market, Station)
- [ ] Implement sync orchestrator with proper error handling
- [ ] Add structured logging to sync pipeline
- [ ] Integration test with real Bitcraft API (test empire)
- [ ] Phase 0.5 validation (claims sync works, construction-driven classification)

### Week 3: Commands & Polish
- [ ] Rewrite all 7 existing commands against new service layer
- [ ] Add new commands: `/claims`, `/claim-status`
- [ ] Update `/inventory` with claim filtering
- [ ] Add formatting utilities for consistent embeds
- [ ] Alert system scaffold

### Week 4: Phase 1 Completion
- [ ] Bug fixes from Phase 1 checklist
- [ ] Performance testing (profile sync cycles)
- [ ] 48h continuous run test
- [ ] Document setup & deployment

---

## 🔧 Key Patterns

### Error Handling
```javascript
// services/ClaimsService.js
try {
  const claims = await bitjitaClient.getEmpireClaims(empireId);
  for (const claim of claims) {
    try {
      await this.processClaim(claim);
    } catch (err) {
      logger.error('Failed to process claim', { claimId: claim.id, error: err.message });
      // Continue with next claim
    }
  }
} catch (err) {
  logger.error('Fatal: failed to fetch claims', { empireId, error: err.message });
  throw err; // Sync step fails; orchestrator catches & logs
}
```

### Logging
```javascript
// sync/logger.js
logger.info('sync_start', {
  empire_id: empireId,
  empire_name: empireName,
  timestamp: new Date().toISOString()
});

logger.info('sync_claims_complete', {
  empire_id: empireId,
  claims_synced: 5,
  duration_ms: 2340,
  timestamp: new Date().toISOString()
});

logger.error('sync_failed', {
  empire_id: empireId,
  step: 'syncEquipment',
  error_code: 429,
  error_message: 'Rate limited',
  timestamp: new Date().toISOString()
});
```

### Testing Pattern
```javascript
// __tests__/services.test.js
jest.mock('../api/bitjitaClient');
jest.mock('../repos');

describe('StationService', () => {
  it('classifies stations using construction data', () => {
    const building = { entityId: 'b1', buildingName: 'Smithing' };
    const construction = [{
      buildingId: 'b1',
      recipeId: 'recipe_smithing_station_t3',
      percentComplete: 0.5
    }];
    
    const result = StationService.classifyStation(building, construction);
    expect(result.stationType).toBe('Smithing');
    expect(result.stationTier).toBe(3);
    expect(result.inferred_via).toBe('construction');
  });
});
```

---

## ✅ Success Criteria

**Clean rewrite is complete when**:
- [ ] All 7 existing commands work identically to current version
- [ ] Sync cycle runs without errors for 48 consecutive hours
- [ ] New `/claims` and `/claim-status` commands work
- [ ] Station classification is 100% construction-driven (no heuristics needed)
- [ ] Database tests pass with 90%+ coverage
- [ ] Integration tests pass with mock Bitcraft API
- [ ] Architecture document is referenced in code comments
- [ ] Zero technical debt issues blocking Phase 2

---

## 📝 Notes

- **No breaking changes to API clients**: All existing guild configurations work after migration
- **Backward compatibility**: Old database backed up; migration script runs at startup
- **Performance target**: Full sync cycle < 15 seconds (currently ~47s with naive implementation)
- **Extensibility**: Adding new command = 1 file in `/commands` + 1 service method
- **Monitoring**: Every sync cycle produces structured logs for alerting/dashboards

---

**Next Steps**:
1. Review this architecture document
2. Greenlight → start fresh repository branch OR fresh repo
3. Begin Week 1 implementation

Questions? See ROADMAP.md or open an issue.
