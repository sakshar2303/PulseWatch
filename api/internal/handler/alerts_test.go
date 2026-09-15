package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/sakshar2303/pulsewatch/api/internal/store"
)

type alertMockStore struct {
	mockStore
	rules     []store.AlertRule
	single    *store.AlertRule
	createErr error
	updateErr error
	deleteErr error
	toggleErr error
}

func (m *alertMockStore) GetAlertRules(ctx context.Context, enabledOnly bool) ([]store.AlertRule, error) {
	if m.err != nil {
		return nil, m.err
	}
	if enabledOnly {
		var filtered []store.AlertRule
		for _, r := range m.rules {
			if r.Enabled {
				filtered = append(filtered, r)
			}
		}
		return filtered, nil
	}
	return m.rules, nil
}

func (m *alertMockStore) GetAlertRule(ctx context.Context, id int64) (*store.AlertRule, error) {
	if m.err != nil {
		return nil, m.err
	}
	if m.single != nil && m.single.ID == id {
		return m.single, nil
	}
	for _, r := range m.rules {
		if r.ID == id {
			return &r, nil
		}
	}
	return nil, errors.New("alert rule not found")
}

func (m *alertMockStore) CreateAlertRule(ctx context.Context, rule *store.AlertRule) (*store.AlertRule, error) {
	if m.createErr != nil {
		return nil, m.createErr
	}
	rule.ID = 100
	rule.CreatedAt = time.Now().UTC()
	rule.UpdatedAt = time.Now().UTC()
	return rule, nil
}

func (m *alertMockStore) UpdateAlertRule(ctx context.Context, id int64, rule *store.AlertRule) (*store.AlertRule, error) {
	if m.updateErr != nil {
		return nil, m.updateErr
	}
	rule.ID = id
	rule.UpdatedAt = time.Now().UTC()
	return rule, nil
}

func (m *alertMockStore) DeleteAlertRule(ctx context.Context, id int64) error {
	return m.deleteErr
}

func (m *alertMockStore) ToggleAlertRule(ctx context.Context, id int64) (*store.AlertRule, error) {
	if m.toggleErr != nil {
		return nil, m.toggleErr
	}
	if m.single != nil && m.single.ID == id {
		m.single.Enabled = !m.single.Enabled
		return m.single, nil
	}
	return nil, errors.New("alert rule not found")
}

func TestAlertsHandler_List(t *testing.T) {
	mock := &alertMockStore{
		rules: []store.AlertRule{
			{ID: 1, Name: "CPU High", MetricName: "cpu_usage_percent", Condition: ">", Threshold: 85, Duration: "5m", Severity: "warning", Enabled: true},
			{ID: 2, Name: "Mem High", MetricName: "memory_usage_percent", Condition: ">", Threshold: 95, Duration: "2m", Severity: "critical", Enabled: false},
		},
	}
	h := NewAlertsHandler(mock)

	// Test list all
	req := httptest.NewRequest(http.MethodGet, "/api/v1/alerts/rules", nil)
	rec := httptest.NewRecorder()
	h.HandleList(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var resp map[string]any
	_ = json.NewDecoder(rec.Body).Decode(&resp)
	if count, ok := resp["count"].(float64); !ok || int(count) != 2 {
		t.Fatalf("expected count 2, got %v", resp["count"])
	}

	// Test filter enabled
	reqEnabled := httptest.NewRequest(http.MethodGet, "/api/v1/alerts/rules?enabled=true", nil)
	recEnabled := httptest.NewRecorder()
	h.HandleList(recEnabled, reqEnabled)
	_ = json.NewDecoder(recEnabled.Body).Decode(&resp)
	if count, ok := resp["count"].(float64); !ok || int(count) != 1 {
		t.Fatalf("expected count 1, got %v", resp["count"])
	}
}

func TestAlertsHandler_Get(t *testing.T) {
	mock := &alertMockStore{
		single: &store.AlertRule{ID: 5, Name: "Disk Full", MetricName: "disk_utilization_percent", Condition: ">", Threshold: 90, Severity: "critical", Enabled: true},
	}
	h := NewAlertsHandler(mock)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/alerts/rules/5", nil)
	req.SetPathValue("id", "5")
	rec := httptest.NewRecorder()
	h.HandleGet(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	// Not found test
	reqNotFound := httptest.NewRequest(http.MethodGet, "/api/v1/alerts/rules/999", nil)
	reqNotFound.SetPathValue("id", "999")
	recNotFound := httptest.NewRecorder()
	h.HandleGet(recNotFound, reqNotFound)

	if recNotFound.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", recNotFound.Code)
	}
}

func TestAlertsHandler_Create(t *testing.T) {
	mock := &alertMockStore{}
	h := NewAlertsHandler(mock)

	payload := map[string]any{
		"name":        "High Error Rate",
		"metric_name": "http_errors_total",
		"condition":   ">=",
		"threshold":   50,
		"duration":    "1m",
		"severity":    "critical",
	}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/alerts/rules", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.HandleCreate(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", rec.Code, rec.Body.String())
	}

	var created store.AlertRule
	_ = json.NewDecoder(rec.Body).Decode(&created)
	if created.ID != 100 || created.Name != "High Error Rate" {
		t.Fatalf("unexpected created rule: %+v", created)
	}

	// Validation error: invalid condition
	invalidPayload := map[string]any{
		"name":        "Invalid",
		"metric_name": "cpu",
		"condition":   "invalid_operator",
		"threshold":   50,
		"severity":    "warning",
	}
	invBody, _ := json.Marshal(invalidPayload)
	reqInv := httptest.NewRequest(http.MethodPost, "/api/v1/alerts/rules", bytes.NewReader(invBody))
	recInv := httptest.NewRecorder()
	h.HandleCreate(recInv, reqInv)

	if recInv.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request, got %d", recInv.Code)
	}
}

func TestAlertsHandler_Update(t *testing.T) {
	mock := &alertMockStore{}
	h := NewAlertsHandler(mock)

	payload := map[string]any{
		"name":        "Updated CPU Rule",
		"metric_name": "cpu_usage_percent",
		"condition":   ">",
		"threshold":   92,
		"severity":    "critical",
	}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPut, "/api/v1/alerts/rules/1", bytes.NewReader(body))
	req.SetPathValue("id", "1")
	rec := httptest.NewRecorder()
	h.HandleUpdate(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestAlertsHandler_Delete(t *testing.T) {
	mock := &alertMockStore{}
	h := NewAlertsHandler(mock)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/alerts/rules/1", nil)
	req.SetPathValue("id", "1")
	rec := httptest.NewRecorder()
	h.HandleDelete(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}

	// Test error when not found
	mockErr := &alertMockStore{deleteErr: errors.New("alert rule not found with id 2")}
	hErr := NewAlertsHandler(mockErr)
	reqErr := httptest.NewRequest(http.MethodDelete, "/api/v1/alerts/rules/2", nil)
	reqErr.SetPathValue("id", "2")
	recErr := httptest.NewRecorder()
	hErr.HandleDelete(recErr, reqErr)

	if recErr.Code != http.StatusNotFound {
		t.Fatalf("expected 404 Not Found, got %d", recErr.Code)
	}
}

func TestAlertsHandler_Toggle(t *testing.T) {
	mock := &alertMockStore{
		single: &store.AlertRule{ID: 10, Enabled: true},
	}
	h := NewAlertsHandler(mock)

	req := httptest.NewRequest(http.MethodPatch, "/api/v1/alerts/rules/10/toggle", nil)
	req.SetPathValue("id", "10")
	rec := httptest.NewRecorder()
	h.HandleToggle(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}

	var toggled store.AlertRule
	_ = json.NewDecoder(rec.Body).Decode(&toggled)
	if toggled.Enabled != false {
		t.Fatalf("expected rule to be toggled to false, got %v", toggled.Enabled)
	}
}
