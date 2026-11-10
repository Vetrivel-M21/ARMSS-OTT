package main

import (
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"text/tabwriter"

	_ "github.com/go-sql-driver/mysql"
	"github.com/joho/godotenv"

	"armss-ott-backend/services/media"
)

type VideoItem struct {
	SourceTable string // "titles" or "episodes" or "videos"
	ID          string
	Title       string
	VideoURL    string
	OldDuration float64
}

func main() {
	dryRun := flag.Bool("dry-run", true, "Perform dry-run without writing files or database")
	deleteBackups := flag.Bool("delete-backups", false, "Delete .bak files after successful replacement")
	targetID := flag.String("id", "", "Optional: only process a single video/episode by ID")
	uploadsDirFlag := flag.String("uploads-dir", "", "Custom uploads directory path (defaults to UPLOADS_DIR env or ./public/uploads)")
	flag.Parse()

	log.Printf("[FixVideos] Mode: dry-run=%v, delete-backups=%v, filter-id=%q", *dryRun, *deleteBackups, *targetID)

	_ = godotenv.Load()
	_ = godotenv.Load("../../.env")

	// 1. Resolve Uploads directory
	uploadsDir := *uploadsDirFlag
	if uploadsDir == "" {
		uploadsDir = os.Getenv("UPLOADS_DIR")
	}
	if uploadsDir == "" {
		uploadsDir = "./public/uploads"
	}
	absUploadsDir, err := filepath.Abs(uploadsDir)
	if err != nil {
		log.Fatalf("Resolving uploads dir error: %v", err)
	}
	log.Printf("[FixVideos] Resolved Uploads Directory: %s", absUploadsDir)

	// 2. Connect to database
	dsn := os.Getenv("MYSQL_DSN")
	if dsn == "" {
		user := os.Getenv("MYSQL_USER")
		if user == "" {
			user = "root"
		}
		pass := os.Getenv("MYSQL_PASSWORD")
		host := os.Getenv("MYSQL_HOST")
		if host == "" {
			host = "127.0.0.1"
		}
		port := os.Getenv("MYSQL_PORT")
		if port == "" {
			port = "3306"
		}
		dbName := os.Getenv("MYSQL_DB")
		if dbName == "" {
			dbName = "armss_ott"
		}
		dsn = fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true", user, pass, host, port, dbName)
	}

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("Opening DB connection error: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Printf("[FixVideos] Warning: DB ping failed (%v). Continuing in offline/file scan mode if files are specified.", err)
	}

	// 3. Collect candidates from DB
	items := queryCandidates(db, *targetID)
	log.Printf("[FixVideos] Found %d candidate items in database pointing to /uploads/*.mp4", len(items))

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 3, ' ', 0)
	fmt.Fprintln(w, "TABLE\tID\tTITLE\tOLD DUR\tNEW DUR\tMOOV BEFORE\tMOOV AFTER\tSTATUS")

	for _, item := range items {
		relFilename := strings.TrimPrefix(item.VideoURL, "/uploads/")
		relFilename = strings.TrimPrefix(relFilename, "uploads/")
		filePath := filepath.Join(absUploadsDir, relFilename)

		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			fmt.Fprintf(w, "%s\t%s\t%s\t%.1fs\t-\t-\t-\tFILE NOT FOUND (%s)\n",
				item.SourceTable, item.ID, item.Title, item.OldDuration, relFilename)
			continue
		}

		// Detect if normalization is required (pure Go atom inspection)
		needsNorm := media.IsFragmentedOrNoFaststart(filePath)
		moovBefore := "front (faststart)"
		if needsNorm {
			moovBefore = "end or fragmented"
		}

		if *dryRun {
			// Dry-run mode: do not call ffmpeg, probe if possible
			dur, pErr := media.ProbeDuration(filePath)
			newDurStr := "-"
			if pErr == nil {
				newDurStr = fmt.Sprintf("%.2fs", dur)
			}
			status := "NEEDS NORMALIZE"
			if !needsNorm {
				status = "ALREADY OK"
			}
			fmt.Fprintf(w, "%s\t%s\t%s\t%.1fs\t%s\t%s\t-\tDRY RUN (%s)\n",
				item.SourceTable, item.ID, item.Title, item.OldDuration, newDurStr, moovBefore, status)
			continue
		}

		// Active run mode
		newDur, err := processVideoFile(filePath, needsNorm, *deleteBackups)
		if err != nil {
			fmt.Fprintf(w, "%s\t%s\t%s\t%.1fs\t-\t%s\tERROR: %v\tFAILED\n",
				item.SourceTable, item.ID, item.Title, item.OldDuration, moovBefore, err)
			continue
		}

		// Update database
		if err := updateDuration(db, item.SourceTable, item.ID, newDur); err != nil {
			log.Printf("[FixVideos] Warning: updating DB for %s %s: %v", item.SourceTable, item.ID, err)
		}

		fmt.Fprintf(w, "%s\t%s\t%s\t%.1fs\t%.2fs\t%s\tfront (faststart)\tSUCCESS\n",
			item.SourceTable, item.ID, item.Title, item.OldDuration, newDur, moovBefore)
	}

	w.Flush()
}

func queryCandidates(db *sql.DB, targetID string) []VideoItem {
	var items []VideoItem

	// 1. Titles
	queryTitles := "SELECT id, title, video_url, runtime_min FROM titles WHERE video_url LIKE '%/uploads/%.mp4' OR video_url LIKE '%/uploads/%.MP4'"
	if targetID != "" {
		queryTitles += fmt.Sprintf(" AND id = '%s'", targetID)
	}
	if rows, err := db.Query(queryTitles); err == nil {
		defer rows.Close()
		for rows.Next() {
			var id, title, videoURL string
			var runtimeMin int
			if err := rows.Scan(&id, &title, &videoURL, &runtimeMin); err == nil {
				items = append(items, VideoItem{
					SourceTable: "titles",
					ID:          id,
					Title:       title,
					VideoURL:    videoURL,
					OldDuration: float64(runtimeMin * 60),
				})
			}
		}
	}

	// 2. Episodes
	queryEpisodes := "SELECT id, title, video_url, runtime FROM episodes WHERE video_url LIKE '%/uploads/%.mp4' OR video_url LIKE '%/uploads/%.MP4'"
	if targetID != "" {
		queryEpisodes += fmt.Sprintf(" AND id = '%s'", targetID)
	}
	if rows, err := db.Query(queryEpisodes); err == nil {
		defer rows.Close()
		for rows.Next() {
			var id, title, videoURL string
			var runtimeMin int
			if err := rows.Scan(&id, &title, &videoURL, &runtimeMin); err == nil {
				items = append(items, VideoItem{
					SourceTable: "episodes",
					ID:          id,
					Title:       title,
					VideoURL:    videoURL,
					OldDuration: float64(runtimeMin * 60),
				})
			}
		}
	}

	// 3. Videos table
	queryVideos := "SELECT id, title, duration FROM videos WHERE master_key LIKE '%/uploads/%.mp4' OR master_key LIKE '%/uploads/%.MP4'"
	if targetID != "" {
		queryVideos += fmt.Sprintf(" AND id = '%s'", targetID)
	}
	if rows, err := db.Query(queryVideos); err == nil {
		defer rows.Close()
		for rows.Next() {
			var id, title string
			var dur float64
			if err := rows.Scan(&id, &title, &dur); err == nil {
				items = append(items, VideoItem{
					SourceTable: "videos",
					ID:          id,
					Title:       title,
					VideoURL:    id,
					OldDuration: dur,
				})
			}
		}
	}

	return items
}

func processVideoFile(filePath string, needsNorm bool, deleteBackups bool) (float64, error) {
	if needsNorm {
		dir := filepath.Dir(filePath)
		base := filepath.Base(filePath)
		tmpOutPath := filepath.Join(dir, "tmp_norm_"+base)
		bakPath := filePath + ".bak"

		// Clean up old temporary files
		_ = os.Remove(tmpOutPath)

		// 1. Run NormalizeMP4 to temp file
		if err := media.NormalizeMP4(filePath, tmpOutPath); err != nil {
			_ = os.Remove(tmpOutPath)
			return 0, fmt.Errorf("normalizing: %w", err)
		}

		// 2. Verify with ProbeDuration (> 0)
		dur, err := media.ProbeDuration(tmpOutPath)
		if err != nil || dur <= 0 {
			_ = os.Remove(tmpOutPath)
			return 0, fmt.Errorf("normalized file verification failed: %w", err)
		}

		// 3. Backup original
		_ = os.Remove(bakPath)
		if err := os.Rename(filePath, bakPath); err != nil {
			_ = os.Remove(tmpOutPath)
			return 0, fmt.Errorf("creating backup: %w", err)
		}

		// 4. Atomically replace original
		if err := os.Rename(tmpOutPath, filePath); err != nil {
			// Rollback backup
			_ = os.Rename(bakPath, filePath)
			return 0, fmt.Errorf("replacing original: %w", err)
		}

		// 5. Delete backup if requested
		if deleteBackups {
			_ = os.Remove(bakPath)
		}

		return dur, nil
	}

	// Does not need normalization, just probe duration
	return media.ProbeDuration(filePath)
}

func updateDuration(db *sql.DB, table, id string, duration float64) error {
	switch table {
	case "titles":
		runtimeMin := int((duration + 30) / 60)
		_, err := db.Exec("UPDATE titles SET runtime_min = ? WHERE id = ?", runtimeMin, id)
		return err
	case "episodes":
		runtimeMin := int((duration + 30) / 60)
		_, err := db.Exec("UPDATE episodes SET runtime = ? WHERE id = ?", runtimeMin, id)
		return err
	case "videos":
		_, err := db.Exec("UPDATE videos SET duration = ? WHERE id = ?", duration, id)
		return err
	}
	return nil
}

