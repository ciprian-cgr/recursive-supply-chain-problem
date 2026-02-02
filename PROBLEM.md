# Interview Problem: Supply Chain Cost Allocation & Transfer Pricing Engine

## Problem Statement

You're building a cost calculation engine for a global manufacturing company. The system must compute the fully-loaded cost of every product across multiple factories, handling recursive bill-of-materials, inter-entity transfers, time-phased costing, and allocation rules that have complex execution dependencies.

---

## Data Inputs (9 Interconnected Datasets)

```javascript
// 1. BILL OF MATERIALS - Recursive product composition
// Products can contain other products, raw materials, or sub-assemblies
const billOfMaterials = [
  { productId: "LAPTOP-X1", components: [
    { itemId: "MOTHERBOARD-A", quantity: 1, scrapRate: 0.02 },
    { itemId: "DISPLAY-15", quantity: 1, scrapRate: 0.05 },
    { itemId: "BATTERY-PACK", quantity: 1, scrapRate: 0.01 },
    { itemId: "ASSEMBLY-LABOR", quantity: 2.5, unit: "hours" }
  ]},
  { productId: "MOTHERBOARD-A", components: [
    { itemId: "PCB-BLANK", quantity: 1, scrapRate: 0.03 },
    { itemId: "CPU-CHIP", quantity: 1, scrapRate: 0.001 },
    { itemId: "RAM-MODULE", quantity: 2, scrapRate: 0.01 },
    { itemId: "SMT-LABOR", quantity: 0.5, unit: "hours" }
  ]},
  { productId: "BATTERY-PACK", components: [
    { itemId: "CELL-18650", quantity: 6, scrapRate: 0.02 },
    { itemId: "BMS-BOARD", quantity: 1, scrapRate: 0.01 },
    { itemId: "BATTERY-HOUSING", quantity: 1, scrapRate: 0.005 },
    { itemId: "PACK-LABOR", quantity: 0.25, unit: "hours" }
  ]},
  { productId: "BMS-BOARD", components: [
    { itemId: "PCB-BLANK", quantity: 1, scrapRate: 0.02 },
    { itemId: "IC-PROTECTION", quantity: 3, scrapRate: 0.005 },
    { itemId: "SMT-LABOR", quantity: 0.1, unit: "hours" }
  ]},
  // Raw materials have no components (base case)
  { productId: "PCB-BLANK", components: [] },
  { productId: "CPU-CHIP", components: [] },
  { productId: "RAM-MODULE", components: [] },
  { productId: "DISPLAY-15", components: [] },
  { productId: "CELL-18650", components: [] },
  { productId: "IC-PROTECTION", components: [] },
  { productId: "BATTERY-HOUSING", components: [] }
];

// 2. ENTITY STRUCTURE - Legal entities with transfer relationships
// Forms a directed graph (may have cycles for royalties)
const entities = [
  { id: "CORP-HQ", type: "headquarters", country: "US", currency: "USD" },
  { id: "MFG-CHINA", type: "manufacturing", country: "CN", currency: "CNY", parent: "CORP-HQ" },
  { id: "MFG-MEXICO", type: "manufacturing", country: "MX", currency: "MXN", parent: "CORP-HQ" },
  { id: "RND-GERMANY", type: "r&d", country: "DE", currency: "EUR", parent: "CORP-HQ" },
  { id: "DIST-US", type: "distribution", country: "US", currency: "USD", parent: "CORP-HQ" },
  { id: "DIST-EU", type: "distribution", country: "DE", currency: "EUR", parent: "CORP-HQ" },
  { id: "IP-IRELAND", type: "ip_holder", country: "IE", currency: "EUR", parent: "CORP-HQ" }
];

// 3. TRANSFER PRICING ROUTES - How goods/services flow between entities
// Creates dependency chains for cost calculations
const transferRoutes = [
  { from: "MFG-CHINA", to: "MFG-MEXICO", itemTypes: ["sub-assembly"], markupType: "cost-plus", markupValue: 0.08 },
  { from: "MFG-CHINA", to: "DIST-US", itemTypes: ["finished-good"], markupType: "resale-minus", markupValue: 0.25 },
  { from: "MFG-MEXICO", to: "DIST-US", itemTypes: ["finished-good"], markupType: "cost-plus", markupValue: 0.12 },
  { from: "MFG-MEXICO", to: "DIST-EU", itemTypes: ["finished-good"], markupType: "cost-plus", markupValue: 0.15 },
  { from: "IP-IRELAND", to: "MFG-CHINA", itemTypes: ["royalty"], markupType: "revenue-percent", markupValue: 0.04 },
  { from: "IP-IRELAND", to: "MFG-MEXICO", itemTypes: ["royalty"], markupType: "revenue-percent", markupValue: 0.04 },
  { from: "RND-GERMANY", to: "IP-IRELAND", itemTypes: ["r&d-service"], markupType: "cost-plus", markupValue: 0.10 },
  { from: "CORP-HQ", to: "MFG-CHINA", itemTypes: ["mgmt-fee"], markupType: "revenue-percent", markupValue: 0.02 },
  { from: "CORP-HQ", to: "MFG-MEXICO", itemTypes: ["mgmt-fee"], markupType: "revenue-percent", markupValue: 0.02 }
];

// 4. TIME-PHASED COSTS - Costs vary by period, some with lookback requirements
const periodCosts = [
  // Raw material costs by period and entity
  { itemId: "PCB-BLANK", entityId: "MFG-CHINA", periods: {
    "2024-Q1": { unit: 12.50, currency: "CNY" },
    "2024-Q2": { unit: 13.20, currency: "CNY" },
    "2024-Q3": { unit: 12.80, currency: "CNY" },
    "2024-Q4": { unit: 14.00, currency: "CNY" }
  }},
  { itemId: "CPU-CHIP", entityId: "MFG-CHINA", periods: {
    "2024-Q1": { unit: 850, currency: "CNY" },
    "2024-Q2": { unit: 820, currency: "CNY" },
    "2024-Q3": { unit: 780, currency: "CNY" },
    "2024-Q4": { unit: 750, currency: "CNY" }
  }},
  { itemId: "RAM-MODULE", entityId: "MFG-CHINA", periods: {
    "2024-Q1": { unit: 180, currency: "CNY" },
    "2024-Q2": { unit: 165, currency: "CNY" },
    "2024-Q3": { unit: 155, currency: "CNY" },
    "2024-Q4": { unit: 150, currency: "CNY" }
  }},
  { itemId: "DISPLAY-15", entityId: "MFG-CHINA", periods: {
    "2024-Q1": { unit: 420, currency: "CNY" },
    "2024-Q2": { unit: 400, currency: "CNY" },
    "2024-Q3": { unit: 385, currency: "CNY" },
    "2024-Q4": { unit: 375, currency: "CNY" }
  }},
  { itemId: "CELL-18650", entityId: "MFG-CHINA", periods: {
    "2024-Q1": { unit: 18, currency: "CNY" },
    "2024-Q2": { unit: 17, currency: "CNY" },
    "2024-Q3": { unit: 16.5, currency: "CNY" },
    "2024-Q4": { unit: 16, currency: "CNY" }
  }},
  { itemId: "IC-PROTECTION", entityId: "MFG-CHINA", periods: {
    "2024-Q1": { unit: 4.5, currency: "CNY" },
    "2024-Q2": { unit: 4.2, currency: "CNY" },
    "2024-Q3": { unit: 4.0, currency: "CNY" },
    "2024-Q4": { unit: 3.8, currency: "CNY" }
  }},
  { itemId: "BATTERY-HOUSING", entityId: "MFG-CHINA", periods: {
    "2024-Q1": { unit: 25, currency: "CNY" },
    "2024-Q2": { unit: 24, currency: "CNY" },
    "2024-Q3": { unit: 23, currency: "CNY" },
    "2024-Q4": { unit: 22, currency: "CNY" }
  }},
  // Labor rates
  { itemId: "ASSEMBLY-LABOR", entityId: "MFG-CHINA", periods: {
    "2024-Q1": { unit: 45, currency: "CNY" },
    "2024-Q2": { unit: 47, currency: "CNY" },
    "2024-Q3": { unit: 48, currency: "CNY" },
    "2024-Q4": { unit: 50, currency: "CNY" }
  }},
  { itemId: "SMT-LABOR", entityId: "MFG-CHINA", periods: {
    "2024-Q1": { unit: 65, currency: "CNY" },
    "2024-Q2": { unit: 68, currency: "CNY" },
    "2024-Q3": { unit: 70, currency: "CNY" },
    "2024-Q4": { unit: 72, currency: "CNY" }
  }},
  { itemId: "PACK-LABOR", entityId: "MFG-CHINA", periods: {
    "2024-Q1": { unit: 40, currency: "CNY" },
    "2024-Q2": { unit: 42, currency: "CNY" },
    "2024-Q3": { unit: 43, currency: "CNY" },
    "2024-Q4": { unit: 45, currency: "CNY" }
  }},
  { itemId: "ASSEMBLY-LABOR", entityId: "MFG-MEXICO", periods: {
    "2024-Q1": { unit: 180, currency: "MXN" },
    "2024-Q2": { unit: 185, currency: "MXN" },
    "2024-Q3": { unit: 190, currency: "MXN" },
    "2024-Q4": { unit: 195, currency: "MXN" }
  }}
];

// 5. EXCHANGE RATES - Time-series with forward rates
const exchangeRates = {
  "2024-Q1": { "CNY/USD": 0.14, "MXN/USD": 0.058, "EUR/USD": 1.08 },
  "2024-Q2": { "CNY/USD": 0.138, "MXN/USD": 0.055, "EUR/USD": 1.07 },
  "2024-Q3": { "CNY/USD": 0.137, "MXN/USD": 0.054, "EUR/USD": 1.09 },
  "2024-Q4": { "CNY/USD": 0.135, "MXN/USD": 0.052, "EUR/USD": 1.10 }
};

// 6. ALLOCATION RULES - Must be executed in dependency order
// Rules can depend on other rules' outputs
const allocationRules = [
  {
    id: "RULE-001",
    name: "Direct Material Cost",
    type: "sum-components",
    appliesTo: { itemType: "all" },
    dependencies: [],  // Base rule - no dependencies
    priority: 100
  },
  {
    id: "RULE-002",
    name: "Scrap Adjustment",
    type: "multiply",
    factor: "1 / (1 - scrapRate)",
    appliesTo: { itemType: "all" },
    dependencies: ["RULE-001"],
    priority: 90
  },
  {
    id: "RULE-003",
    name: "Labor Overhead Allocation",
    type: "labor-burden",
    burdenRate: 0.35,  // 35% burden on labor
    appliesTo: { itemType: "labor" },
    dependencies: ["RULE-001"],
    priority: 90
  },
  {
    id: "RULE-004",
    name: "Factory Overhead",
    type: "percentage-of-base",
    baseRules: ["RULE-002", "RULE-003"],
    percentage: 0.18,
    appliesTo: { entityType: "manufacturing" },
    dependencies: ["RULE-002", "RULE-003"],
    priority: 80
  },
  {
    id: "RULE-005",
    name: "R&D Amortization",
    type: "per-unit-allocation",
    poolId: "RND-POOL-2024",
    allocationBase: "production-volume",
    lookbackPeriods: 4,  // Use 4-quarter rolling average
    appliesTo: { productCategory: "electronics" },
    dependencies: ["RULE-004"],
    priority: 70
  },
  {
    id: "RULE-006",
    name: "IP Royalty",
    type: "transfer-price",
    transferType: "royalty",
    dependencies: ["RULE-005"],  // Royalty based on cost after R&D
    priority: 60
  },
  {
    id: "RULE-007",
    name: "Management Fee Allocation",
    type: "transfer-price",
    transferType: "mgmt-fee",
    dependencies: ["RULE-006"],
    priority: 50
  },
  {
    id: "RULE-008",
    name: "Inter-Company Markup",
    type: "transfer-price",
    transferType: "goods",
    dependencies: ["RULE-007"],  // Apply after all other costs
    priority: 40
  },
  {
    id: "RULE-009",
    name: "Customs & Duties",
    type: "conditional",
    conditions: [
      { if: "crossBorder && destCountry == 'US'", rate: 0.025 },
      { if: "crossBorder && destCountry == 'DE'", rate: 0.04 },
      { if: "crossBorder", rate: 0.03 }  // Default
    ],
    appliesTo: { transferType: "cross-border" },
    dependencies: ["RULE-008"],
    priority: 30
  },
  {
    id: "RULE-010",
    name: "Weighted Average Cost",
    type: "weighted-average",
    weights: { "current": 0.6, "prior-1": 0.25, "prior-2": 0.15 },
    appliesTo: { costingMethod: "weighted-average" },
    dependencies: ["RULE-009"],
    priority: 20
  },
  {
    id: "RULE-011",
    name: "Standard Cost Variance",
    type: "variance-calculation",
    compareAgainst: "standard-cost-table",
    dependencies: ["RULE-010"],
    priority: 10
  }
];

// 7. PRODUCTION VOLUMES - Needed for allocation calculations
const productionVolumes = {
  "2024-Q1": {
    "MFG-CHINA": { "LAPTOP-X1": 50000, "MOTHERBOARD-A": 55000, "BATTERY-PACK": 52000, "BMS-BOARD": 54000 },
    "MFG-MEXICO": { "LAPTOP-X1": 20000 }
  },
  "2024-Q2": {
    "MFG-CHINA": { "LAPTOP-X1": 55000, "MOTHERBOARD-A": 60000, "BATTERY-PACK": 57000, "BMS-BOARD": 59000 },
    "MFG-MEXICO": { "LAPTOP-X1": 25000 }
  },
  "2024-Q3": {
    "MFG-CHINA": { "LAPTOP-X1": 60000, "MOTHERBOARD-A": 65000, "BATTERY-PACK": 62000, "BMS-BOARD": 64000 },
    "MFG-MEXICO": { "LAPTOP-X1": 30000 }
  },
  "2024-Q4": {
    "MFG-CHINA": { "LAPTOP-X1": 70000, "MOTHERBOARD-A": 75000, "BATTERY-PACK": 72000, "BMS-BOARD": 74000 },
    "MFG-MEXICO": { "LAPTOP-X1": 35000 }
  }
};

// 8. COST POOLS - For allocation rules that distribute pools
const costPools = {
  "RND-POOL-2024": {
    entityId: "RND-GERMANY",
    periods: {
      "2024-Q1": { amount: 2500000, currency: "EUR" },
      "2024-Q2": { amount: 2800000, currency: "EUR" },
      "2024-Q3": { amount: 3100000, currency: "EUR" },
      "2024-Q4": { amount: 2900000, currency: "EUR" }
    }
  }
};

// 9. STANDARD COSTS - For variance calculation
const standardCosts = {
  "LAPTOP-X1": { "MFG-CHINA": 285.00, "MFG-MEXICO": 310.00, currency: "USD" },
  "MOTHERBOARD-A": { "MFG-CHINA": 165.00, currency: "USD" },
  "BATTERY-PACK": { "MFG-CHINA": 42.00, currency: "USD" },
  "BMS-BOARD": { "MFG-CHINA": 8.50, currency: "USD" }
};
```

---

## Function Signature

```javascript
function calculateFullyLoadedCosts(
  billOfMaterials,
  entities,
  transferRoutes,
  periodCosts,
  exchangeRates,
  allocationRules,
  productionVolumes,
  costPools,
  standardCosts,
  options = {}
) {
  // options: { period: "2024-Q4", targetCurrency: "USD", entity: "DIST-US" }

  // Returns:
  // {
  //   costs: {
  //     "LAPTOP-X1": {
  //       "MFG-CHINA": {
  //         breakdown: {
  //           directMaterial: 1850.50,
  //           scrapAdjustment: 45.20,
  //           laborBurden: 52.30,
  //           factoryOverhead: 350.40,
  //           rndAmortization: 28.50,
  //           royalty: 95.20,
  //           managementFee: 48.10,
  //           interCompanyMarkup: 0,
  //           customsDuties: 0
  //         },
  //         totalCost: 2470.20,
  //         weightedAverageCost: 2445.80,
  //         standardCostVariance: { amount: -24.20, percentage: -0.0085 },
  //         currency: "USD"
  //       },
  //       "DIST-US": {
  //         // Includes transfer pricing from MFG-CHINA or MFG-MEXICO
  //         breakdown: { ... },
  //         sourceEntity: "MFG-CHINA",
  //         transferRoute: "MFG-CHINA -> DIST-US",
  //         totalCost: 3250.40,
  //         currency: "USD"
  //       }
  //     }
  //   },
  //   ruleExecutionOrder: ["RULE-001", "RULE-002", ...],
  //   warnings: [...],
  //   metadata: { ... }
  // }
}
```

---

## Recursive Challenges

### 1. BOM Explosion (Multi-Level Recursion)
- Products contain components that contain components (arbitrary depth)
- Must handle shared components (PCB-BLANK used in multiple assemblies)
- Scrap rates compound through levels
- Circular reference detection required

### 2. Transfer Route Resolution (Graph Traversal)
- Find optimal route from manufacturing to distribution entity
- Routes may have multiple hops
- Must track accumulated markups and cost transformations per hop
- Detect and handle cycles (legitimate for royalty flows)

### 3. Time-Series Lookback (Temporal Recursion)
- Weighted average cost requires looking back N periods
- R&D amortization uses rolling average of production volumes
- Missing historical data must be handled gracefully
- Period boundaries affect currency conversion

### 4. Rule Dependency Resolution (Topological Sort + Execution)
```
RULE-001 ─┬─► RULE-002 ─┬─► RULE-004 ─► RULE-005 ─► RULE-006 ─► RULE-007 ─► RULE-008 ─► RULE-009 ─► RULE-010 ─► RULE-011
          │             │
          └─► RULE-003 ─┘
```
- Rules must execute in dependency order
- Some rules feed into multiple downstream rules
- Rule execution modifies cost state that later rules read
- Cycle detection required (invalid rule configuration)

### 5. Cost Rollup Through Entity Hierarchy
- Costs calculated at manufacturing must roll up through transfers
- Each entity adds its own overhead/markup
- Currency conversions at each boundary
- Consolidation eliminates inter-company profits

---

## Business Logic Complexity

### Ordering Dependencies
1. **BOM before Costs**: Can't calculate product cost until component costs known
2. **Rules in Dependency Order**: RULE-004 needs RULE-002 and RULE-003 outputs
3. **Transfers after Manufacturing Cost**: Can't price transfer until source cost calculated
4. **Currency Conversion Timing**: Convert at point of transfer or at reporting?
5. **Lookback Resolution**: Historical costs must be finalized before current period weighted average

### Conditional Logic
```javascript
// Customs duty determination (pseudocode)
function calculateCustomsDuty(transfer, cost) {
  if (!isCrossBorder(transfer)) return 0;

  const rules = [
    { condition: dest.country === 'US' && origin.inTradePact('USMCA'), rate: 0 },
    { condition: dest.country === 'US', rate: 0.025 },
    { condition: dest.country === 'DE' && origin.inEU(), rate: 0 },
    { condition: dest.country === 'DE', rate: 0.04 },
    { condition: true, rate: 0.03 }  // Default
  ];

  return cost * findFirstMatchingRule(rules).rate;
}
```

### Edge Cases
- Component cost unavailable for period (use prior period? fail?)
- Production volume is zero (how to allocate R&D pool?)
- Exchange rate missing (interpolate? use nearest?)
- Transfer route doesn't exist (product can't reach entity)
- Rule dependency cycle (configuration error)
- Scrap rate > 1 (invalid data)
- Negative variance thresholds exceeded (trigger alert)

---

## Expected Execution Flow

```
1. PARSE & VALIDATE
   ├── Validate BOM for cycles
   ├── Validate rule dependencies (topological sort)
   └── Validate transfer routes

2. BUILD DEPENDENCY GRAPH
   ├── BOM dependency tree per product
   ├── Rule execution order
   └── Entity transfer paths

3. RESOLVE BASE COSTS (recursive BOM explosion)
   └── For each product (leaf-to-root order):
       └── For each component:
           ├── If raw material: lookup periodCost
           └── If assembly: recurse, then sum adjusted costs

4. EXECUTE ALLOCATION RULES (topological order)
   └── For each rule in sorted order:
       ├── Gather inputs from prerequisite rules
       ├── Apply rule logic
       └── Store results for downstream rules

5. CALCULATE TRANSFER PRICES (path traversal)
   └── For each destination entity:
       └── Find all valid paths from manufacturing
           ├── Calculate cost at each hop
           └── Select optimal path (lowest cost? policy-driven?)

6. APPLY TIME ADJUSTMENTS
   ├── Weighted average across lookback periods
   └── Currency conversion at reporting date

7. CALCULATE VARIANCES
   └── Compare to standard costs

8. CONSOLIDATE & REPORT
```

---

## Evaluation Criteria

| Dimension | What We're Assessing |
|-----------|---------------------|
| **Multi-Level Recursion** | BOM explosion, graph traversal, temporal lookback |
| **Dependency Management** | Topological sort, correct execution order, cycle detection |
| **Data Integration** | Joining 9 datasets correctly, handling missing data |
| **Business Rules** | Transfer pricing, overhead allocation, duty calculation |
| **State Management** | Tracking intermediate results across rule executions |
| **Error Handling** | Cycles, missing data, invalid configurations |
| **Code Architecture** | Separation of concerns, testability, clarity |

---

## Bonus Challenges

1. **Incremental Recalculation**: If one component cost changes, only recalculate affected products
2. **What-If Analysis**: Support hypothetical scenarios (new exchange rate, different route)
3. **Audit Trail**: Track exactly which rules and data contributed to each cost element
4. **Parallel Execution**: Rules with satisfied dependencies can execute concurrently
5. **Cycle Resolution**: Handle legitimate cycles in transfer pricing (royalties based on revenue based on cost based on royalties) using iterative convergence

---

## Time Expectation

This is designed as a **take-home assignment** (4-6 hours) or a **multi-session onsite** (2 x 2-hour sessions).

A strong candidate will:
- Recognize the need for topological sorting
- Implement clean recursive BOM traversal with memoization
- Handle the rule dependency chain correctly
- Address at least 2-3 edge cases
- Write testable, modular code

An exceptional candidate will additionally:
- Implement one or more bonus features
- Identify additional edge cases not listed
- Discuss time/space complexity tradeoffs
- Propose optimizations for scale
