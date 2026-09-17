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

async def verify_anomaly(
    metric: str,
    host: str,
    service: str,
    severity: str,
    current_value: float,
    threshold: float | None,
    score: float | None,
    samples: List[Tuple[float, float]],
    description: str
) -> dict | None:
    """Use Claude to verify if an anomaly is a true issue or a false positive."""
    if not settings.anthropic_api_key:
        return None

    try:
        import json
        client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        
        recent = samples[-15:] if len(samples) > 15 else samples
        recent_values = [f"{val:.2f}" for _, val in recent]
        
        prompt = (
            f"You are an expert site reliability engineer (SRE) acting as a judge.\n"
            f"An automated system detected an anomaly. Your job is to verify if it's a real issue or just noise/routine.\n\n"
            f"Context:\n"
            f"- Description: {description}\n"
            f"- Metric: {metric}\n"
            f"- Service: {service}\n"
            f"- Host: {host}\n"
            f"- Severity: {severity.upper()}\n"
            f"- Current Value: {current_value:.4f}\n"
            f"- Threshold: {threshold if threshold is not None else 'N/A'}\n"
            f"- ML Anomaly Score: {score if score is not None else 'N/A'}\n"
            f"- Recent values leading up to anomaly: {', '.join(recent_values)}\n\n"
            f"Determine if this is a real anomaly (true) or a false positive (false). "
            f"Respond with ONLY a JSON object in this format:\n"
            f'{{"is_real": true/false, "reason": "brief 1-sentence explanation"}}'
        )

        response = await client.messages.create(
            model="claude-3-5-sonnet-20240620",
            max_tokens=150,
            temperature=0.1,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        raw = response.content[0].text.strip()
        # Find JSON boundaries just in case Claude adds conversational wrapper
        start = raw.find('{')
        end = raw.rfind('}') + 1
        if start >= 0 and end > start:
            return json.loads(raw[start:end])
        return None
    except Exception as e:
        log.error(f"Failed to verify anomaly with Claude: {e}")
        return None

async def plan_remediation(
    metric: str,
    host: str,
    service: str,
    severity: str,
    current_value: float,
    description: str,
    rca_summary: str | None = None,
    samples: List[Tuple[float, float]] | None = None
) -> dict | None:
    """Use Claude 3.5 Sonnet to plan an autonomous SRE remediation action."""
    if not settings.anthropic_api_key:
        log.warning("No ANTHROPIC_API_KEY provided; skipping remediation planning.")
        return None

    try:
        import json
        client = AsyncAnthropic(api_key=settings.anthropic_api_key)

        recent_values = ""
        if samples:
            recent = samples[-10:] if len(samples) > 10 else samples
            recent_values = f"- Recent values leading up to incident: {', '.join([f'{val:.2f}' for _, val in recent])}\n"

        prompt = (
            f"You are an autonomous Site Reliability Engineering (SRE) agent for PulseWatch.\n"
            f"A critical incident / anomaly has been detected and verified on a production service.\n\n"
            f"Incident Details:\n"
            f"- Metric: {metric}\n"
            f"- Service: {service}\n"
            f"- Host: {host}\n"
            f"- Severity: {severity.upper()}\n"
            f"- Current Value: {current_value:.4f}\n"
            f"- Description: {description}\n"
            f"{f'- Root Cause Analysis: {rca_summary}' if rca_summary else ''}\n"
            f"{recent_values}\n"
            f"Available remediation actions in the PulseWatch execution registry:\n"
            f"1. 'restart_service' — Restarts the affected container/worker daemon to clear stuck goroutines, deadlock, or hung sockets.\n"
            f"2. 'flush_cache' — Flushes in-memory cache/buffers to immediately mitigate memory leak or buffer saturation.\n"
            f"3. 'recycle_pool' — Resets and cycles database connection pools to resolve connection leak or pool exhaustion.\n"
            f"4. 'scale_replicas' — Increases worker concurrency / worker pool capacity to relieve CPU or queue backpressure.\n"
            f"5. 'rate_limit' — Engages protective ingress throttling / backpressure shedding to prevent cascading failure.\n\n"
            f"Select the single most appropriate action to remediate this incident safely.\n"
            f"Respond ONLY with a JSON object in this exact schema (no markdown fences, no conversational prose):\n"
            f'{{\n'
            f'  "action_type": "restart_service" | "flush_cache" | "recycle_pool" | "scale_replicas" | "rate_limit",\n'
            f'  "action_title": "Short descriptive action title (e.g., Recycle Database Connection Pool)",\n'
            f'  "reasoning": "2-3 sentences explaining why this action resolves the incident and expected outcome",\n'
            f'  "payload": {{"target_service": "{service}", "target_host": "{host}", "grace_seconds": 5}},\n'
            f'  "verification_delay_seconds": 5\n'
            f'}}'
        )

        response = await client.messages.create(
            model="claude-3-5-sonnet-20240620",
            max_tokens=250,
            temperature=0.1,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        raw = response.content[0].text.strip()
        start = raw.find('{')
        end = raw.rfind('}') + 1
        if start >= 0 and end > start:
            result = json.loads(raw[start:end])
            log.info("Claude planned remediation for %s/%s: %s", service, metric, result.get("action_type"))
            return result
        return None
    except Exception as e:
        log.error(f"Failed to plan remediation with Claude: {e}")
        return None

