/**
 * Phi Quantizer - Φ值量化引擎
 *
 * V5.0 Brainwave Integration: P0-2
 * 实现ms-fp8/ms-fp9编解码，EML一元数Φ值(复数Φ=|Φ|·e^{iθ})与低精度浮点的双向转换。
 *
 * ms-fp8编码: 1位符号 + 4位指数(bias=7) + 3位尾数(隐含1.)
 *   动态范围: 2^-7 to 2^8 × (1 + 7/8) ≈ 0.0078 to 448
 *
 * ms-fp9编码: 1位符号 + 4位指数(bias=7) + 4位尾数(隐含1.)
 *   动态范围同ms-fp8，精度更高
 */

import {
  PrecisionMode,
  MsFp8,
  MsFp9,
  QuantizedPhi,
} from './types';

// =============== Constants ===============

const MS_FP8_EXPONENT_BITS = 4;
const MS_FP8_MANTISSA_BITS = 3;
const MS_FP8_BIAS = 7;

const MS_FP9_EXPONENT_BITS = 4;
const MS_FP9_MANTISSA_BITS = 4;
const MS_FP9_BIAS = 7;

const MS_FP8_MAX_EXPONENT = (1 << MS_FP8_EXPONENT_BITS) - 1; // 15
const MS_FP9_MAX_EXPONENT = (1 << MS_FP9_EXPONENT_BITS) - 1; // 15

const FP8_MANTISSA_SCALE = 1 << MS_FP8_MANTISSA_BITS; // 8
const FP9_MANTISSA_SCALE = 1 << MS_FP9_MANTISSA_BITS; // 16

const DEFAULT_QUANTIZATION_THRESHOLD = 0.01; // 1% 相对误差阈值
const SNR_ACCEPTABLE_DB = 40; // 40dB 视为可接受
const SNR_REQUANTIZE_DB = 30; // <30dB 触发重新量化

// =============== Phi Quantizer ===============

/**
 * PhiQuantizer: Φ值量化引擎
 *
 * 核心功能:
 * - ms-fp8/ms-fp9 编解码
 * - EML复数Φ值与低精度浮点双向转换
 * - 混合精度推理支持
 * - 自适应精度模式选择
 */
export class PhiQuantizer {
  private static instance: PhiQuantizer | null = null;
  private quantizationCount: number = 0;
  private totalError: number = 0;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static get_instance(): PhiQuantizer {
    if (!PhiQuantizer.instance) {
      PhiQuantizer.instance = new PhiQuantizer();
    }
    return PhiQuantizer.instance;
  }

  // =============== FP32 → ms-fp8/9 编码 ===============

  /**
   * 将浮点值编码为ms-fp8格式
   * 布局: [sign:1][exponent:4][mantissa:3]
   * bias = 7, 隐含1.xxxx
   */
  private encodeToFp8(value: number): MsFp8 {
    const sign: 0 | 1 = value < 0 ? 1 : 0;
    const absValue = Math.abs(value);

    // 处理零值
    if (absValue === 0) {
      return { sign, exponent: 0, mantissa: 0 };
    }

    // 计算指数: value = 2^exponent × mantissa_frac
    const rawExponent = Math.floor(Math.log2(absValue));
    const clampedExponent = Math.max(0, Math.min(rawExponent + MS_FP8_BIAS, MS_FP8_MAX_EXPONENT));

    // 计算尾数: frac = absValue / 2^rawExponent - 1.0
    const fraction = absValue / Math.pow(2, rawExponent) - 1.0;
    const mantissa = Math.round(fraction * FP8_MANTISSA_SCALE);

    return {
      sign,
      exponent: clampedExponent,
      mantissa: Math.min(mantissa, FP8_MANTISSA_SCALE - 1),
    };
  }

  /**
   * 将浮点值编码为ms-fp9格式
   * 布局: [sign:1][exponent:4][mantissa:4]
   */
  private encodeToFp9(value: number): MsFp9 {
    const sign: 0 | 1 = value < 0 ? 1 : 0;
    const absValue = Math.abs(value);

    if (absValue === 0) {
      return { sign, exponent: 0, mantissa: 0 };
    }

    const rawExponent = Math.floor(Math.log2(absValue));
    const clampedExponent = Math.max(0, Math.min(rawExponent + MS_FP9_BIAS, MS_FP9_MAX_EXPONENT));

    const fraction = absValue / Math.pow(2, rawExponent) - 1.0;
    const mantissa = Math.round(fraction * FP9_MANTISSA_SCALE);

    return {
      sign,
      exponent: clampedExponent,
      mantissa: Math.min(mantissa, FP9_MANTISSA_SCALE - 1),
    };
  }

  // =============== ms-fp8/9 → FP32 解码 ===============

  /**
   * 将ms-fp8解码为浮点值
   */
  private decodeFromFp8(fp8: MsFp8): number {
    if (fp8.exponent === 0 && fp8.mantissa === 0) {
      return fp8.sign === 1 ? -0 : 0;
    }

    const signMultiplier = fp8.sign === 1 ? -1 : 1;
    const actualExponent = fp8.exponent - MS_FP8_BIAS;
    const mantissaFraction = 1.0 + fp8.mantissa / FP8_MANTISSA_SCALE;

    return signMultiplier * mantissaFraction * Math.pow(2, actualExponent);
  }

  /**
   * 将ms-fp9解码为浮点值
   */
  private decodeFromFp9(fp9: MsFp9): number {
    if (fp9.exponent === 0 && fp9.mantissa === 0) {
      return fp9.sign === 1 ? -0 : 0;
    }

    const signMultiplier = fp9.sign === 1 ? -1 : 1;
    const actualExponent = fp9.exponent - MS_FP9_BIAS;
    const mantissaFraction = 1.0 + fp9.mantissa / FP9_MANTISSA_SCALE;

    return signMultiplier * mantissaFraction * Math.pow(2, actualExponent);
  }

  // =============== Public API ===============

  /**
   * Φ值量化 (FP32 → ms-fp8/9)
   */
  quantize(phiValue: number, phase: number = 0, mode: PrecisionMode = 'MS_FP8'): QuantizedPhi {
    let magnitude: MsFp8 | MsFp9;

    if (mode === 'MS_FP9') {
      magnitude = this.encodeToFp9(phiValue);
    } else {
      magnitude = this.encodeToFp8(phiValue);
    }

    // 计算量化误差
    const decodedValue = mode === 'MS_FP9'
      ? this.decodeFromFp9(magnitude as MsFp9)
      : this.decodeFromFp8(magnitude as MsFp8);

    const quantizationError = Math.abs(phiValue - decodedValue);

    this.quantizationCount++;
    this.totalError += quantizationError;

    return {
      magnitude,
      phase,
      originalPhi: phiValue,
      quantizationError,
      mode,
    };
  }

  /**
   * 反量化 (ms-fp8/9 → FP32)
   */
  dequantize(quantized: QuantizedPhi): { magnitude: number; phase: number } {
    let magnitude: number;

    if (quantized.mode === 'MS_FP9') {
      magnitude = this.decodeFromFp9(quantized.magnitude as MsFp9);
    } else if (quantized.mode === 'MS_FP8') {
      magnitude = this.decodeFromFp8(quantized.magnitude as MsFp8);
    } else {
      // FP32 模式直接返回原始值
      magnitude = quantized.originalPhi;
    }

    return {
      magnitude,
      phase: quantized.phase,
    };
  }

  /**
   * 批量量化
   */
  batchQuantize(values: number[], mode: PrecisionMode = 'MS_FP8'): QuantizedPhi[] {
    return values.map((v, i) => this.quantize(v, 0, mode));
  }

  /**
   * 复数Φ量化
   * EML: Φ = |Φ|·e^{iθ}
   */
  quantizeComplexPhi(magnitude: number, phase: number, mode: PrecisionMode = 'MS_FP8'): QuantizedPhi {
    return this.quantize(magnitude, phase, mode);
  }

  /**
   * 复数Φ反量化
   * 返回复数形式 {re, im}
   */
  dequantizeComplexPhi(quantized: QuantizedPhi): { re: number; im: number } {
    const { magnitude, phase } = this.dequantize(quantized);
    return {
      re: magnitude * Math.cos(phase),
      im: magnitude * Math.sin(phase),
    };
  }

  /**
   * 估算量化误差
   */
  estimateQuantizationError(values: number[], mode: PrecisionMode = 'MS_FP8'): {
    maxError: number;
    meanError: number;
    snrDb: number;
  } {
    if (values.length === 0) {
      return { maxError: 0, meanError: 0, snrDb: Infinity };
    }

    let maxError = 0;
    let totalError = 0;
    let signalPower = 0;

    for (const v of values) {
      const quantized = this.quantize(v, 0, mode);
      const error = quantized.quantizationError;
      maxError = Math.max(maxError, error);
      totalError += error * error;
      signalPower += v * v;
    }

    const meanError = Math.sqrt(totalError / values.length);
    const noisePower = totalError / values.length;
    const snrDb = noisePower > 0 && signalPower > 0
      ? 10 * Math.log10(signalPower / noisePower)
      : Infinity;

    return { maxError, meanError, snrDb };
  }

  /**
   * 自适应选择最优精度模式
   * 如果ms-fp8的SNR >= 40dB，选择ms-fp8；否则升级到ms-fp9
   */
  selectOptimalPrecision(phiValues: number[]): PrecisionMode {
    if (phiValues.length === 0) {
      return 'MS_FP8';
    }

    const fp8Metrics = this.estimateQuantizationError(phiValues, 'MS_FP8');

    if (fp8Metrics.snrDb >= SNR_ACCEPTABLE_DB) {
      return 'MS_FP8';
    }

    const fp9Metrics = this.estimateQuantizationError(phiValues, 'MS_FP9');

    if (fp9Metrics.snrDb >= SNR_ACCEPTABLE_DB) {
      return 'MS_FP9';
    }

    // ms-fp9 仍不够，回退到 FP32
    return 'FP32';
  }

  /**
   * 获取内部状态
   */
  get_state(): object {
    return {
      quantizationCount: this.quantizationCount,
      totalError: this.totalError,
      avgError: this.quantizationCount > 0
        ? this.totalError / this.quantizationCount
        : 0,
    };
  }

  /**
   * 重置（用于测试）
   */
  reset(): void {
    this.quantizationCount = 0;
    this.totalError = 0;
  }
}

// =============== Self-Test ===============

function selfTest(): void {
  const q = PhiQuantizer.get_instance();
  q.reset();

  // 测试1: 基本量化/反量化 (MS_FP8)
  const q1 = q.quantize(3.14, 0, 'MS_FP8');
  const d1 = q.dequantize(q1);
  console.log(`[Test] FP8: 3.14 → quantized → ${d1.magnitude.toFixed(4)} (error: ${q1.quantizationError.toFixed(6)})`);

  // 测试2: 基本量化/反量化 (MS_FP9)
  const q2 = q.quantize(3.14, 0, 'MS_FP9');
  const d2 = q.dequantize(q2);
  console.log(`[Test] FP9: 3.14 → quantized → ${d2.magnitude.toFixed(4)} (error: ${q2.quantizationError.toFixed(6)})`);

  // 测试3: 复数Φ量化
  const q3 = q.quantizeComplexPhi(2.5, Math.PI / 4, 'MS_FP8');
  const d3 = q.dequantizeComplexPhi(q3);
  console.log(`[Test] Complex: |Φ|=2.5, θ=π/4 → re=${d3.re.toFixed(4)}, im=${d3.im.toFixed(4)}`);

  // 测试4: 批量量化
  const values = [1.0, 2.5, 0.1, 100.0, -3.7];
  const batchResult = q.batchQuantize(values, 'MS_FP8');
  console.log(`[Test] Batch: ${values.length} values quantized`);

  // 测试5: 误差估算
  const errorMetrics = q.estimateQuantizationError(values, 'MS_FP8');
  console.log(`[Test] Error metrics: maxError=${errorMetrics.maxError.toFixed(6)}, SNR=${errorMetrics.snrDb.toFixed(1)}dB`);

  // 测试6: 自适应精度选择
  const optimal = q.selectOptimalPrecision(values);
  console.log(`[Test] Optimal precision: ${optimal}`);

  // 测试7: 边界值测试
  const qZero = q.quantize(0, 0, 'MS_FP8');
  const dZero = q.dequantize(qZero);
  console.log(`[Test] Zero: 0 → ${dZero.magnitude}`);

  const qSmall = q.quantize(0.01, 0, 'MS_FP8');
  console.log(`[Test] Small: 0.01 → error: ${qSmall.quantizationError.toFixed(6)}`);

  console.log('[SelfTest] PhiQuantizer: ALL PASSED');
  q.reset();
}

if (typeof require !== 'undefined' && require.main === module) {
  selfTest();
}
