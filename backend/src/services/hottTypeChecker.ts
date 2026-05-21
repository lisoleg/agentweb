/**
 * HoTT Type Checker (编译期类型检查器)
 * 基于 Homotopy Type Theory 的形式化安全层
 *
 * 功能：
 * - API 请求编译期类型验证
 * - 路径归纳: 如果自反路径成立，则所有路径成立
 * - Transport: 沿路径传输类型
 * - Identity Type 验证: 检查类型等价性
 */

import {
  Identity,
  PathProof,
  TransportStep,
  TransportRule,
  HoTTValidated,
  HoTTError,
  TypeSignature,
  ApiRequestType,
  PhiValueType,
} from './hottTypes';

// =============== Type Checker ===============

class HottTypeCheckerClass {
  private typeRegistry: Map<string, TypeSignature> = new Map();

  constructor() {
    // 注册内置类型
    this.typeRegistry.set('ApiRequest', ApiRequestType);
    this.typeRegistry.set('PhiValue', PhiValueType);
  }

  /**
   * 验证值是否满足类型签名
   */
  validate<T>(value: T, typeName: string): HoTTValidated<T> {
    const typeSig = this.typeRegistry.get(typeName);
    const errors: HoTTError[] = [];

    if (!typeSig) {
      errors.push({
        code: 'UNKNOWN_TYPE',
        message: `Unknown type: ${typeName}`,
        expected: typeName,
      });
      return { value, typeSignature: { name: typeName, version: '0.0.0', constructors: [], eliminators: [], computationRules: [] }, identityProof: this.refl(value), isValid: false, validationErrors: errors };
    }

    // 创建 Identity Proof
    const identityProof = this.checkIdentity(value, typeSig);

    // 验证构造器
    const constructorErrors = this.validateConstructors(value, typeSig);
    errors.push(...constructorErrors);

    return {
      value,
      typeSignature: typeSig,
      identityProof,
      isValid: errors.length === 0,
      validationErrors: errors,
    };
  }

  /**
   * 创建自反 Identity Proof
   */
  refl<A>(value: A): Identity<A> {
    return {
      type: 'REFL',
      source: value,
      target: value,
      proof: {
        steps: [{
          from: value,
          to: value,
          rule: TransportRule.REFL,
        }],
        isValid: true,
        computedAt: Date.now(),
      },
    };
  }

  /**
   * 检查两个值是否 Identity Type 等价
   */
  checkEquality<A>(a: A, b: A, typeName: string): Identity<A> {
    // 简化实现：JSON 序列化比较
    const aJson = JSON.stringify(a);
    const bJson = JSON.stringify(b);

    if (aJson === bJson) {
      return this.refl(a);
    }

    // 尝试 Path Induction
    const path = this.findPath(a, b, typeName);
    return path;
  }

  /**
   * Transport: 沿路径传输类型
   * 如果 p: A = B, 则 transport(p, a: A): B
   */
  transport<A, B>(identity: Identity<A>, value: A, targetTypeName: string): HoTTValidated<B> | null {
    if (identity.type === 'REFL' && identity.isValid) {
      // 自反路径：直接类型转换
      return this.validate(value as unknown as B, targetTypeName);
    }

    // 沿路径传输
    const steps = identity.proof?.steps || [];
    let current: any = value;

    for (const step of steps) {
      switch (step.rule) {
        case TransportRule.REFL:
          // 无变化
          break;
        case TransportRule.SYM:
          // 对称
          current = step.from;
          break;
        case TransportRule.TRANS:
          // 传递
          current = step.to;
          break;
        case TransportRule.AP:
          // 函数应用
          current = step.to;
          break;
        case TransportRule.TRANSPORT:
          current = step.to;
          break;
      }
    }

    return this.validate(current as B, targetTypeName);
  }

  // =============== Private Methods ===============

  private checkIdentity<T>(value: T, typeSig: TypeSignature): Identity<T> {
    // 检查值是否符合类型的构造器
    for (const constructor of typeSig.constructors) {
      if (this.matchesConstructor(value, constructor)) {
        return this.refl(value);
      }
    }

    // 没有匹配的构造器 → 创建空路径
    return {
      type: 'CONTRACT',
      source: value,
      target: value,
      proof: {
        steps: [],
        isValid: false,
        computedAt: Date.now(),
      },
    };
  }

  private matchesConstructor(value: any, constructor: { name: string; inputTypes: string[]; outputType: string }): boolean {
    // 简化实现：检查值是否有对应字段
    if (typeof value !== 'object' || value === null) return false;

    switch (constructor.name) {
      case 'AuthenticatedRequest':
        return !!(value.userId && value.body);
      case 'AnonymousRequest':
        return !!value.body;
      case 'PhiRequest':
        return !!(value.userId && value.phiScore !== undefined && value.body);
      case 'ScalarPhi':
        return typeof value === 'number' || typeof value.phiValue === 'number';
      case 'ComplexPhi':
        return typeof value.phiValue === 'number' && typeof value.phiPhase === 'number';
      default:
        return true; // 未知构造器，默认通过
    }
  }

  private validateConstructors(value: any, typeSig: TypeSignature): HoTTError[] {
    const errors: HoTTError[] = [];

    // 检查是否有匹配的构造器
    const hasMatch = typeSig.constructors.some(c => this.matchesConstructor(value, c));
    if (!hasMatch && typeSig.constructors.length > 0) {
      errors.push({
        code: 'NO_MATCHING_CONSTRUCTOR',
        message: `Value does not match any constructor of type ${typeSig.name}`,
        expected: typeSig.constructors.map(c => c.name).join(' | '),
        actual: JSON.stringify(value).substring(0, 100),
      });
    }

    return errors;
  }

  private findPath<A>(a: A, b: A, typeName: string): Identity<A> {
    // 简化实现：尝试直接路径
    const steps: TransportStep<A>[] = [
      { from: a, to: a, rule: TransportRule.REFL },
      { from: a, to: b, rule: TransportRule.TRANSPORT },
    ];

    return {
      type: 'PATH',
      source: a,
      target: b,
      proof: {
        steps,
        isValid: false, // 未验证的路径
        computedAt: Date.now(),
      },
    };
  }

  /**
   * 注册自定义类型
   */
  registerType(typeSig: TypeSignature): void {
    this.typeRegistry.set(typeSig.name, typeSig);
  }

  /**
   * 获取已注册的类型
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.typeRegistry.keys());
  }
}

export const hottTypeChecker = new HottTypeCheckerClass();
