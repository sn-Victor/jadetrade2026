"""
Security Audit for JadeTrade Bot Engine

Run with: python tests/security_audit.py

Checks for common security vulnerabilities and misconfigurations.
"""
import requests
import json
import sys
from typing import Tuple

BASE_URL = "http://localhost:8000"

class SecurityAudit:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.results = []

    def log(self, check: str, passed: bool, details: str = ""):
        status = "PASS" if passed else "FAIL"
        self.results.append({"check": check, "passed": passed, "details": details})
        print(f"[{status}] {check}")
        if details:
            print(f"       {details}")

    def check_cors_headers(self) -> bool:
        """Check CORS configuration"""
        try:
            response = requests.options(
                f"{self.base_url}/health",
                headers={"Origin": "http://evil.com", "Access-Control-Request-Method": "GET"}
            )
            allow_origin = response.headers.get("Access-Control-Allow-Origin", "")

            # In production, should NOT be "*" but specific domains
            if allow_origin == "*":
                self.log("CORS Configuration", False,
                        "Allow-Origin is '*' - should restrict to specific domains in production")
                return False
            else:
                self.log("CORS Configuration", True, f"Allow-Origin: {allow_origin}")
                return True
        except Exception as e:
            self.log("CORS Configuration", False, f"Error: {e}")
            return False

    def check_security_headers(self) -> bool:
        """Check security headers"""
        try:
            response = requests.get(f"{self.base_url}/health")
            headers = response.headers

            checks = {
                "X-Content-Type-Options": "nosniff",
                "X-Frame-Options": ["DENY", "SAMEORIGIN"],
                "X-XSS-Protection": "1; mode=block",
            }

            missing = []
            for header, expected in checks.items():
                value = headers.get(header)
                if not value:
                    missing.append(header)
                elif isinstance(expected, list) and value not in expected:
                    missing.append(f"{header} (got: {value})")
                elif isinstance(expected, str) and value != expected:
                    missing.append(f"{header} (got: {value})")

            if missing:
                self.log("Security Headers", False, f"Missing/incorrect: {', '.join(missing)}")
                return False
            else:
                self.log("Security Headers", True)
                return True
        except Exception as e:
            self.log("Security Headers", False, f"Error: {e}")
            return False

    def check_webhook_auth(self) -> bool:
        """Check webhook requires authentication"""
        try:
            # Try without secret
            response = requests.post(
                f"{self.base_url}/webhooks/tradingview",
                json={
                    "strategy_id": "test",
                    "symbol": "BTCUSDT",
                    "action": "long_entry",
                }
            )

            if response.status_code == 422:  # Missing required field
                self.log("Webhook Auth - Missing Secret", True, "Rejected request without secret")

            # Try with short secret
            response = requests.post(
                f"{self.base_url}/webhooks/tradingview",
                json={
                    "strategy_id": "test",
                    "secret": "short",
                    "symbol": "BTCUSDT",
                    "action": "long_entry",
                }
            )

            if response.status_code == 401:
                self.log("Webhook Auth - Short Secret", True, "Rejected short secret")
                return True
            else:
                self.log("Webhook Auth - Short Secret", False,
                        f"Accepted short secret (status: {response.status_code})")
                return False
        except Exception as e:
            self.log("Webhook Auth", False, f"Error: {e}")
            return False

    def check_sql_injection(self) -> bool:
        """Basic SQL injection check"""
        try:
            payloads = [
                "'; DROP TABLE users; --",
                "1 OR 1=1",
                "admin'--",
            ]

            all_passed = True
            for payload in payloads:
                response = requests.post(
                    f"{self.base_url}/webhooks/tradingview",
                    json={
                        "strategy_id": payload,
                        "secret": "valid-secret-key-123",
                        "symbol": "BTCUSDT",
                        "action": "long_entry",
                    }
                )
                # Should handle gracefully (not crash)
                if response.status_code >= 500:
                    self.log("SQL Injection Protection", False, f"Server error with payload: {payload}")
                    all_passed = False
                    break

            if all_passed:
                self.log("SQL Injection Protection", True, "Handled malicious payloads gracefully")
            return all_passed
        except Exception as e:
            self.log("SQL Injection Protection", False, f"Error: {e}")
            return False

    def check_rate_limiting(self) -> bool:
        """Check if rate limiting is in place"""
        try:
            # Send burst of requests
            responses = []
            for _ in range(50):
                response = requests.get(f"{self.base_url}/health")
                responses.append(response.status_code)

            # Check if any were rate limited (429)
            rate_limited = 429 in responses

            if rate_limited:
                self.log("Rate Limiting", True, "Rate limiting detected")
            else:
                self.log("Rate Limiting", False,
                        "No rate limiting detected - consider adding for production")
            return rate_limited
        except Exception as e:
            self.log("Rate Limiting", False, f"Error: {e}")
            return False

    def check_sensitive_data_exposure(self) -> bool:
        """Check for sensitive data in responses"""
        try:
            response = requests.get(f"{self.base_url}/")

            sensitive_patterns = ["password", "secret", "api_key", "token", "credential"]
            body = response.text.lower()

            exposed = [p for p in sensitive_patterns if p in body]

            if exposed:
                self.log("Sensitive Data Exposure", False, f"Found: {', '.join(exposed)}")
                return False
            else:
                self.log("Sensitive Data Exposure", True)
                return True
        except Exception as e:
            self.log("Sensitive Data Exposure", False, f"Error: {e}")
            return False

    def check_error_handling(self) -> bool:
        """Check error responses don't leak internal details"""
        try:
            # Try invalid endpoint
            response = requests.get(f"{self.base_url}/nonexistent")

            if response.status_code == 404:
                body = response.text.lower()
                leaky_patterns = ["traceback", "stack trace", "file \"", "line "]
                leaks = [p for p in leaky_patterns if p in body]

                if leaks:
                    self.log("Error Handling", False, f"Stack trace exposed: {leaks}")
                    return False
                else:
                    self.log("Error Handling", True, "404 response is clean")
                    return True
            else:
                self.log("Error Handling", True, f"Status: {response.status_code}")
                return True
        except Exception as e:
            self.log("Error Handling", False, f"Error: {e}")
            return False

    def check_input_validation(self) -> bool:
        """Check input validation"""
        try:
            # Test with invalid action
            response = requests.post(
                f"{self.base_url}/webhooks/tradingview",
                json={
                    "strategy_id": "test",
                    "secret": "valid-secret-key-123",
                    "symbol": "BTCUSDT",
                    "action": "invalid_action",
                }
            )

            if response.status_code == 422:
                self.log("Input Validation", True, "Invalid action rejected")
                return True
            else:
                self.log("Input Validation", False,
                        f"Invalid action accepted (status: {response.status_code})")
                return False
        except Exception as e:
            self.log("Input Validation", False, f"Error: {e}")
            return False

    def run_all(self):
        """Run all security checks"""
        print("\n" + "="*60)
        print("JadeTrade Bot Engine - Security Audit")
        print("="*60 + "\n")

        checks = [
            self.check_cors_headers,
            self.check_security_headers,
            self.check_webhook_auth,
            self.check_sql_injection,
            self.check_rate_limiting,
            self.check_sensitive_data_exposure,
            self.check_error_handling,
            self.check_input_validation,
        ]

        for check in checks:
            try:
                check()
            except Exception as e:
                print(f"[ERROR] {check.__name__}: {e}")
            print()

        # Summary
        passed = sum(1 for r in self.results if r["passed"])
        total = len(self.results)

        print("="*60)
        print(f"SUMMARY: {passed}/{total} checks passed")
        print("="*60)

        # Known issues for production
        print("\nProduction recommendations:")
        print("1. Configure CORS to allow only specific origins")
        print("2. Add security headers middleware")
        print("3. Implement rate limiting (nginx or app-level)")
        print("4. Enable HTTPS only")
        print("5. Use environment-specific secrets")

        return passed == total


if __name__ == "__main__":
    audit = SecurityAudit(BASE_URL)
    success = audit.run_all()
    sys.exit(0 if success else 1)
