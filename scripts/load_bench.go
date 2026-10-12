package main

import (
	"flag"
	"fmt"
	"io"
	"net/http"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

func main() {
	baseURL := flag.String("url", "http://localhost:8081", "Target Base URL")
	concurrency := flag.Int("concurrency", 50, "Number of concurrent workers (VUs)")
	duration := flag.Duration("duration", 10*time.Second, "Test run duration")
	flag.Parse()

	fmt.Println("================================================================")
	fmt.Println("       ARMSS-OTT High-Concurrency Playback Load Tester          ")
	fmt.Println("================================================================")
	fmt.Printf("Target: %s | Concurrency: %d VUs | Duration: %v\n\n", *baseURL, *concurrency, *duration)

	endpoints := []string{
		*baseURL + "/api/health",
		*baseURL + "/api/metrics?format=json",
		*baseURL + "/api/videos/crownless/playback",   // Tests unauth 401 gate
		*baseURL + "/api/videos/crownless/master.m3u8", // Tests token signature validation gate
	}

	var totalRequests uint64
	var successRequests uint64
	var errorRequests uint64

	var latenciesMu sync.Mutex
	var allLatencies []time.Duration

	client := &http.Client{
		Timeout: 5 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        500,
			MaxIdleConnsPerHost: 200,
			IdleConnTimeout:     90 * time.Second,
		},
	}

	stopChan := make(chan struct{})
	var wg sync.WaitGroup

	startTime := time.Now()

	// Launch worker routines
	for i := 0; i < *concurrency; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			localLatencies := make([]time.Duration, 0, 1000)
			reqIdx := workerID

			for {
				select {
				case <-stopChan:
					latenciesMu.Lock()
					allLatencies = append(allLatencies, localLatencies...)
					latenciesMu.Unlock()
					return
				default:
					target := endpoints[reqIdx%len(endpoints)]
					reqIdx++

					t0 := time.Now()
					resp, err := client.Get(target)
					dur := time.Since(t0)
					localLatencies = append(localLatencies, dur)

					atomic.AddUint64(&totalRequests, 1)
					if err != nil {
						atomic.AddUint64(&errorRequests, 1)
					} else {
						// 200 OK and expected 401 (for auth gates) are counted as successful protocol responses
						if resp.StatusCode == 200 || resp.StatusCode == 401 {
							atomic.AddUint64(&successRequests, 1)
						} else {
							atomic.AddUint64(&errorRequests, 1)
						}
						_, _ = io.Copy(io.Discard, resp.Body)
						resp.Body.Close()
					}
				}
			}
		}(i)
	}

	// Run for configured duration
	time.Sleep(*duration)
	close(stopChan)
	wg.Wait()

	totalTime := time.Since(startTime)
	totalReqs := atomic.LoadUint64(&totalRequests)
	succReqs := atomic.LoadUint64(&successRequests)
	errReqs := atomic.LoadUint64(&errorRequests)

	rps := float64(totalReqs) / totalTime.Seconds()

	sort.Slice(allLatencies, func(i, j int) bool {
		return allLatencies[i] < allLatencies[j]
	})

	fmt.Println("\n---------------------- RESULTS SUMMARY -------------------------")
	fmt.Printf("Total Elapsed Time:    %.2fs\n", totalTime.Seconds())
	fmt.Printf("Total Requests Sent:   %d\n", totalReqs)
	fmt.Printf("Throughput:            %.2f req/sec\n", rps)
	fmt.Printf("Successful (200/401):  %d (%.2f%%)\n", succReqs, float64(succReqs)/float64(totalReqs)*100.0)
	fmt.Printf("Failed / Errored:      %d (%.2f%%)\n", errReqs, float64(errReqs)/float64(totalReqs)*100.0)

	if len(allLatencies) > 0 {
		min := allLatencies[0]
		p50 := allLatencies[len(allLatencies)*50/100]
		p90 := allLatencies[len(allLatencies)*90/100]
		p95 := allLatencies[len(allLatencies)*95/100]
		p99 := allLatencies[len(allLatencies)*99/100]
		max := allLatencies[len(allLatencies)-1]

		fmt.Println("\n---------------------- LATENCY DISTRIBUTION ---------------------")
		fmt.Printf("Min Latency:           %v\n", min)
		fmt.Printf("p50 (Median):          %v\n", p50)
		fmt.Printf("p90:                   %v\n", p90)
		fmt.Printf("p95:                   %v\n", p95)
		fmt.Printf("p99:                   %v\n", p99)
		fmt.Printf("Max Latency:           %v\n", max)
	}
	fmt.Println("================================================================")
}
