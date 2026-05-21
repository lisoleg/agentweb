"""
Phi Calculator (Φ - Integrated Information Theory)
Simplified version for MVP - calculates Φ value based on information entropy and time decay
"""

import numpy as np
from datetime import datetime
from typing import Dict, Any, Optional
from loguru import logger


class PhiCalculator:
    """
    Calculator for Φ (Phi) value based on Integrated Information Theory.
    Simplified version uses information entropy and time decay.
    """

    def __init__(self, decay_rate: float = 0.95, min_value: float = 0.0, max_value: float = 1.0):
        """
        Initialize Phi Calculator.

        Args:
            decay_rate: Time decay rate (0-1, higher = slower decay)
            min_value: Minimum Φ value
            max_value: Maximum Φ value
        """
        self.decay_rate = decay_rate
        self.min_value = min_value
        self.max_value = max_value
        logger.info(f"PhiCalculator initialized with decay_rate={decay_rate}")

    def calculate_information_entropy(self, data: np.ndarray) -> float:
        """
        Calculate Shannon entropy of data.

        Args:
            data: Input data array

        Returns:
            Entropy value (0-1 range)
        """
        if len(data) == 0:
            return 0.0

        # Normalize data to probability distribution
        data = np.array(data, dtype=float)
        if data.sum() == 0:
            return 0.0

        probabilities = data / data.sum()

        # Calculate Shannon entropy
        entropy = -np.sum(probabilities * np.log2(probabilities + 1e-10))
        max_entropy = np.log2(len(data)) if len(data) > 0 else 1.0

        # Normalize to 0-1
        normalized_entropy = entropy / max_entropy if max_entropy > 0 else 0.0
        return float(normalized_entropy)

    def calculate_mutual_information(self, x: np.ndarray, y: np.ndarray) -> float:
        """
        Calculate mutual information between two variables.

        Args:
            x: First variable
            y: Second variable

        Returns:
            Mutual information value
        """
        if len(x) == 0 or len(y) == 0 or len(x) != len(y):
            return 0.0

        # Simplified mutual information calculation
        # I(X;Y) = H(X) + H(Y) - H(X,Y)
        h_x = self.calculate_information_entropy(x)
        h_y = self.calculate_information_entropy(y)

        # Joint entropy (simplified as average)
        joint_data = (x + y) / 2.0
        h_xy = self.calculate_information_entropy(joint_data)

        mi = h_x + h_y - h_xy
        return max(0.0, float(mi))

    def apply_time_decay(self, phi_value: float, time_delta: float) -> float:
        """
        Apply time decay to Φ value.

        Args:
            phi_value: Original Φ value
            time_delta: Time delta in seconds

        Returns:
            Decayed Φ value
        """
        # Convert time delta to hours
        hours = time_delta / 3600.0

        # Apply exponential decay
        decayed = phi_value * (self.decay_rate ** hours)
        return max(self.min_value, float(decayed))

    def extract_features(self, interaction_data: Dict[str, Any]) -> Dict[str, float]:
        """
        Extract features from user interaction data.

        Args:
            interaction_data: Dictionary containing interaction events

        Returns:
            Dictionary of extracted features
        """
        features = {}

        # Mouse movement entropy
        if 'mouse_events' in interaction_data:
            mouse_data = np.array(interaction_data['mouse_events'], dtype=float)
            features['mouse_entropy'] = self.calculate_information_entropy(mouse_data)

        # Keyboard input entropy
        if 'keyboard_events' in interaction_data:
            keyboard_data = np.array(interaction_data['keyboard_events'], dtype=float)
            features['keyboard_entropy'] = self.calculate_information_entropy(keyboard_data)

        # Time-based features
        if 'timestamps' in interaction_data:
            timestamps = interaction_data['timestamps']
            if len(timestamps) > 1:
                intervals = np.diff(timestamps)
                features['timing_entropy'] = self.calculate_information_entropy(intervals)

        # Scroll behavior
        if 'scroll_events' in interaction_data:
            scroll_data = np.array(interaction_data['scroll_events'], dtype=float)
            features['scroll_entropy'] = self.calculate_information_entropy(scroll_data)

        return features

    def calculate_eml_phase(self, features: Dict[str, float]) -> float:
        """
        Calculate EML (Euler-Moivre-Laplace) phase angle.
        Phase = atan2(semantic_direction, integration_magnitude)
        
        Based on Paper 2+3: Φ = |Φ|·e^{iθ}
        - |Φ| (magnitude) = integration degree
        - θ (phase) = semantic direction angle
        """
        feature_values = list(features.values())
        if len(feature_values) < 2:
            return 0.0
        
        # 语义方向：特征间的角度差异
        # 取前两个特征构建2D语义方向向量
        x = feature_values[0] if len(feature_values) > 0 else 0.0
        y = feature_values[1] if len(feature_values) > 1 else 0.0
        
        phase = np.arctan2(y, x)
        return float(phase)

    def calculate_phi(self, interaction_data: Dict[str, Any],
                     user_id: str, content_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Calculate Φ value from interaction data.

        Args:
            interaction_data: User interaction data
            user_id: User ID
            content_id: Optional content ID

        Returns:
            Dictionary with Φ value and details
        """
        try:
            # Extract features
            features = self.extract_features(interaction_data)

            if not features:
                logger.warning(f"No features extracted for user {user_id}")
                return {
                    "user_id": user_id,
                    "phi_value": self.min_value,
                    "timestamp": datetime.utcnow().isoformat(),
                    "details": {"error": "No features extracted"}
                }

            # Calculate mutual information between features
            feature_values = list(features.values())
            if len(feature_values) < 2:
                # Single feature - use its entropy directly
                phi_raw = feature_values[0] if feature_values else 0.0
            else:
                # Calculate pairwise mutual information
                mi_values = []
                for i in range(len(feature_values)):
                    for j in range(i + 1, len(feature_values)):
                        mi = self.calculate_mutual_information(
                            np.array([feature_values[i]]),
                            np.array([feature_values[j]])
                        )
                        mi_values.append(mi)

                phi_raw = np.mean(mi_values) if mi_values else 0.0

            # Normalize to [min_value, max_value]
            phi_normalized = self.min_value + (self.max_value - self.min_value) * phi_raw

            # Apply time decay if timestamp provided
            time_delta = 0.0
            if 'reference_timestamp' in interaction_data and 'current_timestamp' in interaction_data:
                time_delta = interaction_data['current_timestamp'] - interaction_data['reference_timestamp']

            phi_final = self.apply_time_decay(phi_normalized, time_delta)

            # EML 相位计算（Φ = |Φ|·e^{iθ}）
            phi_phase = self.calculate_eml_phase(features)

            result = {
                "user_id": user_id,
                "phi_value": round(phi_final, 6),
                "phi_phase": round(phi_phase, 6),
                "timestamp": datetime.utcnow().isoformat(),
                "details": {
                    "features": features,
                    "raw_phi": round(phi_raw, 6),
                    "normalized_phi": round(phi_normalized, 6),
                    "time_delta_seconds": round(time_delta, 2),
                    "decay_applied": time_delta > 0,
                }
            }

            if content_id:
                result["content_id"] = content_id

            logger.info(f"Φ calculated for user {user_id}: {phi_final}")
            return result

        except Exception as e:
            logger.error(f"Φ calculation error for user {user_id}: {e}")
            return {
                "user_id": user_id,
                "phi_value": self.min_value,
                "timestamp": datetime.utcnow().isoformat(),
                "details": {"error": str(e)}
            }


# Global calculator instance
calculator = PhiCalculator()


def calculate_phi(interaction_data: Dict[str, Any], user_id: str,
                 content_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Convenience function to calculate Φ value.

    Args:
        interaction_data: User interaction data
        user_id: User ID
        content_id: Optional content ID

    Returns:
        Φ calculation result
    """
    return calculator.calculate_phi(interaction_data, user_id, content_id)


if __name__ == "__main__":
    # Test calculation
    test_data = {
        "mouse_events": [1, 2, 3, 2, 1],
        "keyboard_events": [0, 1, 0, 1, 2],
        "timestamps": [0, 1, 2, 3, 4],
    }

    result = calculate_phi(test_data, "test_user")
    print(f"Φ value: {result['phi_value']}")
    print(f"Details: {result['details']}")
