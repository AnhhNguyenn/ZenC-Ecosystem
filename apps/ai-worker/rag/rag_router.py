"""
ZenC AI Worker – RAG API Router.

Exposes REST endpoints for document ingestion and retrieval.
These endpoints are called by admin tools and the Gateway Server.
"""

import logging
import os
import shutil
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from rag.rag_service import rag_service

logger = logging.getLogger(__name__)

# ── Lightweight Admin Auth ────────────────────────────────────────
# The RAG ingest endpoint is admin-only. We use the ADMIN_SECRET_KEY
# from env vars as a simple bearer token check — full JWT verification
# runs in the Gateway; this is an internal service-level guard.
_bearer_scheme = HTTPBearer(auto_error=True)
_ADMIN_KEY = os.getenv("ADMIN_SECRET_KEY", "")


def require_admin(credentials: HTTPAuthorizationCredentials = Security(_bearer_scheme)) -> None:
    """Verify the bearer token matches ADMIN_SECRET_KEY."""
    if not _ADMIN_KEY or credentials.credentials != _ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Admin access required")


router = APIRouter(prefix="/rag", tags=["RAG Pipeline"])


class QueryRequest(BaseModel):
    """Request body for RAG query endpoint."""
    question: str
    top_k: int = 5
    source_filter: Optional[str] = None


class QueryResponse(BaseModel):
    """Single retrieval result."""
    text: str
    source: str
    page: int
    score: float


class IngestResponse(BaseModel):
    """Response from document ingestion."""
    message: str
    chunks_ingested: int
    source_name: str


@router.post("/ingest", response_model=IngestResponse, dependencies=[Depends(require_admin)])
async def ingest_document(
    file: UploadFile = File(...),
    source_name: str = Form(...),
) -> IngestResponse:
    """
    Ingest a PDF document into the RAG vector store.

    The file is temporarily saved to disk for PyPDF2 processing,
    then immediately deleted. Only the extracted text chunks and
    their embeddings persist (in Qdrant).

    Args:
        file: PDF file upload
        source_name: Human-readable identifier for this document

    Returns:
        Number of chunks successfully ingested
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    temp_path = f"/tmp/rag_ingest_{file.filename}"

    try:
        # Save uploaded file temporarily for PyPDF2
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        chunks_count = await rag_service.ingest_pdf(temp_path, source_name)

        return IngestResponse(
            message="Document ingested successfully",
            chunks_ingested=chunks_count,
            source_name=source_name,
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File processing failed")
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Always clean up the temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)


@router.post("/query", response_model=list[QueryResponse])
async def query_documents(request: QueryRequest) -> list[QueryResponse]:
    """
    Query the RAG vector store for relevant document chunks.

    Embeds the question using text-embedding-004 and performs
    cosine similarity search in Qdrant.

    Args:
        request: Question text, top_k count, optional source filter

    Returns:
        List of relevant chunks with similarity scores
    """
    try:
        results = await rag_service.query(
            question=request.question,
            top_k=request.top_k,
            source_filter=request.source_filter,
        )

        return [
            QueryResponse(
                text=r["text"],
                source=r["source"],
                page=r["page"],
                score=r["score"],
            )
            for r in results
        ]
    except Exception as e:
        logger.error(f"RAG query endpoint error: {e}")
        raise HTTPException(status_code=500, detail="Query processing failed")


class SourceInfo(BaseModel):
    """A single document source in the knowledge base."""
    source: str
    chunks: int


class SourcesResponse(BaseModel):
    """Response listing all ingested document sources."""
    sources: list[SourceInfo]
    total: int


@router.get("/sources", response_model=SourcesResponse)
async def list_sources() -> SourcesResponse:
    """
    List all unique document sources in the RAG knowledge base.

    Aggregates Qdrant points by source name and returns the total
    chunk count for each document. Used by the Admin content management
    page to display the current state of the knowledge base.

    Returns:
        List of source names with chunk counts + total document count
    """
    try:
        sources = await rag_service.list_sources()
        return SourcesResponse(
            sources=[SourceInfo(**s) for s in sources],
            total=len(sources),
        )
    except Exception as e:
        logger.error(f"RAG sources endpoint error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve sources")
