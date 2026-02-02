/**
 * Supply Chain Cost Allocation & Transfer Pricing Engine
 *
 * A sophisticated cost calculation engine handling:
 * - Recursive BOM explosion
 * - Transfer pricing with graph traversal
 * - Time-phased costing with lookbacks
 * - Dependency-ordered rule execution
 * - Multi-currency support
 */

// ============================================================================
// CORE DATA STRUCTURES
// ============================================================================

class Graph {
  constructor() {
    this.adjacencyList = new Map();
  }

  addNode(node) {
    if (!this.adjacencyList.has(node)) {
      this.adjacencyList.set(node, []);
    }
  }

  addEdge(from, to, metadata = {}) {
    this.addNode(from);
    this.addNode(to);
    this.adjacencyList.get(from).push({ node: to, ...metadata });
  }

  getNeighbors(node) {
    return this.adjacencyList.get(node) || [];
  }

  getNodes() {
    return Array.from(this.adjacencyList.keys());
  }

  // Detect cycles using DFS with coloring
  detectCycles() {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map();
    const cycles = [];

    for (const node of this.getNodes()) {
      color.set(node, WHITE);
    }

    const dfs = (node, path) => {
      color.set(node, GRAY);
      path.push(node);

      for (const { node: neighbor } of this.getNeighbors(node)) {
        if (color.get(neighbor) === GRAY) {
          const cycleStart = path.indexOf(neighbor);
          cycles.push(path.slice(cycleStart).concat(neighbor));
        } else if (color.get(neighbor) === WHITE) {
          dfs(neighbor, path);
        }
      }

      path.pop();
      color.set(node, BLACK);
    };

    for (const node of this.getNodes()) {
      if (color.get(node) === WHITE) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  // Topological sort using Kahn's algorithm
  topologicalSort() {
    const inDegree = new Map();
    const result = [];
    const queue = [];

    for (const node of this.getNodes()) {
      inDegree.set(node, 0);
    }

    for (const node of this.getNodes()) {
      for (const { node: neighbor } of this.getNeighbors(node)) {
        inDegree.set(neighbor, (inDegree.get(neighbor) || 0) + 1);
      }
    }

    for (const [node, degree] of inDegree) {
      if (degree === 0) queue.push(node);
    }

    while (queue.length > 0) {
      const node = queue.shift();
      result.push(node);

      for (const { node: neighbor } of this.getNeighbors(node)) {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (result.length !== this.getNodes().length) {
      throw new Error('Cycle detected in dependency graph - topological sort impossible');
    }

    return result;
  }

  // Find all paths between two nodes
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
          path.pop();
          visited.delete(edge.node);
        }
      }
    };

    const visited = new Set([start]);
    dfs(start, [{ node: start, edge: null }], visited);
    return paths;
  }
}

// ============================================================================
// AUDIT TRAIL
// ============================================================================

class AuditTrail {
  constructor() {
    this.entries = [];
    this.costContributions = new Map(); // product -> entity -> rule -> contribution
  }

  log(event, details) {
    this.entries.push({
      timestamp: Date.now(),
      event,
      details
    });
  }

  recordContribution(productId, entityId, ruleId, amount, description) {
    const key = `${productId}:${entityId}`;
    if (!this.costContributions.has(key)) {
      this.costContributions.set(key, []);
    }
    this.costContributions.get(key).push({
      ruleId,
      amount,
      description,
      timestamp: Date.now()
    });
  }

  getContributions(productId, entityId) {
    return this.costContributions.get(`${productId}:${entityId}`) || [];
  }

  getFullTrail() {
    return {
      events: this.entries,
      contributions: Object.fromEntries(this.costContributions)
    };
  }
}

// ============================================================================
// COST STATE MANAGER
// ============================================================================

class CostState {
  constructor() {
    this.costs = new Map(); // product:entity:period -> cost breakdown
    this.ruleOutputs = new Map(); // ruleId:product:entity:period -> output
    this.dependencies = new Map(); // key -> Set of keys that depend on it
    this.dirty = new Set(); // keys that need recalculation
  }

  getCostKey(productId, entityId, period) {
    return `${productId}:${entityId}:${period}`;
  }

  getRuleKey(ruleId, productId, entityId, period) {
    return `${ruleId}:${productId}:${entityId}:${period}`;
  }

  setCost(productId, entityId, period, breakdown) {
    const key = this.getCostKey(productId, entityId, period);
    this.costs.set(key, { ...breakdown, _key: key });
    return key;
  }

  getCost(productId, entityId, period) {
    return this.costs.get(this.getCostKey(productId, entityId, period));
  }

  setRuleOutput(ruleId, productId, entityId, period, output) {
    const key = this.getRuleKey(ruleId, productId, entityId, period);
    this.ruleOutputs.set(key, output);
    return key;
  }

  getRuleOutput(ruleId, productId, entityId, period) {
    return this.ruleOutputs.get(this.getRuleKey(ruleId, productId, entityId, period));
  }

  addDependency(sourceKey, dependentKey) {
    if (!this.dependencies.has(sourceKey)) {
      this.dependencies.set(sourceKey, new Set());
    }
    this.dependencies.get(sourceKey).add(dependentKey);
  }

  markDirty(key) {
    this.dirty.add(key);
    // Propagate to dependents
    const dependents = this.dependencies.get(key);
    if (dependents) {
      for (const dependent of dependents) {
        this.markDirty(dependent);
      }
    }
  }

  getDirtyKeys() {
    return Array.from(this.dirty);
  }

  clearDirty() {
    this.dirty.clear();
  }

  clone() {
    const newState = new CostState();
    newState.costs = new Map(this.costs);
    newState.ruleOutputs = new Map(this.ruleOutputs);
    newState.dependencies = new Map(
      Array.from(this.dependencies.entries()).map(([k, v]) => [k, new Set(v)])
    );
    return newState;
  }
}

// ============================================================================
// BOM PROCESSOR
// ============================================================================

class BOMProcessor {
  constructor(billOfMaterials, auditTrail) {
    this.bom = new Map();
    this.bomGraph = new Graph();
    this.auditTrail = auditTrail;
    this.explosionCache = new Map();

    // Index BOM by product ID
    for (const item of billOfMaterials) {
      this.bom.set(item.productId, item);
      this.bomGraph.addNode(item.productId);
      for (const component of item.components) {
        this.bomGraph.addEdge(item.productId, component.itemId, {
          quantity: component.quantity,
          scrapRate: component.scrapRate || 0,
          unit: component.unit
        });
      }
    }

    // Validate no cycles
    const cycles = this.bomGraph.detectCycles();
    if (cycles.length > 0) {
      throw new Error(`BOM contains cycles: ${cycles.map(c => c.join(' -> ')).join('; ')}`);
    }

    this.auditTrail.log('BOM_VALIDATED', { productCount: billOfMaterials.length });
  }

  // Get explosion order (leaves first, then assemblies)
  getExplosionOrder() {
    // Reverse topological sort gives us leaf-to-root order
    return this.bomGraph.topologicalSort().reverse();
  }

  // Explode BOM recursively with memoization
  explodeBOM(productId, depth = 0, visited = new Set()) {
    const cacheKey = productId;
    if (this.explosionCache.has(cacheKey)) {
      return this.explosionCache.get(cacheKey);
    }

    if (visited.has(productId)) {
      throw new Error(`Circular reference detected: ${productId}`);
    }
    visited.add(productId);

    const product = this.bom.get(productId);
    if (!product) {
      return { productId, isRawMaterial: true, components: [], depth };
    }

    if (product.components.length === 0) {
      const result = { productId, isRawMaterial: true, components: [], depth };
      this.explosionCache.set(cacheKey, result);
      return result;
    }

    const explodedComponents = [];
    for (const component of product.components) {
      const childExplosion = this.explodeBOM(component.itemId, depth + 1, new Set(visited));
      explodedComponents.push({
        ...component,
        explosion: childExplosion,
        effectiveQuantity: component.quantity / (1 - (component.scrapRate || 0))
      });
    }

    const result = {
      productId,
      isRawMaterial: false,
      components: explodedComponents,
      depth
    };

    this.explosionCache.set(cacheKey, result);
    return result;
  }

  // Get flat list of all raw materials needed for a product
  getFlattenedMaterials(productId, multiplier = 1) {
    const materials = new Map(); // itemId -> total quantity needed

    const traverse = (itemId, qty) => {
      const product = this.bom.get(itemId);
      if (!product || product.components.length === 0) {
        // Raw material
        materials.set(itemId, (materials.get(itemId) || 0) + qty);
        return;
      }

      for (const component of product.components) {
        const effectiveQty = qty * component.quantity / (1 - (component.scrapRate || 0));
        traverse(component.itemId, effectiveQty);
      }
    };

    traverse(productId, multiplier);
    return materials;
  }

  getProduct(productId) {
    return this.bom.get(productId);
  }

  getAllProducts() {
    return Array.from(this.bom.keys());
  }
}

// ============================================================================
// CURRENCY CONVERTER
// ============================================================================

class CurrencyConverter {
  constructor(exchangeRates) {
    this.rates = exchangeRates;
  }

  convert(amount, fromCurrency, toCurrency, period) {
    if (fromCurrency === toCurrency) return amount;

    const periodRates = this.rates[period];
    if (!periodRates) {
      // Try to find nearest period
      const periods = Object.keys(this.rates).sort();
      const nearestPeriod = periods.reduce((nearest, p) => {
        if (!nearest) return p;
        return Math.abs(this.periodToNumber(p) - this.periodToNumber(period)) <
               Math.abs(this.periodToNumber(nearest) - this.periodToNumber(period))
          ? p : nearest;
      }, null);

      if (nearestPeriod) {
        return this.convert(amount, fromCurrency, toCurrency, nearestPeriod);
      }
      throw new Error(`No exchange rate found for period ${period}`);
    }

    // Convert to USD first, then to target
    let amountInUSD = amount;
    if (fromCurrency !== 'USD') {
      const rateKey = `${fromCurrency}/USD`;
      if (!periodRates[rateKey]) {
        throw new Error(`Missing exchange rate: ${rateKey} for period ${period}`);
      }
      amountInUSD = amount * periodRates[rateKey];
    }

    if (toCurrency === 'USD') return amountInUSD;

    const targetRateKey = `${toCurrency}/USD`;
    if (!periodRates[targetRateKey]) {
      throw new Error(`Missing exchange rate: ${targetRateKey} for period ${period}`);
    }
    return amountInUSD / periodRates[targetRateKey];
  }

  periodToNumber(period) {
    const [year, quarter] = period.split('-Q');
    return parseInt(year) * 4 + parseInt(quarter);
  }

  getPriorPeriods(period, count) {
    const periods = [];
    let [year, quarter] = period.split('-Q').map(Number);

    for (let i = 0; i < count; i++) {
      quarter--;
      if (quarter < 1) {
        quarter = 4;
        year--;
      }
      periods.push(`${year}-Q${quarter}`);
    }

    return periods;
  }
}

// ============================================================================
// ENTITY MANAGER
// ============================================================================

class EntityManager {
  constructor(entities, transferRoutes) {
    this.entities = new Map();
    this.transferGraph = new Graph();

    for (const entity of entities) {
      this.entities.set(entity.id, entity);
      this.transferGraph.addNode(entity.id);
    }

    for (const route of transferRoutes) {
      this.transferGraph.addEdge(route.from, route.to, {
        itemTypes: route.itemTypes,
        markupType: route.markupType,
        markupValue: route.markupValue
      });
    }
  }

  getEntity(entityId) {
    return this.entities.get(entityId);
  }

  getAllEntities() {
    return Array.from(this.entities.values());
  }

  getManufacturingEntities() {
    return this.getAllEntities().filter(e => e.type === 'manufacturing');
  }

  getDistributionEntities() {
    return this.getAllEntities().filter(e => e.type === 'distribution');
  }

  findTransferPaths(fromEntity, toEntity) {
    return this.transferGraph.findAllPaths(fromEntity, toEntity);
  }

  getTransferRoute(fromEntity, toEntity) {
    const neighbors = this.transferGraph.getNeighbors(fromEntity);
    return neighbors.find(n => n.node === toEntity);
  }

  isCrossBorder(fromEntityId, toEntityId) {
    const from = this.getEntity(fromEntityId);
    const to = this.getEntity(toEntityId);
    return from && to && from.country !== to.country;
  }
}

// ============================================================================
// RULE ENGINE
// ============================================================================

class RuleEngine {
  constructor(allocationRules, auditTrail) {
    this.rules = new Map();
    this.ruleGraph = new Graph();
    this.auditTrail = auditTrail;

    // Index rules and build dependency graph
    for (const rule of allocationRules) {
      this.rules.set(rule.id, rule);
      this.ruleGraph.addNode(rule.id);
    }

    for (const rule of allocationRules) {
      for (const depId of (rule.dependencies || [])) {
        this.ruleGraph.addEdge(depId, rule.id);
      }
    }

    // Validate no cycles
    const cycles = this.ruleGraph.detectCycles();
    if (cycles.length > 0) {
      throw new Error(`Rule dependencies contain cycles: ${cycles.map(c => c.join(' -> ')).join('; ')}`);
    }

    this.executionOrder = this.ruleGraph.topologicalSort();
    this.auditTrail.log('RULES_VALIDATED', {
      ruleCount: allocationRules.length,
      executionOrder: this.executionOrder
    });
  }

  getExecutionOrder() {
    return this.executionOrder;
  }

  getRule(ruleId) {
    return this.rules.get(ruleId);
  }

  // Get rules that can execute in parallel (no interdependencies)
  getParallelGroups() {
    const groups = [];
    const executed = new Set();

    while (executed.size < this.rules.size) {
      const group = [];

      for (const ruleId of this.executionOrder) {
        if (executed.has(ruleId)) continue;

        const rule = this.rules.get(ruleId);
        const depsReady = (rule.dependencies || []).every(d => executed.has(d));

        if (depsReady) {
          group.push(ruleId);
        }
      }

      if (group.length === 0) break;

      for (const ruleId of group) {
        executed.add(ruleId);
      }
      groups.push(group);
    }

    return groups;
  }
}

// ============================================================================
// COST CALCULATOR (MAIN ENGINE)
// ============================================================================

class CostCalculator {
  constructor(config) {
    this.auditTrail = new AuditTrail();
    this.costState = new CostState();

    this.bomProcessor = new BOMProcessor(config.billOfMaterials, this.auditTrail);
    this.currencyConverter = new CurrencyConverter(config.exchangeRates);
    this.entityManager = new EntityManager(config.entities, config.transferRoutes);
    this.ruleEngine = new RuleEngine(config.allocationRules, this.auditTrail);

    this.periodCosts = this.indexPeriodCosts(config.periodCosts);
    this.productionVolumes = config.productionVolumes;
    this.costPools = config.costPools;
    this.standardCosts = config.standardCosts;
    this.transferRoutes = config.transferRoutes;

    this.warnings = [];
  }

  indexPeriodCosts(periodCosts) {
    const index = new Map(); // itemId:entityId:period -> cost
    for (const cost of periodCosts) {
      for (const [period, data] of Object.entries(cost.periods)) {
        const key = `${cost.itemId}:${cost.entityId}:${period}`;
        index.set(key, data);
      }
    }
    return index;
  }

  getItemCost(itemId, entityId, period) {
    const key = `${itemId}:${entityId}:${period}`;
    return this.periodCosts.get(key);
  }

  // Main calculation entry point
  calculate(options = {}) {
    const {
      period = '2024-Q4',
      targetCurrency = 'USD',
      targetEntity = null,
      products = null
    } = options;

    this.auditTrail.log('CALCULATION_STARTED', { period, targetCurrency, targetEntity });

    const results = {
      costs: {},
      ruleExecutionOrder: this.ruleEngine.getExecutionOrder(),
      parallelGroups: this.ruleEngine.getParallelGroups(),
      warnings: [],
      metadata: {
        period,
        targetCurrency,
        calculatedAt: new Date().toISOString()
      }
    };

    // Get products to calculate
    const productIds = products || this.bomProcessor.getAllProducts();
    const explosionOrder = this.bomProcessor.getExplosionOrder()
      .filter(p => productIds.includes(p));

    // Phase 1: Calculate base costs for all products (leaf to root)
    this.auditTrail.log('PHASE_1_START', { phase: 'Base Cost Calculation' });
    for (const productId of explosionOrder) {
      for (const entity of this.entityManager.getManufacturingEntities()) {
        this.calculateBaseCost(productId, entity.id, period, targetCurrency);
      }
    }

    // Phase 2: Execute allocation rules in dependency order
    this.auditTrail.log('PHASE_2_START', { phase: 'Rule Execution' });
    for (const ruleId of this.ruleEngine.getExecutionOrder()) {
      this.executeRule(ruleId, productIds, period, targetCurrency);
    }

    // Phase 3: Calculate transfer pricing to distribution entities
    this.auditTrail.log('PHASE_3_START', { phase: 'Transfer Pricing' });
    for (const productId of productIds) {
      for (const distEntity of this.entityManager.getDistributionEntities()) {
        this.calculateTransferPrice(productId, distEntity.id, period, targetCurrency);
      }
    }

    // Phase 4: Calculate weighted averages with lookback
    this.auditTrail.log('PHASE_4_START', { phase: 'Weighted Average' });
    for (const productId of productIds) {
      this.calculateWeightedAverage(productId, period, targetCurrency);
    }

    // Phase 5: Calculate variances
    this.auditTrail.log('PHASE_5_START', { phase: 'Variance Calculation' });
    for (const productId of productIds) {
      this.calculateVariance(productId, period, targetCurrency);
    }

    // Compile results
    for (const productId of productIds) {
      results.costs[productId] = {};

      for (const entity of this.entityManager.getAllEntities()) {
        const cost = this.costState.getCost(productId, entity.id, period);
        if (cost) {
          results.costs[productId][entity.id] = {
            breakdown: { ...cost },
            totalCost: cost.totalCost || 0,
            weightedAverageCost: cost.weightedAverageCost,
            standardCostVariance: cost.variance,
            currency: targetCurrency,
            contributions: this.auditTrail.getContributions(productId, entity.id)
          };
          delete results.costs[productId][entity.id].breakdown._key;
          delete results.costs[productId][entity.id].breakdown.totalCost;
          delete results.costs[productId][entity.id].breakdown.weightedAverageCost;
          delete results.costs[productId][entity.id].breakdown.variance;
        }
      }
    }

    results.warnings = this.warnings;
    results.auditTrail = this.auditTrail.getFullTrail();

    this.auditTrail.log('CALCULATION_COMPLETED', { productCount: productIds.length });

    return results;
  }

  calculateBaseCost(productId, entityId, period, targetCurrency) {
    const product = this.bomProcessor.getProduct(productId);
    if (!product) return null;

    const entity = this.entityManager.getEntity(entityId);
    let directMaterialCost = 0;
    let directLaborCost = 0;
    const componentCosts = [];

    if (product.components.length === 0) {
      // Raw material - get direct cost
      const costData = this.getItemCost(productId, entityId, period);
      if (costData) {
        directMaterialCost = this.currencyConverter.convert(
          costData.unit,
          costData.currency,
          targetCurrency,
          period
        );
      }
    } else {
      // Assembly - sum component costs
      for (const component of product.components) {
        const isLabor = component.unit === 'hours';
        const scrapMultiplier = 1 / (1 - (component.scrapRate || 0));

        if (isLabor) {
          const laborRate = this.getItemCost(component.itemId, entityId, period);
          if (laborRate) {
            const laborCost = this.currencyConverter.convert(
              laborRate.unit * component.quantity * scrapMultiplier,
              laborRate.currency,
              targetCurrency,
              period
            );
            directLaborCost += laborCost;
            componentCosts.push({
              itemId: component.itemId,
              type: 'labor',
              quantity: component.quantity,
              scrapMultiplier,
              cost: laborCost
            });
          }
        } else {
          // Get component's total cost (recursive)
          const componentCost = this.costState.getCost(component.itemId, entityId, period);
          if (componentCost) {
            const totalComponentCost = (componentCost.totalCost || componentCost.directMaterial || 0)
              * component.quantity * scrapMultiplier;
            directMaterialCost += totalComponentCost;
            componentCosts.push({
              itemId: component.itemId,
              type: 'material',
              quantity: component.quantity,
              scrapMultiplier,
              unitCost: componentCost.totalCost || componentCost.directMaterial || 0,
              cost: totalComponentCost
            });
          } else {
            // Raw material without sub-components
            const rawCost = this.getItemCost(component.itemId, entityId, period);
            if (rawCost) {
              const materialCost = this.currencyConverter.convert(
                rawCost.unit * component.quantity * scrapMultiplier,
                rawCost.currency,
                targetCurrency,
                period
              );
              directMaterialCost += materialCost;
              componentCosts.push({
                itemId: component.itemId,
                type: 'raw-material',
                quantity: component.quantity,
                scrapMultiplier,
                unitCost: rawCost.unit,
                cost: materialCost
              });
            }
          }
        }
      }
    }

    const breakdown = {
      directMaterial: directMaterialCost,
      directLabor: directLaborCost,
      scrapAdjustment: 0,
      laborBurden: 0,
      factoryOverhead: 0,
      rndAmortization: 0,
      royalty: 0,
      managementFee: 0,
      interCompanyMarkup: 0,
      customsDuties: 0,
      totalCost: directMaterialCost + directLaborCost,
      componentBreakdown: componentCosts
    };

    this.costState.setCost(productId, entityId, period, breakdown);
    this.auditTrail.recordContribution(productId, entityId, 'BASE', directMaterialCost + directLaborCost,
      `Direct costs: material=${directMaterialCost.toFixed(2)}, labor=${directLaborCost.toFixed(2)}`);

    return breakdown;
  }

  executeRule(ruleId, productIds, period, targetCurrency) {
    const rule = this.ruleEngine.getRule(ruleId);
    if (!rule) return;

    this.auditTrail.log('RULE_EXECUTION_START', { ruleId, ruleName: rule.name });

    for (const productId of productIds) {
      for (const entity of this.entityManager.getManufacturingEntities()) {
        this.applyRule(rule, productId, entity.id, period, targetCurrency);
      }
    }
  }

  applyRule(rule, productId, entityId, period, targetCurrency) {
    const cost = this.costState.getCost(productId, entityId, period);
    if (!cost) return;

    const entity = this.entityManager.getEntity(entityId);
    let ruleOutput = 0;

    switch (rule.type) {
      case 'sum-components':
        // Already handled in base cost calculation
        ruleOutput = cost.directMaterial + cost.directLabor;
        break;

      case 'multiply':
        // Scrap adjustment is already factored into component quantities
        // This rule would apply additional adjustments if needed
        break;

      case 'labor-burden':
        if (cost.directLabor > 0) {
          const burden = cost.directLabor * rule.burdenRate;
          cost.laborBurden = burden;
          cost.totalCost += burden;
          ruleOutput = burden;
          this.auditTrail.recordContribution(productId, entityId, rule.id, burden,
            `Labor burden: ${cost.directLabor.toFixed(2)} * ${rule.burdenRate} = ${burden.toFixed(2)}`);
        }
        break;

      case 'percentage-of-base':
        const baseAmount = (rule.baseRules || []).reduce((sum, baseRuleId) => {
          if (baseRuleId === 'RULE-002') return sum + cost.directMaterial + cost.scrapAdjustment;
          if (baseRuleId === 'RULE-003') return sum + cost.directLabor + cost.laborBurden;
          return sum;
        }, 0);
        const overhead = baseAmount * rule.percentage;
        cost.factoryOverhead = overhead;
        cost.totalCost += overhead;
        ruleOutput = overhead;
        this.auditTrail.recordContribution(productId, entityId, rule.id, overhead,
          `Factory overhead: ${baseAmount.toFixed(2)} * ${rule.percentage} = ${overhead.toFixed(2)}`);
        break;

      case 'per-unit-allocation':
        const pool = this.costPools[rule.poolId];
        if (pool) {
          const totalVolume = this.getTotalProductionVolume(period, rule.lookbackPeriods);
          const productVolume = this.getProductVolume(productId, entityId, period);
          if (totalVolume > 0 && productVolume > 0) {
            const poolAmount = this.currencyConverter.convert(
              pool.periods[period]?.amount || 0,
              pool.periods[period]?.currency || 'USD',
              targetCurrency,
              period
            );
            const allocation = (poolAmount / totalVolume) * (productVolume / productVolume);
            cost.rndAmortization = allocation;
            cost.totalCost += allocation;
            ruleOutput = allocation;
            this.auditTrail.recordContribution(productId, entityId, rule.id, allocation,
              `R&D amortization: pool=${poolAmount.toFixed(2)}, volume share`);
          }
        }
        break;

      case 'transfer-price':
        if (rule.transferType === 'royalty') {
          const royaltyRoutes = this.transferRoutes.filter(r =>
            r.to === entityId && r.itemTypes.includes('royalty'));
          for (const route of royaltyRoutes) {
            if (route.markupType === 'revenue-percent') {
              // Royalty based on cost (proxy for revenue)
              const royalty = cost.totalCost * route.markupValue;
              cost.royalty += royalty;
              cost.totalCost += royalty;
              ruleOutput += royalty;
              this.auditTrail.recordContribution(productId, entityId, rule.id, royalty,
                `IP Royalty from ${route.from}: ${cost.totalCost.toFixed(2)} * ${route.markupValue}`);
            }
          }
        } else if (rule.transferType === 'mgmt-fee') {
          const mgmtRoutes = this.transferRoutes.filter(r =>
            r.to === entityId && r.itemTypes.includes('mgmt-fee'));
          for (const route of mgmtRoutes) {
            if (route.markupType === 'revenue-percent') {
              const fee = cost.totalCost * route.markupValue;
              cost.managementFee += fee;
              cost.totalCost += fee;
              ruleOutput += fee;
              this.auditTrail.recordContribution(productId, entityId, rule.id, fee,
                `Management fee from ${route.from}: ${route.markupValue * 100}%`);
            }
          }
        }
        break;

      case 'conditional':
        // Customs duties handled in transfer pricing
        break;

      case 'weighted-average':
        // Handled in separate phase
        break;

      case 'variance-calculation':
        // Handled in separate phase
        break;
    }

    this.costState.setRuleOutput(rule.id, productId, entityId, period, ruleOutput);
    this.costState.setCost(productId, entityId, period, cost);
  }

  calculateTransferPrice(productId, destEntityId, period, targetCurrency) {
    const destEntity = this.entityManager.getEntity(destEntityId);
    if (!destEntity || destEntity.type !== 'distribution') return;

    // Find best path from manufacturing to distribution
    let bestCost = Infinity;
    let bestPath = null;
    let bestSourceEntity = null;

    for (const mfgEntity of this.entityManager.getManufacturingEntities()) {
      const paths = this.entityManager.findTransferPaths(mfgEntity.id, destEntityId);

      for (const path of paths) {
        const sourceCost = this.costState.getCost(productId, mfgEntity.id, period);
        if (!sourceCost) continue;

        let transferCost = sourceCost.totalCost;
        let pathCosts = [{ entity: mfgEntity.id, cost: transferCost }];

        // Apply markups along the path
        for (let i = 1; i < path.length; i++) {
          const step = path[i];
          const route = step.edge;

          if (route.markupType === 'cost-plus') {
            transferCost *= (1 + route.markupValue);
          } else if (route.markupType === 'resale-minus') {
            // Resale minus means the transfer price is (1 - margin) of resale price
            // Approximate: add markup equivalent
            transferCost *= (1 + route.markupValue * 0.5);
          }

          // Add customs duties if cross-border
          const prevEntity = path[i - 1].node;
          if (this.entityManager.isCrossBorder(prevEntity, step.node)) {
            const toEntity = this.entityManager.getEntity(step.node);
            let dutyRate = 0.03; // Default
            if (toEntity.country === 'US') dutyRate = 0.025;
            if (toEntity.country === 'DE') dutyRate = 0.04;

            const duty = transferCost * dutyRate;
            transferCost += duty;
          }

          pathCosts.push({ entity: step.node, cost: transferCost, markup: route.markupValue });
        }

        if (transferCost < bestCost) {
          bestCost = transferCost;
          bestPath = pathCosts;
          bestSourceEntity = mfgEntity.id;
        }
      }
    }

    if (bestPath) {
      const sourceCost = this.costState.getCost(productId, bestSourceEntity, period);
      const breakdown = {
        directMaterial: sourceCost.directMaterial,
        directLabor: sourceCost.directLabor,
        scrapAdjustment: sourceCost.scrapAdjustment,
        laborBurden: sourceCost.laborBurden,
        factoryOverhead: sourceCost.factoryOverhead,
        rndAmortization: sourceCost.rndAmortization,
        royalty: sourceCost.royalty,
        managementFee: sourceCost.managementFee,
        interCompanyMarkup: bestCost - sourceCost.totalCost,
        customsDuties: 0, // Included in markup calculation
        totalCost: bestCost,
        sourceEntity: bestSourceEntity,
        transferPath: bestPath
      };

      this.costState.setCost(productId, destEntityId, period, breakdown);
      this.auditTrail.recordContribution(productId, destEntityId, 'TRANSFER',
        bestCost - sourceCost.totalCost,
        `Transfer from ${bestSourceEntity}: markup=${(bestCost - sourceCost.totalCost).toFixed(2)}`);
    }
  }

  calculateWeightedAverage(productId, period, targetCurrency) {
    const weights = { current: 0.6, 'prior-1': 0.25, 'prior-2': 0.15 };
    const priorPeriods = this.currencyConverter.getPriorPeriods(period, 2);

    for (const entity of this.entityManager.getAllEntities()) {
      const currentCost = this.costState.getCost(productId, entity.id, period);
      if (!currentCost) continue;

      let weightedCost = currentCost.totalCost * weights.current;
      let totalWeight = weights.current;

      for (let i = 0; i < priorPeriods.length; i++) {
        const priorCost = this.costState.getCost(productId, entity.id, priorPeriods[i]);
        const weightKey = `prior-${i + 1}`;
        if (priorCost && weights[weightKey]) {
          weightedCost += priorCost.totalCost * weights[weightKey];
          totalWeight += weights[weightKey];
        }
      }

      currentCost.weightedAverageCost = weightedCost / totalWeight;
      this.costState.setCost(productId, entity.id, period, currentCost);
    }
  }

  calculateVariance(productId, period, targetCurrency) {
    const standards = this.standardCosts[productId];
    if (!standards) return;

    for (const [entityId, standardCost] of Object.entries(standards)) {
      if (entityId === 'currency') continue;

      const actualCost = this.costState.getCost(productId, entityId, period);
      if (!actualCost) continue;

      const standardInTarget = this.currencyConverter.convert(
        standardCost,
        standards.currency || 'USD',
        targetCurrency,
        period
      );

      const variance = {
        amount: actualCost.totalCost - standardInTarget,
        percentage: (actualCost.totalCost - standardInTarget) / standardInTarget,
        favorable: actualCost.totalCost < standardInTarget
      };

      actualCost.variance = variance;
      this.costState.setCost(productId, entityId, period, actualCost);

      this.auditTrail.recordContribution(productId, entityId, 'VARIANCE', variance.amount,
        `Variance: actual=${actualCost.totalCost.toFixed(2)}, standard=${standardInTarget.toFixed(2)}, diff=${variance.amount.toFixed(2)}`);
    }
  }

  getTotalProductionVolume(period, lookbackPeriods = 1) {
    let total = 0;
    const periods = [period, ...this.currencyConverter.getPriorPeriods(period, lookbackPeriods - 1)];

    for (const p of periods) {
      const periodVolumes = this.productionVolumes[p];
      if (periodVolumes) {
        for (const entityVolumes of Object.values(periodVolumes)) {
          for (const volume of Object.values(entityVolumes)) {
            total += volume;
          }
        }
      }
    }

    return total / periods.length;
  }

  getProductVolume(productId, entityId, period) {
    return this.productionVolumes[period]?.[entityId]?.[productId] || 0;
  }

  // ============================================================================
  // BONUS: INCREMENTAL RECALCULATION
  // ============================================================================

  updateCost(itemId, entityId, period, newCost) {
    // Mark affected costs as dirty
    const key = this.costState.getCostKey(itemId, entityId, period);
    this.costState.markDirty(key);

    // Update the base cost
    const costData = this.periodCosts.get(`${itemId}:${entityId}:${period}`);
    if (costData) {
      costData.unit = newCost;
    }

    // Return list of affected items for recalculation
    return this.costState.getDirtyKeys();
  }

  recalculateIncremental(options = {}) {
    const dirtyKeys = this.costState.getDirtyKeys();
    if (dirtyKeys.length === 0) return { recalculated: 0 };

    // Extract unique products/entities/periods from dirty keys
    const toRecalculate = new Set();
    for (const key of dirtyKeys) {
      const [productId, entityId, period] = key.split(':');
      toRecalculate.add(JSON.stringify({ productId, entityId, period }));
    }

    // Recalculate only affected items
    for (const item of toRecalculate) {
      const { productId, entityId, period } = JSON.parse(item);
      this.calculateBaseCost(productId, entityId, period, options.targetCurrency || 'USD');
    }

    // Re-run rules for affected items
    for (const ruleId of this.ruleEngine.getExecutionOrder()) {
      for (const item of toRecalculate) {
        const { productId, entityId, period } = JSON.parse(item);
        const rule = this.ruleEngine.getRule(ruleId);
        this.applyRule(rule, productId, entityId, period, options.targetCurrency || 'USD');
      }
    }

    this.costState.clearDirty();
    return { recalculated: toRecalculate.size };
  }

  // ============================================================================
  // BONUS: WHAT-IF ANALYSIS
  // ============================================================================

  whatIf(scenarios, options = {}) {
    const results = {};

    for (const [scenarioName, changes] of Object.entries(scenarios)) {
      // Clone current state
      const originalState = this.costState.clone();
      const originalPeriodCosts = new Map(this.periodCosts);

      // Apply scenario changes
      for (const change of changes) {
        if (change.type === 'cost') {
          const key = `${change.itemId}:${change.entityId}:${change.period}`;
          this.periodCosts.set(key, { unit: change.value, currency: change.currency || 'USD' });
        } else if (change.type === 'exchangeRate') {
          // Would need to modify currencyConverter
        }
      }

      // Recalculate
      this.costState = new CostState();
      const scenarioResult = this.calculate(options);

      // Store results
      results[scenarioName] = scenarioResult;

      // Restore original state
      this.costState = originalState;
      this.periodCosts = originalPeriodCosts;
    }

    return results;
  }

  // ============================================================================
  // BONUS: CYCLE RESOLUTION (Iterative Convergence)
  // ============================================================================

  resolveRoyaltyCycle(productId, entityId, period, targetCurrency, maxIterations = 10, tolerance = 0.01) {
    let prevCost = 0;
    let currentCost = this.costState.getCost(productId, entityId, period)?.totalCost || 0;
    let iterations = 0;

    while (Math.abs(currentCost - prevCost) > tolerance && iterations < maxIterations) {
      prevCost = currentCost;

      // Recalculate with current cost as base for royalty
      this.calculateBaseCost(productId, entityId, period, targetCurrency);

      // Apply royalty rules
      for (const ruleId of this.ruleEngine.getExecutionOrder()) {
        const rule = this.ruleEngine.getRule(ruleId);
        if (rule.type === 'transfer-price' && rule.transferType === 'royalty') {
          this.applyRule(rule, productId, entityId, period, targetCurrency);
        }
      }

      currentCost = this.costState.getCost(productId, entityId, period)?.totalCost || 0;
      iterations++;
    }

    return {
      converged: Math.abs(currentCost - prevCost) <= tolerance,
      iterations,
      finalCost: currentCost
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  CostCalculator,
  Graph,
  AuditTrail,
  CostState,
  BOMProcessor,
  CurrencyConverter,
  EntityManager,
  RuleEngine
};
