"""
ZenC AI Worker – RAG (Retrieval Augmented Generation) Service.

Handles the full RAG pipeline:
1. Ingest: PDF → text extraction → token-based chunking
2. Embed: Chunks → Google text-embedding-004 → 768-dim vectors
3. Store: Vectors → Qdrant collection with payload metadata
4. Query: User question → embed → nearest neighbor search → context injection

Design decisions:
- 512-token chunks (spec §6.3) balance retrieval precision vs. context.
  Smaller chunks improve precision but lose paragraph-level coherence;
  larger chunks preserve context but reduce retrieval accuracy.
- 50-token overlap prevents information loss at chunk boundaries,
  ensuring sentences split across chunks are recoverable.
- Using tiktoken (cl100k_base) for tokenization to match the embedding
  model's tokenizer behavior.
"""

import logging
import uuid
from typing import Optional

import tiktoken
from PyPDF2 import PdfReader
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
)
import google.generativeai as genai

from config import settings

logger = logging.getLogger(__name__)


class RAGService:
    """
    RAG pipeline for curriculum document ingestion and retrieval.

    Lifecycle:
    - initialize() must be called once at startup to create the Qdrant
      collection if it doesn't exist.
    - ingest_pdf() processes a single PDF into the vector store.
    - query() retrieves relevant chunks for a user question.
    """

    def __init__(self) -> None:
        """
        Initialize RAG service with Qdrant client and Gemini embedding model.

        Using the cl100k_base tokenizer because it closely matches the
        token counting behavior of Google's embedding models, ensuring
        our 512-token chunks align with actual model token limits.
        """
        self.qdrant = QdrantClient(
            host=settings.QDRANT_HOST,
            port=settings.QDRANT_PORT,
        )
        self.collection_name = settings.QDRANT_COLLECTION
        self.tokenizer = tiktoken.get_encoding("cl100k_base")
        self.chunk_size = settings.CHUNK_SIZE
        self.chunk_overlap = settings.CHUNK_OVERLAP
        self.embedding_dimension = 768  # text-embedding-004 output dimension

        # Configure Google Generative AI for embeddings
        genai.configure(api_key=settings.GEMINI_API_KEY)

    async def initialize(self) -> None:
        """
        Create the Qdrant collection if it doesn't exist.

        Uses cosine distance because text-embedding-004 produces
        normalized vectors, making cosine equivalent to dot product
        but more interpretable (score range 0–1).
        """
        try:
            collections = self.qdrant.get_collections().collections
            exists = any(c.name == self.collection_name for c in collections)

            if not exists:
                self.qdrant.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=self.embedding_dimension,
                        distance=Distance.COSINE,
                    ),
                )
                logger.info(f"Created Qdrant collection: {self.collection_name}")
            else:
                logger.info(f"Qdrant collection already exists: {self.collection_name}")
        except Exception as e:
            logger.error(f"Failed to initialize Qdrant collection: {e}")
            raise

    async def ingest_pdf(self, pdf_path: str, source_name: str) -> int:
        """
        Ingest a PDF document into the RAG vector store.

        Flow:
        1. Extract text from all PDF pages
        2. Chunk text into 512-token segments with 50-token overlap
        3. Embed each chunk using Google text-embedding-004
        4. Upsert vectors into Qdrant with metadata payload

        Args:
            pdf_path: Filesystem path to the PDF file
            source_name: Human-readable source identifier (e.g., "Grammar Textbook Ch.5")

        Returns:
            Number of chunks ingested

        Raises:
            FileNotFoundError: If PDF path doesn't exist
            RuntimeError: If embedding or Qdrant operations fail
        """
        try:
            # ── Step 1: Extract text from PDF ──────────────────────────
            reader = PdfReader(pdf_path)
            full_text = ""
            for page_num, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text:
                    full_text += f"\n[Page {page_num + 1}]\n{page_text}"

            if not full_text.strip():
                logger.warning(f"No text extracted from PDF: {pdf_path}")
                return 0

            # ── Step 2: Chunk text ─────────────────────────────────────
            chunks = self._chunk_text(full_text)
            logger.info(f"PDF '{source_name}' split into {len(chunks)} chunks")

            # ── Step 3: Embed chunks ───────────────────────────────────
            embeddings = self._embed_texts([chunk["text"] for chunk in chunks])

            # ── Step 4: Upsert into Qdrant ─────────────────────────────
            points = [
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=embedding,
                    payload={
                        "text": chunk["text"],
                        "source": source_name,
                        "page": chunk["page"],
                        "chunk_index": i,
                        "token_count": chunk["token_count"],
                    },
                )
                for i, (chunk, embedding) in enumerate(zip(chunks, embeddings))
            ]

            # Batch upsert in groups of 100 to avoid memory spikes
            batch_size = 100
            for i in range(0, len(points), batch_size):
                batch = points[i : i + batch_size]
                self.qdrant.upsert(
                    collection_name=self.collection_name,
                    points=batch,
                )

            logger.info(
                f"Ingested {len(chunks)} chunks from '{source_name}' into Qdrant"
            )
            return len(chunks)

        except FileNotFoundError:
            logger.error(f"PDF file not found: {pdf_path}")
            raise
        except Exception as e:
            logger.error(f"PDF ingestion failed for '{source_name}': {e}")
            raise RuntimeError(f"Ingestion failed: {e}") from e

    def _chunk_text(self, text: str) -> list[dict]:
        """
        Split text into token-based chunks with overlap.

        Algorithm:
        1. Tokenize the entire text into token IDs
        2. Slide a window of `chunk_size` tokens with `chunk_overlap` stride
        3. Decode each window back to text
        4. Track approximate page numbers from [Page N] markers

        Returns:
            List of dicts with keys: text, page, token_count
        """
        tokens = self.tokenizer.encode(text)
        chunks = []
        current_page = 1
        stride = self.chunk_size - self.chunk_overlap

        for start in range(0, len(tokens), stride):
            end = min(start + self.chunk_size, len(tokens))
            chunk_tokens = tokens[start:end]
            chunk_text = self.tokenizer.decode(chunk_tokens)

            # Track page numbers from embedded markers
            page_markers = [
                int(line.split("]")[0].replace("[Page ", ""))
                for line in chunk_text.split("\n")
                if line.strip().startswith("[Page ")
            ]
            if page_markers:
                current_page = page_markers[-1]

            chunks.append(
                {
                    "text": chunk_text,
                    "page": current_page,
                    "token_count": len(chunk_tokens),
                }
            )

            if end >= len(tokens):
                break

        return chunks

    def _embed_texts(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings for a list of texts using Google text-embedding-004.

        Batches requests to the API to minimize round-trip overhead.
        Each embedding is a 768-dimensional float vector.

        Args:
            texts: List of text strings to embed

        Returns:
            List of 768-dim float vectors
        """
        try:
            result = genai.embed_content(
                model=f"models/{settings.GEMINI_EMBEDDING_MODEL}",
                content=texts,
                task_type="retrieval_document",
            )
            return result["embedding"]
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            raise

    async def query(
        self,
        question: str,
        top_k: int = 5,
        source_filter: Optional[str] = None,
    ) -> list[dict]:
        """
        Retrieve relevant document chunks for a user question.

        Flow:
        1. Embed the question using text-embedding-004 (retrieval_query task)
        2. Perform nearest-neighbor search in Qdrant
        3. Return top-k chunks with metadata and similarity scores

        Args:
            question: User's natural language question
            top_k: Number of chunks to retrieve (default 5)
            source_filter: Optional source name to restrict search

        Returns:
            List of dicts with: text, source, page, score
        """
        try:
            # Embed the query with retrieval_query task type
            query_result = genai.embed_content(
                model=f"models/{settings.GEMINI_EMBEDDING_MODEL}",
                content=question,
                task_type="retrieval_query",
            )
            query_vector = query_result["embedding"]

            # Build optional filter
            search_filter = None
            if source_filter:
                search_filter = Filter(
                    must=[
                        FieldCondition(
                            key="source",
                            match=MatchValue(value=source_filter),
                        )
                    ]
                )

            # Search Qdrant
            results = self.qdrant.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                query_filter=search_filter,
                limit=top_k,
            )

            return [
                {
                    "text": hit.payload.get("text", "") if hit.payload else "",
                    "source": hit.payload.get("source", "") if hit.payload else "",
                    "page": hit.payload.get("page", 0) if hit.payload else 0,
                    "score": hit.score,
                }
                for hit in results
            ]

        except Exception as e:
            logger.error(f"RAG query failed: {e}")
            raise


# Singleton instance
rag_service = RAGService()
