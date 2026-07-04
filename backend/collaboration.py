import random
import string
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List, Any

router = APIRouter(prefix="/api/collaboration", tags=["collaboration"])

# In-memory store for active rooms
# room_code -> list of dicts containing user info and websocket
# { "room_code": [ {"username": str, "websocket": WebSocket, "color": str} ] }
active_rooms: Dict[str, List[Dict[str, Any]]] = {}

def generate_room_code() -> str:
    """Generate a unique 6-digit room code in the format AER-XXX (where X is a digit)."""
    while True:
        digits = "".join(random.choices(string.digits, k=3))
        code = f"AER-{digits}"
        if code not in active_rooms:
            return code

@router.post("/create")
async def create_room():
    """Create a new collaboration room and return the code."""
    code = generate_room_code()
    active_rooms[code] = []
    return {"room_code": code}

@router.get("/check/{room_code}")
async def check_room(room_code: str):
    """Check if a room exists and is active."""
    exists = room_code in active_rooms
    return {"exists": exists, "participants_count": len(active_rooms[room_code]) if exists else 0}

class ConnectionManager:
    async def connect(self, websocket: WebSocket, room_code: str, username: str, user_color: str):
        await websocket.accept()
        if room_code not in active_rooms:
            active_rooms[room_code] = []
        
        # Add connection to room
        active_rooms[room_code].append({
            "username": username,
            "websocket": websocket,
            "color": user_color
        })
        
        # Notify all participants in the room about the new participant
        await self.broadcast(room_code, {
            "type": "user-joined",
            "username": username,
            "color": user_color,
            "participants": self.get_participants(room_code)
        })

    async def disconnect(self, room_code: str, websocket: WebSocket, username: str):
        if room_code in active_rooms:
            # Remove connection
            active_rooms[room_code] = [
                conn for conn in active_rooms[room_code] 
                if conn["websocket"] != websocket
            ]
            
            # Clean up empty rooms
            if not active_rooms[room_code]:
                del active_rooms[room_code]
            else:
                # Notify remaining participants
                await self.broadcast(room_code, {
                    "type": "user-left",
                    "username": username,
                    "participants": self.get_participants(room_code)
                })

    def get_participants(self, room_code: str) -> List[Dict[str, str]]:
        if room_code in active_rooms:
            return [
                {"username": conn["username"], "color": conn["color"]}
                for conn in active_rooms[room_code]
            ]
        return []

    async def broadcast(self, room_code: str, message: dict, exclude_websocket: WebSocket = None):
        if room_code in active_rooms:
            for conn in active_rooms[room_code]:
                if conn["websocket"] != exclude_websocket:
                    try:
                        await conn["websocket"].send_json(message)
                    except Exception:
                        # Clean up stale connections if send fails
                        pass

manager = ConnectionManager()

@router.websocket("/ws/{room_code}/{username}/{user_color}")
async def websocket_endpoint(
    websocket: WebSocket, 
    room_code: str, 
    username: str, 
    user_color: str
):
    # Decode color hex value since URL paths can't contain '#' directly
    # e.g., ff00ff instead of #ff00ff
    color = f"#{user_color}" if not user_color.startswith("#") else user_color
    
    await manager.connect(websocket, room_code, username, color)
    try:
        while True:
            # Receive drawing/cursor messages from client
            data = await websocket.receive_json()
            
            # Attach sender's username to the message for identification
            data["sender"] = username
            
            # Broadcast the message to all other participants in the room
            await manager.broadcast(room_code, data, exclude_websocket=websocket)
            
    except WebSocketDisconnect:
        await manager.disconnect(room_code, websocket, username)
    except Exception as e:
        print(f"WebSocket error: {e}", flush=True)
        await manager.disconnect(room_code, websocket, username)
