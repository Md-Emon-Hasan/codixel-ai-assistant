from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import authenticate_agent, create_access_token, get_current_agent, require_admin, hash_password
from app.core.config import Settings
from app.db import get_db
from app.models import Agent

router = APIRouter(prefix="/auth", tags=["auth"])


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    agent_id: int
    username: str
    display_name: str
    is_admin: bool


class AgentCreate(BaseModel):
    username: str
    password: str
    display_name: str = "Agent"
    is_admin: bool = False


class AgentResponse(BaseModel):
    id: int
    username: str
    display_name: str
    is_admin: bool
    is_active: bool


@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
    settings: Settings = Depends(Settings.from_env),
):
    agent = authenticate_agent(db, form_data.username, form_data.password)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({"sub": agent.username}, settings)
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        agent_id=agent.id,
        username=agent.username,
        display_name=agent.display_name,
        is_admin=agent.is_admin,
    )


@router.get("/me", response_model=AgentResponse)
def me(agent: Agent = Depends(get_current_agent)):
    return AgentResponse(
        id=agent.id,
        username=agent.username,
        display_name=agent.display_name,
        is_admin=agent.is_admin,
        is_active=agent.is_active,
    )


@router.post("/agents", response_model=AgentResponse, status_code=201)
def create_agent(
    body: AgentCreate,
    db: Session = Depends(get_db),
    _: Agent = Depends(require_admin),
):
    if db.query(Agent).filter(Agent.username == body.username).first():
        raise HTTPException(status_code=400, detail="Username already exists.")
    agent = Agent(
        username=body.username,
        hashed_password=hash_password(body.password),
        display_name=body.display_name,
        is_admin=body.is_admin,
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return AgentResponse(
        id=agent.id,
        username=agent.username,
        display_name=agent.display_name,
        is_admin=agent.is_admin,
        is_active=agent.is_active,
    )


@router.get("/agents", response_model=list[AgentResponse])
def list_agents(
    db: Session = Depends(get_db),
    _: Agent = Depends(require_admin),
):
    agents = db.query(Agent).all()
    return [
        AgentResponse(id=a.id, username=a.username, display_name=a.display_name, is_admin=a.is_admin, is_active=a.is_active)
        for a in agents
    ]
