from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Conversation, Message
from app.services.business_hours import get_business_hours_state


def serialize_message(message: Message) -> dict:
    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender_type": message.sender_type,
        "sender_name": message.sender_name,
        "content": message.content,
        "created_at": message.created_at.isoformat(),
    }


def serialize_conversation(conversation: Conversation) -> dict:
    return {
        "id": conversation.id,
        "status": conversation.status,
        "channel": conversation.channel,
        "guest_name": conversation.guest_name,
        "guest_email": conversation.guest_email,
        "guest_phone": conversation.guest_phone,
        "assigned_agent_name": conversation.assigned_agent_name,
        "human_requested_at": (
            conversation.human_requested_at.isoformat()
            if conversation.human_requested_at
            else None
        ),
        "last_message_at": conversation.last_message_at.isoformat(),
        "created_at": conversation.created_at.isoformat(),
        "updated_at": conversation.updated_at.isoformat(),
    }


def list_conversations(db: Session, status: str | None = None) -> list[Conversation]:
    stmt = select(Conversation).order_by(Conversation.last_message_at.desc())
    if status and status != "all":
        stmt = stmt.where(Conversation.status == status)
    return list(db.scalars(stmt).all())


def get_conversation(db: Session, conversation_id: str) -> Conversation | None:
    return db.get(Conversation, conversation_id)


def get_messages(db: Session, conversation_id: str) -> list[Message]:
    stmt = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.id.asc())
    )
    return list(db.scalars(stmt).all())


def create_or_get_conversation(
    db: Session,
    conversation_id: str | None,
    guest_name: str | None = None,
    guest_email: str | None = None,
    guest_phone: str | None = None,
) -> Conversation:
    conversation = db.get(Conversation, conversation_id) if conversation_id else None
    if conversation is None:
        conversation = Conversation(
            id=str(uuid.uuid4()),
            guest_name=guest_name,
            guest_email=guest_email,
            guest_phone=guest_phone,
        )
        db.add(conversation)
        db.flush()
    else:
        if guest_name:
            conversation.guest_name = guest_name
        if guest_email:
            conversation.guest_email = guest_email
        if guest_phone:
            conversation.guest_phone = guest_phone
    return conversation


def add_message(
    db: Session,
    conversation: Conversation,
    sender_type: str,
    content: str,
    sender_name: str | None = None,
) -> Message:
    message = Message(
        conversation_id=conversation.id,
        sender_type=sender_type,
        sender_name=sender_name,
        content=content,
    )
    conversation.last_message_at = datetime.now(timezone.utc)
    db.add(message)
    db.flush()
    return message


def build_history_for_ai(messages: list[Message]) -> list[dict]:
    history = []
    for item in messages:
        if item.sender_type == "user":
            history.append({"role": "user", "content": item.content})
        elif item.sender_type in {"assistant", "human"}:
            history.append({"role": "assistant", "content": item.content})
    return history


def generate_ai_reply(assistant, user_message: str, history: list[Message]) -> str:
    return assistant.get_response(user_message, build_history_for_ai(history))


def request_human_handoff(
    db: Session, conversation: Conversation, settings
) -> tuple[Conversation, Message]:
    state = get_business_hours_state(settings)
    conversation.human_requested_at = datetime.now(timezone.utc)

    if state.is_open:
        conversation.status = "waiting_for_agent"
        content = (
            "A human teammate has been notified and will join this conversation shortly. "
            "Please share any extra details so they can help faster."
        )
    else:
        conversation.status = "queued_for_business_hours"
        content = (
            f"Our live support team is currently offline. Business hours are {state.label}. "
            "Your message is saved and a human teammate will reply in this same chat during the next working period."
        )

    message = add_message(db, conversation, "system", content, sender_name="System")
    return conversation, message


def assign_agent(db: Session, conversation: Conversation, agent_name: str) -> Message:
    conversation.status = "assigned_to_agent"
    conversation.assigned_agent_name = agent_name
    message = add_message(
        db,
        conversation,
        "system",
        f"{agent_name} joined the conversation from the Codixel team.",
        sender_name="System",
    )
    return message


def revert_to_ai(db: Session, conversation: Conversation) -> Message:
    conversation.status = "ai_active"
    conversation.assigned_agent_name = None
    message = add_message(
        db,
        conversation,
        "system",
        "This conversation has been returned to the AI assistant.",
        sender_name="System",
    )
    return message
