import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Volume2 } from 'lucide-react';
import styles from './page.module.scss';
import MiniChatbot from '@/features/seo/components/MiniChatbot';

// MOCK DATA cho Programmatic SEO
const VOCAB_DATABASE: Record<string, any> = {
  'procrastinate': {
    word: 'Procrastinate',
    phonetic: '/prəˈkræs.tə.neɪt/',
    type: 'Verb (Động từ)',
    meaning: 'Trì hoãn, chần chừ việc gì đó, đặc biệt là do lười biếng hoặc không muốn làm.',
    example: 'I always procrastinate when it comes to doing my taxes.',
    vietnameseExample: 'Tôi luôn chần chừ khi phải làm thủ tục đóng thuế.',
    funFact: 'Người La Mã cổ đại không coi "Procrastinate" là từ xấu, họ coi đó là sự chờ đợi thời cơ chín muồi!',
  },
  'serendipity': {
    word: 'Serendipity',
    phonetic: '/ˌser.ənˈdɪp.ə.t̬i/',
    type: 'Noun (Danh từ)',
    meaning: 'Sự tình cờ phát hiện ra những điều tốt đẹp, may mắn một cách không ngờ tới.',
    example: 'Finding that rare book in the dusty corner was pure serendipity.',
    vietnameseExample: 'Tìm thấy cuốn sách hiếm đó ở góc bụi bặm thực sự là một sự tình cờ may mắn.',
    funFact: 'Từ này được bình chọn là một trong những từ đẹp nhất trong tiếng Anh!',
  }
};

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = VOCAB_DATABASE[params.slug.toLowerCase()];

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

export default function VocabularySeoPage({ params }: { params: { slug: string } }) {
  const data = VOCAB_DATABASE[params.slug.toLowerCase()];

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
