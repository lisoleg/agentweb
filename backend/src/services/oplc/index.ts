/**
 * OPLC (奇正格链) 模块统一导出
 *
 * @version V15.0
 */

// 核心类型
export * from './types';

// Merkle Proof 验证器
export { buildMerkleTree, generateProof, verifyMerkleProof, batchVerifyProofs, calculateTopologicalImpedance } from './merkleProof';
export type { MerkleNode, MerkleTree, PhiMetricImpedance } from './merkleProof';

// 偏序格引擎
export { PosetEngine } from './posetEngine';

// 三进制投票状态机
export { TernaryVoteEngine, VotingRound, DEFAULT_VOTE_CONFIG } from './ternaryVoteMachine';
export type { TernaryVoteConfig } from './ternaryVoteMachine';

// OP-BFT 共识
export { OpBftConsensus, DEFAULT_OPBFT_CONFIG } from './opBftConsensus';
export type { OpBftConfig } from './opBftConsensus';

// 核心服务（主入口）
export { OPLCCoreService, createOPLC, DEFAULT_OPLC_CONFIG } from './oplcCoreService';
export type { OPLCSystemConfig } from './oplcCoreService';
