import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Volume2 } from 'lucide-react';
import styles from './page.module.scss';
import MiniChatbot from '@/features/seo/components/MiniChatbot';

interface VocabularyData {
  word: string;
  phonetic: string;
  type: string;
  meaning: string;
  example: string;
  vietnameseExample: string;
  funFact: string;
}

async function getVocabData(slug: string): Promise<VocabularyData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/vocabulary/public/seo/${slug}`, {
      next: { revalidate: 3600 } // ISR - Revalidate every hour
    });
    if (!res.ok) {
      return null;
    }
    const text = await res.text();
    try {
       return JSON.parse(text) as VocabularyData;
    } catch (e) {
       console.error("Failed to parse JSON for seo word", text);
       return null;
    }
  } catch (error) {
    console.error('Failed to fetch SEO word:', error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const data = await getVocabData(resolvedParams.slug.toLowerCase());

  if (!data) return { title: 'Not Found' };

  return {
    title: `${data.word} là gì? Nghĩa, cách phát âm và ví dụ - ZenC AI`,
    description: `Khám phá nghĩa của từ ${data.word} (${data.phonetic}), cách sử dụng và ví dụ thực tế. Học tiếng Anh cùng AI tại ZenC.`,
    openGraph: {
      title: `${data.word} là gì?`,
      description: `Khám phá nghĩa của từ ${data.word} (${data.phonetic})`,
    }
  };
}

export default async function VocabularySeoPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const data = await getVocabData(resolvedParams.slug.toLowerCase());

  if (!data) {
    notFound();
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.wordBox}>
          <h1 className={styles.word}>{data.word}</h1>
          <button className={styles.playBtn} aria-label="Listen pronunciation">
            <Volume2 size={24} />
          </button>
        </div>
        <p className={styles.phonetic}>{data.phonetic} • {data.type}</p>
      </header>

      <main>
        <section className={styles.section}>
          <h2>Ý nghĩa</h2>
          <p>{data.meaning}</p>
          <div className={styles.exampleBox}>
            <p>"{data.example}"</p>
            <p style={{ marginTop: '8px' }}>👉 <em>{data.vietnameseExample}</em></p>
          </div>
        </section>

        <section className={styles.section}>
          <h2>Sự thật thú vị (Fun Fact) 💡</h2>
          <p>{data.funFact}</p>
        </section>

        {/* Growth Hacking Hook - Mini Chatbot */}
        <div className={styles.chatbotWrapper}>
          <MiniChatbot word={data.word} />
        </div>
      </main>
    </div>
  );
}
