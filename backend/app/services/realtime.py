from __future__ import annotations

import json
from collections import defaultdict

from fastapi import WebSocket


class RealtimeManager:
    def __init__(self) -> None:
        self.connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, conversation_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections[conversation_id].append(websocket)

    def disconnect(self, conversation_id: str, websocket: WebSocket) -> None:
        clients = self.connections.get(conversation_id, [])
        if websocket in clients:
            clients.remove(websocket)
        if not clients and conversation_id in self.connections:
            del self.connections[conversation_id]

    async def broadcast(self, conversation_id: str, payload: dict) -> None:
        clients = list(self.connections.get(conversation_id, []))
        dead_clients: list[WebSocket] = []
        for websocket in clients:
            try:
                await websocket.send_text(json.dumps(payload, default=str))
            except Exception:
                dead_clients.append(websocket)

        for websocket in dead_clients:
            self.disconnect(conversation_id, websocket)


realtime_manager = RealtimeManager()
