from pathlib import Path

from langchain_community.document_loaders import PyPDFDirectoryLoader, TextLoader
from langchain_core.documents import Document


def load_local_documents(documents_dir: Path) -> list[Document]:
    documents_dir.mkdir(parents=True, exist_ok=True)
    docs: list[Document] = []

    pdf_files = list(documents_dir.glob("*.pdf"))
    txt_files = list(documents_dir.glob("*.txt")) + list(documents_dir.glob("*.md"))

    if pdf_files:
        docs.extend(PyPDFDirectoryLoader(str(documents_dir)).load())

    for path in txt_files:
        docs.extend(TextLoader(str(path), encoding="utf-8").load())

    for doc in docs:
        doc.metadata["type"] = "document"

    return docs
