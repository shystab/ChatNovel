from fastapi import APIRouter, Body, Depends, Query, HTTPException
from sqlmodel import Session, select
from typing import Annotated

from app.db.session import get_session
from app.models.knowledge import (
    KnowledgeDocument,
    KnowledgeChunk,
    KnowledgeUploadRequest,
    KnowledgeUploadResponse,
    KnowledgeSearchResponse,
)
from app.services.knowledge_service import _chunk_text, get_knowledge_service


router = APIRouter()


@router.post("/upload", response_model=KnowledgeUploadResponse)
def upload_knowledge(
    payload: Annotated[KnowledgeUploadRequest, Body(description="上传知识库文本")],
    session: Annotated[Session, Depends(get_session)],
):
    doc = KnowledgeDocument(user_id=payload.user_id, project_id=payload.project_id, title=payload.title)
    session.add(doc)
    session.commit()
    session.refresh(doc)

    chunks = _chunk_text(payload.text)
    chunk_rows: list[KnowledgeChunk] = []
    for c in chunks:
        row = KnowledgeChunk(document_id=doc.id, user_id=payload.user_id, project_id=payload.project_id, text=c)  # type: ignore[arg-type]
        session.add(row)
        chunk_rows.append(row)
    session.commit()
    for row in chunk_rows:
        session.refresh(row)

    ks = get_knowledge_service()
    ks.upsert_document(
        user_id=payload.user_id,
        project_id=payload.project_id,
        document_id=doc.id,  # type: ignore[arg-type]
        chunks=((row.id, row.text) for row in chunk_rows if row.id is not None),
    )

    return KnowledgeUploadResponse(document_id=doc.id, chunks=len(chunk_rows))  # type: ignore[arg-type]


@router.get("/search", response_model=KnowledgeSearchResponse)
def search_knowledge(
    user_id: Annotated[str, Query(description="用户 ID")],
    project_id: Annotated[str, Query(description="项目/书籍 ID")],
    q: Annotated[str, Query(description="检索 query")],
    top_k: Annotated[int, Query(ge=1, le=20, description="返回数量")] = 5,
):
    ks = get_knowledge_service()
    results = ks.search(user_id=user_id, project_id=project_id, query=q, top_k=top_k)
    return KnowledgeSearchResponse(results=results)


@router.get("/documents")
def list_documents(
    user_id: Annotated[str, Query(description="用户 ID")],
    project_id: Annotated[str, Query(description="项目 ID")],
    session: Annotated[Session, Depends(get_session)],
):
    """获取知识库文档列表"""
    stmt = select(KnowledgeDocument).where(
        KnowledgeDocument.user_id == user_id,
        KnowledgeDocument.project_id == project_id
    )
    documents = session.exec(stmt).all()

    # 统计每个文档的 chunk 数量
    result = []
    for doc in documents:
        chunk_count = session.exec(
            select(KnowledgeChunk).where(KnowledgeChunk.document_id == doc.id)
        ).all()
        result.append({
            "id": doc.id,
            "title": doc.title,
            "user_id": doc.user_id,
            "project_id": doc.project_id,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
            "chunk_count": len(chunk_count)
        })

    return {"items": result, "total": len(result)}


@router.delete("/documents/{document_id}")
def delete_document(
    document_id: int,
    session: Annotated[Session, Depends(get_session)],
):
    """删除知识库文档及其所有 chunks"""
    doc = session.get(KnowledgeDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # 删除所有相关的 chunks（数据库）
    chunks = session.exec(
        select(KnowledgeChunk).where(KnowledgeChunk.document_id == document_id)
    ).all()

    chunk_ids = [chunk.id for chunk in chunks if chunk.id is not None]

    for chunk in chunks:
        session.delete(chunk)

    # 删除文档
    session.delete(doc)
    session.commit()

    # 从向量数据库删除
    try:
        ks = get_knowledge_service()
        if chunk_ids:
            # ChromaDB 删除需要字符串 ID
            ks.collection.delete(ids=[f"chunk_{cid}" for cid in chunk_ids])
    except Exception as e:
        print(f"Warning: Failed to delete from vector DB: {e}")

    return {"message": "Document deleted successfully", "deleted_chunks": len(chunk_ids)}

