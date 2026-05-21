"""
Goldbach Module Classifier (堆垒素数模块分类器)
基于 Paper 3 "太一万有理论白皮书" 的堆垒素数概念

核心思想：
- 哥德巴赫猜想：每个≥4的偶数 = 两个素数之和
- 奇数 = 费米子型模块（排他锁，互斥访问）
- 偶数 = 玻色子型模块（共享锁，并发访问）
- 模块ID的奇偶性决定其锁策略

数学基础：
- 堆垒素数定理：任何充分大的偶数可表示为两个素数之和
- 费米子型：服从泡利不相容原理（同态排斥）
- 玻色子型：服从玻色-爱因斯坦统计（同态凝聚）
"""

import math
from typing import Dict, List, Optional, Tuple
from enum import Enum
from loguru import logger


class ModuleParity(Enum):
    """模块奇偶性"""
    FERMION = "FERMION"   # 奇数 → 费米子型（排他锁）
    BOSON = "BOSON"        # 偶数 → 玻色子型（共享锁）


class LockStrategy(Enum):
    """锁策略"""
    EXCLUSIVE = "EXCLUSIVE"    # 排他锁（费米子型）
    SHARED = "SHARED"          # 共享锁（玻色子型）
    DEADLOCK_FREE = "DEADLOCK_FREE"  # 无死锁策略


class GoldbachClassifier:
    """
    堆垒素数模块分类器

    基于 Goldbach 猜想的模块锁策略分类：
    - 奇数模块 ID → 费米子型 → 排他锁
    - 偶数模块 ID → 玻色子型 → 共享锁
    - Goldbach 分解：偶数模块可分解为两个素数模块之和
    """

    def __init__(self):
        self._prime_cache: Dict[int, bool] = {}
        self._goldbach_cache: Dict[int, Optional[Tuple[int, int]]] = {}
        self._module_registry: Dict[int, Dict] = {}
        logger.info("GoldbachClassifier initialized")

    # =============== 素数判定 ===============

    def is_prime(self, n: int) -> bool:
        """Miller-Rabin 素性测试"""
        if n in self._prime_cache:
            return self._prime_cache[n]

        if n < 2:
            result = False
        elif n < 4:
            result = True
        elif n % 2 == 0:
            result = False
        elif n < 100:
            # 小素数直接试除
            result = all(n % i != 0 for i in range(3, int(math.sqrt(n)) + 1, 2))
        else:
            # Miller-Rabin
            result = self._miller_rabin(n)

        self._prime_cache[n] = result
        return result

    def _miller_rabin(self, n: int, k: int = 5) -> bool:
        """Miller-Rabin 素性测试"""
        if n < 2:
            return False
        if n == 2 or n == 3:
            return True
        if n % 2 == 0:
            return False

        # n-1 = 2^r * d
        r, d = 0, n - 1
        while d % 2 == 0:
            r += 1
            d //= 2

        # 测试基
        witnesses = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37][:k]

        for a in witnesses:
            if a >= n:
                continue
            x = pow(a, d, n)
            if x == 1 or x == n - 1:
                continue
            for _ in range(r - 1):
                x = pow(x, 2, n)
                if x == n - 1:
                    break
            else:
                return False
        return True

    # =============== Goldbach 分解 ===============

    def goldbach_decompose(self, n: int) -> Optional[Tuple[int, int]]:
        """
        Goldbach 分解：将偶数分解为两个素数之和

        Args:
            n: 偶数 (≥4)

        Returns:
            (p1, p2) 使得 p1 + p2 = n，且 p1 ≤ p2
            如果无法分解返回 None
        """
        if n in self._goldbach_cache:
            return self._goldbach_cache[n]

        if n < 4 or n % 2 != 0:
            self._goldbach_cache[n] = None
            return None

        # 尝试分解
        for p in range(2, n // 2 + 1):
            if self.is_prime(p) and self.is_prime(n - p):
                result = (p, n - p)
                self._goldbach_cache[n] = result
                logger.debug(f"Goldbach decomposition: {n} = {p} + {n - p}")
                return result

        self._goldbach_cache[n] = None
        return None

    # =============== 模块分类 ===============

    def classify_module(self, module_id: int) -> Dict:
        """
        分类模块

        Args:
            module_id: 模块ID

        Returns:
            分类结果
        """
        parity = ModuleParity.FERMION if module_id % 2 == 1 else ModuleParity.BOSON
        lock_strategy = LockStrategy.EXCLUSIVE if parity == ModuleParity.FERMION else LockStrategy.SHARED

        result = {
            "module_id": module_id,
            "parity": parity.value,
            "lock_strategy": lock_strategy.value,
            "is_prime": self.is_prime(module_id),
            "goldbach_decomposition": None,
        }

        # 玻色子型模块尝试 Goldbach 分解
        if parity == ModuleParity.BOSON and module_id >= 4:
            decomposition = self.goldbach_decompose(module_id)
            if decomposition:
                result["goldbach_decomposition"] = {
                    "prime_1": decomposition[0],
                    "prime_2": decomposition[1],
                    "verification": f"{decomposition[0]} + {decomposition[1]} = {module_id}",
                    "sub_modules": [
                        self.classify_module(decomposition[0]),
                        self.classify_module(decomposition[1]),
                    ],
                }

        # 注册模块
        self._module_registry[module_id] = result

        return result

    def get_lock_strategy(self, module_id: int) -> LockStrategy:
        """获取模块的锁策略"""
        if module_id % 2 == 1:
            return LockStrategy.EXCLUSIVE  # 费米子型 → 排他锁
        else:
            return LockStrategy.SHARED      # 玻色子型 → 共享锁

    def can_acquire_lock(self, module_id: int, current_locks: List[int], request_type: str = "shared") -> bool:
        """
        检查是否可以获取锁

        Args:
            module_id: 目标模块ID
            current_locks: 当前持有锁的模块列表
            request_type: 请求类型 ("shared" 或 "exclusive")

        Returns:
            是否可以获取锁
        """
        strategy = self.get_lock_strategy(module_id)

        if strategy == LockStrategy.EXCLUSIVE:
            # 费米子型：排他锁，不允许并发
            return module_id not in current_locks and request_type == "exclusive"
        else:
            # 玻色子型：共享锁，允许多个读取
            if request_type == "shared":
                return True  # 共享锁总是可以获取
            else:
                return module_id not in current_locks  # 写锁需要排他

    def batch_classify(self, module_ids: List[int]) -> Dict[str, any]:
        """
        批量分类模块

        Args:
            module_ids: 模块ID列表

        Returns:
            分类结果汇总
        """
        results = {}
        fermion_count = 0
        boson_count = 0
        prime_count = 0

        for mid in module_ids:
            result = self.classify_module(mid)
            results[str(mid)] = result
            if result["parity"] == "FERMION":
                fermion_count += 1
            else:
                boson_count += 1
            if result["is_prime"]:
                prime_count += 1

        return {
            "total_modules": len(module_ids),
            "fermion_modules": fermion_count,
            "boson_modules": boson_count,
            "prime_modules": prime_count,
            "classifications": results,
            "summary": {
                "lock_distribution": {
                    "exclusive": fermion_count,
                    "shared": boson_count,
                },
                "prime_density": prime_count / len(module_ids) if module_ids else 0,
            },
        }

    def get_registry(self) -> Dict[int, Dict]:
        """获取已分类的模块注册表"""
        return dict(self._module_registry)


# 全局实例
classifier = GoldbachClassifier()


def classify_module(module_id: int) -> Dict:
    """便捷函数：分类单个模块"""
    return classifier.classify_module(module_id)


def batch_classify(module_ids: List[int]) -> Dict:
    """便捷函数：批量分类模块"""
    return classifier.batch_classify(module_ids)


if __name__ == "__main__":
    # 测试
    test_ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 100, 119, 120]

    for mid in test_ids:
        result = classify_module(mid)
        prime_tag = "★" if result["is_prime"] else " "
        gb = ""
        if result["goldbach_decomposition"]:
            d = result["goldbach_decomposition"]
            gb = f" → {d['prime_1']}+{d['prime_2']}"

        print(f"  M{mid:03d} {prime_tag} {result['parity']:8s} {result['lock_strategy']:10s}{gb}")

    print("\n--- Batch Classify M119-M125 ---")
    batch = batch_classify(list(range(119, 126)))
    print(f"  Fermion: {batch['fermion_modules']}, Boson: {batch['boson_modules']}")
    print(f"  Prime density: {batch['summary']['prime_density']:.2%}")
