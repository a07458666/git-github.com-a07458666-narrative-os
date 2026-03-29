"""
Export endpoints.

GET /api/projects/{project_id}/export
  Query params:
    format=txt  (default) — plain text, chapters in order with scene content stripped of HTML
    format=md             — Markdown headings + paragraphs

Returns a text file download.
"""
from __future__ import annotations

import re
from html.parser import HTMLParser

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse

from kg import crud

router = APIRouter(prefix="/api/projects", tags=["export"])


# ─────────────────────────────────────────────
# HTML → plain text
# ─────────────────────────────────────────────

class _HTMLStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self._parts: list[str] = []
        self._block_tags = {"p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "br", "div"}

    def handle_starttag(self, tag, attrs):
        if tag in self._block_tags:
            self._parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self._block_tags:
            self._parts.append("\n")

    def handle_data(self, data):
        self._parts.append(data)

    def get_text(self) -> str:
        text = "".join(self._parts)
        # Collapse 3+ blank lines to double blank line
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()


def _html_to_text(html: str) -> str:
    if not html:
        return ""
    stripper = _HTMLStripper()
    stripper.feed(html)
    return stripper.get_text()


def _html_to_md(html: str) -> str:
    """Very light HTML → Markdown (covers TipTap output)."""
    if not html:
        return ""
    text = html
    text = re.sub(r"<h1[^>]*>(.*?)</h1>", r"# \1\n", text, flags=re.DOTALL)
    text = re.sub(r"<h2[^>]*>(.*?)</h2>", r"## \1\n", text, flags=re.DOTALL)
    text = re.sub(r"<h3[^>]*>(.*?)</h3>", r"### \1\n", text, flags=re.DOTALL)
    text = re.sub(r"<strong[^>]*>(.*?)</strong>", r"**\1**", text, flags=re.DOTALL)
    text = re.sub(r"<em[^>]*>(.*?)</em>", r"*\1*", text, flags=re.DOTALL)
    text = re.sub(r"<br\s*/?>", "\n", text)
    text = re.sub(r"<p[^>]*>(.*?)</p>", r"\1\n\n", text, flags=re.DOTALL)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ─────────────────────────────────────────────
# Route
# ─────────────────────────────────────────────

@router.get("/{project_id}/export")
async def export_project(
    project_id: str,
    format: str = Query(default="txt", pattern="^(txt|md)$"),
) -> PlainTextResponse:
    project = await crud.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    chapters = await crud.list_chapters(project_id)
    if not chapters:
        return PlainTextResponse(
            f"# {project.get('name', project_id)}\n\n(no chapters yet)",
            media_type="text/plain; charset=utf-8",
        )

    chapters_sorted = sorted(chapters, key=lambda c: c.get("order", 0))

    lines: list[str] = []
    project_title = project.get("name", project_id)

    if format == "md":
        lines.append(f"# {project_title}\n")
    else:
        lines.append(project_title.upper())
        lines.append("=" * len(project_title))
        lines.append("")

    for ch in chapters_sorted:
        ch_title = ch.get("title", f"Chapter {ch.get('order', '?')}")
        ch_id = ch["id"]

        if format == "md":
            lines.append(f"\n## {ch_title}\n")
        else:
            lines.append(f"\n{ch_title}")
            lines.append("-" * len(ch_title))

        scenes = await crud.list_scenes_by_chapter(ch_id)
        scenes_sorted = sorted(scenes, key=lambda s: s.get("order", 0))

        for sc in scenes_sorted:
            content_html = sc.get("content", "")
            if not content_html:
                continue
            if format == "md":
                body = _html_to_md(content_html)
            else:
                body = _html_to_text(content_html)
            lines.append(body)
            lines.append("")

    text = "\n".join(lines)
    ext = "md" if format == "md" else "txt"
    safe_name = re.sub(r"[^\w\-]", "_", project_title)
    filename = f"{safe_name}.{ext}"

    return PlainTextResponse(
        text,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
