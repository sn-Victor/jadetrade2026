"""
Load Testing for JadeTrade Bot Engine

Run with: locust -f tests/load_test.py --host=http://localhost:8000

Or headless: locust -f tests/load_test.py --host=http://localhost:8000 --headless -u 100 -r 10 -t 60s
  -u: Number of users
  -r: Spawn rate (users per second)
  -t: Test duration
"""
import random
import uuid
from locust import HttpUser, task, between


class WebhookUser(HttpUser):
    """Simulates TradingView webhook traffic"""
    wait_time = between(0.1, 0.5)  # Fast webhook bursts
    weight = 3  # Higher weight = more of these users

    @task(10)
    def send_webhook(self):
        """Send TradingView webhook signal"""
        payload = {
            "strategy_id": f"strategy-{random.randint(1, 100)}",
            "secret": "load-test-secret-key-12345",
            "symbol": random.choice(["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"]),
            "action": random.choice(["long_entry", "long_exit", "short_entry", "short_exit"]),
            "price": str(random.uniform(1000, 100000)),
            "stop_loss": str(random.uniform(900, 99000)),
            "take_profit": str(random.uniform(1100, 110000)),
        }
        self.client.post("/webhooks/tradingview", json=payload)

    @task(2)
    def check_queue_stats(self):
        """Check queue statistics"""
        self.client.get("/webhooks/queue/stats")


class ChatUser(HttpUser):
    """Simulates AI chat traffic"""
    wait_time = between(1, 3)  # Users think between messages
    weight = 2

    @task(5)
    def send_chat_demo(self):
        """Send demo chat message"""
        messages = [
            "What is Bitcoin?",
            "How do I set a stop loss?",
            "Explain leverage trading",
            "What's the best strategy for beginners?",
            "How do I read candlestick charts?",
            "What is RSI indicator?",
            "Explain dollar cost averaging",
            "What are trading fees?",
        ]
        self.client.post("/chat/demo", json={"message": random.choice(messages)})

    @task(1)
    def check_chat_health(self):
        """Check chat health"""
        self.client.get("/chat/health")


class HealthCheckUser(HttpUser):
    """Simulates monitoring/health check traffic"""
    wait_time = between(5, 10)  # Less frequent
    weight = 1

    @task
    def health_check(self):
        """Basic health check"""
        self.client.get("/health")

    @task
    def root_check(self):
        """Root endpoint"""
        self.client.get("/")

    @task
    def ws_stats(self):
        """WebSocket stats"""
        self.client.get("/ws/stats")


class MixedUser(HttpUser):
    """Simulates typical user behavior - mix of operations"""
    wait_time = between(1, 5)
    weight = 2

    def on_start(self):
        """Login when user starts"""
        # Get demo credentials
        response = self.client.get("/auth/demo-credentials")
        if response.status_code == 200:
            creds = response.json()
            # Login
            self.client.post("/auth/login", json={
                "username": creds.get("username", "demo"),
                "password": creds.get("password", "demo123"),
            })

    @task(3)
    def browse_and_chat(self):
        """Typical user flow: check health, send chat"""
        self.client.get("/health")
        self.client.post("/chat/demo", json={"message": "Hello, how can you help me?"})

    @task(2)
    def check_endpoints(self):
        """Check various endpoints"""
        self.client.get("/")
        self.client.get("/ws/stats")
        self.client.get("/webhooks/queue/stats")

    @task(1)
    def webhook_burst(self):
        """Occasional webhook (as if strategy triggered)"""
        payload = {
            "strategy_id": str(uuid.uuid4()),
            "secret": "user-webhook-secret-123",
            "symbol": "BTCUSDT",
            "action": "long_entry",
            "price": "50000.00",
        }
        self.client.post("/webhooks/tradingview", json=payload)


# Performance targets:
# - Health check: < 50ms p95
# - Webhook: < 100ms p95
# - Chat demo: < 500ms p95
# - Target: 500+ RPS on webhook endpoint
