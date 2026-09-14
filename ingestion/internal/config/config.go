package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds runtime configuration for the ingestion service.
type Config struct {
	Port                 string
	DatabaseURL          string
	BatchSize            int
	BatchTimeout         time.Duration
	MaxBodyBytes         int64
	DBMaxConns           int32
	DBMinConns           int32
	NATSURL              string
	StreamName           string
	ConsumerName         string
	ConsumerBatchSize    int
	ConsumerFetchTimeout time.Duration
	EnableNATS           bool
}

// Load reads configuration from environment variables with production defaults.
func Load() (*Config, error) {
	return &Config{
		Port:                 getEnv("INGESTION_PORT", "8081"),
		DatabaseURL:          getEnv("INGESTION_DB_URL", "postgresql://pulsewatch:changeme@localhost:5432/pulsewatch?sslmode=disable"),
		BatchSize:            getEnvInt("INGESTION_BATCH_SIZE", 500),
		BatchTimeout:         getEnvDuration("INGESTION_BATCH_TIMEOUT", 1*time.Second),
		MaxBodyBytes:         getEnvInt64("INGESTION_MAX_BODY_BYTES", 2*1024*1024), // 2 MB max body
		DBMaxConns:           int32(getEnvInt("INGESTION_DB_MAX_CONNS", 20)),
		DBMinConns:           int32(getEnvInt("INGESTION_DB_MIN_CONNS", 5)),
		NATSURL:              getEnv("NATS_URL", "nats://localhost:4222"),
		StreamName:           getEnv("NATS_STREAM_NAME", "METRICS"),
		ConsumerName:         getEnv("NATS_CONSUMER_NAME", "ingestion-worker"),
		ConsumerBatchSize:    getEnvInt("CONSUMER_BATCH_SIZE", 500),
		ConsumerFetchTimeout: getEnvDuration("CONSUMER_FETCH_TIMEOUT", 500*time.Millisecond),
		EnableNATS:           getEnvBool("ENABLE_NATS", true),
	}, nil
}

func getEnvBool(key string, fallback bool) bool {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	b, err := strconv.ParseBool(val)
	if err != nil {
		return fallback
	}
	return b
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

func getEnvInt64(key string, fallback int64) int64 {
	val := os.Getenv(key)
	if val == "" {
		return fallback
	}
	i, err := strconv.ParseInt(val, 10, 64)
	if err != nil {
		return fallback
	}
	return i
}
