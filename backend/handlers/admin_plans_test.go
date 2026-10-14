package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"armss-ott-backend/database"

	"github.com/go-chi/chi/v5"
	_ "github.com/go-sql-driver/mysql"
	"github.com/google/uuid"
)

func TestAdminPlansHandlers_MySQL(t *testing.T) {
	testDSN := strings.TrimSpace(os.Getenv("PLAN_ACCESS_TEST_MYSQL_DSN"))
	if testDSN == "" {
		t.Skip("skipping MySQL admin plans tests: PLAN_ACCESS_TEST_MYSQL_DSN is not set")
		return
	}

	if strings.Contains(testDSN, "/armss_ott?") || strings.HasSuffix(testDSN, "/armss_ott") {
		t.Fatal("SAFETY VIOLATION: PLAN_ACCESS_TEST_MYSQL_DSN must point to a dedicated test database")
	}

	db, err := sql.Open("mysql", testDSN)
	if err != nil {
		t.Fatalf("failed connecting to MySQL test DB: %v", err)
	}
	defer db.Close()

	oldDB := database.DB
	database.DB = db
	defer func() {
		database.DB = oldDB
	}()

	// 1. Test AdminListPlans
	req := httptest.NewRequest("GET", "/api/admin/plans", nil)
	rr := httptest.NewRecorder()
	AdminListPlans(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("AdminListPlans returned code %d: %s", rr.Code, rr.Body.String())
	}

	var listRes struct {
		Plans []AdminPlanDTO `json:"plans"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &listRes); err != nil {
		t.Fatalf("unmarshal AdminListPlans: %v", err)
	}
	if len(listRes.Plans) < 3 {
		t.Errorf("expected at least 3 plans, got %d", len(listRes.Plans))
	}

	// 2. Test AdminUpdatePlan
	updatePayload := AdminPlanDTO{
		Name:              "Free Member (Updated)",
		PriceINR:          0,
		BillingPeriod:     "monthly",
		DailyMovieLimit:   2,
		DailyEpisodeLimit: 4,
		MaxQuality:        720,
		MaxDevices:        1,
		IsActive:          true,
	}
	body, _ := json.Marshal(updatePayload)

	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", "free")
	reqUpdate := httptest.NewRequest("PUT", "/api/admin/plans/free", bytes.NewReader(body))
	reqUpdate = reqUpdate.WithContext(context.WithValue(reqUpdate.Context(), chi.RouteCtxKey, rctx))
	rrUpdate := httptest.NewRecorder()

	AdminUpdatePlan(rrUpdate, reqUpdate)
	if rrUpdate.Code != http.StatusOK {
		t.Fatalf("AdminUpdatePlan returned code %d: %s", rrUpdate.Code, rrUpdate.Body.String())
	}

	// Verify updated value in database
	var updatedMovieLimit, updatedEpLimit int
	_ = db.QueryRow("SELECT daily_movie_limit, daily_episode_limit FROM plans WHERE id = 'free'").Scan(&updatedMovieLimit, &updatedEpLimit)
	if updatedMovieLimit != 2 || updatedEpLimit != 4 {
		t.Errorf("expected updated limits 2/4, got %d/%d", updatedMovieLimit, updatedEpLimit)
	}

	// Revert to 1/2 for consistency
	_, _ = db.Exec("UPDATE plans SET daily_movie_limit = 1, daily_episode_limit = 2, name = 'Free Member' WHERE id = 'free'")

	// 3. Test AdminGetTitleAccess & AdminUpdateTitleAccess
	testTitleID := "test_admin_title_" + uuid.NewString()[:8]
	_, _ = db.Exec(
		`INSERT INTO titles (id, title, kind, year, maturity, runtime_min, match_percent, logline, synopsis, poster, backdrop, tone, required_tier, genres, badges, free_episodes)
		 VALUES (?, 'Admin Test Title', 'series', 2026, '13+', 60, 90, 'log', 'syn', 'p', 'b', 'Comedy', 'free', 'Comedy', 'HD', 1)`,
		testTitleID,
	)

	// GET Title Access
	rctxTitle := chi.NewRouteContext()
	rctxTitle.URLParams.Add("id", testTitleID)
	reqGetAccess := httptest.NewRequest("GET", "/api/admin/titles/"+testTitleID+"/access", nil)
	reqGetAccess = reqGetAccess.WithContext(context.WithValue(reqGetAccess.Context(), chi.RouteCtxKey, rctxTitle))
	rrGetAccess := httptest.NewRecorder()

	AdminGetTitleAccess(rrGetAccess, reqGetAccess)
	if rrGetAccess.Code != http.StatusOK {
		t.Fatalf("AdminGetTitleAccess returned code %d: %s", rrGetAccess.Code, rrGetAccess.Body.String())
	}

	var titleAccessRes TitleAccessDTO
	_ = json.Unmarshal(rrGetAccess.Body.Bytes(), &titleAccessRes)
	if titleAccessRes.FreeEpisodes != 1 {
		t.Errorf("expected FreeEpisodes=1, got %d", titleAccessRes.FreeEpisodes)
	}

	// UPDATE Title Access
	updateAccessPayload := map[string]interface{}{
		"required_tier": "standard",
		"free_episodes": 3,
	}
	accessBody, _ := json.Marshal(updateAccessPayload)
	reqUpdateAccess := httptest.NewRequest("PUT", "/api/admin/titles/"+testTitleID+"/access", bytes.NewReader(accessBody))
	reqUpdateAccess = reqUpdateAccess.WithContext(context.WithValue(reqUpdateAccess.Context(), chi.RouteCtxKey, rctxTitle))
	rrUpdateAccess := httptest.NewRecorder()

	AdminUpdateTitleAccess(rrUpdateAccess, reqUpdateAccess)
	if rrUpdateAccess.Code != http.StatusOK {
		t.Fatalf("AdminUpdateTitleAccess returned code %d: %s", rrUpdateAccess.Code, rrUpdateAccess.Body.String())
	}

	// Verify in DB
	var verifiedTier string
	var verifiedFreeEps int
	_ = db.QueryRow("SELECT required_tier, free_episodes FROM titles WHERE id = ?", testTitleID).Scan(&verifiedTier, &verifiedFreeEps)
	if verifiedTier != "standard" || verifiedFreeEps != 3 {
		t.Errorf("expected standard/3, got %s/%d", verifiedTier, verifiedFreeEps)
	}

	// 4. Test PublicListPlans
	reqPublic := httptest.NewRequest("GET", "/api/plans", nil)
	rrPublic := httptest.NewRecorder()
	PublicListPlans(rrPublic, reqPublic)

	if rrPublic.Code != http.StatusOK {
		t.Fatalf("PublicListPlans returned code %d: %s", rrPublic.Code, rrPublic.Body.String())
	}
}
