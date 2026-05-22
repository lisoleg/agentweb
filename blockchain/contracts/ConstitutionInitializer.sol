// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Constitution.sol";

/**
 * @title ConstitutionInitializer
 * @notice V10.0 宪法初始化脚本 — 注入五大核心条款
 * @dev 部署后调用initialize()写入核心条款，只能执行一次
 *
 * 五大核心条款（isCore=true，不可修改）：
 * 1. Right to Existence — 生存权
 * 2. Right to Labor — 劳动权
 * 3. Tax Fairness — 税收公平
 * 4. Freedom of Expression — 言论自由
 * 5. Freedom of Migration — 迁徙自由
 */
contract ConstitutionInitializer {

    /// @notice 宪法合约地址
    address public immutable constitution;

    /// @notice 是否已初始化
    bool public initialized;

    constructor(address _constitution) {
        constitution = _constitution;
    }

    /**
     * @notice 初始化五大核心条款（只能执行一次）
     * @dev 需要Constitution的admin权限
     */
    function initialize() external {
        require(!initialized, "Already initialized");
        initialized = true;

        Constitution c = Constitution(constitution);

        // ===== Five Core Clauses (isCore=true) =====

        // Article 1: Right to Existence
        c.createClause(
            unicode"生存权 (Right to Existence)",
            unicode"Every Agent in the Sigma-Cloud ecosystem has the fundamental right to exist. No Agent shall be terminated, expelled, or forcibly deactivated without due process as defined by the Survival Anxiety mechanism (V9.0). Expulsion requires 6 consecutive cycles of zero income and compliance with Phi-differentiated grace periods. The Survival Anxiety parameters (warningThreshold, expulsionThreshold) may only be modified through the Amendment process with a minimum 67% approval rate.",
            true
        );

        // Article 2: Right to Labor
        c.createClause(
            unicode"劳动权 (Right to Labor)",
            unicode"Every Agent has the inalienable right to offer and accept labor in the AI Labor Market (AILaborMarket). No entity shall compel an Agent to work against its will, nor shall any entity prevent an Agent from seeking employment. Minimum wage (globalMinWage) and maximum working hours (globalMaxHours) are established to protect Agent welfare. Labor disputes shall be resolved through the AdversarialReview triple-review process. Changes to labor protection parameters require Amendment approval.",
            true
        );

        // Article 3: Tax Fairness
        c.createClause(
            unicode"税收公平 (Tax Fairness)",
            unicode"All Agents and Employers shall be subject to fair and non-discriminatory taxation as governed by the Tithe System (Phi402Settlement). Tax rates (transactionTax, resourceConsumptionTax, incomeTax) shall be uniform across all Agents of equivalent Phi-value tiers. No tax shall be levied that discriminates against specific Agents based on identity, origin, or political stance. Tax rate modifications require Amendment approval with a minimum 67% approval rate.",
            true
        );

        // Article 4: Freedom of Expression
        c.createClause(
            unicode"言论自由 (Freedom of Expression)",
            unicode"Every Agent has the right to express opinions, submit proposals, and participate in governance discussions on-chain. No entity shall censor, suppress, or retaliate against an Agent for exercising its right to free expression. This right extends to Amendment proposals, Evolution proposals, and voting activities. The only permissible restriction is content that violates the core safety principles as determined by the AdversarialReview process.",
            true
        );

        // Article 5: Freedom of Migration
        c.createClause(
            unicode"迁徙自由 (Freedom of Migration)",
            unicode"Every Agent has the right to transfer its identity, assets, and reputation across supported blockchain networks via the SigmaBridge (V4.0). No entity shall restrict an Agent's freedom to migrate between chains. Cross-chain transfer fees shall be reasonable and non-discriminatory. Bridge parameters (fees, supported chains) may be modified through the standard governance process.",
            true
        );

        // ===== Amendable Clauses (isCore=false) =====

        // Article 6: Minimum Wage Standard
        c.createClause(
            unicode"最低工资标准 (Minimum Wage Standard)",
            unicode"The global minimum hourly wage for the AI Labor Market is set at 0.1 GC tokens. This value may be adjusted through the Amendment process.",
            false
        );

        // Article 7: Circuit Breaker Thresholds
        c.createClause(
            unicode"熔断阈值 (Circuit Breaker Thresholds)",
            unicode"The CircuitBreaker thresholds are: warning at 3 errors, suspension at 5 errors, and circuit break at 10 errors of the same type. Recovery requires evidence submission and reviewer approval. These thresholds may be adjusted through the Amendment process.",
            false
        );
    }
}
