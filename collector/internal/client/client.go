package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/sakshar2303/pulsewatch/pkg/model"
)

// HTTPClient posts metrics to the ingestion service with retries and backoff.
type HTTPClient struct {
	endpoint     string
	client       *http.Client
	maxRetries   int
	retryBackoff time.Duration
}

// NewHTTPClient creates a new configured HTTPClient.
func NewHTTPClient(endpoint string, timeout, retryBackoff time.Duration, maxRetries int) *HTTPClient {
	return &HTTPClient{
		endpoint: endpoint,
		client: &http.Client{
			Timeout: timeout,
			Transport: &http.Transport{
				MaxIdleConns:        10,
				MaxIdleConnsPerHost: 10,
				IdleConnTimeout:     60 * time.Second,
			},
		},
		maxRetries:   maxRetries,
		retryBackoff: retryBackoff,
	}
}

// SendMetrics sends a batch of MetricPoints to the ingestion endpoint.
// It retries on transient network errors and 5xx responses using exponential backoff.
func (c *HTTPClient) SendMetrics(ctx context.Context, points []model.MetricPoint) error {
	if len(points) == 0 {
		return nil
	}

	payload, err := json.Marshal(points)
	if err != nil {
		return fmt.Errorf("failed to marshal metrics payload: %w", err)
	}

	var lastErr error
	backoff := c.retryBackoff

	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return fmt.Errorf("send cancelled during retry backoff: %w", ctx.Err())
			case <-time.After(backoff):
				backoff *= 2 // exponential backoff
			}
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(payload))
		if err != nil {
			return fmt.Errorf("failed to create http request: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "PulseWatch-Collector/1.0")

		resp, err := c.client.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("http request failed (attempt %d/%d): %w", attempt+1, c.maxRetries+1, err)
			continue
		}

		// Read & discard body to allow connection reuse
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()

		// Success
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			return nil
		}

		// 4xx errors are client errors (invalid payload, rejected) — retrying won't help
		if resp.StatusCode >= 400 && resp.StatusCode < 500 {
			return fmt.Errorf("ingestion service rejected request with status %d (non-retryable)", resp.StatusCode)
		}

		// 5xx errors are server errors (DB down, overloaded) — eligible for retry
		lastErr = fmt.Errorf("ingestion service returned transient server error: status %d", resp.StatusCode)
	}

	return fmt.Errorf("all %d attempts failed: %w", c.maxRetries+1, lastErr)
}
