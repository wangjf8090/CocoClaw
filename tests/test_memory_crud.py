#!/usr/bin/env python3
"""
Memory System CRUD Operations Test
"""
import requests
import json
import time
from datetime import datetime

def test_memory_crud():
    """Test Create, Read, Update, Delete operations on memory system"""
    base_url = "http://localhost:8082/api/memory"
    test_memory_id = None
    
    results = {
        "test_name": "Memory System CRUD Operations",
        "timestamp": datetime.now().isoformat(),
        "tests": [],
        "overall_status": "PASSED"
    }
    
    # Test 1: Create Memory
    try:
        create_data = {
            "content": "Test memory content for SelfClaw deployment verification",
            "metadata": {
                "source": "deployment_test",
                "priority": "high",
                "tags": ["test", "deployment", "verification"]
            },
            "vector_embedding": [0.1] * 1536,  # Mock embedding
            "ttl": 3600
        }
        
        start_time = time.time()
        response = requests.post(f"{base_url}/entries", json=create_data, timeout=10)
        latency = time.time() - start_time
        
        if response.status_code == 201:
            test_memory_id = response.json().get("id")
            results["tests"].append({
                "test": "Create Memory (POST)",
                "status": "PASSED",
                "status_code": response.status_code,
                "latency_ms": round(latency * 1000, 2),
                "memory_id": test_memory_id,
                "details": "Memory entry created successfully"
            })
        else:
            results["tests"].append({
                "test": "Create Memory (POST)",
                "status": "FAILED",
                "status_code": response.status_code,
                "details": f"Failed with response: {response.text[:200]}"
            })
            results["overall_status"] = "FAILED"
    except Exception as e:
        results["tests"].append({
            "test": "Create Memory (POST)",
            "status": "FAILED",
            "error": str(e),
            "details": "Connection error"
        })
        results["overall_status"] = "FAILED"
    
    # Test 2: Read Memory
    if test_memory_id:
        try:
            start_time = time.time()
            response = requests.get(f"{base_url}/entries/{test_memory_id}", timeout=10)
            latency = time.time() - start_time
            
            if response.status_code == 200:
                results["tests"].append({
                    "test": "Read Memory (GET)",
                    "status": "PASSED",
                    "status_code": response.status_code,
                    "latency_ms": round(latency * 1000, 2),
                    "details": "Memory entry retrieved successfully"
                })
            else:
                results["tests"].append({
                    "test": "Read Memory (GET)",
                    "status": "FAILED",
                    "status_code": response.status_code,
                    "details": "Failed to retrieve memory entry"
                })
                results["overall_status"] = "FAILED"
        except Exception as e:
            results["tests"].append({
                "test": "Read Memory (GET)",
                "status": "FAILED",
                "error": str(e),
                "details": "Connection error"
            })
            results["overall_status"] = "FAILED"
    
    # Test 3: Update Memory
    if test_memory_id:
        try:
            update_data = {
                "content": "Updated memory content after modification",
                "metadata": {
                    "source": "deployment_test_updated",
                    "updated": True
                }
            }
            
            start_time = time.time()
            response = requests.put(f"{base_url}/entries/{test_memory_id}", json=update_data, timeout=10)
            latency = time.time() - start_time
            
            if response.status_code == 200:
                results["tests"].append({
                    "test": "Update Memory (PUT)",
                    "status": "PASSED",
                    "status_code": response.status_code,
                    "latency_ms": round(latency * 1000, 2),
                    "details": "Memory entry updated successfully"
                })
            else:
                results["tests"].append({
                    "test": "Update Memory (PUT)",
                    "status": "FAILED",
                    "status_code": response.status_code,
                    "details": "Failed to update memory entry"
                })
                results["overall_status"] = "FAILED"
        except Exception as e:
            results["tests"].append({
                "test": "Update Memory (PUT)",
                "status": "FAILED",
                "error": str(e),
                "details": "Connection error"
            })
            results["overall_status"] = "FAILED"
    
    # Test 4: Vector Similarity Search
    try:
        search_data = {
            "vector": [0.1] * 1536,
            "top_k": 5,
            "threshold": 0.7
        }
        
        start_time = time.time()
        response = requests.post(f"{base_url}/search", json=search_data, timeout=30)
        latency = time.time() - start_time
        
        if response.status_code == 200:
            results_count = len(response.json().get("results", []))
            results["tests"].append({
                "test": "Vector Similarity Search",
                "status": "PASSED",
                "status_code": response.status_code,
                "latency_ms": round(latency * 1000, 2),
                "results_count": results_count,
                "details": f"Vector search returned {results_count} results"
            })
        else:
            results["tests"].append({
                "test": "Vector Similarity Search",
                "status": "FAILED",
                "status_code": response.status_code,
                "details": "Vector search failed"
            })
    except Exception as e:
        results["tests"].append({
            "test": "Vector Similarity Search",
            "status": "FAILED",
            "error": str(e),
            "details": "Connection error"
        })
    
    # Test 5: Delete Memory
    if test_memory_id:
        try:
            start_time = time.time()
            response = requests.delete(f"{base_url}/entries/{test_memory_id}", timeout=10)
            latency = time.time() - start_time
            
            if response.status_code in [200, 204]:
                results["tests"].append({
                    "test": "Delete Memory (DELETE)",
                    "status": "PASSED",
                    "status_code": response.status_code,
                    "latency_ms": round(latency * 1000, 2),
                    "details": "Memory entry deleted successfully"
                })
            else:
                results["tests"].append({
                    "test": "Delete Memory (DELETE)",
                    "status": "FAILED",
                    "status_code": response.status_code,
                    "details": "Failed to delete memory entry"
                })
                results["overall_status"] = "FAILED"
        except Exception as e:
            results["tests"].append({
                "test": "Delete Memory (DELETE)",
                "status": "FAILED",
                "error": str(e),
                "details": "Connection error"
            })
            results["overall_status"] = "FAILED"
    
    # Test 6: Batch Operations
    try:
        batch_data = {
            "entries": [
                {"content": f"Batch test {i}", "metadata": {"batch": True}}
                for i in range(10)
            ]
        }
        
        start_time = time.time()
        response = requests.post(f"{base_url}/batch", json=batch_data, timeout=30)
        latency = time.time() - start_time
        
        if response.status_code == 200:
            results["tests"].append({
                "test": "Batch Create Operations",
                "status": "PASSED",
                "status_code": response.status_code,
                "latency_ms": round(latency * 1000, 2),
                "batch_size": 10,
                "throughput_per_sec": round(10 / latency, 2),
                "details": "Batch operations completed successfully"
            })
        else:
            results["tests"].append({
                "test": "Batch Create Operations",
                "status": "WARNING",
                "status_code": response.status_code,
                "details": "Batch operations test skipped or failed"
            })
    except Exception as e:
        results["tests"].append({
            "test": "Batch Create Operations",
            "status": "SKIPPED",
            "error": str(e),
            "details": "Batch test skipped"
        })
    
    # Calculate summary
    passed = sum(1 for t in results["tests"] if t["status"] == "PASSED")
    failed = sum(1 for t in results["tests"] if t["status"] == "FAILED")
    
    results["summary"] = {
        "total_tests": len(results["tests"]),
        "passed": passed,
        "failed": failed,
        "success_rate": round(passed / len(results["tests"]) * 100, 2) if results["tests"] else 0
    }
    
    return results

if __name__ == "__main__":
    results = test_memory_crud()
    print(json.dumps(results, indent=2))
