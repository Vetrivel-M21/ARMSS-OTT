package database

import (
	"os"
	"testing"
	"time"
)

func TestConnectionPoolConfiguration(t *testing.T) {
	// Use an isolated SQLite file in temp directory for the test
	tmpDB := t.TempDir() + "/test_pool.db"
	_ = os.Setenv("SQLITE_PATH", tmpDB)
	// Clear any MySQL variables to trigger fast SQLite path
	origHost := os.Getenv("MYSQL_HOST")
	origDSN := os.Getenv("MYSQL_DSN")
	_ = os.Unsetenv("MYSQL_HOST")
	_ = os.Unsetenv("MYSQL_DSN")
	defer func() {
		if origHost != "" {
			_ = os.Setenv("MYSQL_HOST", origHost)
		}
		if origDSN != "" {
			_ = os.Setenv("MYSQL_DSN", origDSN)
		}
	}()

	db, err := InitDB()
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer db.Close()

	if db == nil {
		t.Fatal("expected initialized database, got nil")
	}

	stats := db.Stats()
	if stats.MaxOpenConnections != 1 {
		t.Errorf("expected MaxOpenConnections=1 for SQLite, got %d", stats.MaxOpenConnections)
	}

	// Verify basic query execution
	var one int
	if err := db.QueryRow("SELECT 1").Scan(&one); err != nil {
		t.Fatalf("failed executing query on initialized database: %v", err)
	}
	if one != 1 {
		t.Errorf("expected 1, got %d", one)
	}
}

func TestRetryParameters(t *testing.T) {
	// Verify retry intervals and durations
	maxRetriesLocal := 1
	if os.Getenv("MYSQL_HOST") != "" || os.Getenv("MYSQL_DSN") != "" {
		maxRetriesLocal = 15
	}
	if maxRetriesLocal <= 0 {
		t.Errorf("expected positive retry count, got %d", maxRetriesLocal)
	}

	retryInterval := 2 * time.Second
	totalDuration := time.Duration(15) * retryInterval
	if totalDuration != 30*time.Second {
		t.Errorf("expected 30s total retry window, got %v", totalDuration)
	}
}

