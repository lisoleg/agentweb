/**
 * OPLC Merkle Proof 验证器
 *
 * 负责验证 -1 (揭发/Odd) 票附带的 Merkle Proof 证据。
 * 验证复杂度 O(n)，构成流贯的拓扑阻抗。
 *
 * 核心功能：
 * 1. 构建 Merkle Tree
 * 2. 生成 Merkle Proof（审计/揭发时使用）
 * 3. 验证 Merkle Proof（共识投票时使用）
 *
 * @version V15.0
 * @reference 微信文章《奇正格链》§4.3 三进制投票状态空间
 */

import * as crypto from 'crypto';

/**
 * SHA-256 哈希函数 — OPLC 的基础哈希
 */
export function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Merkle Tree 节点
 */
export interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
  /** 叶子节点对应的原始数据索引 */
  leafIndex?: number;
}

/**
 * Merkle Tree 完整结构
 */
export interface MerkleTree {
  root: MerkleNode;
  leaves: MerkleNode[];
  depth: number;
}

/**
 * 从交易哈希列表构建 Merkle Tree
 *
 * @param txHashes 交易哈希列表（有序）
 * @returns 完整的 Merkle Tree
 *
 * 构建规则：
 * - 偶数个叶子：两两配对
 * - 奇数个叶子：最后一个复制一份与自己配对
 */
export function buildMerkleTree(txHashes: string[]): MerkleTree {
  if (txHashes.length === 0) {
    throw new Error('Cannot build Merkle tree with empty transaction list');
  }

  // 创建叶子节点
  const leaves: MerkleNode[] = txHashes.map((hash, index) => ({
    hash,
    leafIndex: index,
  }));

  // 如果只有一个叶子，它本身就是根
  if (leaves.length === 1) {
    return { root: leaves[0], leaves, depth: 0 };
  }

  // 自底向上构建树
  let currentLevel: MerkleNode[] = [...leaves];
  let depth = 0;

  while (currentLevel.length > 1) {
    const nextLevel: MerkleNode[] = [];

    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      // 奇数节点：复制自己作为右兄弟
      const right = currentLevel[i + 1] || currentLevel[i];

      const combinedHash = left.hash + right.hash;
      nextLevel.push({
        hash: sha256(combinedHash),
        left,
        right,
      });
    }

    currentLevel = nextLevel;
    depth++;
  }

  return { root: currentLevel[0], leaves, depth };
}

/**
 * 为指定叶子生成 Merkle Proof
 *
 * @param tree Merkle Tree
 * @param leafIndex 叶子索引
 * @returns Merkle Proof 路径
 *
 * 用途：
 * - 审计员(Auditor)在揭发(-1票)时附带此证明
 * - 证明某笔交易确实在(或不在)某个区块中
 */
export function generateProof(
  tree: MerkleTree,
  leafIndex: number
): { path: { hash: string; isRight: boolean }[]; rootHash: string } {
  if (leafIndex < 0 || leafIndex >= tree.leaves.length) {
    throw new Error(`Leaf index ${leafIndex} out of bounds [0, ${tree.leaves.length})`);
  }

  const path: { hash: string; isRight: boolean }[] = [];

  // 从叶子到根遍历，收集兄弟节点的哈希
  // 使用 BFS 层级遍历来定位路径
  type QueueItem = { node: MerkleNode; index: number; siblingIndices: number[] };

  function findPath(
    nodes: MerkleNode[],
    targetIdx: number,
    siblings: Array<{ hash: string; isRight: boolean }>
  ): boolean {
    // 检查是否到达叶子层
    if (nodes[0]?.leafIndex !== undefined) {
      return true; // 到达叶子层，siblings 已收集完毕
    }

    const nextLevel: MerkleNode[] = [];

    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i];
      const right = nodes[i + 1] || nodes[i]; // 奇数处理

      // 确定目标在哪一侧
      const targetInLeft = i === targetIdx || (i + 1 <= targetIdx && targetIdx < i + 2 && nodes[i + 1] !== undefined);

      if (left && right) {
        if (targetIdx % 2 === 0 || (i === targetIdx)) {
          // 目标在左子树，收集右兄弟
          if (right !== left) { // 不是自配对的情况
            siblings.push({ hash: right.hash, isRight: true });
          }
        } else {
          // 目标在右子树，收集左兄弟
          siblings.push({ hash: left.hash, isRight: false });
        }
      }

      nextLevel.push(left);
      if (right && right !== left) nextLevel.push(right);
    }

    // 计算下一层的目标索引
    const nextTargetIdx = Math.floor(targetIdx / 2);
    return findPath(nextLevel, nextTargetIdx, siblings);
  }

  // 更简洁的实现：直接从叶子向上回溯
  function collectPathFromLeaf(
    targetHash: string,
    levelNodes: MerkleNode[],
    collectedSiblings: Array<{ hash: string; isRight: boolean }>
  ): void {
    if (levelNodes.length <= 1) return; // 到达根

    // 找到目标节点在这一层的索引
    const idx = levelNodes.findIndex(n => n.hash === targetHash || n.leafIndex === leafIndex);
    if (idx === -1) return;

    // 确定配对关系
    const partnerIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    const partner = levelNodes[partnerIdx];

    if (partner && partner !== levelNodes[idx]) {
      collectedSiblings.push({
        hash: partner.hash,
        isRight: idx % 2 === 0, // 当前是左节点，兄弟在右边
      });
    }
  }

  // 简化版：直接用层级数组重建路径
  const allLevels: MerkleNode[][] = [];
  let level: MerkleNode[] = tree.leaves;

  while (level.length > 0) {
    allLevels.push(level);
    const next: MerkleNode[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] || level[i];
      next.push({ hash: left.hash + (right?.hash || ''), left, right }); // 占位符
    }
    level = next;
  }

  // 使用更直接的算法
  const proofPath = computeMerklePath(tree, leafIndex);

  return {
    path: proofPath,
    rootHash: tree.root.hash,
  };
}

/**
 * 计算 Merkle Path 的核心算法
 */
function computeMerklePath(
  tree: MerkleTree,
  leafIndex: number
): { hash: string; isRight: boolean }[] {
  const path: { hash: string; isRight: boolean }[] = [];
  // 从叶子节点开始
  let currentNode = tree.leaves[leafIndex];

  // 我们需要从底向上遍历树
  // 由于我们的树结构是从下往上构建的，需要特殊处理

  // 替代方案：重新计算每层的兄弟哈希
  const leafHashes = tree.leaves.map(l => l.hash);
  let currentHashes = [...leafHashes];
  let currentIndex = leafIndex;

  while (currentHashes.length > 1) {
    const isLeftChild = currentIndex % 2 === 0;
    const siblingIndex = isLeftChild ? currentIndex + 1 : currentIndex - 1;

    // 收集兄弟哈希（如果存在且不是自引用）
    if (siblingIndex < currentHashes.length && siblingIndex !== currentIndex) {
      path.push({
        hash: currentHashes[siblingIndex],
        isRight: isLeftChild, // 我是左孩子，兄弟在右
      });
    }

    // 进入下一层
    const nextHashes: string[] = [];
    for (let i = 0; i < currentHashes.length; i += 2) {
      const left = currentHashes[i];
      const right = currentHashes[i + 1] || currentHashes[i]; // 奇数个时自配对
      nextHashes.push(sha256(left + right));
    }

    currentHashes = nextHashes;
    currentIndex = Math.floor(currentIndex / 2);
  }

  return path;
}

/**
 * 验证 Merkle Proof
 *
 * @param targetHash 目标交易哈希
 * @param proof Merkle Proof 路径
 * @param expectedRoot 期望的 Merkle Root
 * @returns 验证结果
 *
 * 验证复杂度：O(n)，n = proof path 长度
 * 对应流贯动力学中的「拓扑阻抗」
 */
export function verifyMerkleProof(
  targetHash: string,
  proof: { hash: string; isRight: boolean }[],
  expectedRoot: string
): { valid: boolean; computedRoot: string; verificationSteps: number } {
  let currentHash = targetHash;
  let steps = 0;

  for (const sibling of proof) {
    steps++;
    if (sibling.isRight) {
      // 当前哈希是左节点，兄弟在右边
      currentHash = sha256(currentHash + sibling.hash);
    } else {
      // 当前哈希是右节点，兄弟在左边
      currentHash = sha256(sibling.hash + currentHash);
    }
  }

  return {
    valid: currentHash === expectedRoot,
    computedRoot: currentHash,
    verificationSteps: steps,
  };
}

/**
 * 批量验证多个 Merkle Proof（用于 -1 票的证据批量校验）
 *
 * @param proofs 待验证的证明列表
 * @returns 每个证明的验证结果
 */
export function batchVerifyProofs(
  proofs: Array<{
    targetHash: string;
    proof: { hash: string; isRight: boolean }[];
    expectedRoot: string;
  }>
): Array<{ valid: boolean; latencyNs: number }> {
  const start = process.hrtime.bigint();

  return proofs.map(p => {
    const tStart = process.hrtime.bigint();
    const result = verifyMerkleProof(p.targetHash, p.proof, p.expectedRoot);
    const tEnd = process.hrtime.bigint();

    return {
      valid: result.valid,
      latencyNs: Number(tEnd - tStart),
    };
  });
}

/**
 * 计算拓扑阻抗指标
 *
 * Merkle Proof 验证的 O(n) 复杂度带来的系统开销度量
 * 对应文章 §6.1 的风险分析
 */
export function calculateTopologicalImpedance(
  proofCount: number,
  avgProofLength: number,
  baseLatencyMs: number = 0.01
): PhiMetricImpedance {
  const totalOps = proofCount * avgProofLength;
  const estimatedLatencyMs = baseLatencyMs * totalOps;

  return {
    totalVerificationOps: totalOps,
    estimatedLatencyMs,
    impedanceLevel:
      estimatedLatencyMs < 100 ? 'LOW' :
      estimatedLatencyMs < 1000 ? 'MEDIUM' :
      'HIGH',
    riskAssessment:
      proofCount > 1000
        ? 'WARNING: High accusation volume may cause topology stress'
        : 'NORMAL',
  };
}

/** 拓扑阻抗指标 */
export interface PhiMetricImpedance {
  totalVerificationOps: number;
  estimatedLatencyMs: number;
  impedanceLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskAssessment: string;
}
