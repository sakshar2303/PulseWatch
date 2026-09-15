import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    db_url: str = os.getenv(
        "DETECTOR_DB_URL",
        "postgresql://pulsewatch:changeme@localhost:5432/pulsewatch",
    )
    port: int = int(os.getenv("DETECTOR_PORT", "8000"))
    host: str = os.getenv("DETECTOR_HOST", "0.0.0.0")

    # Evaluation loop cadence
    eval_interval_seconds: int = int(os.getenv("EVAL_INTERVAL_SECONDS", "30"))
    lookback_minutes: int = int(os.getenv("LOOKBACK_MINUTES", "30"))

    # ML Parameters
    min_train_samples: int = int(os.getenv("MIN_TRAIN_SAMPLES", "30"))
    default_contamination: float = float(os.getenv("DEFAULT_CONTAMINATION", "0.05"))
    n_estimators: int = int(os.getenv("N_ESTIMATORS", "100"))

    # Anomaly score thresholds for severity (based on IsolationForest decision_function: < 0 is anomaly)
    score_critical_threshold: float = float(os.getenv("SCORE_CRITICAL_THRESHOLD", "-0.15"))
    score_warning_threshold: float = float(os.getenv("SCORE_WARNING_THRESHOLD", "0.0"))

    model_config = SettingsConfigDict(env_prefix="DETECTOR_", extra="ignore")


settings = Settings()
