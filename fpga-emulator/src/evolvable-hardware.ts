/**
 * Evolvable Hardware Simulation for FPGA Emulator
 * 
 * Based on Paper ②: "可进化的天地一体虚实结合的互联网核心基础设施"
 * (Evolvable integrated space-terrestrial virtual-reality internet core infrastructure)
 * 
 * This module simulates:
 * 1. Evolutionary algorithm for FPGA configuration optimization
 * 2. Fitness function based on Φ value (integrated information)
 * 3. Mutation and crossover operations on bitstreams
 * 4. Population-based evolution with elitism
 * 5. Multi-objective optimization (Φ value, throughput, latency, energy)
 */

import { FPGAConfig, EvolutionConfig, FitnessFunctionType, HardwareSpec, PerformanceMetrics } from './types';
import { PhiFieldMapper } from './phi-field-mapper';

/**
 * EvolvableHardware Class
 * 
 * Simulates evolvable hardware using evolutionary algorithms
 */
export class EvolvableHardware {
  private hardwareSpec: HardwareSpec;
  private phiMapper: PhiFieldMapper;
  private population: FPGAConfig[];
  private fitnessScores: number[];
  private generation: number;
  private bestConfig: FPGAConfig | null;
  private bestFitness: number;

  constructor(hardwareSpec: HardwareSpec) {
    this.hardwareSpec = hardwareSpec;
    this.phiMapper = new PhiFieldMapper();
    this.population = [];
    this.fitnessScores = [];
    this.generation = 0;
    this.bestConfig = null;
    this.bestFitness = -Infinity;
  }

  /**
   * Run full evolution process
   * @param config Evolution configuration
   * @param hardwareSpec Hardware specification
   * @param fitnessFn Fitness function (optional, uses config's fitnessFunction)
   * @returns Best FPGA configuration found
   */
  async runEvolution(
    config: EvolutionConfig,
    hardwareSpec: HardwareSpec,
    fitnessFn?: (config: FPGAConfig) => number
  ): Promise<FPGAConfig> {
    console.log(`[EvolvableHardware] Starting evolution: ${config.generations} generations, population=${config.populationSize}`);

    // Initialize population
    this.population = this.initializePopulation(config.populationSize, hardwareSpec);
    this.generation = 0;

    // Evolution loop
    for (let gen = 0; gen < config.generations; gen++) {
      this.generation = gen;

      // Evaluate fitness
      this.fitnessScores = this.evaluatePopulation(
        this.population,
        fitnessFn || this.getDefaultFitnessFunction(config.fitnessFunction)
      );

      // Track best
      const [bestIdx, bestScore] = this.findBest(this.fitnessScores);
      if (bestScore > this.bestFitness) {
        this.bestFitness = bestScore;
        this.bestConfig = { ...this.population[bestIdx] };
      }

      console.log(`[EvolvableHardware] Generation ${gen + 1}/${config.generations}: best fitness=${this.bestFitness.toFixed(4)}`);

      // Evolve to next generation
      if (gen < config.generations - 1) {
        this.population = this.evolveOneGeneration(this.population, this.fitnessScores, config);
      }
    }

    console.log(`[EvolvableHardware] Evolution complete. Best fitness=${this.bestFitness.toFixed(4)}`);

    return this.bestConfig!;
  }

  /**
   * Initialize random population
   */
  private initializePopulation(
    populationSize: number,
    hardwareSpec: HardwareSpec
  ): FPGAConfig[] {
    const population: FPGAConfig[] = [];

    for (let i = 0; i < populationSize; i++) {
      const config: FPGAConfig = {
        id: `config-${i}-gen0`,
        bitstream: this.generateRandomBitstream(hardwareSpec),
        timestamp: Date.now(),
        metadata: {
          generation: 0,
          individual: i
        }
      };
      population.push(config);
    }

    return population;
  }

  /**
   * Evaluate fitness for entire population
   */
  private evaluatePopulation(
    population: FPGAConfig[],
    fitnessFn: (config: FPGAConfig) => number
  ): number[] {
    return population.map(config => fitnessFn(config));
  }

  /**
   * Evolve one generation using selection, crossover, mutation
   */
  private evolveOneGeneration(
    population: FPGAConfig[],
    fitnessScores: number[],
    config: EvolutionConfig
  ): FPGAConfig[] {
    const newPopulation: FPGAConfig[] = [];

    // Elitism: Preserve top individuals
    const eliteCount = config.elitismCount;
    const eliteIndices = this.getTopN(fitnessScores, eliteCount);
    for (const idx of eliteIndices) {
      newPopulation.push({ ...population[idx] });
    }

    // Fill rest with crossover and mutation
    while (newPopulation.length < config.populationSize) {
      // Selection (tournament selection)
      const parent1 = this.tournamentSelection(population, fitnessScores, 3);
      const parent2 = this.tournamentSelection(population, fitnessScores, 3);

      // Crossover
      let [child1, child2] = this.crossover(parent1, parent2, config.crossoverRate);

      // Mutation
      child1 = this.mutate(child1, config.mutationRate);
      child2 = this.mutate(child2, config.mutationRate);

      // Add to new population
      if (newPopulation.length < config.populationSize) {
        newPopulation.push(child1);
      }
      if (newPopulation.length < config.populationSize) {
        newPopulation.push(child2);
      }
    }

    // Update generation counter in metadata
    for (let i = 0; i < newPopulation.length; i++) {
      newPopulation[i].metadata = {
        ...newPopulation[i].metadata,
        generation: this.generation + 1,
        individual: i
      };
      newPopulation[i].id = `config-${i}-gen${this.generation + 1}`;
      newPopulation[i].timestamp = Date.now();
    }

    return newPopulation;
  }

  /**
   * Tournament selection
   */
  private tournamentSelection(
    population: FPGAConfig[],
    fitnessScores: number[],
    tournamentSize: number
  ): FPGAConfig {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < tournamentSize; i++) {
      const idx = Math.floor(Math.random() * population.length);
      if (fitnessScores[idx] > bestScore) {
        bestScore = fitnessScores[idx];
        bestIdx = idx;
      }
    }

    return population[bestIdx];
  }

  /**
   * Crossover two parents to produce two children
   */
  private crossover(
    parent1: FPGAConfig,
    parent2: FPGAConfig,
    crossoverRate: number
  ): [FPGAConfig, FPGAConfig] {
    if (Math.random() > crossoverRate) {
      // No crossover, return copies of parents
      return [{ ...parent1 }, { ...parent2 }];
    }

    // Uniform crossover
    const bitstream1 = parent1.bitstream.split('');
    const bitstream2 = parent2.bitstream.split('');

    for (let i = 0; i < bitstream1.length; i++) {
      if (Math.random() < 0.5) {
        const temp = bitstream1[i];
        bitstream1[i] = bitstream2[i];
        bitstream2[i] = temp;
      }
    }

    const child1: FPGAConfig = {
      ...parent1,
      bitstream: bitstream1.join('')
    };

    const child2: FPGAConfig = {
      ...parent2,
      bitstream: bitstream2.join('')
    };

    return [child1, child2];
  }

  /**
   * Mutate a configuration
   */
  private mutate(config: FPGAConfig, mutationRate: number): FPGAConfig {
    const bitstream = config.bitstream.split('');

    for (let i = 0; i < bitstream.length; i++) {
      if (Math.random() < mutationRate) {
        // Flip a random hex digit
        const hexDigits = '0123456789ABCDEF';
        const randomDigit = hexDigits[Math.floor(Math.random() * hexDigits.length)];
        bitstream[i] = randomDigit;
      }
    }

    return {
      ...config,
      bitstream: bitstream.join('')
    };
  }

  /**
   * Get default fitness function based on type
   */
  private getDefaultFitnessFunction(type: FitnessFunctionType): (config: FPGAConfig) => number {
    switch (type) {
      case FitnessFunctionType.PHI_VALUE:
        return (config: FPGAConfig) => this.calculatePhiValue(config);

      case FitnessFunctionType.THROUGHPUT:
        return (config: FPGAConfig) => this.calculateThroughput(config);

      case FitnessFunctionType.LATENCY:
        return (config: FPGAConfig) => 1 / (1 + this.calculateLatency(config));  // Minimize latency

      case FitnessFunctionType.ENERGY:
        return (config: FPGAConfig) => 1 / (1 + this.calculateEnergy(config));  // Minimize energy

      case FitnessFunctionType.CUSTOM:
        // Default to Φ value if custom not provided
        return (config: FPGAConfig) => this.calculatePhiValue(config);

      default:
        return (config: FPGAConfig) => this.calculatePhiValue(config);
    }
  }

  /**
   * Calculate Φ value of a configuration
   * Simplified: Φ = integrated information of bitstream
   */
  private calculatePhiValue(config: FPGAConfig): number {
    const bitstream = config.bitstream;

    // Information content (entropy)
    const entropy = this.calculateEntropy(bitstream);

    // Integration (simplified: count of alternating patterns)
    const integration = this.calculateIntegration(bitstream);

    // Φ = α * Entropy + β * Integration
    const alpha = 0.6;
    const beta = 0.4;

    const phiValue = alpha * entropy + beta * integration;

    return Math.min(1, Math.max(0, phiValue));  // Clamp to [0, 1]
  }

  /**
   * Calculate entropy of bitstream
   */
  private calculateEntropy(bitstream: string): number {
    const freq: Map<string, number> = new Map();

    for (const char of bitstream) {
      freq.set(char, (freq.get(char) || 0) + 1);
    }

    let entropy = 0;
    const length = bitstream.length;

    for (const [, count] of freq) {
      const p = count / length;
      entropy -= p * Math.log2(p);
    }

    // Normalize by max entropy (log2(16) = 4 for hex)
    return entropy / 4;
  }

  /**
   * Calculate integration of bitstream
   * Simplified: Count alternating patterns
   */
  private calculateIntegration(bitstream: string): number {
    if (bitstream.length < 2) return 0;

    let alternations = 0;
    for (let i = 1; i < bitstream.length; i++) {
      if (bitstream[i] !== bitstream[i - 1]) {
        alternations++;
      }
    }

    return alternations / (bitstream.length - 1);
  }

  /**
   * Calculate throughput (simplified)
   */
  private calculateThroughput(config: FPGAConfig): number {
    // Simplified: Throughput ∝ number of active CLBs
    const activeCLBs = config.bitstream.replace(/0/g, '').length;
    return activeCLBs / config.bitstream.length;
  }

  /**
   * Calculate latency (simplified)
   */
  private calculateLatency(config: FPGAConfig): number {
    // Simplified: Latency ∝ number of cascaded LUTs
    const cascadedCount = this.countCascadedLUTs(config.bitstream);
    return cascadedCount * 0.1;  // 0.1 ns per LUT
  }

  /**
   * Calculate energy consumption (simplified)
   */
  private calculateEnergy(config: FPGAConfig): number {
    // Simplified: Energy ∝ number of active CLBs
    const activeCLBs = config.bitstream.replace(/0/g, '').length;
    return activeCLBs * 0.001;  // 1 mJ per active CLB
  }

  /**
   * Count cascaded LUTs (simplified)
   */
  private countCascadedLUTs(bitstream: string): number {
    // Simplified: Count occurrences of "101" pattern (LUT cascade)
    let count = 0;
    for (let i = 2; i < bitstream.length; i++) {
      if (
        bitstream[i] === '1' &&
        bitstream[i - 1] === '0' &&
        bitstream[i - 2] === '1'
      ) {
        count++;
      }
    }
    return count;
  }

  /**
   * Generate random bitstream
   */
  private generateRandomBitstream(hardwareSpec: HardwareSpec): string {
    const length = hardwareSpec.numCLBs * 2;  // 2 hex chars per CLB (simplified)
    let bitstream = '';
    const hexDigits = '0123456789ABCDEF';

    for (let i = 0; i < length; i++) {
      bitstream += hexDigits[Math.floor(Math.random() * hexDigits.length)];
    }

    return bitstream;
  }

  /**
   * Find top N indices by fitness score
   */
  private getTopN(scores: number[], n: number): number[] {
    const indexed = scores.map((score, idx) => [score, idx]);
    indexed.sort((a, b) => b[0] - a[0]);
    return indexed.slice(0, n).map(pair => pair[1]);
  }

  /**
   * Find best individual
   */
  private findBest(scores: number[]): [number, number] {
    let bestIdx = 0;
    let bestScore = scores[0];

    for (let i = 1; i < scores.length; i++) {
      if (scores[i] > bestScore) {
        bestScore = scores[i];
        bestIdx = i;
      }
    }

    return [bestIdx, bestScore];
  }

  /**
   * Get current generation
   */
  getGeneration(): number {
    return this.generation;
  }

  /**
   * Get best configuration found so far
   */
  getBestConfig(): FPGAConfig | null {
    return this.bestConfig ? { ...this.bestConfig } : null;
  }

  /**
   * Get best fitness score
   */
  getBestFitness(): number {
    return this.bestFitness;
  }

  /**
   * Get current population
   */
  getPopulation(): FPGAConfig[] {
    return this.population.map(config => ({ ...config }));
  }

  /**
   * Get fitness scores of current population
   */
  getFitnessScores(): number[] {
    return [...this.fitnessScores];
  }
}
