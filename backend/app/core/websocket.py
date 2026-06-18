"""
WebSocket connection manager for real-time GPS streaming.
"""

import json
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    """Manages WebSocket connections for real-time data streaming."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.connection_metadata: dict[WebSocket, dict] = {}

    async def connect(
        self, websocket: WebSocket, metadata: dict | None = None
    ) -> None:
        """Accept a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        if metadata:
            self.connection_metadata[websocket] = metadata

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket connection."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        self.connection_metadata.pop(websocket, None)

    async def send_personal_message(
        self, message: dict[str, Any], websocket: WebSocket
    ) -> None:
        """Send a message to a specific client."""
        try:
            await websocket.send_json(message)
        except Exception:
            self.disconnect(websocket)

    async def broadcast(self, message: dict[str, Any]) -> None:
        """Broadcast a message to all connected clients."""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)

    async def broadcast_to_group(
        self, message: dict[str, Any], group_key: str, group_value: str
    ) -> None:
        """Broadcast a message to a group of connections based on metadata."""
        disconnected = []
        for connection in self.active_connections:
            metadata = self.connection_metadata.get(connection, {})
            if metadata.get(group_key) == group_value:
                try:
                    await connection.send_json(message)
                except Exception:
                    disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)

    @property
    def connection_count(self) -> int:
        """Get the number of active connections."""
        return len(self.active_connections)


# Global connection manager instance
gps_manager = ConnectionManager()
notification_manager = ConnectionManager()
