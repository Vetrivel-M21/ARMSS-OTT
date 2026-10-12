package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"mime"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	smithy "github.com/aws/smithy-go"
)

// Service provides S3-compatible storage operations for MinIO and Cloudflare R2.
type Service struct {
	client          *s3.Client
	presignClient   *s3.PresignClient
	endpoint        string
	mastersBucket   string
	hlsBucket       string
	usePathStyle    bool
	publicBaseURL   string
}

var globalStorage *Service

// Config holds S3 configuration parameters.
type Config struct {
	Endpoint      string
	AccessKey     string
	SecretKey     string
	Region        string
	MastersBucket string
	HLSBucket     string
	UsePathStyle  bool
	PublicBaseURL string
}

// NewService initializes an S3-compatible storage client.
func NewService(cfg Config) (*Service, error) {
	if cfg.MastersBucket == "" {
		cfg.MastersBucket = "masters"
	}
	if cfg.HLSBucket == "" {
		cfg.HLSBucket = "hls"
	}
	if cfg.Region == "" {
		cfg.Region = "us-east-1"
	}

	customResolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		if cfg.Endpoint != "" {
			return aws.Endpoint{
				PartitionID:       "aws",
				URL:               cfg.Endpoint,
				SigningRegion:     cfg.Region,
				HostnameImmutable: cfg.UsePathStyle,
			}, nil
		}
		return aws.Endpoint{}, &aws.EndpointNotFoundError{}
	})

	awsCfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithRegion(cfg.Region),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, "")),
		config.WithEndpointResolverWithOptions(customResolver),
	)
	if err != nil {
		return nil, fmt.Errorf("loading AWS config: %w", err)
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = cfg.UsePathStyle
	})

	presignClient := s3.NewPresignClient(client)

	svc := &Service{
		client:        client,
		presignClient: presignClient,
		endpoint:      cfg.Endpoint,
		mastersBucket: cfg.MastersBucket,
		hlsBucket:     cfg.HLSBucket,
		usePathStyle:  cfg.UsePathStyle,
		publicBaseURL: cfg.PublicBaseURL,
	}

	return svc, nil
}

// InitFromEnv initializes the global storage singleton from environment variables.
func InitFromEnv() (*Service, error) {
	endpoint := getEnv("S3_ENDPOINT", "http://127.0.0.1:9000")
	accessKey := getEnv("S3_ACCESS_KEY", getEnv("MINIO_ROOT_USER", "minioadmin"))
	secretKey := getEnv("S3_SECRET_KEY", getEnv("MINIO_ROOT_PASSWORD", "minioadmin"))
	region := getEnv("S3_REGION", "us-east-1")
	mastersBucket := getEnv("S3_MASTERS_BUCKET", "masters")
	hlsBucket := getEnv("S3_HLS_BUCKET", "hls")
	usePathStyle := getEnv("S3_USE_PATH_STYLE", "true") == "true"
	publicBaseURL := getEnv("S3_PUBLIC_BASE_URL", "")

	cfg := Config{
		Endpoint:      endpoint,
		AccessKey:     accessKey,
		SecretKey:     secretKey,
		Region:        region,
		MastersBucket: mastersBucket,
		HLSBucket:     hlsBucket,
		UsePathStyle:  usePathStyle,
		PublicBaseURL: publicBaseURL,
	}

	svc, err := NewService(cfg)
	if err != nil {
		return nil, err
	}
	globalStorage = svc
	return svc, nil
}

// GetGlobalStorage returns initialized global storage service.
func GetGlobalStorage() *Service {
	return globalStorage
}

// SetGlobalStorage sets global storage instance (useful for tests).
func SetGlobalStorage(svc *Service) {
	globalStorage = svc
}

// MastersBucket returns name of masters bucket.
func (s *Service) MastersBucket() string {
	return s.mastersBucket
}

// HLSBucket returns name of HLS bucket.
func (s *Service) HLSBucket() string {
	return s.hlsBucket
}

// EnsureBuckets ensures required buckets exist, creating them if necessary.
func (s *Service) EnsureBuckets(ctx context.Context) error {
	for _, bucket := range []string{s.mastersBucket, s.hlsBucket} {
		_, err := s.client.HeadBucket(ctx, &s3.HeadBucketInput{
			Bucket: aws.String(bucket),
		})
		if err != nil {
			log.Printf("[S3] Bucket '%s' not found, creating...", bucket)
			_, createErr := s.client.CreateBucket(ctx, &s3.CreateBucketInput{
				Bucket: aws.String(bucket),
			})
			if createErr != nil {
				// Bucket already owned by you or already exists is acceptable
				var bAlreadyExists *types.BucketAlreadyExists
				var bAlreadyOwned *types.BucketAlreadyOwnedByYou
				if !errors.As(createErr, &bAlreadyExists) && !errors.As(createErr, &bAlreadyOwned) {
					return fmt.Errorf("creating bucket %s: %w", bucket, createErr)
				}
			} else {
				log.Printf("[S3] Bucket '%s' created successfully.", bucket)
			}
		}
	}
	return nil
}

// GeneratePresignedPutURL creates a presigned PUT URL allowing clients to upload directly to S3.
func (s *Service) GeneratePresignedPutURL(ctx context.Context, bucket, key string, lifetime time.Duration) (string, error) {
	req, err := s.presignClient.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(lifetime))
	if err != nil {
		return "", fmt.Errorf("generating presigned PUT URL: %w", err)
	}
	return req.URL, nil
}

// GeneratePresignedGetURL creates a presigned GET URL for downloading or playing an object.
func (s *Service) GeneratePresignedGetURL(ctx context.Context, bucket, key string, lifetime time.Duration) (string, error) {
	req, err := s.presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(lifetime))
	if err != nil {
		return "", fmt.Errorf("generating presigned GET URL: %w", err)
	}
	return req.URL, nil
}

// ObjectExists checks whether an object exists in a bucket.
func (s *Service) ObjectExists(ctx context.Context, bucket, key string) (bool, error) {
	_, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		var notFound *types.NotFound
		var apiErr smithy.APIError
		if errors.As(err, &notFound) {
			return false, nil
		}
		if errors.As(err, &apiErr) && (apiErr.ErrorCode() == "NotFound" || apiErr.ErrorCode() == "404") {
			return false, nil
		}
		// S3 HeadObject returns 404 in some clients
		if strings.Contains(err.Error(), "404") || strings.Contains(err.Error(), "NotFound") {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// DownloadFile downloads an object from S3 to a local file path.
func (s *Service) DownloadFile(ctx context.Context, bucket, key, localPath string) error {
	resp, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("getting S3 object %s/%s: %w", bucket, key, err)
	}
	defer resp.Body.Close()

	if err := os.MkdirAll(filepath.Dir(localPath), 0755); err != nil {
		return fmt.Errorf("creating parent directory: %w", err)
	}

	outFile, err := os.Create(localPath)
	if err != nil {
		return fmt.Errorf("creating local destination file: %w", err)
	}
	defer outFile.Close()

	if _, err := io.Copy(outFile, resp.Body); err != nil {
		return fmt.Errorf("writing object to local file: %w", err)
	}
	return nil
}

// FetchObjectBytes downloads an S3 object into memory as bytes (ideal for m3u8 playlists).
func (s *Service) FetchObjectBytes(ctx context.Context, bucket, key string) ([]byte, error) {
	resp, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("getting S3 object %s/%s: %w", bucket, key, err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading S3 object body %s/%s: %w", bucket, key, err)
	}
	return data, nil
}

// UploadFile uploads a single local file to S3.
func (s *Service) UploadFile(ctx context.Context, localPath, bucket, key, contentType string) error {
	file, err := os.Open(localPath)
	if err != nil {
		return fmt.Errorf("opening local file %s: %w", localPath, err)
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		return fmt.Errorf("stating file %s: %w", localPath, err)
	}

	if contentType == "" {
		ext := strings.ToLower(filepath.Ext(localPath))
		switch ext {
		case ".m3u8":
			contentType = "application/vnd.apple.mpegurl"
		case ".m4s":
			contentType = "video/iso.segment"
		case ".mp4":
			contentType = "video/mp4"
		default:
			contentType = mime.TypeByExtension(ext)
			if contentType == "" {
				contentType = "application/octet-stream"
			}
		}
	}

	_, err = s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(bucket),
		Key:           aws.String(key),
		Body:          file,
		ContentLength: aws.Int64(stat.Size()),
		ContentType:   aws.String(contentType),
	})
	if err != nil {
		return fmt.Errorf("uploading %s to %s/%s: %w", localPath, bucket, key, err)
	}
	return nil
}

// UploadDirectory recursively uploads all files from a directory to an S3 prefix.
func (s *Service) UploadDirectory(ctx context.Context, localDir, bucket, keyPrefix string) error {
	cleanPrefix := strings.Trim(keyPrefix, "/")

	return filepath.Walk(localDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}

		relPath, err := filepath.Rel(localDir, path)
		if err != nil {
			return err
		}

		s3Key := cleanPrefix + "/" + filepath.ToSlash(relPath)
		return s.UploadFile(ctx, path, bucket, s3Key, "")
	})
}

// GetPlaybackURL returns the URL to access a stream playlist.
func (s *Service) GetPlaybackURL(ctx context.Context, bucket, key string) (string, error) {
	if s.publicBaseURL != "" {
		return fmt.Sprintf("%s/%s/%s", strings.TrimRight(s.publicBaseURL, "/"), bucket, strings.TrimLeft(key, "/")), nil
	}
	// Fallback to presigned GET URL (valid 6 hours)
	return s.GeneratePresignedGetURL(ctx, bucket, key, 6*time.Hour)
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
