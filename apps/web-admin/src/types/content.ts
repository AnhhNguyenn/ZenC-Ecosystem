export type ContentType = "LESSON" | "ARTICLE" | "GUIDE" | "RAG_DOCUMENT";

export interface ContentItem {
  id: string;
  title: string;
  type: ContentType;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  authorId: string;
}

export interface RagDocument {
  id: string;
  filename: string;
  url: string;
  sizeBytes: number;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  uploadedAt: string;
}
