import type { Metadata } from 'next';
import { TermsContent } from '../legal-content';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for Simple Collection Manager.'
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <section className="legal-card">
        <a className="back-link legal-back-link" href="/">&larr; Back</a>
        <h1>Terms of Service</h1>
        <TermsContent />
      </section>
    </main>
  );
}
