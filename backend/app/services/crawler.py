import re
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from langchain_core.documents import Document

_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; CodixelAIAssistant/1.0)"}


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def _normalize(url: str) -> str:
    p = urlparse(url)
    return f"{p.scheme}://{p.netloc}{p.path.rstrip('/') or '/'}"


def _same_domain(url: str, base: str) -> bool:
    return urlparse(url).netloc == urlparse(base).netloc


def _extract_page(url: str, base_url: str) -> tuple[Document | None, list[str]]:
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=20)
        resp.raise_for_status()
    except Exception as exc:
        print(f"Skipping {url}: {exc}")
        return None, []

    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()

    title = _clean(soup.title.text if soup.title else "")
    body = _clean(soup.get_text(separator=" "))
    links = [
        _normalize(urljoin(url, a["href"]))
        for a in soup.find_all("a", href=True)
        if _same_domain(urljoin(url, a["href"]), base_url)
    ]

    if not body:
        return None, links

    doc = Document(
        page_content=f"Title: {title}\nURL: {url}\n\n{body}",
        metadata={"source": url, "title": title, "type": "website"},
    )
    return doc, links


def crawl_website(start_url: str, max_pages: int = 12) -> list[Document]:
    queue = [_normalize(start_url)]
    visited: set[str] = set()
    docs: list[Document] = []

    while queue and len(visited) < max_pages:
        url = queue.pop(0)
        if url in visited:
            continue
        visited.add(url)

        doc, links = _extract_page(url, start_url)
        if doc:
            docs.append(doc)
            print(f"Collected: {url}")

        for link in links:
            if link not in visited and link not in queue:
                queue.append(link)

    return docs
