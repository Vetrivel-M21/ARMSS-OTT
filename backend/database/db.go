package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	_ "modernc.org/sqlite"
)

var DB *sql.DB
var DriverName string

// InitDB initializes the SQL database — attempts MySQL first, with automatic SQLite fallback.
func InitDB() (*sql.DB, error) {
	mysqlDSN := os.Getenv("MYSQL_DSN")
	if mysqlDSN == "" {
		cfg := mysql.NewConfig()
		cfg.User = getEnv("MYSQL_USER", "root")
		cfg.Passwd = getEnv("MYSQL_PASSWORD", "Vetri@123")
		cfg.Net = "tcp"
		cfg.Addr = getEnv("MYSQL_HOST", "127.0.0.1") + ":" + getEnv("MYSQL_PORT", "3306")
		cfg.DBName = getEnv("MYSQL_DB", "armss_ott")
		cfg.ParseTime = true
		cfg.MultiStatements = true
		cfg.AllowNativePasswords = true
		mysqlDSN = cfg.FormatDSN()
	}

	log.Printf("[ARMSS-OTT] Attempting MySQL connection: %s", maskDSN(mysqlDSN))
	db, err := sql.Open("mysql", mysqlDSN)
	if err == nil {
		db.SetMaxOpenConns(25)
		db.SetMaxIdleConns(10)

		if pingErr := db.Ping(); pingErr == nil {
			log.Println("[ARMSS-OTT] ✓ MySQL connected successfully!")
			DB = db
			DriverName = "mysql"
			if initErr := createTables("mysql"); initErr != nil {
				return nil, fmt.Errorf("failed creating MySQL tables: %w", initErr)
			}
			return DB, nil
		} else {
			log.Printf("[ARMSS-OTT] Notice: MySQL ping failed (%v). Falling back to embedded SQLite database...", pingErr)
			_ = db.Close()
		}
	} else {
		log.Printf("[ARMSS-OTT] Notice: MySQL open failed (%v). Falling back to embedded SQLite database...", err)
	}

	// ── Auto SQLite Fallback ──
	sqlitePath := getEnv("SQLITE_PATH", "armss_ott.db")
	_ = os.MkdirAll(filepath.Dir(sqlitePath), 0755)
	log.Printf("[ARMSS-OTT] Connecting to embedded SQLite: %s", sqlitePath)

	sdb, sErr := sql.Open("sqlite", sqlitePath+"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)")
	if sErr != nil {
		return nil, fmt.Errorf("failed opening SQLite fallback: %w", sErr)
	}

	sdb.SetMaxOpenConns(1) // SQLite single-writer safe pool

	if pingErr := sdb.Ping(); pingErr != nil {
		_ = sdb.Close()
		return nil, fmt.Errorf("SQLite ping failed: %w", pingErr)
	}

	log.Println("[ARMSS-OTT] ✓ SQLite database connected successfully (Embedded Fallback Active)!")
	DB = sdb
	DriverName = "sqlite"

	if initErr := createTables("sqlite"); initErr != nil {
		return nil, fmt.Errorf("failed creating SQLite tables: %w", initErr)
	}
	return DB, nil
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func createTables(driver string) error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id VARCHAR(64) PRIMARY KEY,
		email VARCHAR(191) NOT NULL UNIQUE,
		password_hash VARCHAR(255) NOT NULL,
		name VARCHAR(100) NOT NULL,
		subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free',
		is_admin BOOLEAN NOT NULL DEFAULT FALSE,
		last_login_at DATETIME NULL,
		last_active_at DATETIME NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS profiles (
		id VARCHAR(64) PRIMARY KEY,
		user_id VARCHAR(64) NOT NULL,
		name VARCHAR(50) NOT NULL,
		avatar_color VARCHAR(30) NOT NULL,
		is_kids BOOLEAN NOT NULL DEFAULT FALSE,
		pin VARCHAR(10) DEFAULT '',
		created_at DATETIME NOT NULL,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS titles (
		id VARCHAR(100) PRIMARY KEY,
		title VARCHAR(255) NOT NULL,
		kind VARCHAR(50) NOT NULL,
		year INT NOT NULL,
		maturity VARCHAR(20) NOT NULL,
		runtime_min INT NOT NULL,
		match_percent INT NOT NULL,
		logline TEXT NOT NULL,
		synopsis TEXT NOT NULL,
		poster TEXT NOT NULL,
		backdrop TEXT NOT NULL,
		trailer TEXT,
		video_url TEXT,
		tone VARCHAR(50) NOT NULL,
		original BOOLEAN NOT NULL DEFAULT FALSE,
		kids BOOLEAN NOT NULL DEFAULT FALSE,
		required_tier VARCHAR(50) NOT NULL DEFAULT 'free',
		genres TEXT NOT NULL,
		badges TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS episodes (
		id VARCHAR(100) PRIMARY KEY,
		title_id VARCHAR(100) NOT NULL,
		season_number INT NOT NULL DEFAULT 1,
		episode_number INT NOT NULL,
		title VARCHAR(255) NOT NULL,
		runtime_min INT NOT NULL DEFAULT 0,
		synopsis TEXT,
		video_url TEXT NOT NULL,
		thumbnail_url TEXT,
		created_at DATETIME NOT NULL,
		FOREIGN KEY (title_id) REFERENCES titles(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS watchlist (
		user_id VARCHAR(64) NOT NULL,
		profile_id VARCHAR(64) NOT NULL,
		title_id VARCHAR(100) NOT NULL,
		added_at DATETIME NOT NULL,
		PRIMARY KEY (user_id, profile_id, title_id)
	);

	CREATE TABLE IF NOT EXISTS watch_progress (
		user_id VARCHAR(64) NOT NULL,
		profile_id VARCHAR(64) NOT NULL,
		title_id VARCHAR(100) NOT NULL,
		episode_id VARCHAR(100) DEFAULT '',
		progress_percent DOUBLE NOT NULL,
		time_seconds DOUBLE NOT NULL,
		updated_at DATETIME NOT NULL,
		PRIMARY KEY (user_id, profile_id, title_id)
	);

	CREATE TABLE IF NOT EXISTS ratings (
		user_id VARCHAR(64) NOT NULL,
		title_id VARCHAR(100) NOT NULL,
		score INT NOT NULL,
		updated_at DATETIME NOT NULL,
		PRIMARY KEY (user_id, title_id)
	);

	CREATE TABLE IF NOT EXISTS user_activity_logs (
		id VARCHAR(64) PRIMARY KEY,
		user_id VARCHAR(64) NOT NULL,
		action VARCHAR(50) NOT NULL,
		details VARCHAR(255) DEFAULT '',
		created_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS user_otps (
		id VARCHAR(64) PRIMARY KEY,
		user_id VARCHAR(64) NOT NULL,
		email VARCHAR(191) NOT NULL,
		otp_code VARCHAR(10) NOT NULL,
		purpose VARCHAR(50) NOT NULL,
		expires_at DATETIME NOT NULL,
		verified BOOLEAN NOT NULL DEFAULT FALSE,
		created_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS site_settings (
		setting_key VARCHAR(64) PRIMARY KEY,
		setting_value TEXT NOT NULL,
		updated_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS videos (
		id VARCHAR(64) PRIMARY KEY,
		title VARCHAR(255) NOT NULL,
		status VARCHAR(32) NOT NULL DEFAULT 'uploaded',
		master_key VARCHAR(512) NOT NULL,
		duration DOUBLE NOT NULL DEFAULT 0,
		error_message TEXT NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS user_devices (
		id VARCHAR(64) PRIMARY KEY,
		user_id VARCHAR(64) NOT NULL,
		device_id VARCHAR(128) NOT NULL,
		device_name VARCHAR(100) NOT NULL DEFAULT 'Unknown Device',
		client_type VARCHAR(32) NOT NULL DEFAULT 'web',
		last_used_at DATETIME NOT NULL,
		created_at DATETIME NOT NULL,
		UNIQUE(user_id, device_id),
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS playback_sessions (
		session_id VARCHAR(64) PRIMARY KEY,
		user_id VARCHAR(64) NOT NULL,
		device_id VARCHAR(128) NOT NULL,
		video_id VARCHAR(64) NOT NULL,
		last_heartbeat_at DATETIME NOT NULL,
		created_at DATETIME NOT NULL,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);
	`

	if driver == "mysql" {
		schema = strings.ReplaceAll(schema, ");", ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;")
	}

	queries := strings.Split(schema, ";")
	for _, q := range queries {
		q = strings.TrimSpace(q)
		if q == "" {
			continue
		}
		if _, err := DB.Exec(q); err != nil {
			return fmt.Errorf("executing SQL query: %w", err)
		}
	}

	runMigrations(driver)
	return nil
}

func maskDSN(dsn string) string {
	parts := strings.Split(dsn, "@")
	if len(parts) > 1 {
		return "***@" + parts[len(parts)-1]
	}
	return dsn
}

func runMigrations(driver string) {
	if driver == "mysql" {
		addColumnIfNotExists(DB, "users", "is_admin", "BOOLEAN NOT NULL DEFAULT FALSE")
		addColumnIfNotExists(DB, "users", "last_login_at", "DATETIME NULL")
		addColumnIfNotExists(DB, "users", "last_active_at", "DATETIME NULL")
		addColumnIfNotExists(DB, "titles", "video_url", "TEXT NULL")
		addColumnIfNotExists(DB, "titles", "trailer", "TEXT NULL")
		addColumnIfNotExists(DB, "episodes", "video_url", "TEXT NOT NULL")
		addColumnIfNotExists(DB, "episodes", "thumbnail_url", "TEXT NULL")
		_, _ = DB.Exec("ALTER TABLE titles MODIFY COLUMN poster TEXT NOT NULL")
		_, _ = DB.Exec("ALTER TABLE titles MODIFY COLUMN backdrop TEXT NOT NULL")
		_, _ = DB.Exec("ALTER TABLE titles MODIFY COLUMN trailer TEXT NULL")
		_, _ = DB.Exec("ALTER TABLE titles MODIFY COLUMN title VARCHAR(255) NOT NULL")
		_, _ = DB.Exec("ALTER TABLE titles MODIFY COLUMN maturity VARCHAR(20) NOT NULL")
		_, _ = DB.Exec("ALTER TABLE titles MODIFY COLUMN tone VARCHAR(50) NOT NULL")
		_, _ = DB.Exec("ALTER TABLE titles MODIFY COLUMN kind VARCHAR(50) NOT NULL")
		_, _ = DB.Exec("ALTER TABLE titles MODIFY COLUMN required_tier VARCHAR(50) NOT NULL DEFAULT 'free'")
	} else {
		_, _ = DB.Exec("ALTER TABLE titles ADD COLUMN video_url TEXT")
	}

	// Additive plan-based access control migrations
	runPlanAccessMigrations(driver)
}

func addColumnIfNotExists(db *sql.DB, tableName, columnName, columnDef string) {
	var count int
	query := "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?"
	err := db.QueryRow(query, tableName, columnName).Scan(&count)
	if err == nil && count == 0 {
		alterQuery := fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", tableName, columnName, columnDef)
		if _, alterErr := db.Exec(alterQuery); alterErr != nil {
			log.Printf("[runMigrations] Error adding column %s to %s: %v", columnName, tableName, alterErr)
		} else {
			log.Printf("[runMigrations] ✓ Added column %s to %s successfully!", columnName, tableName)
		}
	}
}

// GetSetting retrieves a JSON or string setting by key.
func GetSetting(key string) (string, error) {
	var val string
	err := DB.QueryRow("SELECT setting_value FROM site_settings WHERE setting_key = ?", key).Scan(&val)
	return val, err
}

// SetSetting stores or updates a setting by key across MySQL and SQLite.
func SetSetting(key, val string) error {
	now := time.Now()
	if DriverName == "sqlite" {
		_, err := DB.Exec("INSERT OR REPLACE INTO site_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?)", key, val, now)
		return err
	}
	_, err := DB.Exec("INSERT INTO site_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = VALUES(updated_at)", key, val, now)
	return err
}

