"""
Test script for bot engine endpoints.
Run in a separate terminal: python run_server.py
Then run this: python test_server.py
"""
import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def test_endpoints():
    print("Testing Bot Engine Webhooks...")
    print("=" * 50)

    # Test 1: Health check
    print("\n1. Health Check:")
    try:
        r = requests.get(f"{BASE_URL}/health", timeout=5)
        print(f"   Status: {r.status_code}")
        print(f"   Response: {r.json()}")
    except requests.exceptions.ConnectionError:
        print("   ERROR: Server not running!")
        print("   Start the server first: python run_server.py")
        return False
    except Exception as e:
        print(f"   Error: {e}")
        return False

    # Test 2: Webhook health
    print("\n2. Webhook Health:")
    try:
        r = requests.get(f"{BASE_URL}/webhooks/health", timeout=5)
        print(f"   Status: {r.status_code}")
        print(f"   Response: {r.json()}")
    except Exception as e:
        print(f"   Error: {e}")

    # Test 3: Test webhook endpoint
    print("\n3. Test Webhook:")
    try:
        r = requests.post(f"{BASE_URL}/webhooks/test", json={"test": "data"}, timeout=5)
        print(f"   Status: {r.status_code}")
        print(f"   Response: {r.json()}")
    except Exception as e:
        print(f"   Error: {e}")

    # Test 4: TradingView webhook (simulated signal)
    print("\n4. TradingView Webhook (Long Entry Signal):")
    signal = {
        "strategy_id": "550e8400-e29b-41d4-a716-446655440000",
        "secret": "supersecretkey12345678",
        "symbol": "BTCUSDT",
        "action": "long_entry",
        "price": "97500.00",
        "stop_loss": "95000.00",
        "take_profit": "105000.00",
        "leverage": 5
    }
    try:
        r = requests.post(f"{BASE_URL}/webhooks/tradingview", json=signal, timeout=5)
        print(f"   Status: {r.status_code}")
        print(f"   Response: {json.dumps(r.json(), indent=6)}")
    except Exception as e:
        print(f"   Error: {e}")

    # Test 5: Invalid signal (should fail - short secret)
    print("\n5. Invalid Signal (short secret - should return 401):")
    bad_signal = {
        "strategy_id": "test",
        "secret": "short",
        "symbol": "BTCUSDT",
        "action": "long_entry",
    }
    try:
        r = requests.post(f"{BASE_URL}/webhooks/tradingview", json=bad_signal, timeout=5)
        print(f"   Status: {r.status_code}")
        print(f"   Response: {r.json()}")
    except Exception as e:
        print(f"   Error: {e}")

    print("\n" + "=" * 50)
    print("Tests complete!")
    return True


if __name__ == "__main__":
    test_endpoints()
