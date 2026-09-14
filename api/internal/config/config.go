package config

import (
	"os"
	"strconv"
)

// Config holds runtime configuration for the query/API service.
type Config struct {
	Port         string
	DatabaseURL  string
	DBMaxConns   int32
	DBMinConns   int32
	CORSOrigins  string
	NATSURL      string
}

// Load reads configuration from environment variables.
func Load() (*Config, error) {
	return &Config{
		Port:        getEnv("API_PORT", "8080"),
		DatabaseURL: getEnv("API_DB_URL", "postgresql://pulsewatch:changeme@localhost:5432/pulsewatch?sslmode=disable"),
		DBMaxConns:  int32(getEnvInt("API_DB_MAX_CONNS", 20)),
		DBMinConns:  int32(getEnvInt("API_DB_MIN_CONNS", 5)),
		CORSOrigins: getEnv("API_CORS_ORIGINS", "*"),
		NATSURL:      getEnv("NATS_URL", "nats://localhost:4222"),
	}, nil
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
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
