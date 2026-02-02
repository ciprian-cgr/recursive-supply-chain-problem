/**
 * Test Suite for Supply Chain Cost Allocation Engine
 */

const { CostCalculator, Graph, BOMProcessor, AuditTrail } = require('./index');
const testData = require('./test-data');

// ============================================================================
// TEST UTILITIES
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`${colors.green}  ✓${colors.reset} ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`${colors.red}  ✗${colors.reset} ${name}`);
    console.log(`    ${colors.dim}${error.message}${colors.reset}`);
    testsFailed++;
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, got ${actual}. ${message}`);
  }
}

function assertApproxEqual(actual, expected, tolerance = 0.01, message = '') {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`Expected ~${expected}, got ${actual} (diff: ${Math.abs(actual - expected)}). ${message}`);
  }
}

function assertTrue(condition, message = '') {
  if (!condition) {
    throw new Error(`Assertion failed. ${message}`);
  }
}

function assertThrows(fn, message = '') {
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
  }
  if (!threw) {
    throw new Error(`Expected function to throw. ${message}`);
  }
}

function section(name) {
  console.log(`\n${colors.bright}${colors.cyan}▸ ${name}${colors.reset}`);
}

// ============================================================================
// UNIT TESTS
// ============================================================================

function runUnitTests() {
  console.log(`\n${colors.bright}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}                    UNIT TESTS${colors.reset}`);
  console.log(`${colors.bright}═══════════════════════════════════════════════════════════════${colors.reset}`);

  section('Graph - Cycle Detection');

  test('detects simple cycle', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('C', 'A');
    const cycles = g.detectCycles();
    assertTrue(cycles.length > 0, 'Should detect cycle');
  });

  test('no false positive for acyclic graph', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'C');
    g.addEdge('A', 'C');
    const cycles = g.detectCycles();
    assertEqual(cycles.length, 0, 'Should not detect cycle in DAG');
  });

  section('Graph - Topological Sort');

  test('sorts dependencies correctly', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('A', 'C');
    g.addEdge('B', 'D');
    g.addEdge('C', 'D');
    const sorted = g.topologicalSort();
    assertTrue(sorted.indexOf('A') < sorted.indexOf('B'), 'A before B');
    assertTrue(sorted.indexOf('A') < sorted.indexOf('C'), 'A before C');
    assertTrue(sorted.indexOf('B') < sorted.indexOf('D'), 'B before D');
    assertTrue(sorted.indexOf('C') < sorted.indexOf('D'), 'C before D');
  });

  test('throws on cyclic graph', () => {
    const g = new Graph();
    g.addEdge('A', 'B');
    g.addEdge('B', 'A');
    assertThrows(() => g.topologicalSort(), 'Should throw on cycle');
  });

  section('Graph - Path Finding');

  test('finds all paths', () => {
    const g = new Graph();
    g.addEdge('A', 'B', { cost: 1 });
    g.addEdge('A', 'C', { cost: 2 });
    g.addEdge('B', 'D', { cost: 1 });
    g.addEdge('C', 'D', { cost: 1 });
    const paths = g.findAllPaths('A', 'D');
    assertEqual(paths.length, 2, 'Should find 2 paths');
  });

  section('BOM Processor');

  test('validates BOM without cycles', () => {
    const audit = new AuditTrail();
    const bom = new BOMProcessor(testData.billOfMaterials, audit);
    assertTrue(bom.getAllProducts().length > 0, 'Should have products');
  });

  test('detects BOM cycles', () => {
    const audit = new AuditTrail();
    const cyclicBOM = [
      { productId: 'A', components: [{ itemId: 'B', quantity: 1 }] },
      { productId: 'B', components: [{ itemId: 'C', quantity: 1 }] },
      { productId: 'C', components: [{ itemId: 'A', quantity: 1 }] }
    ];
    assertThrows(() => new BOMProcessor(cyclicBOM, audit), 'Should detect BOM cycle');
  });

  test('explosion order is leaf-to-root', () => {
    const audit = new AuditTrail();
    const bom = new BOMProcessor(testData.billOfMaterials, audit);
    const order = bom.getExplosionOrder();
    // Raw materials should come before assemblies
    assertTrue(order.indexOf('PCB-BLANK') < order.indexOf('MOTHERBOARD-A'),
      'Raw materials before assemblies');
    assertTrue(order.indexOf('BMS-BOARD') < order.indexOf('BATTERY-PACK'),
      'Sub-assemblies before parent assemblies');
  });

  test('flattens materials correctly', () => {
    const audit = new AuditTrail();
    const bom = new BOMProcessor(testData.billOfMaterials, audit);
    const materials = bom.getFlattenedMaterials('MOTHERBOARD-A');
    assertTrue(materials.has('PCB-BLANK'), 'Should include PCB');
    assertTrue(materials.has('CPU-CHIP'), 'Should include CPU');
    assertTrue(materials.has('RAM-MODULE'), 'Should include RAM');
    // RAM quantity should be ~2.02 (2 * 1/(1-0.01) scrap adjustment)
    assertApproxEqual(materials.get('RAM-MODULE'), 2.02, 0.01, 'RAM quantity with scrap');
  });
}

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

function runIntegrationTests() {
  console.log(`\n${colors.bright}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}                 INTEGRATION TESTS${colors.reset}`);
  console.log(`${colors.bright}═══════════════════════════════════════════════════════════════${colors.reset}`);

  const calculator = new CostCalculator(testData);

  section('Full Calculation Pipeline');

  test('calculates costs for all products', () => {
    const result = calculator.calculate({ period: '2024-Q4', targetCurrency: 'USD' });
    assertTrue(Object.keys(result.costs).length > 0, 'Should have costs');
    assertTrue(result.costs['LAPTOP-X1'] !== undefined, 'Should have LAPTOP-X1');
  });

  test('rule execution order is correct', () => {
    const result = calculator.calculate({ period: '2024-Q4' });
    const order = result.ruleExecutionOrder;
    assertTrue(order.indexOf('RULE-001') < order.indexOf('RULE-002'), 'RULE-001 before RULE-002');
    assertTrue(order.indexOf('RULE-002') < order.indexOf('RULE-004'), 'RULE-002 before RULE-004');
    assertTrue(order.indexOf('RULE-003') < order.indexOf('RULE-004'), 'RULE-003 before RULE-004');
  });

  test('parallel groups are independent', () => {
    const result = calculator.calculate({ period: '2024-Q4' });
    // RULE-002 and RULE-003 should be in the same parallel group
    const groups = result.parallelGroups;
    const group2 = groups.find(g => g.includes('RULE-002'));
    assertTrue(group2 && group2.includes('RULE-003'),
      'RULE-002 and RULE-003 should be parallelizable');
  });

  section('Cost Components');

  test('direct material cost is positive', () => {
    const result = calculator.calculate({ period: '2024-Q4' });
    const laptopCost = result.costs['LAPTOP-X1']['MFG-CHINA'];
    assertTrue(laptopCost.breakdown.directMaterial > 0, 'Should have material cost');
  });

  test('direct labor cost is positive', () => {
    const result = calculator.calculate({ period: '2024-Q4' });
    const laptopCost = result.costs['LAPTOP-X1']['MFG-CHINA'];
    assertTrue(laptopCost.breakdown.directLabor > 0, 'Should have labor cost');
  });

  test('labor burden is 35% of labor', () => {
    const result = calculator.calculate({ period: '2024-Q4' });
    const laptopCost = result.costs['LAPTOP-X1']['MFG-CHINA'];
    const expectedBurden = laptopCost.breakdown.directLabor * 0.35;
    assertApproxEqual(laptopCost.breakdown.laborBurden, expectedBurden, 0.01,
      'Labor burden should be 35%');
  });

  test('factory overhead is calculated', () => {
    const result = calculator.calculate({ period: '2024-Q4' });
    const laptopCost = result.costs['LAPTOP-X1']['MFG-CHINA'];
    assertTrue(laptopCost.breakdown.factoryOverhead > 0, 'Should have factory overhead');
  });

  section('Transfer Pricing');

  test('distribution entity has transfer pricing applied', () => {
    const result = calculator.calculate({ period: '2024-Q4' });
    const distCost = result.costs['LAPTOP-X1']['DIST-US'];
    assertTrue(distCost !== undefined, 'DIST-US should have cost');
    assertTrue(distCost.breakdown.interCompanyMarkup > 0, 'Should have markup');
  });

  test('transfer path is recorded', () => {
    const result = calculator.calculate({ period: '2024-Q4' });
    const distCost = result.costs['LAPTOP-X1']['DIST-US'];
    assertTrue(distCost.breakdown.sourceEntity !== undefined, 'Should record source');
    assertTrue(distCost.breakdown.transferPath !== undefined, 'Should record path');
  });

  section('Currency Conversion');

  test('costs are converted to target currency', () => {
    const resultUSD = calculator.calculate({ period: '2024-Q4', targetCurrency: 'USD' });
    assertTrue(resultUSD.metadata.targetCurrency === 'USD', 'Should be USD');
  });

  section('Variance Calculation');

  test('variance is calculated against standard', () => {
    const result = calculator.calculate({ period: '2024-Q4' });
    const laptopCost = result.costs['LAPTOP-X1']['MFG-CHINA'];
    assertTrue(laptopCost.standardCostVariance !== undefined, 'Should have variance');
    assertTrue(typeof laptopCost.standardCostVariance.amount === 'number', 'Variance amount');
    assertTrue(typeof laptopCost.standardCostVariance.percentage === 'number', 'Variance %');
  });

  section('Audit Trail');

  test('audit trail records events', () => {
    const result = calculator.calculate({ period: '2024-Q4' });
    assertTrue(result.auditTrail.events.length > 0, 'Should have audit events');
  });

  test('audit trail records cost contributions', () => {
    const result = calculator.calculate({ period: '2024-Q4' });
    const contributions = result.costs['LAPTOP-X1']['MFG-CHINA'].contributions;
    assertTrue(contributions.length > 0, 'Should have contributions');
  });
}

// ============================================================================
// BONUS FEATURE TESTS
// ============================================================================

function runBonusTests() {
  console.log(`\n${colors.bright}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}                 BONUS FEATURE TESTS${colors.reset}`);
  console.log(`${colors.bright}═══════════════════════════════════════════════════════════════${colors.reset}`);

  section('What-If Analysis');

  test('what-if with different costs', () => {
    const calculator = new CostCalculator(testData);

    const scenarios = {
      'high-cpu-cost': [
        { type: 'cost', itemId: 'CPU-CHIP', entityId: 'MFG-CHINA', period: '2024-Q4', value: 1000, currency: 'CNY' }
      ],
      'low-cpu-cost': [
        { type: 'cost', itemId: 'CPU-CHIP', entityId: 'MFG-CHINA', period: '2024-Q4', value: 500, currency: 'CNY' }
      ]
    };

    const results = calculator.whatIf(scenarios, { period: '2024-Q4' });

    assertTrue(results['high-cpu-cost'] !== undefined, 'Should have high scenario');
    assertTrue(results['low-cpu-cost'] !== undefined, 'Should have low scenario');

    const highCost = results['high-cpu-cost'].costs['MOTHERBOARD-A']['MFG-CHINA'].totalCost;
    const lowCost = results['low-cpu-cost'].costs['MOTHERBOARD-A']['MFG-CHINA'].totalCost;

    assertTrue(highCost > lowCost, 'High scenario should have higher cost');
  });

  section('Incremental Recalculation');

  test('marks dependencies dirty on cost change', () => {
    const calculator = new CostCalculator(testData);
    calculator.calculate({ period: '2024-Q4' });

    const dirty = calculator.updateCost('CPU-CHIP', 'MFG-CHINA', '2024-Q4', 1000);
    assertTrue(dirty.length > 0, 'Should mark keys dirty');
  });

  test('recalculates only affected items', () => {
    const calculator = new CostCalculator(testData);
    calculator.calculate({ period: '2024-Q4' });

    calculator.updateCost('CPU-CHIP', 'MFG-CHINA', '2024-Q4', 1000);
    const result = calculator.recalculateIncremental({ targetCurrency: 'USD' });

    assertTrue(result.recalculated > 0, 'Should recalculate some items');
  });

  section('Cycle Resolution (Royalty)');

  test('converges on royalty calculation', () => {
    const calculator = new CostCalculator(testData);
    calculator.calculate({ period: '2024-Q4' });

    const result = calculator.resolveRoyaltyCycle('LAPTOP-X1', 'MFG-CHINA', '2024-Q4', 'USD');

    assertTrue(result.converged, 'Should converge');
    assertTrue(result.iterations > 0, 'Should take iterations');
    assertTrue(result.finalCost > 0, 'Should have final cost');
  });
}

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

function runPerformanceTests() {
  console.log(`\n${colors.bright}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}                 PERFORMANCE TESTS${colors.reset}`);
  console.log(`${colors.bright}═══════════════════════════════════════════════════════════════${colors.reset}`);

  section('Calculation Speed');

  test('full calculation completes in reasonable time', () => {
    const start = Date.now();
    const calculator = new CostCalculator(testData);
    calculator.calculate({ period: '2024-Q4' });
    const elapsed = Date.now() - start;
    console.log(`    ${colors.dim}(${elapsed}ms)${colors.reset}`);
    assertTrue(elapsed < 5000, `Should complete in <5s (took ${elapsed}ms)`);
  });

  test('what-if analysis is efficient', () => {
    const calculator = new CostCalculator(testData);
    calculator.calculate({ period: '2024-Q4' });

    const scenarios = {};
    for (let i = 0; i < 10; i++) {
      scenarios[`scenario-${i}`] = [
        { type: 'cost', itemId: 'CPU-CHIP', entityId: 'MFG-CHINA', period: '2024-Q4', value: 500 + i * 50 }
      ];
    }

    const start = Date.now();
    calculator.whatIf(scenarios, { period: '2024-Q4' });
    const elapsed = Date.now() - start;
    console.log(`    ${colors.dim}(10 scenarios in ${elapsed}ms)${colors.reset}`);
    assertTrue(elapsed < 10000, `Should complete in <10s (took ${elapsed}ms)`);
  });
}

// ============================================================================
// OUTPUT DEMO
// ============================================================================

function runOutputDemo() {
  console.log(`\n${colors.bright}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}                 CALCULATION OUTPUT DEMO${colors.reset}`);
  console.log(`${colors.bright}═══════════════════════════════════════════════════════════════${colors.reset}`);

  const calculator = new CostCalculator(testData);
  const result = calculator.calculate({
    period: '2024-Q4',
    targetCurrency: 'USD',
    products: ['LAPTOP-X1', 'MOTHERBOARD-A', 'BATTERY-PACK', 'BMS-BOARD']
  });

  console.log(`\n${colors.cyan}Rule Execution Order:${colors.reset}`);
  console.log('  ' + result.ruleExecutionOrder.join(' → '));

  console.log(`\n${colors.cyan}Parallel Execution Groups:${colors.reset}`);
  result.parallelGroups.forEach((group, i) => {
    console.log(`  Group ${i + 1}: [${group.join(', ')}]`);
  });

  console.log(`\n${colors.cyan}Cost Breakdown - LAPTOP-X1 @ MFG-CHINA (USD):${colors.reset}`);
  const laptopChina = result.costs['LAPTOP-X1']['MFG-CHINA'];
  console.log(`  Direct Material:     $${laptopChina.breakdown.directMaterial.toFixed(2)}`);
  console.log(`  Direct Labor:        $${laptopChina.breakdown.directLabor.toFixed(2)}`);
  console.log(`  Labor Burden:        $${laptopChina.breakdown.laborBurden.toFixed(2)}`);
  console.log(`  Factory Overhead:    $${laptopChina.breakdown.factoryOverhead.toFixed(2)}`);
  console.log(`  R&D Amortization:    $${laptopChina.breakdown.rndAmortization.toFixed(2)}`);
  console.log(`  IP Royalty:          $${laptopChina.breakdown.royalty.toFixed(2)}`);
  console.log(`  Management Fee:      $${laptopChina.breakdown.managementFee.toFixed(2)}`);
  console.log(`  ${colors.bright}────────────────────────────${colors.reset}`);
  console.log(`  ${colors.bright}Total Cost:            $${laptopChina.totalCost.toFixed(2)}${colors.reset}`);
  console.log(`  Weighted Avg Cost:   $${laptopChina.weightedAverageCost?.toFixed(2) || 'N/A'}`);
  if (laptopChina.standardCostVariance) {
    const v = laptopChina.standardCostVariance;
    const sign = v.amount >= 0 ? '+' : '';
    const color = v.favorable ? colors.green : colors.red;
    console.log(`  Variance:            ${color}${sign}$${v.amount.toFixed(2)} (${(v.percentage * 100).toFixed(1)}%)${colors.reset}`);
  }

  console.log(`\n${colors.cyan}Cost Breakdown - LAPTOP-X1 @ DIST-US (with transfer pricing):${colors.reset}`);
  const laptopDist = result.costs['LAPTOP-X1']['DIST-US'];
  if (laptopDist) {
    console.log(`  Source Entity:       ${laptopDist.breakdown.sourceEntity}`);
    console.log(`  Inter-Co Markup:     $${laptopDist.breakdown.interCompanyMarkup.toFixed(2)}`);
    console.log(`  ${colors.bright}Total Cost:            $${laptopDist.totalCost.toFixed(2)}${colors.reset}`);
  }

  console.log(`\n${colors.cyan}Component Cost Summary (MFG-CHINA, USD):${colors.reset}`);
  const products = ['MOTHERBOARD-A', 'BATTERY-PACK', 'BMS-BOARD'];
  for (const product of products) {
    const cost = result.costs[product]?.['MFG-CHINA'];
    if (cost) {
      console.log(`  ${product.padEnd(15)} $${cost.totalCost.toFixed(2)}`);
    }
  }

  console.log(`\n${colors.cyan}Audit Trail Sample (last 5 events):${colors.reset}`);
  const events = result.auditTrail.events.slice(-5);
  for (const event of events) {
    console.log(`  ${colors.dim}${event.event}${colors.reset}`);
  }

  // Return full result for documentation
  return result;
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log(`${colors.bright}${colors.cyan}`);
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   SUPPLY CHAIN COST ALLOCATION ENGINE - TEST SUITE            ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);

  runUnitTests();
  runIntegrationTests();
  runBonusTests();
  runPerformanceTests();
  const result = runOutputDemo();

  console.log(`\n${colors.bright}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}                      TEST SUMMARY${colors.reset}`);
  console.log(`${colors.bright}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`  ${colors.green}Passed: ${testsPassed}${colors.reset}`);
  console.log(`  ${colors.red}Failed: ${testsFailed}${colors.reset}`);
  console.log(`  Total:  ${testsPassed + testsFailed}`);
  console.log();

  if (testsFailed > 0) {
    process.exit(1);
  }

  return result;
}

// Export for documentation
module.exports = { main };

// Run if called directly
if (require.main === module) {
  main();
}
