from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from app.core.config import Settings
from app.services.assistant import CodixelAssistant
from app.services.vectorstore import build_vectorstore, load_vectorstore


def create_assistant(settings: Settings, rebuild_index: bool = False) -> CodixelAssistant:
    embeddings = OpenAIEmbeddings(model=settings.embedding_model)
    llm = ChatOpenAI(model=settings.chat_model, temperature=settings.temperature)

    if rebuild_index or not settings.chroma_path.exists():
        vectorstore = build_vectorstore(settings, embeddings)
    else:
        vectorstore = load_vectorstore(settings.chroma_path, embeddings)

    retriever = vectorstore.as_retriever(search_kwargs={"k": settings.retriever_k})
    return CodixelAssistant(llm=llm, retriever=retriever)
