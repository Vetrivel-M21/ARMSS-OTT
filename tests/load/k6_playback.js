import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 Load Test for ARMSS-OTT Playback & Playlist Endpoints
// Usage: k6 run tests/load/k6_playback.js

export const options = {
  stages: [
    { duration: '5s', target: 20 },  // Ramp-up to 20 virtual users
    { duration: '15s', target: 50 }, // Sustained load at 50 VUs
    { duration: '5s', target: 0 },   // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<400'], // 95% of requests under 200ms
    http_req_failed: ['rate<0.01'],                 // Error rate < 1%
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:8081';
const VIDEO_ID = __ENV.VIDEO_ID || 'crownless';

export default function () {
  // 1. Test unauthenticated request correctly returns 401
  const unauthResp = http.get(`${BASE_URL}/api/videos/${VIDEO_ID}/playback`);
  check(unauthResp, {
    'unauth returns 401': (r) => r.status === 401,
  });

  // 2. Test public health endpoint
  const healthResp = http.get(`${BASE_URL}/api/health`);
  check(healthResp, {
    'health returns 200': (r) => r.status === 200,
  });

  // 3. Test metrics endpoint
  const metricsResp = http.get(`${BASE_URL}/api/metrics`);
  check(metricsResp, {
    'metrics returns 200': (r) => r.status === 200,
  });

  // 4. Test master playlist token verification (invalid token returns 401)
  const masterNoToken = http.get(`${BASE_URL}/api/videos/${VIDEO_ID}/master.m3u8`);
  check(masterNoToken, {
    'master without token returns 401': (r) => r.status === 401,
  });

  sleep(0.5);
}
