from pydantic import BaseModel, Field, field_validator


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    conversation_id: str | None = None
    guest_name: str | None = None
    guest_email: str | None = None
    guest_phone: str | None = None

    @field_validator("message", mode="before")
    @classmethod
    def strip_message(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v


class ConversationSummary(BaseModel):
    id: str
    status: str
    channel: str
    guest_name: str | None = None
    guest_email: str | None = None
    guest_phone: str | None = None
    assigned_agent_name: str | None = None
    human_requested_at: str | None = None
    last_message_at: str
    created_at: str
    updated_at: str


class MessagePayload(BaseModel):
    id: int
    conversation_id: str
    sender_type: str
    sender_name: str | None = None
    content: str
    created_at: str


class ChatResponse(BaseModel):
    answer: str
    conversation: ConversationSummary
    user_message: MessagePayload | None = None
    message: MessagePayload


class HandoffRequest(BaseModel):
    conversation_id: str
    guest_name: str | None = None
    guest_email: str | None = None
    guest_phone: str | None = None


class HandoffResponse(BaseModel):
    conversation: ConversationSummary
    message: MessagePayload


class AdminReplyRequest(BaseModel):
    agent_name: str | None = None
    content: str = Field(..., min_length=1, max_length=4000)

    @field_validator("content", mode="before")
    @classmethod
    def strip_content(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v


class AdminAssignRequest(BaseModel):
    agent_name: str | None = None
