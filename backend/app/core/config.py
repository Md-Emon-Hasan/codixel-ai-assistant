from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv


@dataclass(slots=True)
class Settings:
    # OpenAI
    openai_api_key: str
    chat_model: str
    embedding_model: str
    temperature: float

    # Knowledge base / RAG
    target_website: str
    documents_dir: Path
    chroma_path: Path
    crawl_max_pages: int
    chunk_size: int
    chunk_overlap: int
    retriever_k: int

    # CORS
    allowed_origins: list[str]

    # Business hours
    office_timezone: str
    office_start_hour: int
    office_end_hour: int
    office_days: list[int]

    # JWT
    jwt_secret_key: str
    jwt_algorithm: str
    jwt_access_token_expire_minutes: int

    # Default admin
    admin_username: str
    admin_password: str

    @classmethod
    def from_env(cls, env_file: str = ".env") -> "Settings":
        load_dotenv(env_file)

        openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if not openai_api_key:
            raise ValueError("OPENAI_API_KEY is missing in .env")

        raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
        allowed_origins = (
            [o.strip() for o in raw_origins.split(",") if o.strip()]
            if raw_origins != "*"
            else ["*"]
        )

        return cls(
            openai_api_key=openai_api_key,
            chat_model=os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
            embedding_model=os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
            temperature=float(os.getenv("TEMPERATURE", "0.3")),

            target_website=os.getenv("TARGET_WEBSITE", ""),
            documents_dir=Path(os.getenv("DOCUMENTS_DIR", "./data/documents")),
            chroma_path=Path(os.getenv("CHROMA_PATH", "./data/chroma_store")),
            crawl_max_pages=int(os.getenv("CRAWL_MAX_PAGES", "12")),
            chunk_size=int(os.getenv("CHUNK_SIZE", "1000")),
            chunk_overlap=int(os.getenv("CHUNK_OVERLAP", "200")),
            retriever_k=int(os.getenv("RETRIEVER_K", "4")),

            allowed_origins=allowed_origins,

            office_timezone=os.getenv("OFFICE_TIMEZONE", "Asia/Dhaka"),
            office_start_hour=int(os.getenv("OFFICE_START_HOUR", "10")),
            office_end_hour=int(os.getenv("OFFICE_END_HOUR", "18")),
            office_days=[
                int(d.strip())
                for d in os.getenv("OFFICE_DAYS", "0,1,2,3,4").split(",")
                if d.strip()
            ],

            jwt_secret_key=os.getenv("JWT_SECRET_KEY", "change-this-secret"),
            jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
            jwt_access_token_expire_minutes=int(
                os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "480")
            ),

            admin_username=os.getenv("ADMIN_USERNAME", "admin"),
            admin_password=os.getenv("ADMIN_PASSWORD", "codixel-admin-2024"),
        )
