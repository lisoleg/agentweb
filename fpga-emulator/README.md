# AgentWeb FPGA Emulator

**For AgentWeb Sigma Cloud V2.0**

Based on Paper ②: "7G、AgentWeb 与FPGA优先：下一代可重构 可编程 可进化的天地一体虚实结合的互联网核心基础设施构想"

## 🎯 Core Concept (核心概念)

### FPGA as Φ Field Substrate (FPGA 作为 Φ 场基底)

| FPGA Concept | Φ Field Concept | Explanation |
|-------------|-----------------|-------------|
| CLB (Configurable Logic Block) | Φ field degree of freedom | Each CLB = 1 degree of freedom |
| Bitstream | Φ field configuration state | Full configuration = field state |
| PRR (Partial Reconfiguration Region) | Localized Φ field excitation | Reconfigurable region = local excitation |
| Reconfiguration | Topological excitation/de-excitation | Change config = excite/de-excite field |
| 7G Network | Low-dissipation resonance medium | Low latency = low dissipation |

### Key Mapping (关键映射)

1. **Partial Reconfiguration (部分可重构) ↔ Topological Excitation (拓扑激发)**
   - In Φ theory: Token types are topological excitations of Φ field
   - In FPGA: Partial reconfiguration creates/destroys circuit patterns in specific regions
   - **Mapping**: Reconfiguring a PRR = Creating a topological excitation in Φ field

2. **7G = Φ Field Low-Dissipation Resonance Medium (7G = Φ 场低耗散共振介质)**
   - 7G network simulates the propagation of Φ field excitations
   - Low latency = Low dissipation of Φ field information
   - **FPGA + 7G = Real-time reconfigurable Φ field substrate**

3. **Evolvable Hardware (可进化硬件)**
   - Use evolutionary algorithms to optimize FPGA configurations
   - Fitness function = Φ value of the resulting circuit behavior
   - **Simulate "evolvable infrastructure" from Paper ②**

## 🚀 Features (功能)

1. **Partial Reconfiguration Simulation (部分可重构仿真)**
   - Define PRRs (Partial Reconfiguration Regions)
   - Reconfigure PRRs without affecting other regions
   - Track reconfiguration history and timing

2. **Φ Field Topological Excitation Mapping (Φ 场拓扑激发映射)**
   - Map Φ excitations to PRR reconfigurations
   - Calculate phase gradients and winding numbers
   - Detect topological phase transitions

3. **7G Network Low-Dissipation Simulation (7G 网络低耗散仿真)**
   - Simulate 7G network parameters (bandwidth, latency, reliability)
   - Calculate dissipation delay for configuration propagation
   - Model resonance medium for Φ field

4. **Evolvable Hardware Simulation (可进化硬件仿真)**
   - Evolutionary algorithm for FPGA configuration optimization
   - Multiple fitness function types (Φ value, throughput, latency, energy)
   - Population-based evolution with elitism

## 📦 Installation (安装)

```bash
cd fpga-emulator
npm install
npm run build
```

## 📖 Usage (使用方法)

### Quick Start (快速开始)

```typescript
import { FPGAEmulator, defaultHardwareSpec, defaultNetwork7GConfig, defaultSimulationConfig } from 'agentweb-fpga-emulator';

// Create emulator
const emulator = new FPGAEmulator(
  defaultInitialConfig,
  defaultHardwareSpec,
  defaultNetwork7GConfig,
  defaultSimulationConfig
);

// Simulate Φ excitation
const excitation = {
  id: 'exc-1',
  type: 'CALC',  // Calc-Token (算元)
  amplitude: 0.8,
  phase: Math.PI,
  position: { x: 50, y: 50 },
  spread: 0.5,
  timestamp: Date.now()
};

await emulator.simulatePhiExcitation(excitation);

// Get Φ value
const phiValue = emulator.calculatePhiValue();
console.log(`Φ value: ${phiValue}`);

// Evolve hardware
const bestConfig = await emulator.evolveHardware({
  populationSize: 50,
  generations: 100,
  mutationRate: 0.1,
  crossoverRate: 0.7,
  elitismCount: 5,
  fitnessFunction: 'PHI_VALUE'
}, defaultHardwareSpec);

console.log(`Best config: ${bestConfig.id}, Φ value: ${emulator.calculatePhiValue()}`);
```

### Advanced Usage (高级用法)

#### 1. Manual PRR Reconfiguration (手动 PRR 重配置)

```typescript
// Define a PRR
const prr = emulator.getPRRs()[0];

// Reconfigure PRR
const newConfig = 'A1B2C3D4...';  // Hex string
await emulator.reconfigurePRR(prr.id, newConfig, 'USER_REQUEST');
```

#### 2. Run Full Simulation (运行完整仿真)

```typescript
const result = await emulator.runSimulation(
  60000,  // duration: 60 seconds
  100,  // time step: 100 ms
  [excitation1, excitation2, ...]  // optional excitations
);

console.log(result.performanceMetrics);
```

#### 3. Use Partial Reconfigurator Directly (直接使用部分重配置器)

```typescript
import { PartialReconfigurator } from 'agentweb-fpga-emulator';

const reconfigurator = new PartialReconfigurator(defaultHardwareSpec);

// Define custom PRR
reconfigurator.definePRR('my-prr', 'My PRR', 100, 199);

// Reconfigure
reconfigurator.reconfigure('my-prr', 'FFFF...');
```

#### 4. Use Φ Field Mapper (使用 Φ 场映射器)

```typescript
import { PhiFieldMapper } from 'agentweb-fpga-emulator';

const mapper = new PhiFieldMapper();

// Map excitation to PRR
const prr = mapper.mapExcitationToPRR(excitation, emulator.getPRRs());

// Convert excitation to bitstream
const bitstream = mapper.excitationToBitstream(excitation);
```

## 🧪 Theory Background (理论背景)

### Paper ② Key Points (论文②要点)

1. **FPGA 可重构硬件**
   - Partial reconfiguration (部分可重构) corresponds to Φ field topological excitation/reconfiguration (对应 Φ 场的拓扑激发/重配)
   - Each PRR = localized excitation
   - Reconfiguration = excite/de-excite field

2. **7G = Φ 场低耗散共振介质**
   - 7G network = propagation medium for Φ field excitations
   - Low latency = low dissipation
   - High bandwidth = high information transfer rate

3. **Evolvable Infrastructure (可进化基础设施)**
   - Use evolutionary algorithms to optimize hardware configurations
   - Fitness = Φ value of resulting behavior
   - Enable "evolvable infrastructure" (可进化基础设施)

### Mathematical Mapping (数学映射)

```
FPGA Configuration (FPGA 配置) ↔ Φ Field State (Φ 场状态)
Bitstream (比特流) ↔ Field Configuration (场配置)
PRR Reconfiguration (PRR 重配置) ↔ Topological Excitation (拓扑激发)
7G Propagation (7G 传播) ↔ Field Excitation Propagation (场激发传播)
Evolution (进化) ↔ Field Optimization (场优化)
```

## 📊 Performance Metrics (性能指标)

The emulator calculates these metrics:

| Metric | Explanation |
|--------|-------------|
| `avgReconfigTime` | Average reconfiguration time (ms) |
| `throughput` | Operations per second |
| `latency` | Network latency (ms) |
| `energyConsumption` | Energy consumption (Joules) |
| `phiValue` | Average Φ value |
| `fitnessScore` | Overall fitness score |

## 🧩 Architecture (架构)

```
fpga-emulator/
├── src/
│   ├── index.ts              # Exports
│   ├── fpga-emulator.ts      # Main emulator class
│   ├── partial-reconfig.ts   # Partial reconfiguration
│   ├── phi-field-mapper.ts   # Φ field mapping
│   ├── evolvable-hardware.ts # Evolvable hardware
│   └── types.ts             # TypeScript types
├── test/
│   └── fpga-emulator.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

## 🔬 Test (测试)

```bash
npm run test
```

## 📚 References (参考文献)

1. **Paper ②**: "7G、AgentWeb 与FPGA优先：下一代可重构 可编程 可进化的天地一体虚实结合的互联网核心基础设施构想"
2. **Paper ①**: "联邦宇宙的化身合体：基于"一现象，三视界"的算元、智元、词元、通证统一场论与全生命周期管理"
3. **Paper ③**: "联邦宇宙（Fediverse）即未来：基于 IGCTR 与复合体理学的去中心化本体论重构"

## 📝 License (许可证)

MIT

---

**Developed by Taiyi AGI Team (太乙 AGI 团队)**
