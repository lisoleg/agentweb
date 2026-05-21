"""
Module Registry with Goldbach Classification
模块注册表，集成堆垒素数分类器
"""

from typing import Dict, List, Optional
from loguru import logger
from goldbach_classifier import GoldbachClassifier, ModuleParity, LockStrategy


class ModuleRegistry:
    """
    模块注册表
    集成 Goldbach 分类器实现费米子/玻色子锁策略
    """

    def __init__(self):
        self.classifier = GoldbachClassifier()
        self.modules: Dict[int, Dict] = {}
        self.active_locks: Dict[int, List[str]] = {}  # module_id → [lock_holders]
        logger.info("ModuleRegistry initialized with Goldbach classifier")

    def register(self, module_id: int, metadata: Optional[Dict] = None) -> Dict:
        """注册模块"""
        classification = self.classifier.classify_module(module_id)

        self.modules[module_id] = {
            "id": module_id,
            "classification": classification,
            "metadata": metadata or {},
            "registered_at": __import__('time').time(),
        }

        logger.info(f"Module M{module_id:03d} registered: {classification['parity']} ({classification['lock_strategy']})")
        return classification

    def acquire_lock(self, module_id: int, holder: str, exclusive: bool = False) -> bool:
        """获取模块锁"""
        if module_id not in self.modules:
            logger.warning(f"Module M{module_id:03d} not registered")
            return False

        current = self.active_locks.get(module_id, [])
        strategy = self.classifier.get_lock_strategy(module_id)

        if strategy == LockStrategy.EXCLUSIVE:
            # 费米子型：排他锁
            if len(current) > 0:
                return False
            self.active_locks[module_id] = [holder]
            return True
        else:
            # 玻色子型：共享锁
            if exclusive and len(current) > 0:
                return False
            if holder not in current:
                current.append(holder)
            self.active_locks[module_id] = current
            return True

    def release_lock(self, module_id: int, holder: str) -> bool:
        """释放模块锁"""
        current = self.active_locks.get(module_id, [])
        if holder in current:
            current.remove(holder)
            self.active_locks[module_id] = current
            return True
        return False

    def get_module_info(self, module_id: int) -> Optional[Dict]:
        """获取模块信息"""
        return self.modules.get(module_id)

    def list_modules(self) -> List[Dict]:
        """列出所有模块"""
        return list(self.modules.values())


# 全局实例
registry = ModuleRegistry()
