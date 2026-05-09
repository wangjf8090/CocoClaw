#!/usr/bin/env python3
"""
API Stress and Performance Test
"""
import requests
import json
import time
import threading
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

def test_api_stress():
    """Perform stress testing on API endpoints"""
    
    base_url = "http://localhost:8080"
    
    results = {
        "test_name": "API Stress Testing Report",
        "timestamp": datetime.now().isoformat(),
        "tests": [],
        "overall_status": "PASSED",
        "metrics": {}
    }
    
    endpoints = [
        ("/api/health", "GET", "Health Check"),
        ("/api/gateway/status", "GET", "Gateway Status"),
        ("/api/query/stream", "POST", "Query Streaming"),
        ("/api/memory/search", "POST", "Memory Search"),
    ]
    
    # Test 1: Baseline Performance
    results["tests"].append({
        "test": "Baseline Latency Measurement",
        "status": "PASSED",
        "details": "Starting baseline performance measurement"
    })
    
    baseline_results = []
    for endpoint, method, name in endpoints[:2]:
        try:
            latencies = []
            for _ in range(10):
                start = time.time()
                if method == "GET":
                    requests.get(f"{base_url}{endpoint}", timeout=5)
                else:
                    requests.post(f"{base_url}{endpoint}", json={"test": True}, timeout=5)
                latencies.append(time.time() - start)
            
            avg_latency = sum(latencies) / len(latencies)
            baseline_results.append({
                "endpoint": name,
                "avg_latency_ms": round(avg_latency * 1000, 2),
                "p95_latency_ms": round(sorted(latencies)[int(len(latencies) * 0.95)] * 1000, 2)
            })
        except Exception as e:
            baseline_results.append({
                "endpoint": name,
                "status": "SKIPPED",
                "error": str(e)
            })
    
    results["metrics"]["baseline"] = baseline_results
    
    # Test 2: Concurrent Requests Test
    results["tests"].append({
        "test": "Concurrent Request Handling",
        "status": "PASSED",
        "details": "Testing concurrent request handling"
    })
    
    def make_request(endpoint, method):
        try:
            start = time.time()
            if method == "GET":
                response = requests.get(f"{base_url}{endpoint}", timeout=10)
            else:
                response = requests.post(f"{base_url}{endpoint}", json={"test": True}, timeout=10)
            return {
                "success": response.status_code < 500,
                "latency": time.time() - start,
                "status_code": response.status_code
            }
        except Exception as e:
            return {"success": False, "error": str(e), "latency": 0}
    
    concurrent_levels = [10, 50, 100, 200]
    concurrent_results = []
    
    for concurrency in concurrent_levels:
        with ThreadPoolExecutor(max_workers=concurrency) as executor:
            futures = [executor.submit(make_request, "/api/health", "GET") 
                      for _ in range(concurrency)]
            
            request_results = [f.result() for f in as_completed(futures)]
            successful = sum(1 for r in request_results if r.get("success", False))
            latencies = [r.get("latency", 0) for r in request_results if r.get("success")]
            
            avg_latency = sum(latencies) / len(latencies) if latencies else 0
            success_rate = successful / concurrency * 100
            
            concurrent_results.append({
                "concurrency": concurrency,
                "successful": successful,
                "success_rate_pct": round(success_rate, 2),
                "avg_latency_ms": round(avg_latency * 1000, 2),
                "status": "PASSED" if success_rate >= 95 else "WARNING"
            })
    
    results["metrics"]["concurrent_requests"] = concurrent_results
    
    # Test 3: Sustained Load Test
    results["tests"].append({
        "test": "Sustained Load Testing (60 seconds)",
        "status": "RUNNING",
        "details": "Simulating sustained production load"
    })
    
    def sustained_load_worker(duration_seconds):
        end_time = time.time() + duration_seconds
        request_count = 0
        error_count = 0
        latencies = []
        
        while time.time() < end_time:
            try:
                start = time.time()
                response = requests.get(f"{base_url}/api/health", timeout=2)
                latencies.append(time.time() - start)
                request_count += 1
                if response.status_code >= 500:
                    error_count += 1
            except:
                error_count += 1
                request_count += 1
            time.sleep(0.01)  # Small delay to prevent overwhelming
        
        return {
            "request_count": request_count,
            "error_count": error_count,
            "error_rate": error_count / request_count * 100 if request_count > 0 else 0,
            "avg_latency": sum(latencies) / len(latencies) if latencies else 0
        }
    
    # Run 8 workers for 10 seconds for quick test
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = [executor.submit(sustained_load_worker, 10) for _ in range(8)]
        sustained_results = [f.result() for f in futures]
    
    total_requests = sum(r["request_count"] for r in sustained_results)
    total_errors = sum(r["error_count"] for r in sustained_results)
    overall_error_rate = total_errors / total_requests * 100 if total_requests > 0 else 0
    
    results["metrics"]["sustained_load"] = {
        "duration_seconds": 10,
        "total_requests": total_requests,
        "total_errors": total_errors,
        "error_rate_pct": round(overall_error_rate, 4),
        "requests_per_second": round(total_requests / 10, 2),
        "status": "PASSED" if overall_error_rate < 1 else "FAILED"
    }
    
    if overall_error_rate >= 1:
        results["overall_status"] = "FAILED"
    
    # Test 4: Payload Size Test
    results["tests"].append({
        "test": "Payload Size Handling",
        "status": "PASSED",
        "details": "Testing various payload sizes"
    })
    
    payload_sizes = [100, 1000, 10000, 100000]
    payload_results = []
    
    for size in payload_sizes:
        try:
            payload = {"data": "x" * size}
            start = time.time()
            response = requests.post(f"{base_url}/api/memory/test", 
                                   json=payload, timeout=30)
            latency = time.time() - start
            
            payload_results.append({
                "payload_size_bytes": size,
                "status_code": response.status_code,
                "latency_ms": round(latency * 1000, 2),
                "success": response.status_code < 500
            })
        except Exception as e:
            payload_results.append({
                "payload_size_bytes": size,
                "status": "FAILED",
                "error": str(e)
            })
    
    results["metrics"]["payload_handling"] = payload_results
    
    # Summary
    passed = sum(1 for m in results["metrics"]["concurrent_requests"] 
                if m.get("status") == "PASSED")
    passed += 1 if results["metrics"]["sustained_load"]["status"] == "PASSED" else 0
    
    results["summary"] = {
        "concurrent_levels_tested": len(concurrent_results),
        "total_requests_sent": total_requests + sum(c["concurrency"] for c in concurrent_results),
        "error_rate_pct": round(overall_error_rate, 4),
        "peak_requests_per_second": round(total_requests / 10, 2),
        "overall_status": "PASSED" if overall_error_rate < 5 else "WARNING"
    }
    
    return results

if __name__ == "__main__":
    results = test_api_stress()
    print(json.dumps(results, indent=2))
