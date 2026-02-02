# Supply Chain Cost Allocation & Transfer Pricing Engine

## Interview Exercise Documentation

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Requirements Analysis](#requirements-analysis)
3. [Design & Architecture](#design--architecture)
4. [Implementation Details](#implementation-details)
5. [Algorithms & Data Structures](#algorithms--data-structures)
6. [Bonus Features](#bonus-features)
7. [Test Results](#test-results)
8. [Code Walkthrough](#code-walkthrough)
9. [Complexity Analysis](#complexity-analysis)
10. [Potential Improvements](#potential-improvements)

---

## Problem Statement

Build a cost calculation engine for a global manufacturing company that computes the **fully-loaded cost** of every product across multiple factories. The system must handle:

- **Recursive Bill of Materials (BOM)** - Products composed of components, which are composed of other components
- **Inter-entity transfers** - Goods moving between legal entities with transfer pricing
- **Time-phased costing** - Costs varying by period with lookback calculations
- **Allocation rules with dependencies** - Rules that must execute in a specific order
- **Multi-currency support** - Converting costs between currencies
- **Audit trail** - Tracking all decisions and contributions

### Input Data (9 Interconnected Datasets)

1. **Bill of Materials** - Recursive product composition with scrap rates
2. **Entities** - Legal entities (manufacturing, distribution, IP holders)
3. **Transfer Routes** - How goods/services flow between entities
4. **Period Costs** - Time-series costs for materials and labor
5. **Exchange Rates** - Currency conversion rates by period
6. **Allocation Rules** - Rules with execution dependencies
7. **Production Volumes** - For allocation calculations
8. **Cost Pools** - R&D and other overhead pools
9. **Standard Costs** - For variance calculation

### Expected Output

```javascript
{
  costs: {
    "LAPTOP-X1": {
      "MFG-CHINA": {
        breakdown: {
          directMaterial: 262.32,
          directLabor: 16.88,
          laborBurden: 5.91,
          factoryOverhead: 51.32,
          rndAmortization: 11.66,
          royalty: 13.92,
          managementFee: 7.24
        },
        totalCost: 369.24,
        weightedAverageCost: 369.24,
        standardCostVariance: { amount: 84.24, percentage: 0.296 }
      }
    }
  },
  ruleExecutionOrder: ["RULE-001", "RULE-002", ...],
  parallelGroups: [...],
  auditTrail: {...}
}
```

---

## Requirements Analysis

### Core Requirements

| Requirement | Complexity | Key Challenge |
|-------------|------------|---------------|
| BOM Explosion | High | Arbitrary depth recursion, shared components, scrap compounding |
| Rule Dependencies | High | Topological sort, cycle detection, parallel identification |
| Transfer Pricing | Medium | Graph pathfinding, markup calculations, customs duties |
| Time Lookback | Medium | Rolling averages, missing data handling |
| Currency Conversion | Low | Rate lookup, period matching |
| Variance Calculation | Low | Standard vs actual comparison |

### Bonus Requirements

| Bonus Feature | Implementation Approach |
|---------------|------------------------|
| Incremental Recalculation | Dependency tracking with dirty marking |
| What-If Analysis | State cloning with scenario overlays |
| Audit Trail | Event logging with contribution tracking |
| Parallel Execution | Identifying independent rule groups |
| Cycle Resolution | Iterative convergence for circular dependencies |

### Ordering Dependencies

The system must respect these ordering constraints:

```
1. BOM Calculation Order: Leaves → Assemblies → Finished Goods
   PCB-BLANK → BMS-BOARD → BATTERY-PACK → LAPTOP-X1
              ↘ MOTHERBOARD-A ↗

2. Rule Execution Order (Topological):
   RULE-001 ─┬─► RULE-002 ─┬─► RULE-004 → RULE-005 → RULE-006 → ...
             │             │
             └─► RULE-003 ─┘

3. Entity Transfer Order:
   MFG-CHINA → DIST-US (direct)
   MFG-CHINA → MFG-MEXICO → DIST-US (via Mexico)
```

---

## Design & Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CostCalculator (Main Engine)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ BOMProcessor │  │ RuleEngine   │  │ EntityManager        │  │
│  │              │  │              │  │                      │  │
│  │ - explodeBOM │  │ - topo sort  │  │ - findTransferPaths  │  │
│  │ - flatten    │  │ - parallel   │  │ - isCrossBorder      │  │
│  │ - validate   │  │   groups     │  │ - getRoute           │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ CostState    │  │ AuditTrail   │  │ CurrencyConverter    │  │
│  │              │  │              │  │                      │  │
│  │ - costs map  │  │ - events     │  │ - convert            │  │
│  │ - rule outs  │  │ - contribs   │  │ - getPriorPeriods    │  │
│  │ - dirty set  │  │              │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     Graph (Utility)                       │  │
│  │  - detectCycles()  - topologicalSort()  - findAllPaths() │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Calculation Flow

```
Phase 1: PARSE & VALIDATE
├── Build BOM graph, detect cycles
├── Build rule dependency graph, topological sort
└── Build transfer route graph

Phase 2: BASE COST CALCULATION (Recursive BOM)
└── For each product in leaf-to-root order:
    ├── If raw material: lookup period cost
    └── If assembly: sum component costs × quantity × scrap multiplier

Phase 3: RULE EXECUTION (Topological Order)
└── For each rule in dependency order:
    ├── RULE-001: Sum components (already done)
    ├── RULE-002: Apply scrap adjustment
    ├── RULE-003: Calculate labor burden (35%)
    ├── RULE-004: Factory overhead (18% of material + labor)
    ├── RULE-005: R&D amortization (pool allocation)
    ├── RULE-006: IP royalty (4% transfer price)
    ├── RULE-007: Management fee (2% transfer price)
    ├── RULE-008: Inter-company markup
    ├── RULE-009: Customs duties (conditional)
    ├── RULE-010: Weighted average (3-period lookback)
    └── RULE-011: Variance calculation

Phase 4: TRANSFER PRICING
└── For each distribution entity:
    ├── Find all paths from manufacturing
    ├── Calculate cost at each hop (markup + duties)
    └── Select optimal path

Phase 5: TIME ADJUSTMENTS
├── Weighted average across lookback periods
└── Currency conversion

Phase 6: VARIANCE CALCULATION
└── Compare to standard costs
```

---

## Implementation Details

### Class Responsibilities

#### `Graph`
Generic graph implementation with:
- Cycle detection (DFS with 3-coloring)
- Topological sort (Kahn's algorithm)
- All-paths finding (DFS with backtracking)

#### `BOMProcessor`
Bill of Materials handler:
- Builds BOM dependency graph
- Validates for cycles
- Computes explosion order (reverse topological sort)
- Memoized BOM explosion
- Material flattening with quantity aggregation

#### `RuleEngine`
Allocation rule orchestrator:
- Builds rule dependency graph
- Validates for cycles
- Computes execution order
- Identifies parallel groups (rules with satisfied dependencies)

#### `EntityManager`
Legal entity and transfer route manager:
- Entity lookup by ID and type
- Transfer path finding between entities
- Cross-border detection

#### `CurrencyConverter`
Multi-currency support:
- Period-based rate lookup
- Nearest period fallback
- Prior period enumeration

#### `CostState`
State management for calculations:
- Cost storage by product/entity/period
- Rule output storage
- Dependency tracking for incremental updates
- Dirty key propagation

#### `AuditTrail`
Audit and debugging support:
- Event logging with timestamps
- Cost contribution tracking per product/entity

#### `CostCalculator`
Main orchestrator that coordinates all components.

---

## Algorithms & Data Structures

### 1. Cycle Detection (DFS 3-Coloring)

```javascript
detectCycles() {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  const cycles = [];

  const dfs = (node, path) => {
    color.set(node, GRAY);  // Mark as "in progress"
    path.push(node);

    for (const neighbor of this.getNeighbors(node)) {
      if (color.get(neighbor) === GRAY) {
        // Back edge found - cycle detected
        const cycleStart = path.indexOf(neighbor);
        cycles.push(path.slice(cycleStart).concat(neighbor));
      } else if (color.get(neighbor) === WHITE) {
        dfs(neighbor, path);
      }
    }

    path.pop();
    color.set(node, BLACK);  // Mark as "completed"
  };

  // Start DFS from each unvisited node
  for (const node of this.getNodes()) {
    if (color.get(node) === WHITE) {
      dfs(node, []);
    }
  }

  return cycles;
}
```

**Time Complexity:** O(V + E) where V = vertices, E = edges

### 2. Topological Sort (Kahn's Algorithm)

```javascript
topologicalSort() {
  const inDegree = new Map();
  const result = [];
  const queue = [];

  // Calculate in-degrees
  for (const node of this.getNodes()) {
    inDegree.set(node, 0);
  }
  for (const node of this.getNodes()) {
    for (const neighbor of this.getNeighbors(node)) {
      inDegree.set(neighbor, inDegree.get(neighbor) + 1);
    }
  }

  // Start with nodes having no dependencies
  for (const [node, degree] of inDegree) {
    if (degree === 0) queue.push(node);
  }

  // Process queue
  while (queue.length > 0) {
    const node = queue.shift();
    result.push(node);

    for (const neighbor of this.getNeighbors(node)) {
      inDegree.set(neighbor, inDegree.get(neighbor) - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (result.length !== this.getNodes().length) {
    throw new Error('Cycle detected');
  }

  return result;
}
```

**Time Complexity:** O(V + E)

### 3. All-Paths Finding (DFS with Backtracking)

```javascript
findAllPaths(start, end, maxDepth = 10) {
  const paths = [];

  const dfs = (current, path, visited) => {
    if (path.length > maxDepth) return;
    if (current === end) {
      paths.push([...path]);
      return;
    }

    for (const edge of this.getNeighbors(current)) {
      if (!visited.has(edge.node)) {
        visited.add(edge.node);
        path.push({ node: edge.node, edge });
        dfs(edge.node, path, visited);
        path.pop();           // Backtrack
        visited.delete(edge.node);
      }
    }
  };

  dfs(start, [{ node: start }], new Set([start]));
  return paths;
}
```

**Time Complexity:** O(V! / (V-d)!) worst case, bounded by maxDepth

### 4. BOM Explosion (Memoized DFS)

```javascript
explodeBOM(productId, depth = 0, visited = new Set()) {
  // Check cache
  if (this.explosionCache.has(productId)) {
    return this.explosionCache.get(productId);
  }

  // Cycle detection
  if (visited.has(productId)) {
    throw new Error(`Circular reference: ${productId}`);
  }
  visited.add(productId);

  const product = this.bom.get(productId);

  // Base case: raw material
  if (!product || product.components.length === 0) {
    return { productId, isRawMaterial: true, components: [] };
  }

  // Recursive case: assembly
  const explodedComponents = product.components.map(component => ({
    ...component,
    explosion: this.explodeBOM(component.itemId, depth + 1, new Set(visited)),
    effectiveQuantity: component.quantity / (1 - component.scrapRate)
  }));

  const result = { productId, isRawMaterial: false, components: explodedComponents };
  this.explosionCache.set(productId, result);
  return result;
}
```

**Time Complexity:** O(N) with memoization, where N = total nodes in BOM

### 5. Incremental Recalculation (Dirty Propagation)

```javascript
markDirty(key) {
  this.dirty.add(key);

  // Propagate to all dependents
  const dependents = this.dependencies.get(key);
  if (dependents) {
    for (const dependent of dependents) {
      this.markDirty(dependent);  // Recursive propagation
    }
  }
}

recalculateIncremental() {
  const dirtyKeys = this.getDirtyKeys();

  // Only recalculate affected items
  for (const key of dirtyKeys) {
    const [productId, entityId, period] = key.split(':');
    this.calculateBaseCost(productId, entityId, period);
  }

  this.clearDirty();
}
```

### 6. Iterative Convergence (Cycle Resolution)

For circular dependencies like royalties based on cost based on royalties:

```javascript
resolveRoyaltyCycle(productId, entityId, period, maxIterations = 10, tolerance = 0.01) {
  let prevCost = 0;
  let currentCost = this.getCost(productId, entityId, period);
  let iterations = 0;

  while (Math.abs(currentCost - prevCost) > tolerance && iterations < maxIterations) {
    prevCost = currentCost;

    // Recalculate with current cost as base
    this.calculateBaseCost(productId, entityId, period);
    this.applyRoyaltyRules(productId, entityId, period);

    currentCost = this.getCost(productId, entityId, period);
    iterations++;
  }

  return {
    converged: Math.abs(currentCost - prevCost) <= tolerance,
    iterations,
    finalCost: currentCost
  };
}
```

---

## Bonus Features

### 1. Incremental Recalculation

When a component cost changes, only affected products are recalculated:

```javascript
// Mark CPU cost as changed
calculator.updateCost('CPU-CHIP', 'MFG-CHINA', '2024-Q4', 1000);

// Only MOTHERBOARD-A and LAPTOP-X1 are recalculated
// (not BATTERY-PACK or BMS-BOARD)
calculator.recalculateIncremental();
```

### 2. What-If Analysis

Run multiple scenarios without affecting base state:

```javascript
const scenarios = {
  'high-cpu-cost': [
    { type: 'cost', itemId: 'CPU-CHIP', value: 1000 }
  ],
  'low-cpu-cost': [
    { type: 'cost', itemId: 'CPU-CHIP', value: 500 }
  ]
};

const results = calculator.whatIf(scenarios);
// Original state unchanged, results contain both scenarios
```

### 3. Audit Trail

Every decision is logged for debugging and compliance:

```javascript
{
  events: [
    { timestamp: 1234567890, event: 'BOM_VALIDATED', details: {...} },
    { timestamp: 1234567891, event: 'RULE_EXECUTION_START', details: {...} }
  ],
  contributions: {
    "LAPTOP-X1:MFG-CHINA": [
      { ruleId: 'BASE', amount: 279.20, description: 'Direct costs' },
      { ruleId: 'RULE-003', amount: 5.91, description: 'Labor burden: 35%' }
    ]
  }
}
```

### 4. Parallel Execution Groups

Rules with satisfied dependencies can run in parallel:

```
Group 1: [RULE-001]           # No dependencies
Group 2: [RULE-002, RULE-003] # Both depend only on RULE-001
Group 3: [RULE-004]           # Depends on RULE-002 AND RULE-003
...
```

### 5. Cycle Resolution

Handles legitimate circular dependencies through iterative convergence:

```javascript
// Royalty depends on cost, cost includes royalty
// Iterate until delta < tolerance
const result = calculator.resolveRoyaltyCycle('LAPTOP-X1', 'MFG-CHINA', '2024-Q4');
// { converged: true, iterations: 3, finalCost: 369.24 }
```

---

## Test Results

### Test Summary

```
═══════════════════════════════════════════════════════════════
                      TEST SUMMARY
═══════════════════════════════════════════════════════════════
  Passed: 28
  Failed: 0
  Total:  28
```

### Test Categories

| Category | Tests | Status |
|----------|-------|--------|
| Graph - Cycle Detection | 2 | ✓ |
| Graph - Topological Sort | 2 | ✓ |
| Graph - Path Finding | 1 | ✓ |
| BOM Processor | 4 | ✓ |
| Full Calculation Pipeline | 3 | ✓ |
| Cost Components | 4 | ✓ |
| Transfer Pricing | 2 | ✓ |
| Currency Conversion | 1 | ✓ |
| Variance Calculation | 1 | ✓ |
| Audit Trail | 2 | ✓ |
| What-If Analysis | 1 | ✓ |
| Incremental Recalculation | 2 | ✓ |
| Cycle Resolution | 1 | ✓ |
| Performance | 2 | ✓ |

### Sample Output

```
Cost Breakdown - LAPTOP-X1 @ MFG-CHINA (USD):
  Direct Material:     $262.32
  Direct Labor:        $16.88
  Labor Burden:        $5.91
  Factory Overhead:    $51.32
  R&D Amortization:    $11.66
  IP Royalty:          $13.92
  Management Fee:      $7.24
  ────────────────────────────
  Total Cost:          $369.24
  Weighted Avg Cost:   $369.24
  Variance:            +$84.24 (29.6%)
```

### Performance Results

```
Full calculation: 1ms
10 what-if scenarios: 8ms
```

---

## Code Walkthrough

### Entry Point: `calculate()`

```javascript
calculate(options = {}) {
  const { period, targetCurrency, targetEntity, products } = options;

  // Phase 1: Get products in dependency order (leaf to root)
  const explosionOrder = this.bomProcessor.getExplosionOrder()
    .filter(p => productIds.includes(p));

  // Phase 2: Calculate base costs for all products
  for (const productId of explosionOrder) {
    for (const entity of this.entityManager.getManufacturingEntities()) {
      this.calculateBaseCost(productId, entity.id, period, targetCurrency);
    }
  }

  // Phase 3: Execute allocation rules in dependency order
  for (const ruleId of this.ruleEngine.getExecutionOrder()) {
    this.executeRule(ruleId, productIds, period, targetCurrency);
  }

  // Phase 4: Calculate transfer pricing
  for (const productId of productIds) {
    for (const distEntity of this.entityManager.getDistributionEntities()) {
      this.calculateTransferPrice(productId, distEntity.id, period, targetCurrency);
    }
  }

  // Phase 5 & 6: Time adjustments and variance
  for (const productId of productIds) {
    this.calculateWeightedAverage(productId, period, targetCurrency);
    this.calculateVariance(productId, period, targetCurrency);
  }

  return results;
}
```

### BOM Cost Calculation

```javascript
calculateBaseCost(productId, entityId, period, targetCurrency) {
  const product = this.bomProcessor.getProduct(productId);
  let directMaterialCost = 0;
  let directLaborCost = 0;

  if (product.components.length === 0) {
    // Raw material - lookup direct cost
    const costData = this.getItemCost(productId, entityId, period);
    directMaterialCost = this.currencyConverter.convert(
      costData.unit, costData.currency, targetCurrency, period
    );
  } else {
    // Assembly - sum component costs with scrap adjustment
    for (const component of product.components) {
      const scrapMultiplier = 1 / (1 - component.scrapRate);

      if (component.unit === 'hours') {
        // Labor component
        const laborRate = this.getItemCost(component.itemId, entityId, period);
        directLaborCost += laborRate.unit * component.quantity * scrapMultiplier;
      } else {
        // Material component - get previously calculated cost
        const componentCost = this.costState.getCost(component.itemId, entityId, period);
        directMaterialCost += componentCost.totalCost * component.quantity * scrapMultiplier;
      }
    }
  }

  this.costState.setCost(productId, entityId, period, {
    directMaterial: directMaterialCost,
    directLabor: directLaborCost,
    totalCost: directMaterialCost + directLaborCost
  });
}
```

### Rule Execution

```javascript
applyRule(rule, productId, entityId, period, targetCurrency) {
  const cost = this.costState.getCost(productId, entityId, period);

  switch (rule.type) {
    case 'labor-burden':
      const burden = cost.directLabor * rule.burdenRate;
      cost.laborBurden = burden;
      cost.totalCost += burden;
      break;

    case 'percentage-of-base':
      const baseAmount = this.getBaseAmount(rule.baseRules, cost);
      const overhead = baseAmount * rule.percentage;
      cost.factoryOverhead = overhead;
      cost.totalCost += overhead;
      break;

    case 'transfer-price':
      if (rule.transferType === 'royalty') {
        const royalty = cost.totalCost * this.getRoyaltyRate(entityId);
        cost.royalty = royalty;
        cost.totalCost += royalty;
      }
      break;
    // ... other rule types
  }

  this.costState.setCost(productId, entityId, period, cost);
}
```

---

## Complexity Analysis

### Time Complexity

| Operation | Complexity | Notes |
|-----------|------------|-------|
| BOM Validation | O(V + E) | Single DFS for cycle detection |
| BOM Explosion | O(N) | Memoized, each node visited once |
| Rule Dependency Sort | O(R + D) | R = rules, D = dependencies |
| Base Cost Calculation | O(P × M × C) | P = products, M = mfg entities, C = components |
| Rule Execution | O(R × P × M) | Each rule applied to each product/entity |
| Transfer Pricing | O(P × D × V!) | D = dist entities, bounded by path depth |
| Full Calculation | O(P × M × (C + R)) | Dominated by product/rule combinations |

### Space Complexity

| Structure | Complexity | Notes |
|-----------|------------|-------|
| BOM Graph | O(V + E) | Adjacency list |
| Cost State | O(P × E × T) | Products × Entities × Periods |
| Audit Trail | O(events) | Grows with operations |
| Memoization Cache | O(P) | One entry per product |

---

## Potential Improvements

### Performance
1. **Lazy evaluation** - Only calculate costs when requested
2. **Parallel processing** - Execute independent rule groups concurrently
3. **Streaming results** - Yield results as they're calculated

### Features
1. **Multi-version BOM** - Support effectivity dates for BOM changes
2. **Activity-based costing** - More granular overhead allocation
3. **Cost simulation** - Monte Carlo analysis for cost uncertainty

### Architecture
1. **Event sourcing** - Store cost changes as events for full history
2. **Plugin system** - Custom rule types via extensions
3. **REST API** - Expose calculations as a service

### Data Handling
1. **Batch loading** - Efficient loading of large datasets
2. **Data validation** - Schema validation for all inputs
3. **Missing data strategies** - Configurable fallback behaviors

---

## Conclusion

This implementation demonstrates:

1. **Multi-level recursion** through BOM explosion with memoization
2. **Dependency-ordered execution** via topological sort
3. **Graph algorithms** for cycle detection and path finding
4. **Complex business logic** with 11 interacting allocation rules
5. **State management** for incremental recalculation
6. **Production-ready patterns** including audit trails and what-if analysis

The solution processes 9 interconnected datasets, respects ordering constraints, and provides both correctness (28 passing tests) and performance (full calculation in ~1ms).
