package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Datapoint represents a single timestamp-value pair in a metric series.
type Datapoint struct {
	Time  time.Time `json:"time"`
	Value float64   `json:"value"`
}

// SeriesResult groups datapoints by host and service for charting.
type SeriesResult struct {
	Host       string      `json:"host"`
	Service    string      `json:"service"`
	Datapoints []Datapoint `json:"datapoints"`
}

// QueryResult represents the top-level API response for a metric query.
type QueryResult struct {
	MetricName string         `json:"metric_name"`
	Series     []SeriesResult `json:"series"`
}

// ServiceInfo represents a service with health status and host count.
type ServiceInfo struct {
	Name      string    `json:"name"`
	LastSeen  time.Time `json:"last_seen"`
	HostCount int       `json:"host_count"`
	Status    string    `json:"status"`
}

// HostInfo represents a monitored host with its service and status.
type HostInfo struct {
	Name     string    `json:"name"`
	Service  string    `json:"service"`
	LastSeen time.Time `json:"last_seen"`
	Status   string    `json:"status"`
}

// Anomaly represents a detected threshold or ML anomaly.
type Anomaly struct {
	ID          int64          `json:"id"`
	DetectedAt  time.Time      `json:"detected_at"`
	MetricName  string         `json:"metric_name"`
	Host        string         `json:"host"`
	Service     string         `json:"service"`
	Severity    string         `json:"severity"`
	Type        string         `json:"type"`
	Description string         `json:"description"`
	Value       float64        `json:"value"`
	Threshold   *float64       `json:"threshold,omitempty"`
	Score       *float64       `json:"score,omitempty"`
	ResolvedAt  *time.Time     `json:"resolved_at,omitempty"`
	Metadata    map[string]any `json:"metadata"`
	RCASummary  *string        `json:"rca_summary,omitempty"`
}

// Forecast represents a predicted future value with confidence bounds.
type Forecast struct {
	ID             int64     `json:"id"`
	GeneratedAt    time.Time `json:"generated_at"`
	MetricName     string    `json:"metric_name"`
	Host           string    `json:"host"`
	Service        string    `json:"service"`
	ForecastTime   time.Time `json:"forecast_time"`
	PredictedValue float64   `json:"predicted_value"`
	LowerBound     *float64  `json:"lower_bound,omitempty"`
	UpperBound     *float64  `json:"upper_bound,omitempty"`
	HorizonMinutes int       `json:"horizon_minutes"`
	ModelType      string    `json:"model_type"`
}

// Remediation represents an automated or manual SRE action.
type Remediation struct {
	ID            int64          `json:"id"`
	AnomalyID     *int64         `json:"anomaly_id,omitempty"`
	Service       string         `json:"service"`
	Host          string         `json:"host"`
	MetricName    string         `json:"metric_name"`
	ActionType    string         `json:"action_type"`
	Status        string         `json:"status"`
	TriggerType   string         `json:"trigger_type"`
	LLMPlan       *string        `json:"llm_plan,omitempty"`
	ActionPayload map[string]any `json:"action_payload"`
	ExecutionLog  *string        `json:"execution_log,omitempty"`
	MetricBefore  *float64       `json:"metric_before,omitempty"`
	MetricAfter   *float64       `json:"metric_after,omitempty"`
	CreatedAt     time.Time      `json:"created_at"`
	ExecutedAt    *time.Time     `json:"executed_at,omitempty"`
	CompletedAt   *time.Time     `json:"completed_at,omitempty"`
}

// AlertRule represents a user-defined threshold alerting rule.
type AlertRule struct {
	ID         int64     `json:"id"`
	Name       string    `json:"name"`
	MetricName string    `json:"metric_name"`
	Condition  string    `json:"condition"`
	Threshold  float64   `json:"threshold"`
	Duration   string    `json:"duration"`
	Severity   string    `json:"severity"`
	Service    *string   `json:"service,omitempty"`
	Host       *string   `json:"host,omitempty"`
	Enabled    bool      `json:"enabled"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// Store defines database operations required by the Query API.
type Store interface {
	GetMetricNames(ctx context.Context) ([]string, error)
	QueryRaw(ctx context.Context, name string, start, end time.Time, service, host string) (*QueryResult, error)
	QueryBucket(ctx context.Context, name string, start, end time.Time, step, agg, service, host string) (*QueryResult, error)
	GetServices(ctx context.Context) ([]ServiceInfo, error)
	GetHosts(ctx context.Context) ([]HostInfo, error)
	GetAnomalies(ctx context.Context, service, severity string, resolved *bool, limit, offset int) ([]Anomaly, int, error)
	UpdateAnomalyRCA(ctx context.Context, id int64, rca string) error
	ResolveAnomaly(ctx context.Context, id int64) error
	GetAlertRules(ctx context.Context, enabledOnly bool) ([]AlertRule, error)
	GetAlertRule(ctx context.Context, id int64) (*AlertRule, error)
	CreateAlertRule(ctx context.Context, rule *AlertRule) (*AlertRule, error)
	UpdateAlertRule(ctx context.Context, id int64, rule *AlertRule) (*AlertRule, error)
	DeleteAlertRule(ctx context.Context, id int64) error
	ToggleAlertRule(ctx context.Context, id int64) (*AlertRule, error)
	GetForecasts(ctx context.Context, metric, host, service string) ([]Forecast, error)
	GetRemediations(ctx context.Context, limit int, status string, service string) ([]Remediation, error)
	GetRemediation(ctx context.Context, id int64) (*Remediation, error)
	GetRemediationStats(ctx context.Context) (map[string]any, error)
	Ping(ctx context.Context) error
	Close()
}

// PgxStore implements Store using TimescaleDB via pgxpool.
type PgxStore struct {
	pool *pgxpool.Pool
}

// NewPgxStore creates and validates a new TimescaleDB connection pool.
func NewPgxStore(ctx context.Context, dbURL string, maxConns, minConns int32) (*PgxStore, error) {
	cfg, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}

	cfg.MaxConns = maxConns
	cfg.MinConns = minConns

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &PgxStore{pool: pool}, nil
}

// GetMetricNames returns all distinct metric names recorded in the database.
func (s *PgxStore) GetMetricNames(ctx context.Context) ([]string, error) {
	query := `SELECT DISTINCT metric_name FROM metrics ORDER BY metric_name ASC;`
	rows, err := s.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query metric names: %w", err)
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("failed to scan metric name: %w", err)
		}
		names = append(names, name)
	}

	if names == nil {
		names = []string{}
	}
	return names, nil
}

// QueryRaw retrieves unaggregated datapoints within [start, end].
func (s *PgxStore) QueryRaw(ctx context.Context, name string, start, end time.Time, service, host string) (*QueryResult, error) {
	var queryBuilder strings.Builder
	queryBuilder.WriteString(`
		SELECT time, host, service, value
		FROM metrics
		WHERE metric_name = $1 AND time >= $2 AND time <= $3
	`)

	args := []any{name, start, end}
	argIdx := 4

	if service != "" {
		queryBuilder.WriteString(fmt.Sprintf(" AND service = $%d", argIdx))
		args = append(args, service)
		argIdx++
	}

	if host != "" {
		queryBuilder.WriteString(fmt.Sprintf(" AND host = $%d", argIdx))
		args = append(args, host)
		argIdx++
	}

	queryBuilder.WriteString(" ORDER BY host, service, time ASC LIMIT 5000;")

	rows, err := s.pool.Query(ctx, queryBuilder.String(), args...)
	if err != nil {
		return nil, fmt.Errorf("failed to execute raw metric query: %w", err)
	}
	defer rows.Close()

	seriesMap := make(map[string]*SeriesResult)
	var seriesOrder []string

	for rows.Next() {
		var ts time.Time
		var h, svc string
		var val float64

		if err := rows.Scan(&ts, &h, &svc, &val); err != nil {
			return nil, fmt.Errorf("failed to scan raw metric row: %w", err)
		}

		key := h + "|" + svc
		sr, exists := seriesMap[key]
		if !exists {
			sr = &SeriesResult{
				Host:       h,
				Service:    svc,
				Datapoints: make([]Datapoint, 0, 100),
			}
			seriesMap[key] = sr
			seriesOrder = append(seriesOrder, key)
		}

		sr.Datapoints = append(sr.Datapoints, Datapoint{
			Time:  ts.UTC(),
			Value: val,
		})
	}

	result := &QueryResult{
		MetricName: name,
		Series:     make([]SeriesResult, 0, len(seriesOrder)),
	}

	for _, k := range seriesOrder {
		result.Series = append(result.Series, *seriesMap[k])
	}

	return result, nil
}

// QueryBucket retrieves downsampled metrics using TimescaleDB's time_bucket.
func (s *PgxStore) QueryBucket(ctx context.Context, name string, start, end time.Time, step, agg, service, host string) (*QueryResult, error) {
	// Whitelist allowed aggregation functions to prevent SQL injection
	aggLower := strings.ToLower(agg)
	switch aggLower {
	case "avg", "max", "min", "sum", "count":
	default:
		aggLower = "avg"
	}

	var queryBuilder strings.Builder
	queryBuilder.WriteString(fmt.Sprintf(`
		SELECT time_bucket($1::interval, time) AS bucket, host, service, %s(value) AS agg_val
		FROM metrics
		WHERE metric_name = $2 AND time >= $3 AND time <= $4
	`, aggLower))

	args := []any{step, name, start, end}
	argIdx := 5

	if service != "" {
		queryBuilder.WriteString(fmt.Sprintf(" AND service = $%d", argIdx))
		args = append(args, service)
		argIdx++
	}

	if host != "" {
		queryBuilder.WriteString(fmt.Sprintf(" AND host = $%d", argIdx))
		args = append(args, host)
		argIdx++
	}

	queryBuilder.WriteString(" GROUP BY bucket, host, service ORDER BY host, service, bucket ASC LIMIT 5000;")

	rows, err := s.pool.Query(ctx, queryBuilder.String(), args...)
	if err != nil {
		return nil, fmt.Errorf("failed to execute time_bucket query: %w", err)
	}
	defer rows.Close()

	seriesMap := make(map[string]*SeriesResult)
	var seriesOrder []string

	for rows.Next() {
		var ts time.Time
		var h, svc string
		var val float64

		if err := rows.Scan(&ts, &h, &svc, &val); err != nil {
			return nil, fmt.Errorf("failed to scan time_bucket row: %w", err)
		}

		key := h + "|" + svc
		sr, exists := seriesMap[key]
		if !exists {
			sr = &SeriesResult{
				Host:       h,
				Service:    svc,
				Datapoints: make([]Datapoint, 0, 100),
			}
			seriesMap[key] = sr
			seriesOrder = append(seriesOrder, key)
		}

		sr.Datapoints = append(sr.Datapoints, Datapoint{
			Time:  ts.UTC(),
			Value: val,
		})
	}

	result := &QueryResult{
		MetricName: name,
		Series:     make([]SeriesResult, 0, len(seriesOrder)),
	}

	for _, k := range seriesOrder {
		result.Series = append(result.Series, *seriesMap[k])
	}

	return result, nil
}

// GetServices returns all distinct services with last seen time and host count.
func (s *PgxStore) GetServices(ctx context.Context) ([]ServiceInfo, error) {
	query := `
		SELECT service, MAX(time) AS last_seen, COUNT(DISTINCT host) AS host_count
		FROM metrics
		GROUP BY service
		ORDER BY service ASC;
	`
	rows, err := s.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query services: %w", err)
	}
	defer rows.Close()

	var services []ServiceInfo
	now := time.Now().UTC()

	for rows.Next() {
		var svc ServiceInfo
		if err := rows.Scan(&svc.Name, &svc.LastSeen, &svc.HostCount); err != nil {
			return nil, fmt.Errorf("failed to scan service row: %w", err)
		}
		svc.LastSeen = svc.LastSeen.UTC()

		diff := now.Sub(svc.LastSeen)
		if diff <= 90*time.Second {
			svc.Status = "healthy"
		} else if diff <= 10*time.Minute {
			svc.Status = "warning"
		} else {
			svc.Status = "offline"
		}

		services = append(services, svc)
	}

	if services == nil {
		services = []ServiceInfo{}
	}
	return services, nil
}

// GetHosts returns all distinct hosts with service, last seen time, and health status.
func (s *PgxStore) GetHosts(ctx context.Context) ([]HostInfo, error) {
	query := `
		SELECT host, service, MAX(time) AS last_seen
		FROM metrics
		GROUP BY host, service
		ORDER BY host ASC;
	`
	rows, err := s.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query hosts: %w", err)
	}
	defer rows.Close()

	var hosts []HostInfo
	now := time.Now().UTC()

	for rows.Next() {
		var h HostInfo
		if err := rows.Scan(&h.Name, &h.Service, &h.LastSeen); err != nil {
			return nil, fmt.Errorf("failed to scan host row: %w", err)
		}
		h.LastSeen = h.LastSeen.UTC()

		diff := now.Sub(h.LastSeen)
		if diff <= 90*time.Second {
			h.Status = "healthy"
		} else if diff <= 10*time.Minute {
			h.Status = "warning"
		} else {
			h.Status = "offline"
		}

		hosts = append(hosts, h)
	}

	if hosts == nil {
		hosts = []HostInfo{}
	}
	return hosts, nil
}

// GetAnomalies queries anomalies with filtering, pagination, and total count.
func (s *PgxStore) GetAnomalies(ctx context.Context, service, severity string, resolved *bool, limit, offset int) ([]Anomaly, int, error) {
	var whereClauses []string
	var args []any
	argIdx := 1

	if service != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("service = $%d", argIdx))
		args = append(args, service)
		argIdx++
	}

	if severity != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("severity = $%d", argIdx))
		args = append(args, severity)
		argIdx++
	}

	if resolved != nil {
		if *resolved {
			whereClauses = append(whereClauses, "resolved_at IS NOT NULL")
		} else {
			whereClauses = append(whereClauses, "resolved_at IS NULL")
		}
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = " WHERE " + strings.Join(whereClauses, " AND ")
	}

	// 1. Get total count
	countQuery := "SELECT COUNT(*) FROM anomalies" + whereSQL + ";"
	var total int
	if err := s.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count anomalies: %w", err)
	}

	// 2. Fetch paginated records
	if limit <= 0 {
		limit = 50
	} else if limit > 200 {
		limit = 200
	}
	if offset < 0 {
		offset = 0
	}

	selectQuery := fmt.Sprintf(`
		SELECT id, detected_at, metric_name, host, service, severity, type, description, value, threshold, score, resolved_at, metadata, rca_summary
		FROM anomalies
		%s
		ORDER BY detected_at DESC
		LIMIT $%d OFFSET $%d;
	`, whereSQL, argIdx, argIdx+1)

	argsWithPaging := append(args, limit, offset)
	rows, err := s.pool.Query(ctx, selectQuery, argsWithPaging...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query anomalies: %w", err)
	}
	defer rows.Close()

	var anomalies []Anomaly
	for rows.Next() {
		var a Anomaly
		var rawMeta []byte

		if err := rows.Scan(
			&a.ID, &a.DetectedAt, &a.MetricName, &a.Host, &a.Service,
			&a.Severity, &a.Type, &a.Description, &a.Value,
			&a.Threshold, &a.Score, &a.ResolvedAt, &rawMeta, &a.RCASummary,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan anomaly row: %w", err)
		}

		a.DetectedAt = a.DetectedAt.UTC()
		if a.ResolvedAt != nil {
			t := a.ResolvedAt.UTC()
			a.ResolvedAt = &t
		}

		if len(rawMeta) > 0 {
			_ = json.Unmarshal(rawMeta, &a.Metadata)
		}
		if a.Metadata == nil {
			a.Metadata = make(map[string]any)
		}

		anomalies = append(anomalies, a)
	}

	if anomalies == nil {
		anomalies = []Anomaly{}
	}
	return anomalies, total, nil
}

// UpdateAnomalyRCA updates the root cause analysis summary for an anomaly.
func (s *PgxStore) UpdateAnomalyRCA(ctx context.Context, id int64, rca string) error {
	query := `UPDATE anomalies SET rca_summary = $1 WHERE id = $2`
	cmd, err := s.pool.Exec(ctx, query, rca, id)
	if err != nil {
		return fmt.Errorf("failed to update anomaly RCA: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return fmt.Errorf("anomaly not found")
	}
	return nil
}

// ResolveAnomaly sets resolved_at = NOW() for the specified anomaly.
func (s *PgxStore) ResolveAnomaly(ctx context.Context, id int64) error {
	cmd, err := s.pool.Exec(ctx, "UPDATE anomalies SET resolved_at = NOW() WHERE id = $1;", id)
	if err != nil {
		return fmt.Errorf("failed to resolve anomaly: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return fmt.Errorf("anomaly not found with id %d", id)
	}
	return nil
}

// GetAlertRules returns all alert rules, optionally filtering by enabled status.
func (s *PgxStore) GetAlertRules(ctx context.Context, enabledOnly bool) ([]AlertRule, error) {
	query := `
		SELECT id, name, metric_name, condition, threshold, duration::TEXT, severity, service, host, enabled, created_at, updated_at
		FROM alert_rules
	`
	if enabledOnly {
		query += " WHERE enabled = TRUE"
	}
	query += " ORDER BY id ASC;"

	rows, err := s.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query alert rules: %w", err)
	}
	defer rows.Close()

	var rules []AlertRule
	for rows.Next() {
		var r AlertRule
		if err := rows.Scan(
			&r.ID, &r.Name, &r.MetricName, &r.Condition, &r.Threshold, &r.Duration,
			&r.Severity, &r.Service, &r.Host, &r.Enabled, &r.CreatedAt, &r.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan alert rule row: %w", err)
		}
		r.CreatedAt = r.CreatedAt.UTC()
		r.UpdatedAt = r.UpdatedAt.UTC()
		rules = append(rules, r)
	}

	if rules == nil {
		rules = []AlertRule{}
	}
	return rules, nil
}

// GetAlertRule fetches a single alert rule by its ID.
func (s *PgxStore) GetAlertRule(ctx context.Context, id int64) (*AlertRule, error) {
	query := `
		SELECT id, name, metric_name, condition, threshold, duration::TEXT, severity, service, host, enabled, created_at, updated_at
		FROM alert_rules
		WHERE id = $1;
	`
	var r AlertRule
	if err := s.pool.QueryRow(ctx, query, id).Scan(
		&r.ID, &r.Name, &r.MetricName, &r.Condition, &r.Threshold, &r.Duration,
		&r.Severity, &r.Service, &r.Host, &r.Enabled, &r.CreatedAt, &r.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("alert rule not found with id %d: %w", id, err)
	}
	r.CreatedAt = r.CreatedAt.UTC()
	r.UpdatedAt = r.UpdatedAt.UTC()
	return &r, nil
}

// CreateAlertRule inserts a new alert rule into the database.
func (s *PgxStore) CreateAlertRule(ctx context.Context, rule *AlertRule) (*AlertRule, error) {
	query := `
		INSERT INTO alert_rules (name, metric_name, condition, threshold, duration, severity, service, host, enabled, created_at, updated_at)
		VALUES ($1, $2, $3, $4, ($5::TEXT)::INTERVAL, $6, $7, $8, $9, NOW(), NOW())
		RETURNING id, duration::TEXT, created_at, updated_at;
	`
	var outDur string
	var createdAt, updatedAt time.Time
	if err := s.pool.QueryRow(ctx, query,
		rule.Name, rule.MetricName, rule.Condition, rule.Threshold, rule.Duration,
		rule.Severity, rule.Service, rule.Host, rule.Enabled,
	).Scan(&rule.ID, &outDur, &createdAt, &updatedAt); err != nil {
		return nil, fmt.Errorf("failed to create alert rule: %w", err)
	}
	rule.Duration = outDur
	rule.CreatedAt = createdAt.UTC()
	rule.UpdatedAt = updatedAt.UTC()
	return rule, nil
}

// UpdateAlertRule updates an existing alert rule.
func (s *PgxStore) UpdateAlertRule(ctx context.Context, id int64, rule *AlertRule) (*AlertRule, error) {
	query := `
		UPDATE alert_rules
		SET name = $2, metric_name = $3, condition = $4, threshold = $5,
		    duration = ($6::TEXT)::INTERVAL, severity = $7, service = $8, host = $9,
		    enabled = $10, updated_at = NOW()
		WHERE id = $1
		RETURNING duration::TEXT, created_at, updated_at;
	`
	var outDur string
	var createdAt, updatedAt time.Time
	if err := s.pool.QueryRow(ctx, query,
		id, rule.Name, rule.MetricName, rule.Condition, rule.Threshold, rule.Duration,
		rule.Severity, rule.Service, rule.Host, rule.Enabled,
	).Scan(&outDur, &createdAt, &updatedAt); err != nil {
		return nil, fmt.Errorf("failed to update alert rule id %d: %w", id, err)
	}
	rule.ID = id
	rule.Duration = outDur
	rule.CreatedAt = createdAt.UTC()
	rule.UpdatedAt = updatedAt.UTC()
	return rule, nil
}

// DeleteAlertRule deletes an alert rule by ID.
func (s *PgxStore) DeleteAlertRule(ctx context.Context, id int64) error {
	cmd, err := s.pool.Exec(ctx, "DELETE FROM alert_rules WHERE id = $1;", id)
	if err != nil {
		return fmt.Errorf("failed to delete alert rule: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return fmt.Errorf("alert rule not found with id %d", id)
	}
	return nil
}

// ToggleAlertRule flips the enabled boolean flag of an alert rule.
func (s *PgxStore) ToggleAlertRule(ctx context.Context, id int64) (*AlertRule, error) {
	query := `
		UPDATE alert_rules
		SET enabled = NOT enabled, updated_at = NOW()
		WHERE id = $1
		RETURNING id, name, metric_name, condition, threshold, duration::TEXT, severity, service, host, enabled, created_at, updated_at;
	`
	var r AlertRule
	if err := s.pool.QueryRow(ctx, query, id).Scan(
		&r.ID, &r.Name, &r.MetricName, &r.Condition, &r.Threshold, &r.Duration,
		&r.Severity, &r.Service, &r.Host, &r.Enabled, &r.CreatedAt, &r.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("failed to toggle alert rule id %d: %w", id, err)
	}
	r.CreatedAt = r.CreatedAt.UTC()
	r.UpdatedAt = r.UpdatedAt.UTC()
	return &r, nil
}

// Ping verifies database connectivity.
func (s *PgxStore) Ping(ctx context.Context) error {
	return s.pool.Ping(ctx)
}

// Close closes the connection pool.
func (s *PgxStore) Close() {
	if s.pool != nil {
		s.pool.Close()
	}
}

// GetForecasts fetches recent forecasts for a specific series.
func (s *PgxStore) GetForecasts(ctx context.Context, metric, host, service string) ([]Forecast, error) {
	query := `
		SELECT id, generated_at, metric_name, host, service, forecast_time, predicted_value, lower_bound, upper_bound, horizon_minutes, model_type
		FROM forecasts
		WHERE metric_name = $1 AND host = $2 AND service = $3
		  AND forecast_time >= NOW()
		ORDER BY forecast_time ASC
		LIMIT 120;
	`
	rows, err := s.pool.Query(ctx, query, metric, host, service)
	if err != nil {
		return nil, fmt.Errorf("failed to query forecasts: %w", err)
	}
	defer rows.Close()

	var forecasts []Forecast
	for rows.Next() {
		var f Forecast
		if err := rows.Scan(
			&f.ID, &f.GeneratedAt, &f.MetricName, &f.Host, &f.Service,
			&f.ForecastTime, &f.PredictedValue, &f.LowerBound, &f.UpperBound,
			&f.HorizonMinutes, &f.ModelType,
		); err != nil {
			return nil, fmt.Errorf("failed to scan forecast row: %w", err)
		}
		f.GeneratedAt = f.GeneratedAt.UTC()
		f.ForecastTime = f.ForecastTime.UTC()
		forecasts = append(forecasts, f)
	}
	if forecasts == nil {
		forecasts = []Forecast{}
	}
	return forecasts, nil
}

// GetRemediations lists recent remediations with optional filters.
func (s *PgxStore) GetRemediations(ctx context.Context, limit int, status string, service string) ([]Remediation, error) {
	query := `
		SELECT id, anomaly_id, service, host, metric_name, action_type, status, trigger_type, 
		       llm_plan, action_payload, execution_log, metric_before, metric_after, created_at, executed_at, completed_at
		FROM remediations
		WHERE ($1::text = '' OR status = $1)
		  AND ($2::text = '' OR service = $2)
		ORDER BY created_at DESC
		LIMIT $3;
	`
	rows, err := s.pool.Query(ctx, query, status, service, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list remediations: %w", err)
	}
	defer rows.Close()

	var results []Remediation
	for rows.Next() {
		var r Remediation
		if err := rows.Scan(
			&r.ID, &r.AnomalyID, &r.Service, &r.Host, &r.MetricName, &r.ActionType, &r.Status, &r.TriggerType,
			&r.LLMPlan, &r.ActionPayload, &r.ExecutionLog, &r.MetricBefore, &r.MetricAfter,
			&r.CreatedAt, &r.ExecutedAt, &r.CompletedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan remediation: %w", err)
		}
		r.CreatedAt = r.CreatedAt.UTC()
		if r.ExecutedAt != nil {
			t := r.ExecutedAt.UTC()
			r.ExecutedAt = &t
		}
		if r.CompletedAt != nil {
			t := r.CompletedAt.UTC()
			r.CompletedAt = &t
		}
		results = append(results, r)
	}
	if results == nil {
		results = []Remediation{}
	}
	return results, nil
}

// GetRemediation gets a single remediation by ID.
func (s *PgxStore) GetRemediation(ctx context.Context, id int64) (*Remediation, error) {
	query := `
		SELECT id, anomaly_id, service, host, metric_name, action_type, status, trigger_type, 
		       llm_plan, action_payload, execution_log, metric_before, metric_after, created_at, executed_at, completed_at
		FROM remediations
		WHERE id = $1;
	`
	var r Remediation
	if err := s.pool.QueryRow(ctx, query, id).Scan(
		&r.ID, &r.AnomalyID, &r.Service, &r.Host, &r.MetricName, &r.ActionType, &r.Status, &r.TriggerType,
		&r.LLMPlan, &r.ActionPayload, &r.ExecutionLog, &r.MetricBefore, &r.MetricAfter,
		&r.CreatedAt, &r.ExecutedAt, &r.CompletedAt,
	); err != nil {
		return nil, fmt.Errorf("failed to get remediation %d: %w", id, err)
	}
	r.CreatedAt = r.CreatedAt.UTC()
	if r.ExecutedAt != nil {
		t := r.ExecutedAt.UTC()
		r.ExecutedAt = &t
	}
	if r.CompletedAt != nil {
		t := r.CompletedAt.UTC()
		r.CompletedAt = &t
	}
	return &r, nil
}

// GetRemediationStats returns high-level metrics about the auto-remediation system.
func (s *PgxStore) GetRemediationStats(ctx context.Context) (map[string]any, error) {
	query := `
		SELECT 
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE status = 'success') AS success_count,
			COUNT(*) FILTER (WHERE trigger_type = 'autonomous') AS autonomous_count,
			COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS last_24h
		FROM remediations;
	`
	var total, success, autonomous, last24h int
	err := s.pool.QueryRow(ctx, query).Scan(&total, &success, &autonomous, &last24h)
	if err != nil {
		return nil, fmt.Errorf("failed to get remediation stats: %w", err)
	}
	
	successRate := 0.0
	if total > 0 {
		successRate = (float64(success) / float64(total)) * 100.0
	}
	
	return map[string]any{
		"total_remediations": total,
		"success_rate": successRate,
		"autonomous_count": autonomous,
		"last_24h": last24h,
	}, nil
}
