// V14 Pattern: JSON-LD Schema generation for Rich Results in Google Search

export function generateCourseSchema(course: { title: string; description: string; url: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.description,
    provider: {
      "@type": "Organization",
      name: "ZenC Ecosystem",
      sameAs: "https://zenc.example.com",
    },
  };
}

export function generateArticleSchema(article: { title: string; author: string; datePublished: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    author: {
      "@type": "Person",
      name: article.author,
    },
    datePublished: article.datePublished,
    publisher: {
      "@type": "Organization",
      name: "ZenC Ecosystem",
      logo: {
        "@type": "ImageObject",
        url: "https://zenc.example.com/logo.png",
      },
    },
  };
}

export function generateFaqSchema(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}
