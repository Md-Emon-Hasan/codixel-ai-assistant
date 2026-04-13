import logging
from pathlib import Path

from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.config import Settings
from app.services.crawler import crawl_website
from app.services.documents import load_local_documents

logger = logging.getLogger("codixel.vectorstore")

_COLLECTION = "codixel"


def _collect_documents(settings: Settings) -> list[Document]:
    web_docs = crawl_website(settings.target_website, max_pages=settings.crawl_max_pages)
    logger.info("Website pages collected: %d", len(web_docs))

    local_docs = load_local_documents(settings.documents_dir)
    logger.info("Local documents collected: %d", len(local_docs))

    all_docs = web_docs + local_docs
    if not all_docs:
        raise ValueError("No documents found. Check the website or add files to data/documents/.")
    return all_docs


def build_vectorstore(settings: Settings, embeddings: OpenAIEmbeddings) -> Chroma:
    docs = _collect_documents(settings)
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )
    chunks = splitter.split_documents(docs)

    vectorstore = Chroma.from_documents(
        chunks,
        embeddings,
        persist_directory=str(settings.chroma_path),
        collection_name=_COLLECTION,
    )
    logger.info("Chunks indexed: %d, saved to: %s", len(chunks), settings.chroma_path)
    return vectorstore


def load_vectorstore(chroma_path: Path, embeddings: OpenAIEmbeddings) -> Chroma:
    return Chroma(
        persist_directory=str(chroma_path),
        embedding_function=embeddings,
        collection_name=_COLLECTION,
    )
