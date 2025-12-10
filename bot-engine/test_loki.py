"""Test script for Loki logging"""
import requests
import json
import time

LOKI_URL = "http://localhost:3100"

# Push a test log
log_entry = {
    "streams": [{
        "stream": {
            "service": "bot",
            "level": "info",
            "component": "test"
        },
        "values": [[
            str(int(time.time() * 1e9)),
            json.dumps({"message": "Hello from test script!", "price": 50000.0})
        ]]
    }]
}

print("Pushing log to Loki...")
response = requests.post(f"{LOKI_URL}/loki/api/v1/push", json=log_entry, timeout=5)
print(f"Push status: {response.status_code}")

# Wait and query
time.sleep(0.5)
print("\nQuerying Loki...")
query_response = requests.get(
    f"{LOKI_URL}/loki/api/v1/query",
    params={"query": '{service="bot"}'}
)
data = query_response.json()
print(f"Query status: {data['status']}")

results = data["data"]["result"]
print(f"Found {len(results)} stream(s)")

if results:
    for stream in results:
        print(f"\nStream labels: {stream['stream']}")
        for value in stream["values"][-3:]:  # Last 3 logs
            print(f"  Log: {value[1][:100]}...")
