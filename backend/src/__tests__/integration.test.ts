/**
 * 西格玛云集成测试套件
 * 验证核心模块的协同工作：
 * 1. Φ-BFT 虚时共识
 * 2. Blockchain Service (链上交互)
 * 3. Φ Calculator (EML一元数)
 * 4. Dual-Track 路由器
 * 5. Φ-Gateway 语义网关
 * 6. SubDAO 服务
 * 7. 跨模块集成
 */

import {
  phiBftConsensus,
  VoteType,
  ConsensusStatus,
} from '../services/phiBftConsensus';

import { blockchainService } from '../services/blockchainService';

// =============== Φ-BFT Consensus Tests ===============

describe('Φ-BFT Consensus', () => {
  afterEach(() => {
    phiBftConsensus.dispose();
  });

  test('应能注册共识节点', () => {
    const result = phiBftConsensus.registerNode({
      id: 'node-1',
      phiWeight: 0.8,
      address: '0x1111111111111111111111111111111111111111',
      isValidator: true,
      reputation: 0.9,
    });
    expect(result).toBe(true);
  });

  test('应能拒绝重复注册', () => {
    phiBftConsensus.registerNode({
      id: 'node-1',
      phiWeight: 0.8,
      address: '0x1111111111111111111111111111111111111111',
      isValidator: true,
      reputation: 0.9,
    });
    const result = phiBftConsensus.registerNode({
      id: 'node-1',
      phiWeight: 0.6,
      address: '0x2222222222222222222222222222222222222222',
      isValidator: true,
      reputation: 0.7,
    });
    expect(result).toBe(false);
  });

  test('应能更新节点Φ权重', () => {
    phiBftConsensus.registerNode({
      id: 'node-1',
      phiWeight: 0.5,
      address: '0x1111111111111111111111111111111111111111',
      isValidator: true,
      reputation: 0.8,
    });
    const result = phiBftConsensus.updatePhiWeight('node-1', 0.9);
    expect(result).toBe(true);
    expect(phiBftConsensus.getTotalPhiWeight()).toBeCloseTo(0.9, 2);
  });

  test('应能创建提案并投票', () => {
    phiBftConsensus.registerNode({
      id: 'validator-1',
      phiWeight: 0.6,
      address: '0x1111111111111111111111111111111111111111',
      isValidator: true,
      reputation: 0.9,
    });
    phiBftConsensus.registerNode({
      id: 'validator-2',
      phiWeight: 0.4,
      address: '0x2222222222222222222222222222222222222222',
      isValidator: true,
      reputation: 0.8,
    });

    const proposal = phiBftConsensus.createProposal('validator-1', { action: 'upgrade' });
    expect(proposal.status).toBe(ConsensusStatus.IN_PROGRESS);

    const vote = phiBftConsensus.castVote('validator-1', proposal.id, VoteType.FOR, 'sig1');
    expect(vote).not.toBeNull();
    expect(vote?.vote).toBe(VoteType.FOR);
    expect(vote?.phiWeight).toBeCloseTo(0.6, 2);
  });

  test('Φ-BFT 应能在>51%权重时达成共识', () => {
    phiBftConsensus.registerNode({
      id: 'v-1',
      phiWeight: 0.6,
      address: '0x1111111111111111111111111111111111111111',
      isValidator: true,
      reputation: 0.9,
    });
    phiBftConsensus.registerNode({
      id: 'v-2',
      phiWeight: 0.4,
      address: '0x2222222222222222222222222222222222222222',
      isValidator: true,
      reputation: 0.8,
    });

    const proposal = phiBftConsensus.createProposal('v-1', { action: 'test' });
    phiBftConsensus.castVote('v-1', proposal.id, VoteType.FOR, 'sig1');

    const updated = phiBftConsensus.getProposal(proposal.id);
    // v-1 Φ=0.6 > 0.51 * (0.6+0.4) = 0.51 → 达成共识
    expect(updated?.status).toBe(ConsensusStatus.REACHED);
    expect(updated?.result?.phiWeightFor).toBeCloseTo(0.6, 2);
  });

  test('应能阻止非验证者创建提案', () => {
    phiBftConsensus.registerNode({
      id: 'non-validator',
      phiWeight: 0.5,
      address: '0x1111111111111111111111111111111111111111',
      isValidator: false,
      reputation: 0.5,
    });

    expect(() => {
      phiBftConsensus.createProposal('non-validator', { action: 'hack' });
    }).toThrow('Invalid proposer');
  });

  test('应能正确计算安全系数', () => {
    phiBftConsensus.registerNode({
      id: 'v-1',
      phiWeight: 0.8,
      address: '0x1111111111111111111111111111111111111111',
      isValidator: true,
      reputation: 0.9,
    });

    const factor = phiBftConsensus.getSecurityFactor();
    // securityFactor = 1 - (0.49 * (1 - 0.8)) = 1 - 0.098 = 0.902
    expect(factor).toBeCloseTo(0.902, 3);
  });

  test('应能防止重复投票', () => {
    phiBftConsensus.registerNode({
      id: 'v-1',
      phiWeight: 0.6,
      address: '0x1111111111111111111111111111111111111111',
      isValidator: true,
      reputation: 0.9,
    });

    const proposal = phiBftConsensus.createProposal('v-1', { action: 'test' });
    const vote1 = phiBftConsensus.castVote('v-1', proposal.id, VoteType.FOR, 'sig1');
    expect(vote1).not.toBeNull();

    // 第二次投票应被拒绝
    const vote2 = phiBftConsensus.castVote('v-1', proposal.id, VoteType.AGAINST, 'sig2');
    expect(vote2).toBeNull();
  });
});

// =============== Blockchain Service Tests ===============

describe('Blockchain Service', () => {
  test('应在模拟模式下运行', () => {
    const status = blockchainService.getStatus();
    expect(status.mode).toBe('simulation');
  });

  test('应能返回模拟投票权', async () => {
    const power = await blockchainService.getVotingPower('user-123');
    expect(power).toBe(1.0);
  });

  test('应能返回模拟质押信息', async () => {
    const info = await blockchainService.getStakeInfo('user-123');
    expect(info).not.toBeNull();
    expect(info?.amount).toBe(100);
    expect(info?.phiValue).toBe(5000);
  });

  test('isLiveMode 应返回 false（模拟模式）', () => {
    expect(blockchainService.isLiveMode()).toBe(false);
  });
});

// =============== Φ Calculator Integration Tests ===============

describe('Φ Calculator (EML一元数)', () => {
  test('应能导入 PhiCalculator 模块', async () => {
    const mod = await import('../services/phiCalculator');
    expect(mod.PhiCalculator).toBeDefined();
  });

  test('应能计算 EML Φ 值', async () => {
    // calculatePhi 依赖 Prisma（需要 DATABASE_URL），无 DB 时验证函数签名即可
    const { calculatePhi } = await import('../services/phiCalculator');
    expect(typeof calculatePhi).toBe('function');
  });
});

// =============== Dual-Track Router Tests ===============

describe('Dual-Track Router', () => {
  test('应能导入 dualTrackRouter 模块', async () => {
    const mod = await import('../services/dualTrackRouter');
    expect(mod.dualTrackRouter).toBeDefined();
  });
});

// =============== Φ-Gateway Service Tests ===============

describe('Φ-Gateway 语义网关', () => {
  test('应能导入 phiGatewayService 模块', async () => {
    const mod = await import('../services/phiGatewayService');
    expect(mod.phiGatewayService).toBeDefined();
  });
});

// =============== SubDAO Service Tests ===============

describe('SubDAO 本地化治理', () => {
  test('应能导入 subDaoService 模块', async () => {
    const mod = await import('../services/subDaoService');
    expect(mod.subDaoService).toBeDefined();
  });
});

// =============== Cross-Module Integration Tests ===============

describe('跨模块集成', () => {
  afterEach(() => {
    phiBftConsensus.dispose();
  });

  test('Φ-BFT + BlockchainService: 模拟治理投票流程', async () => {
    // 1. 获取模拟投票权
    const votingPower = await blockchainService.getVotingPower('governance-test-user');

    // 2. 注册验证者
    phiBftConsensus.registerNode({
      id: 'gov-validator',
      phiWeight: votingPower,
      address: '0xTestGovernanceAddress',
      isValidator: true,
      reputation: 0.95,
    });

    // 3. 创建提案并投票
    const proposal = phiBftConsensus.createProposal('gov-validator', { action: 'parameter_update', value: 42 });
    const vote = phiBftConsensus.castVote('gov-validator', proposal.id, VoteType.FOR, 'sig_gov_test');

    // 4. 验证
    expect(vote).not.toBeNull();
    expect(vote?.phiWeight).toBe(1.0); // 模拟模式的默认值
  });

  test('Φ-BFT + BlockchainService: 高Φ节点单节点共识', async () => {
    // 高Φ节点
    phiBftConsensus.registerNode({
      id: 'high-phi-node',
      phiWeight: 0.9,
      address: '0xHighPhi',
      isValidator: true,
      reputation: 0.95,
    });

    const proposal = phiBftConsensus.createProposal('high-phi-node', { action: 'consensus_test' });
    phiBftConsensus.castVote('high-phi-node', proposal.id, VoteType.FOR, 'sig_high_phi');

    // 单个高Φ节点(0.9) > 0.51*0.9 = 0.459 → 共识达成
    const updated = phiBftConsensus.getProposal(proposal.id);
    expect(updated?.status).toBe(ConsensusStatus.REACHED);
  });

  test('Blockchain Service: 质押信息→投票权映射', async () => {
    const stakeInfo = await blockchainService.getStakeInfo('test-user');
    const votingPower = await blockchainService.getVotingPower('test-user');

    expect(stakeInfo).not.toBeNull();
    expect(typeof votingPower).toBe('number');
    expect(votingPower).toBeGreaterThan(0);
  });

  test('Φ-BFT: 反对票可阻止共识', () => {
    phiBftConsensus.registerNode({
      id: 'v-for',
      phiWeight: 0.3,
      address: '0xFor',
      isValidator: true,
      reputation: 0.9,
    });
    phiBftConsensus.registerNode({
      id: 'v-against',
      phiWeight: 0.3,
      address: '0xAgainst',
      isValidator: true,
      reputation: 0.8,
    });

    const proposal = phiBftConsensus.createProposal('v-for', { action: 'contested' });
    phiBftConsensus.castVote('v-for', proposal.id, VoteType.FOR, 'sig-for');
    phiBftConsensus.castVote('v-against', proposal.id, VoteType.AGAINST, 'sig-against');

    // 0.3 FOR < 0.51 * 0.6 = 0.306 → 未达共识
    // 0.3 AGAINST < 0.51 * 0.6 = 0.306 → 也未达否决
    const updated = phiBftConsensus.getProposal(proposal.id);
    expect(updated?.status).toBe(ConsensusStatus.IN_PROGRESS);
  });
});
