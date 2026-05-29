from __future__ import annotations

import json
import re
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable

from app.core.config import settings
from app.models.books import Book
from app.models.chapters import Chapter


INVALID_FILENAME_CHARS = r'<>:"/\|?*'


class _PlainTextHTMLParser(HTMLParser):
    block_tags = {"p", "div", "br", "li", "h1", "h2", "h3", "blockquote"}

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag == "br":
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in self.block_tags:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def text(self) -> str:
        raw = "".join(self.parts)
        lines = [line.strip() for line in raw.splitlines()]
        output: list[str] = []
        previous_blank = False
        for line in lines:
            if not line:
                if not previous_blank:
                    output.append("")
                previous_blank = True
                continue
            output.append(line)
            previous_blank = False
        return "\n".join(output).strip()


def html_to_plain_text(content: str) -> str:
    if not content:
        return ""
    if "<" not in content or ">" not in content:
        return content.strip()
    parser = _PlainTextHTMLParser()
    parser.feed(content)
    return parser.text()


def normalize_novel_text(content: str) -> str:
    text = html_to_plain_text(content)
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n|\n", text) if p.strip()]
    return "\n\n".join(paragraphs)


def safe_filename(value: str, fallback: str = "untitled") -> str:
    cleaned = value.strip() or fallback
    for char in INVALID_FILENAME_CHARS:
        cleaned = cleaned.replace(char, "_")
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .")
    return cleaned[:80] or fallback


def workspace_root() -> Path:
    root = Path(settings.NOVEL_WORKSPACE_DIR).expanduser()
    if not root.is_absolute():
        root = Path.cwd() / root
    root.mkdir(parents=True, exist_ok=True)
    return root


def book_folder(book: Book | None, book_id: int | None = None) -> Path:
    if book:
        name = f"{book.id:03d}-{safe_filename(book.title, 'book')}"
    elif book_id:
        name = f"{book_id:03d}-book"
    else:
        name = "000-unassigned"
    folder = workspace_root() / name
    (folder / "chapters").mkdir(parents=True, exist_ok=True)
    (folder / "exports").mkdir(parents=True, exist_ok=True)
    (folder / ".cache").mkdir(parents=True, exist_ok=True)
    return folder


def write_project_manifest(book: Book) -> Path:
    folder = book_folder(book)
    manifest = {
        "id": book.id,
        "title": book.title,
        "description": book.description,
        "user_id": book.user_id,
        "updated_at": datetime.now().isoformat(timespec="seconds"),
    }
    path = folder / "project.json"
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def chapter_file_path(chapter: Chapter, book: Book | None = None) -> Path:
    folder = book_folder(book, chapter.book_id)
    order = chapter.order or chapter.id or 0
    chapter_id = chapter.id or 0
    filename = f"{order:03d}-{chapter_id:04d}-{safe_filename(chapter.title, 'chapter')}.txt"
    return folder / "chapters" / filename


def write_chapter_file(chapter: Chapter, book: Book | None = None) -> Path:
    path = chapter_file_path(chapter, book)
    text = normalize_novel_text(chapter.content)
    path.write_text(text + ("\n" if text else ""), encoding="utf-8")
    return path


def build_txt_export(chapters: Iterable[Chapter], title: str = "小说全集") -> str:
    sections = [title.strip() or "小说全集", ""]
    for chapter in chapters:
        body = normalize_novel_text(chapter.content)
        sections.append(chapter.title.strip() or f"第 {chapter.order} 章")
        sections.append("")
        if body:
            sections.append(body)
            sections.append("")
    return "\n".join(sections).rstrip() + "\n"
