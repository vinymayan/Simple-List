import type { Metadata } from 'next';
import { PrivacyContent } from '../legal-content';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for Simple Collection Manager.'
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <section className="legal-card">
        <a className="back-link legal-back-link" href="/">&larr; Back</a>
        <h1>Privacy Policy</h1>
        <PrivacyContent />
      </section>
    </main>
  );
}
