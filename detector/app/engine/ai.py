import logging
from typing import List, Tuple
from anthropic import AsyncAnthropic

from app.config import settings

log = logging.getLogger(__name__)

async def generate_rca_summary(
    metric: str,
    host: str,
    service: str,
    severity: str,
    current_value: float,
    score: float,
    samples: List[Tuple[float, float]]
) -> str | None:
    """Generate a Root Cause Analysis summary using Claude 3.5 Sonnet."""
    if not settings.anthropic_api_key:
        log.warning("No ANTHROPIC_API_KEY provided; skipping RCA generation.")
        return None

    try:
        client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        
        # Prepare context from recent samples (last 10 for brevity)
        recent = samples[-10:] if len(samples) > 10 else samples
        recent_values = [f"{val:.2f}" for _, val in recent]
        
        prompt = (
            f"You are an expert site reliability engineer (SRE) and AI systems monitor.\n"
            f"An anomaly was just detected by our Isolation Forest model.\n\n"
            f"Context:\n"
            f"- Metric: {metric}\n"
            f"- Service: {service}\n"
            f"- Host: {host}\n"
            f"- Severity: {severity.upper()}\n"
            f"- Current Value: {current_value:.4f}\n"
            f"- ML Anomaly Score: {score:.4f}\n"
            f"- Recent values leading up to anomaly: {', '.join(recent_values)}\n\n"
            f"Provide a brief, human-readable root cause analysis (2-3 sentences max) "
            f"explaining what this anomaly might indicate and proposing a potential remediation step. "
            f"Keep it professional and concise. Do not use formatting like bolding or bullet points."
        )

        response = await client.messages.create(
            model="claude-3-5-sonnet-20240620",
            max_tokens=150,
            temperature=0.2,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        return response.content[0].text.strip()
    except Exception as e:
        log.error(f"Failed to generate RCA with Claude: {e}")
        return None
