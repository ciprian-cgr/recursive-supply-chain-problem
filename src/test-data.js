/**
 * Test Data for Supply Chain Cost Engine
 */

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
  // Raw materials (no components - base cases)
  { productId: "PCB-BLANK", components: [] },
  { productId: "CPU-CHIP", components: [] },
  { productId: "RAM-MODULE", components: [] },
  { productId: "DISPLAY-15", components: [] },
  { productId: "CELL-18650", components: [] },
  { productId: "IC-PROTECTION", components: [] },
  { productId: "BATTERY-HOUSING", components: [] }
];

const entities = [
  { id: "CORP-HQ", type: "headquarters", country: "US", currency: "USD" },
  { id: "MFG-CHINA", type: "manufacturing", country: "CN", currency: "CNY", parent: "CORP-HQ" },
  { id: "MFG-MEXICO", type: "manufacturing", country: "MX", currency: "MXN", parent: "CORP-HQ" },
  { id: "RND-GERMANY", type: "r&d", country: "DE", currency: "EUR", parent: "CORP-HQ" },
  { id: "DIST-US", type: "distribution", country: "US", currency: "USD", parent: "CORP-HQ" },
  { id: "DIST-EU", type: "distribution", country: "DE", currency: "EUR", parent: "CORP-HQ" },
  { id: "IP-IRELAND", type: "ip_holder", country: "IE", currency: "EUR", parent: "CORP-HQ" }
];

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

const exchangeRates = {
  "2024-Q1": { "CNY/USD": 0.14, "MXN/USD": 0.058, "EUR/USD": 1.08 },
  "2024-Q2": { "CNY/USD": 0.138, "MXN/USD": 0.055, "EUR/USD": 1.07 },
  "2024-Q3": { "CNY/USD": 0.137, "MXN/USD": 0.054, "EUR/USD": 1.09 },
  "2024-Q4": { "CNY/USD": 0.135, "MXN/USD": 0.052, "EUR/USD": 1.10 }
};

const allocationRules = [
  {
    id: "RULE-001",
    name: "Direct Material Cost",
    type: "sum-components",
    appliesTo: { itemType: "all" },
    dependencies: [],
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
    burdenRate: 0.35,
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
    lookbackPeriods: 4,
    appliesTo: { productCategory: "electronics" },
    dependencies: ["RULE-004"],
    priority: 70
  },
  {
    id: "RULE-006",
    name: "IP Royalty",
    type: "transfer-price",
    transferType: "royalty",
    dependencies: ["RULE-005"],
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
    dependencies: ["RULE-007"],
    priority: 40
  },
  {
    id: "RULE-009",
    name: "Customs & Duties",
    type: "conditional",
    conditions: [
      { if: "crossBorder && destCountry == 'US'", rate: 0.025 },
      { if: "crossBorder && destCountry == 'DE'", rate: 0.04 },
      { if: "crossBorder", rate: 0.03 }
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

const standardCosts = {
  "LAPTOP-X1": { "MFG-CHINA": 285.00, "MFG-MEXICO": 310.00, currency: "USD" },
  "MOTHERBOARD-A": { "MFG-CHINA": 165.00, currency: "USD" },
  "BATTERY-PACK": { "MFG-CHINA": 42.00, currency: "USD" },
  "BMS-BOARD": { "MFG-CHINA": 8.50, currency: "USD" }
};

module.exports = {
  billOfMaterials,
  entities,
  transferRoutes,
  periodCosts,
  exchangeRates,
  allocationRules,
  productionVolumes,
  costPools,
  standardCosts
};
