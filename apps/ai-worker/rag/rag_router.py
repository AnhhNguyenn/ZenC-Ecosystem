"""
ZenC AI Worker – RAG API Router.

Exposes REST endpoints for document ingestion and retrieval.
These endpoints are called by admin tools and the Gateway Server.
"""

import logging
import os
import shutil
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

from rag.rag_service import rag_service

logger = logging.getLogger(__name__)

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


@router.post("/ingest", response_model=IngestResponse)
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
