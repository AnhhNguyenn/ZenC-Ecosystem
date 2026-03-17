"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { FileText, UploadCloud, Search, Plus, MoreVertical, Database } from 'lucide-react';
import styles from './page.module.scss';
import { Button } from '@/components/ui/Button';

// Mock content data
const CONTENTS = [
  { id: 'DOC-001', title: 'English Grammar Basics v2.pdf', type: 'PDF', category: 'Grammar', size: '2.4 MB', status: 'processed', date: '2024-03-09' },
  { id: 'DOC-002', title: 'Healthcare Dialogs Corpus.txt', type: 'TXT', category: 'Vocabulary', size: '850 KB', status: 'processing', date: '2024-03-09' },
  { id: 'DOC-003', title: 'Travel Scenarios 101.docx', type: 'DOCX', category: 'Roleplay', size: '1.2 MB', status: 'failed', date: '2024-03-08' },
  { id: 'DOC-004', title: 'Business English Idioms.pdf', type: 'PDF', category: 'Vocabulary', size: '3.1 MB', status: 'processed', date: '2024-03-07' },
];

export default function AdminContentPage() {
  const [activeTab, setActiveTab] = useState('rag');

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Content & Knowledge Base</h1>
          <p className={styles.subtitle}>Manage course lessons and RAG documents for the AI AI Worker.</p>
        </div>
        <div className={styles.headerRight}>
          <Button className={styles.uploadBtn}>
            <UploadCloud size={18} /> Upload Document
          </Button>
          <Button variant="outline">
            <Plus size={18} /> New Lesson
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
          className={`${styles.tab} ${activeTab === 'lessons' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('lessons')}
        >
          <FileText size={18} /> Structured Lessons
        </button>
      </div>

      {activeTab === 'rag' && (
        <Card className={styles.contentCard}>
          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <Search size={18} className={styles.searchIcon} />
              <input type="text" placeholder="Search filenames or categories..." className={styles.searchInput} />
            </div>
            
            <div className={styles.statsSummary}>
              <span className={styles.statLabel}>Total Stored:</span>
              <span className={styles.statValue}>124 Files (1.2 GB)</span>
            </div>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Target File</th>
                  <th>Category</th>
                  <th>File Size</th>
                  <th>Upload Date</th>
                  <th>Embedding Status</th>
                  <th className={styles.actionsHeader}></th>
                </tr>
              </thead>
              <tbody>
                {CONTENTS.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <div className={styles.fileCell}>
                        <FileText size={20} className={styles.fileIcon} />
                        <div className={styles.fileInfo}>
                          <span className={styles.fileName}>{doc.title}</span>
                          <span className={styles.fileId}>{doc.id}</span>
                        </div>
                      </div>
                    </td>
                    <td><span className={styles.categoryTag}>{doc.category}</span></td>
                    <td className={styles.metaText}>{doc.size}</td>
                    <td className={styles.metaText}>{doc.date}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${styles[doc.status]}`}>
                        {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                      </span>
                    </td>
                    <td>
                      <button className={styles.actionBtn}><MoreVertical size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'lessons' && (
        <Card className={styles.placeholderCard}>
          <div className={styles.emptyState}>
            <FileText size={48} className={styles.emptyIcon} />
            <h3>No Structured Lessons Yet</h3>
            <p>Create curriculum blocks that dictate the user's learning path.</p>
            <Button className={styles.emptyBtn}>Create First Lesson</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
