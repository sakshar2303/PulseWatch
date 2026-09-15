"""Time-series forecaster using statsmodels.

Fetches recent historical data, fits a forecasting model (e.g., Holt-Winters),
and stores predictions with confidence intervals back into the forecasts table.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Tuple

import pandas as pd
from statsmodels.tsa.holtwinters import ExponentialSmoothing

from app.config import settings
from app.db.session import get_pool

log = logging.getLogger(__name__)

_DISCOVER_SERIES_SQL = """
SELECT DISTINCT metric_name, host, service
FROM metrics
WHERE time >= NOW() - INTERVAL '1 minute' * $1
"""

_FETCH_SERIES_SQL = """
SELECT EXTRACT(EPOCH FROM time)::FLOAT AS ts, value
FROM metrics
WHERE metric_name = $1
  AND host = $2
  AND service = $3
  AND time >= NOW() - INTERVAL '1 minute' * $4
ORDER BY time ASC
"""

_INSERT_FORECAST_SQL = """
INSERT INTO forecasts
    (metric_name, host, service, forecast_time, predicted_value, lower_bound, upper_bound, horizon_minutes, model_type)
VALUES
    ($1, $2, $3, $4, $5, $6, $7, $8, 'holt_winters')
"""

class Forecaster:
    """Generates and persists time-series forecasts."""

    def __init__(self):
        # Configuration for forecasting
        self.lookback_minutes = 60 * 4 # 4 hours lookback for training
        self.forecast_horizon_minutes = 60 # 1 hour ahead
        self.min_samples = 30 # need at least some data

    async def _fetch_series(
        self,
        conn,
        metric: str,
        host: str,
        service: str,
    ) -> List[Tuple[float, float]]:
        rows = await conn.fetch(
            _FETCH_SERIES_SQL,
            metric,
            host,
            service,
            self.lookback_minutes,
        )
        return [(r["ts"], r["value"]) for r in rows]

    def _generate_forecast(self, samples: List[Tuple[float, float]], start_ts: float) -> List[dict]:
        """Runs the Holt-Winters model in a thread and returns predictions."""
        # Convert to pandas series
        df = pd.DataFrame(samples, columns=['ts', 'value'])
        df['time'] = pd.to_datetime(df['ts'], unit='s')
        df.set_index('time', inplace=True)

        # Resample to 1-minute intervals and forward-fill to handle gaps
        resampled = df['value'].resample('1min').mean().ffill().dropna()

        if len(resampled) < self.min_samples:
            return []

        # Fit Holt-Winters
        try:
            # We use an additive model, without seasonal components for simplicity since we only have short lookbacks
            model = ExponentialSmoothing(resampled, trend='add', seasonal=None, initialization_method="estimated")
            fit = model.fit()

            # Forecast the next N steps (minutes)
            forecast = fit.forecast(self.forecast_horizon_minutes)
            
            # Simple confidence intervals (rough estimation using std dev of residuals)
            residuals = fit.resid
            std_dev = residuals.std()
            
            results = []
            current_time = datetime.fromtimestamp(start_ts, tz=timezone.utc)
            
            for i, val in enumerate(forecast):
                pred_time = current_time + timedelta(minutes=i+1)
                
                # Expand uncertainty over time (sqrt of steps ahead)
                uncertainty = 1.28 * std_dev * ((i + 1) ** 0.5) # 80% CI approx
                
                lower = val - uncertainty
                upper = val + uncertainty
                
                # Prevent negative bounds if value shouldn't be negative, but keep it simple
                results.append({
                    "forecast_time": pred_time,
                    "predicted_value": float(val),
                    "lower_bound": float(lower),
                    "upper_bound": float(upper)
                })
                
            return results
        except Exception as e:
            log.warning(f"Failed to fit forecasting model: {e}")
            return []

    async def run_cycle(self) -> int:
        """Execute one forecasting cycle. Returns number of series forecasted."""
        pool = await get_pool()
        total_forecasts = 0

        async with pool.acquire() as conn:
            series_rows = await conn.fetch(_DISCOVER_SERIES_SQL, self.lookback_minutes)

        for row in series_rows:
            metric, host, service = row["metric_name"], row["host"], row["service"]
            try:
                async with pool.acquire() as conn:
                    samples = await self._fetch_series(conn, metric, host, service)

                if len(samples) < self.min_samples:
                    continue

                # Run forecasting in a thread to avoid blocking the event loop
                last_ts = samples[-1][0]
                predictions = await asyncio.to_thread(self._generate_forecast, samples, last_ts)

                if not predictions:
                    continue

                # Insert all predictions
                async with pool.acquire() as conn:
                    async with conn.transaction():
                        for p in predictions:
                            await conn.execute(
                                _INSERT_FORECAST_SQL,
                                metric, host, service,
                                p["forecast_time"],
                                p["predicted_value"],
                                p["lower_bound"],
                                p["upper_bound"],
                                self.forecast_horizon_minutes
                            )
                total_forecasts += 1
                
            except Exception:
                log.exception("Forecaster error for series %s/%s/%s", metric, host, service)

        return total_forecasts

# Module-level singleton
forecaster = Forecaster()
