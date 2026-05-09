#!/usr/bin/env python3
"""
WebSocket Connection Test for SelfClaw Gateway
"""
import asyncio
import websockets
import json
import time
from datetime import datetime

async def test_websocket_connection():
    """Test WebSocket connection and message handling"""
    results = {
        "test_name": "Gateway WebSocket Connection Test",
        "timestamp": datetime.now().isoformat(),
        "tests": [],
        "overall_status": "PASSED"
    }
    
    ws_url = "ws://localhost:9000/ws"
    
    try:
        # Test 1: Connection establishment
        start_time = time.time()
        async with websockets.connect(ws_url, ping_timeout=30) as websocket:
            connect_time = time.time() - start_time
            
            results["tests"].append({
                "test": "Connection Establishment",
                "status": "PASSED",
                "latency_ms": round(connect_time * 1000, 2),
                "details": f"Connected to {ws_url}"
            })
            
            # Test 2: Message round-trip
            test_message = json.dumps({
                "type": "ping",
                "timestamp": datetime.now().isoformat(),
                "data": "WebSocket test message"
            })
            
            start_time = time.time()
            await websocket.send(test_message)
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            rtt = time.time() - start_time
            
            results["tests"].append({
                "test": "Message Round-Trip",
                "status": "PASSED",
                "rtt_ms": round(rtt * 1000, 2),
                "details": "Message sent and received successfully"
            })
            
            # Test 3: Concurrent connections
            concurrent_results = await test_concurrent_connections(10, ws_url)
            results["tests"].append(concurrent_results)
            
            # Test 4: Streaming response test
            stream_results = await test_streaming(websocket)
            results["tests"].append(stream_results)
            
            # Test 5: Disconnect handling
            await websocket.close()
            results["tests"].append({
                "test": "Clean Disconnection",
                "status": "PASSED",
                "details": "WebSocket connection closed gracefully"
            })
            
    except Exception as e:
        results["tests"].append({
            "test": "WebSocket Connection",
            "status": "FAILED",
            "error": str(e),
            "details": "Connection failed"
        })
        results["overall_status"] = "FAILED"
    
    # Calculate summary
    passed = sum(1 for t in results["tests"] if t["status"] == "PASSED")
    failed = len(results["tests"]) - passed
    
    results["summary"] = {
        "total_tests": len(results["tests"]),
        "passed": passed,
        "failed": failed,
        "success_rate": round(passed / len(results["tests"]) * 100, 2)
    }
    
    return results

async def test_concurrent_connections(count, ws_url):
    """Test concurrent WebSocket connections"""
    async def single_connection(conn_id):
        try:
            start = time.time()
            async with websockets.connect(ws_url) as ws:
                await ws.send(json.dumps({"type": "ping", "id": conn_id}))
                await asyncio.wait_for(ws.recv(), timeout=5)
                return time.time() - start
        except:
            return None
    
    start_time = time.time()
    tasks = [single_connection(i) for i in range(count)]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    total_time = time.time() - start_time
    
    successful = sum(1 for r in results if r is not None and not isinstance(r, Exception))
    
    return {
        "test": "Concurrent Connections",
        "status": "PASSED" if successful >= count * 0.9 else "WARNING",
        "concurrent_count": count,
        "successful": successful,
        "total_time_s": round(total_time, 2),
        "details": f"{successful}/{count} concurrent connections succeeded"
    }

async def test_streaming(websocket):
    """Test streaming response capability"""
    stream_request = json.dumps({
        "type": "stream_test",
        "chunk_count": 10,
        "delay_ms": 50
    })
    
    chunks_received = 0
    start_time = time.time()
    
    try:
        await websocket.send(stream_request)
        while chunks_received < 10:
            chunk = await asyncio.wait_for(websocket.recv(), timeout=2.0)
            chunks_received += 1
        
        stream_time = time.time() - start_time
        
        return {
            "test": "Streaming Response",
            "status": "PASSED",
            "chunks_received": chunks_received,
            "stream_time_s": round(stream_time, 2),
            "throughput_chunks_per_sec": round(chunks_received / stream_time, 2),
            "details": "All streaming chunks received successfully"
        }
    except Exception as e:
        return {
            "test": "Streaming Response",
            "status": "FAILED",
            "error": str(e),
            "chunks_received": chunks_received,
            "details": "Streaming test failed"
        }

if __name__ == "__main__":
    results = asyncio.run(test_websocket_connection())
    print(json.dumps(results, indent=2))
