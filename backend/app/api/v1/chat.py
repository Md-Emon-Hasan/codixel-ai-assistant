from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.auth import get_current_agent
from app.core.config import Settings
from app.db import get_db
from app.models import Agent
from app.schemas.chat import (
    AdminAssignRequest,
    AdminReplyRequest,
    ChatRequest,
    ChatResponse,
    ConversationSummary,
    HandoffResponse,
    MessagePayload,
)
from app.services.business_hours import get_business_hours_state
from app.services.chat_service import (
    add_message,
    assign_agent,
    create_or_get_conversation,
    generate_ai_reply,
    get_conversation,
    get_messages,
    list_conversations,
    request_human_handoff,
    revert_to_ai,
    serialize_conversation,
    serialize_message,
)
from app.services.realtime import realtime_manager

logger = logging.getLogger("codixel.api")

router = APIRouter()


@router.get("/health")
def health(settings: Settings = Depends(Settings.from_env)):
    hours = get_business_hours_state(settings)
    return {"status": "ok", "version": "2.0.0", "business_hours_open": hours.is_open}


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: Request,
    body: ChatRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(Settings.from_env),
):
    conversation = create_or_get_conversation(
        db,
        body.conversation_id,
        guest_name=body.guest_name,
        guest_email=body.guest_email,
        guest_phone=body.guest_phone,
    )
    user_message = add_message(
        db, conversation, "user", body.message, sender_name=body.guest_name or "Guest"
    )

    assistant = request.app.state.assistant

    # --- Intent: user wants to talk to a human using AI detection ---
    if assistant.is_human_request(body.message) and conversation.status == "ai_active":
        conversation, system_message = request_human_handoff(db, conversation, settings)
        db.commit()
        db.refresh(conversation)
        await realtime_manager.broadcast(
            conversation.id,
            {"type": "message.created", "message": serialize_message(user_message)},
        )
        await realtime_manager.broadcast(
            conversation.id,
            {"type": "message.created", "message": serialize_message(system_message)},
        )
        await realtime_manager.broadcast(
            conversation.id,
            {"type": "conversation.updated", "conversation": serialize_conversation(conversation)},
        )
        return ChatResponse(
            answer=system_message.content,
            conversation=ConversationSummary(**serialize_conversation(conversation)),
            user_message=MessagePayload(**serialize_message(user_message)),
            message=MessagePayload(**serialize_message(system_message)),
        )

    # --- Conversation already handed off to human ---
    if conversation.status in {"waiting_for_agent", "queued_for_business_hours", "assigned_to_agent"}:
        if conversation.status == "assigned_to_agent":
            answer = "Your message has been sent to the human teammate in this chat."
        else:
            hours = get_business_hours_state(settings)
            answer = (
                "A human teammate has been notified. Please keep sharing details here."
                if hours.is_open
                else f"Our live support team is offline right now (hours: {hours.label}). Your message is saved and a teammate will reply here next working period."
            )
        system_message = add_message(db, conversation, "system", answer, sender_name="System")
        db.commit()
        db.refresh(conversation)
        await realtime_manager.broadcast(
            conversation.id,
            {"type": "message.created", "message": serialize_message(user_message)},
        )
        await realtime_manager.broadcast(
            conversation.id,
            {"type": "message.created", "message": serialize_message(system_message)},
        )
        await realtime_manager.broadcast(
            conversation.id,
            {"type": "conversation.updated", "conversation": serialize_conversation(conversation)},
        )
        return ChatResponse(
            answer=answer,
            conversation=ConversationSummary(**serialize_conversation(conversation)),
            user_message=MessagePayload(**serialize_message(user_message)),
            message=MessagePayload(**serialize_message(system_message)),
        )

    # --- Normal AI response ---
    history = get_messages(db, conversation.id)[:-1]  # exclude the message just added

    try:
        assistant = request.app.state.assistant
        loop = asyncio.get_running_loop()
        answer = await loop.run_in_executor(
            None, generate_ai_reply, assistant, body.message, history
        )
    except Exception as exc:
        logger.error("AI error — conversation=%s: %s", conversation.id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="The assistant encountered an error. Please try again.")

    assistant_message = add_message(db, conversation, "assistant", answer, sender_name="Codixel AI")
    db.commit()
    db.refresh(conversation)

    await realtime_manager.broadcast(
        conversation.id,
        {"type": "message.created", "message": serialize_message(user_message)},
    )
    await realtime_manager.broadcast(
        conversation.id,
        {"type": "message.created", "message": serialize_message(assistant_message)},
    )
    await realtime_manager.broadcast(
        conversation.id,
        {"type": "conversation.updated", "conversation": serialize_conversation(conversation)},
    )

    return ChatResponse(
        answer=answer,
        conversation=ConversationSummary(**serialize_conversation(conversation)),
        user_message=MessagePayload(**serialize_message(user_message)),
        message=MessagePayload(**serialize_message(assistant_message)),
    )


@router.get("/conversations/{conversation_id}")
def conversation_detail(conversation_id: str, db: Session = Depends(get_db)):
    conversation = get_conversation(db, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return {
        "conversation": serialize_conversation(conversation),
        "messages": [serialize_message(m) for m in get_messages(db, conversation_id)],
    }


# ---------------------------------------------------------------------------
# Admin endpoints — require valid JWT (agent login)
# ---------------------------------------------------------------------------

@router.get("/admin/conversations")
def admin_conversations(
    status: str = "all",
    db: Session = Depends(get_db),
    _: Agent = Depends(get_current_agent),
):
    items = list_conversations(db, status=status)
    return {"conversations": [serialize_conversation(item) for item in items]}


@router.post("/admin/conversations/{conversation_id}/accept", response_model=HandoffResponse)
async def admin_accept(
    conversation_id: str,
    body: AdminAssignRequest,
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    conversation = get_conversation(db, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    agent_name = body.agent_name or agent.display_name
    system_message = assign_agent(db, conversation, agent_name)
    db.commit()
    db.refresh(conversation)
    await realtime_manager.broadcast(
        conversation.id,
        {"type": "message.created", "message": serialize_message(system_message)},
    )
    await realtime_manager.broadcast(
        conversation.id,
        {"type": "conversation.updated", "conversation": serialize_conversation(conversation)},
    )
    return HandoffResponse(
        conversation=ConversationSummary(**serialize_conversation(conversation)),
        message=MessagePayload(**serialize_message(system_message)),
    )


@router.post("/admin/conversations/{conversation_id}/reply", response_model=HandoffResponse)
async def admin_reply(
    conversation_id: str,
    body: AdminReplyRequest,
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    conversation = get_conversation(db, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    agent_name = body.agent_name or agent.display_name
    if conversation.status != "assigned_to_agent":
        # Auto-accept when replying without explicitly accepting
        assign_agent(db, conversation, agent_name)

    message = add_message(db, conversation, "human", body.content, sender_name=agent_name)
    db.commit()
    db.refresh(conversation)

    await realtime_manager.broadcast(
        conversation.id,
        {"type": "message.created", "message": serialize_message(message)},
    )
    await realtime_manager.broadcast(
        conversation.id,
        {"type": "conversation.updated", "conversation": serialize_conversation(conversation)},
    )
    return HandoffResponse(
        conversation=ConversationSummary(**serialize_conversation(conversation)),
        message=MessagePayload(**serialize_message(message)),
    )


@router.post("/chat/{conversation_id}/revert", response_model=HandoffResponse)
async def user_revert(
    conversation_id: str,
    db: Session = Depends(get_db),
):
    conversation = get_conversation(db, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    system_message = revert_to_ai(db, conversation)
    db.commit()
    db.refresh(conversation)
    await realtime_manager.broadcast(
        conversation.id,
        {"type": "message.created", "message": serialize_message(system_message)},
    )
    await realtime_manager.broadcast(
        conversation.id,
        {"type": "conversation.updated", "conversation": serialize_conversation(conversation)},
    )
    return HandoffResponse(
        conversation=ConversationSummary(**serialize_conversation(conversation)),
        message=MessagePayload(**serialize_message(system_message)),
    )


@router.post("/admin/conversations/{conversation_id}/revert", response_model=HandoffResponse)
async def admin_revert(
    conversation_id: str,
    db: Session = Depends(get_db),
    agent: Agent = Depends(get_current_agent),
):
    conversation = get_conversation(db, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    system_message = revert_to_ai(db, conversation)
    db.commit()
    db.refresh(conversation)
    await realtime_manager.broadcast(
        conversation.id,
        {"type": "message.created", "message": serialize_message(system_message)},
    )
    await realtime_manager.broadcast(
        conversation.id,
        {"type": "conversation.updated", "conversation": serialize_conversation(conversation)},
    )
    return HandoffResponse(
        conversation=ConversationSummary(**serialize_conversation(conversation)),
        message=MessagePayload(**serialize_message(system_message)),
    )


@router.websocket("/ws/conversations/{conversation_id}")
async def conversation_ws(websocket: WebSocket, conversation_id: str):
    await realtime_manager.connect(conversation_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        realtime_manager.disconnect(conversation_id, websocket)
    except Exception:
        realtime_manager.disconnect(conversation_id, websocket)
