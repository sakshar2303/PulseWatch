package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds runtime configuration for the collector agent.
type Config struct {
	CollectorID  string
	Host         string
	Service      string
	Interval     time.Duration
	IngestionURL string
	HTTPTimeout  time.Duration
	MaxRetries   int
	RetryBackoff time.Duration
}

// Load reads configuration from environment variables with sensible defaults.
func Load() (*Config, error) {
	hostname, err := os.Hostname()
	if err != nil || hostname == "" {
		hostname = "unknown-host"
	}

	cfg := &Config{
		CollectorID:  getEnv("COLLECTOR_ID", "collector-"+hostname),
		Host:         getEnv("COLLECTOR_HOST", hostname),
		Service:      getEnv("COLLECTOR_SERVICE", "system-agent"),
		Interval:     getEnvDuration("COLLECTOR_INTERVAL", 5*time.Second),
		IngestionURL: getEnv("INGESTION_URL", "http://localhost:8081/api/v1/metrics"),
		HTTPTimeout:  getEnvDuration("COLLECTOR_HTTP_TIMEOUT", 5*time.Second),
		MaxRetries:   getEnvInt("COLLECTOR_MAX_RETRIES", 3),
		RetryBackoff: getEnvDuration("COLLECTOR_RETRY_BACKOFF", 500*time.Millisecond),
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	d, err := time.ParseDuration(val)
	if err != nil {
		return fallback
	}
	return d
}

func getEnvInt(key string, fallback int) int {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	i, err := strconv.Atoi(val)
	if err != nil {
		return fallback
	}
	return i
}
