"""
WebSocket Real-Time Features

Provides WebSocket connections for real-time updates:
- Trade notifications
- Position updates
- Signal received alerts
- Price broadcasts
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Dict, Set, Optional
import json
import asyncio

from app.logging.logger import get_logger

router = APIRouter(prefix="/ws", tags=["websocket"])
logger = get_logger("websocket")


class ConnectionManager:
    """
    Manage WebSocket connections.

    Features:
    - Per-user connection tracking
    - Topic-based subscriptions
    - Broadcast capabilities
    - Automatic cleanup on disconnect
    """

    def __init__(self):
        # user_id -> set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # All connections for broadcasts
        self.all_connections: Set[WebSocket] = set()
        # Subscription topics per connection
        self.subscriptions: Dict[WebSocket, Set[str]] = {}
        # Reverse mapping: websocket -> user_id
        self.connection_users: Dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        """Accept and register a new connection"""
        await websocket.accept()

        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()

        self.active_connections[user_id].add(websocket)
        self.all_connections.add(websocket)
        self.subscriptions[websocket] = set()
        self.connection_users[websocket] = user_id

        logger.info(
            "WebSocket connected",
            extra_data={
                "user_id": user_id,
                "total_connections": len(self.all_connections),
            }
        )

    def disconnect(self, websocket: WebSocket, user_id: Optional[str] = None):
        """Remove a connection"""
        # Get user_id from reverse mapping if not provided
        if user_id is None:
            user_id = self.connection_users.get(websocket)

        if user_id and user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

        self.all_connections.discard(websocket)
        self.subscriptions.pop(websocket, None)
        self.connection_users.pop(websocket, None)

        logger.info(
            "WebSocket disconnected",
            extra_data={
                "user_id": user_id,
                "total_connections": len(self.all_connections),
            }
        )

    def subscribe(self, websocket: WebSocket, topic: str):
        """Subscribe connection to a topic"""
        if websocket in self.subscriptions:
            self.subscriptions[websocket].add(topic)
            logger.debug(f"Subscribed to topic: {topic}")

    def unsubscribe(self, websocket: WebSocket, topic: str):
        """Unsubscribe connection from a topic"""
        if websocket in self.subscriptions:
            self.subscriptions[websocket].discard(topic)
            logger.debug(f"Unsubscribed from topic: {topic}")

    def get_user_connections_count(self, user_id: str) -> int:
        """Get number of connections for a user"""
        return len(self.active_connections.get(user_id, set()))

    def is_user_connected(self, user_id: str) -> bool:
        """Check if user has any active connections"""
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0

    async def send_to_user(self, user_id: str, message: dict):
        """Send message to all connections for a user"""
        if user_id not in self.active_connections:
            return

        data = json.dumps(message)
        disconnected = set()

        for websocket in self.active_connections[user_id]:
            try:
                await websocket.send_text(data)
            except Exception as e:
                logger.warning(f"Failed to send to user {user_id}: {e}")
                disconnected.add(websocket)

        # Clean up disconnected
        for ws in disconnected:
            self.disconnect(ws, user_id)

    async def send_to_topic(self, topic: str, message: dict):
        """Send message to all connections subscribed to a topic"""
        data = json.dumps(message)
        disconnected = []

        for websocket, topics in list(self.subscriptions.items()):
            if topic in topics:
                try:
                    await websocket.send_text(data)
                except Exception as e:
                    logger.warning(f"Failed to send to topic {topic}: {e}")
                    disconnected.append(websocket)

        # Clean up disconnected
        for ws in disconnected:
            self.disconnect(ws)

    async def broadcast(self, message: dict):
        """Send message to all connections"""
        data = json.dumps(message)
        disconnected = []

        for websocket in list(self.all_connections):
            try:
                await websocket.send_text(data)
            except Exception:
                disconnected.append(websocket)

        # Clean up disconnected
        for ws in disconnected:
            self.disconnect(ws)

    def get_stats(self) -> dict:
        """Get connection statistics"""
        return {
            "total_connections": len(self.all_connections),
            "unique_users": len(self.active_connections),
            "subscriptions": {
                topic: sum(1 for topics in self.subscriptions.values() if topic in topics)
                for topic in {"prices", "positions", "trades", "signals"}
            }
        }


# Global connection manager
manager = ConnectionManager()


def get_connection_manager() -> ConnectionManager:
    """Get the global connection manager"""
    return manager


@router.websocket("/connect")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None, description="JWT access token"),
    user_id: Optional[str] = Query(None, description="User ID (for demo)"),
):
    """
    WebSocket connection endpoint.

    Connect with: ws://host/ws/connect?token=<jwt_token>
    Or for demo: ws://host/ws/connect?user_id=demo-user

    Message format (client -> server):
    {
        "type": "subscribe" | "unsubscribe" | "ping",
        "topic": "prices" | "positions" | "trades" | "signals"
    }

    Message format (server -> client):
    {
        "type": "connected" | "subscribed" | "unsubscribed" | "price_update" |
               "position_update" | "trade_executed" | "signal_received" | "ping" | "pong",
        "data": { ... }
    }
    """
    # In production, verify JWT token
    # For demo, accept user_id parameter
    if token:
        # TODO: Implement proper JWT verification
        # user = await verify_token_ws(token)
        # if not user:
        #     await websocket.close(code=4001, reason="Invalid token")
        #     return
        # actual_user_id = user.id
        actual_user_id = "authenticated-user"  # Placeholder
    elif user_id:
        actual_user_id = user_id
    else:
        actual_user_id = "anonymous"

    await manager.connect(websocket, actual_user_id)

    try:
        # Send initial connection success
        await websocket.send_json({
            "type": "connected",
            "data": {
                "user_id": actual_user_id,
                "message": "Connected to JadeTrade WebSocket"
            }
        })

        # Handle incoming messages
        while True:
            try:
                data = await asyncio.wait_for(
                    websocket.receive_json(),
                    timeout=60.0  # Ping timeout
                )

                msg_type = data.get("type")
                topic = data.get("topic")

                if msg_type == "subscribe" and topic:
                    manager.subscribe(websocket, topic)
                    await websocket.send_json({
                        "type": "subscribed",
                        "data": {"topic": topic}
                    })

                elif msg_type == "unsubscribe" and topic:
                    manager.unsubscribe(websocket, topic)
                    await websocket.send_json({
                        "type": "unsubscribed",
                        "data": {"topic": topic}
                    })

                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})

                elif msg_type == "get_stats":
                    # Admin/debug feature
                    stats = manager.get_stats()
                    await websocket.send_json({
                        "type": "stats",
                        "data": stats
                    })

            except asyncio.TimeoutError:
                # Send ping to keep connection alive
                try:
                    await websocket.send_json({"type": "ping"})
                except Exception:
                    break

    except WebSocketDisconnect:
        manager.disconnect(websocket, actual_user_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        manager.disconnect(websocket, actual_user_id)


@router.get("/stats")
async def websocket_stats():
    """Get WebSocket connection statistics"""
    return manager.get_stats()


# =============================================================================
# Helper functions for sending updates from other parts of the application
# =============================================================================

async def notify_trade_executed(user_id: str, trade_data: dict):
    """
    Notify user of trade execution.

    Called after a trade is executed by the trade executor.
    """
    await manager.send_to_user(user_id, {
        "type": "trade_executed",
        "data": trade_data,
    })


async def notify_position_update(user_id: str, position_data: dict):
    """
    Notify user of position update.

    Called when position is opened, modified, or closed.
    """
    await manager.send_to_user(user_id, {
        "type": "position_update",
        "data": position_data,
    })


async def notify_signal_received(user_id: str, signal_data: dict):
    """
    Notify user of new signal received.

    Called when a webhook signal is received for user's strategy.
    """
    await manager.send_to_user(user_id, {
        "type": "signal_received",
        "data": signal_data,
    })


async def notify_order_update(user_id: str, order_data: dict):
    """
    Notify user of order status update.

    Called when an order is placed, filled, cancelled, etc.
    """
    await manager.send_to_user(user_id, {
        "type": "order_update",
        "data": order_data,
    })


async def broadcast_price_update(prices: dict):
    """
    Broadcast price updates to all subscribed connections.

    Called periodically or on price changes for tracked symbols.
    """
    await manager.send_to_topic("prices", {
        "type": "price_update",
        "data": prices,
    })


async def broadcast_system_message(message: str, level: str = "info"):
    """
    Broadcast system message to all connected users.

    Used for maintenance notices, system updates, etc.
    """
    await manager.broadcast({
        "type": "system_message",
        "data": {
            "message": message,
            "level": level,  # info, warning, error
        }
    })
