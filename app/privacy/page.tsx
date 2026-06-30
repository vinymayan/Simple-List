export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <section className="legal-card">
        <a href="/">Back to Simple Collection Manager</a>
        <h1>Politica de privacidade</h1>
        <p>
          A API key informada e usada apenas para validar a sessao e executar acoes solicitadas pelo usuario dentro do app.
        </p>
        <p>
          A chave nao e armazenada no navegador em localStorage. Ela e mantida em cookie HttpOnly criptografado para a
          sessao configurada pelo aplicativo.
        </p>
        <p>Viny Mods nao vende dados pessoais e nao representa a Nexus Mods.</p>
      </section>
    </main>
  );
}
