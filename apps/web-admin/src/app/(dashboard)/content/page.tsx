"use client";

import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { FileText, UploadCloud, Search, Database, CheckCircle, XCircle, Loader } from 'lucide-react';
import styles from './page.module.scss';
import { Button } from '@/components/ui/Button';
import axios from 'axios';

// ── Types ──────────────────────────────────────────────────────────
interface IngestResponse {
  message: string;
  chunksIngested: number;
  sourceName: string;
}

interface IngestedDocument {
  source: string;
  chunks: number;
}

// ── API helpers ────────────────────────────────────────────────────
const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8000';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

const curriculumApi = {
  ingest: async (file: File, sourceName: string): Promise<IngestResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('source_name', sourceName);
    // Get JWT from cookie for auth
    const token = document.cookie.match(/auth_token=([^;]+)/)?.[1] ?? '';
    const res = await axios.post<IngestResponse>(`${WORKER_URL}/api/v1/rag/ingest`, formData, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  listDocuments: async (): Promise<IngestedDocument[]> => {
    const token = document.cookie.match(/auth_token=([^;]+)/)?.[1] ?? '';
    const res = await axios.get<{ sources: IngestedDocument[] }>(`${WORKER_URL}/api/v1/rag/sources`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data.sources ?? [];
  },
};

// ── Page ──────────────────────────────────────────────────────────
export default function AdminContentPage() {
  const [activeTab, setActiveTab] = useState('rag');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceName, setSourceName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ['rag', 'documents'],
    queryFn: curriculumApi.listDocuments,
  });

  const ingestMutation = useMutation({
    mutationFn: ({ file, name }: { file: File; name: string }) =>
      curriculumApi.ingest(file, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rag', 'documents'] });
      setSelectedFile(null);
      setSourceName('');
    },
  });

  const handleFileSelect = (file: File) => {
    if (!file.type.includes('pdf')) return;
    setSelectedFile(file);
    setSourceName(file.name.replace('.pdf', ''));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const filteredDocs = (documents ?? []).filter(d =>
    d.source.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Content &amp; Knowledge Base</h1>
          <p className={styles.subtitle}>Upload PDF materials for the AI tutor's RAG knowledge base.</p>
        </div>
        <div className={styles.headerRight}>
          <Button onClick={() => fileInputRef.current?.click()}>
            <UploadCloud size={18} /> Upload Document
          </Button>
        </div>
      </header>

      {/* Internal Tabs */}
      <div className={styles.tabsContainer}>
        <button
          className={`${styles.tab} ${activeTab === 'rag' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('rag')}
        >
          <Database size={18} /> RAG Documents
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'upload' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          <UploadCloud size={18} /> Upload New
        </button>
      </div>

      {/* RAG Documents Tab */}
      {activeTab === 'rag' && (
        <Card className={styles.contentCard}>
          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <Search size={18} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search filenames..."
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className={styles.statsSummary}>
              <span className={styles.statLabel}>Total Documents:</span>
              <span className={styles.statValue}>{documents?.length ?? 0}</span>
            </div>
          </div>

          <div className={styles.tableWrapper}>
            {docsLoading ? (
              <p style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-neutral-400)' }}>
                Loading knowledge base...
              </p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Document Name</th>
                    <th>Chunks</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.length > 0 ? filteredDocs.map((doc, i) => (
                    <tr key={i}>
                      <td>
                        <div className={styles.fileCell}>
                          <FileText size={20} className={styles.fileIcon} />
                          <span className={styles.fileName}>{doc.source}</span>
                        </div>
                      </td>
                      <td className={styles.metaText}>{doc.chunks} chunks</td>
                      <td>
                        <span className={`${styles.statusBadge} ${styles.processed}`}>Indexed</span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-neutral-400)' }}>
                        No documents found. Upload your first PDF in the "Upload New" tab.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <Card className={styles.contentCard} style={{ padding: 'var(--spacing-xl)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', maxWidth: '600px' }}>
            <h3 style={{ fontWeight: 600 }}>Upload PDF to RAG Knowledge Base</h3>
            <p style={{ fontSize: 'var(--font-size-meta)', color: 'var(--color-neutral-500)' }}>
              The AI Worker will chunk and embed the document into Qdrant. The AI tutor will then be able to reference it during voice sessions.
            </p>

            {/* Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragOver ? 'var(--color-primary)' : 'var(--color-neutral-300)'}`,
                borderRadius: 'var(--radius-md)', padding: 'var(--spacing-xl)',
                textAlign: 'center', cursor: 'pointer',
                background: dragOver ? 'var(--color-primary-light)' : 'transparent',
                transition: 'all 0.2s ease',
              }}
            >
              <input
                ref={fileInputRef} type="file" accept=".pdf"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
              />
              {selectedFile ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <FileText size={24} color="var(--color-primary)" />
                  <strong>{selectedFile.name}</strong>
                  <span style={{ color: 'var(--color-neutral-400)', fontSize: '12px' }}>
                    ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              ) : (
                <>
                  <UploadCloud size={32} color="var(--color-neutral-400)" style={{ marginBottom: '8px' }} />
                  <p style={{ margin: 0, color: 'var(--color-neutral-500)' }}>
                    Drag & drop a PDF, or <strong style={{ color: 'var(--color-primary)' }}>browse</strong>
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--color-neutral-400)', margin: '4px 0 0' }}>PDF only • Max 50MB</p>
                </>
              )}
            </div>

            {/* Source Name */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: 'var(--font-size-meta)' }}>
                Source Name
              </label>
              <input
                type="text" value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="e.g. Grammar Textbook Chapter 5"
                style={{
                  width: '100%', padding: '10px 14px',
                  border: '1px solid var(--color-neutral-300)',
                  borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-body)',
                  background: 'var(--color-background)', color: 'var(--color-neutral-900)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <Button
              onClick={() => selectedFile && ingestMutation.mutate({ file: selectedFile, name: sourceName.trim() })}
              disabled={!selectedFile || !sourceName.trim() || ingestMutation.isPending}
              style={{ alignSelf: 'flex-start' }}
            >
              {ingestMutation.isPending
                ? <><Loader size={16} /> Ingesting...</>
                : <><UploadCloud size={16} /> Ingest into RAG</>
              }
            </Button>

            {ingestMutation.isSuccess && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)' }}>
                <CheckCircle size={16} />
                <span>✅ {ingestMutation.data.sourceName}: <strong>{ingestMutation.data.chunksIngested} chunks</strong> indexed!</span>
              </div>
            )}
            {ingestMutation.isError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger)' }}>
                <XCircle size={16} />
                <span>Upload failed: {(ingestMutation.error as Error).message}</span>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
