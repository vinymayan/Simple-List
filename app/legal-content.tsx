export function PrivacyContent() {
  return (
    <>
      <p><strong>Effective date: July 13, 2026.</strong></p>
      <h2>Data we process</h2>
      <p>
        Simple Collection Manager uses Nexus Mods OAuth with PKCE. During sign-in, Nexus Mods provides access and,
        when available, refresh tokens plus account information such as your user ID, display name, and email address if
        Nexus returns it. Tokens are
        encrypted before they are stored in the application database. Your browser receives only a random HttpOnly
        session identifier; OAuth tokens are never placed in browser local storage or exposed to client-side JavaScript.
      </p>
      <p>
        OAuth sessions have an absolute 30-day lifetime and are removed on logout or during automatic retention cleanup.
        The temporary encrypted OAuth state cookie expires after 10 minutes. Collection files are parsed in memory and
        are not intentionally retained. Saved drafts and hidden-collection preferences remain in your browser until you
        clear this site's data.
      </p>
      <h2>Use and sharing</h2>
      <p>
        Tokens and requested collection data are sent only to approved Nexus Mods HTTPS hosts as needed to perform your
        requests. Infrastructure providers may temporarily process IP address, request time, user agent, and error data
        to deliver the service, enforce rate limits, prevent abuse, and diagnose failures. We do not sell or rent personal
        information.
      </p>
      <h2>Your choices</h2>
      <p>
        You can sign out to delete the server session and browser cookies, clear this site's browser data to remove local
        drafts, and revoke the application's access through your Nexus Mods account. Nexus Mods and linked sites have
        their own privacy practices.
      </p>
      <h2>Independent service and changes</h2>
      <p>
        Simple Collection Manager is an independent Viny Mods project and is not affiliated with, endorsed by, or
        operated by Nexus Mods. Material policy changes will be posted here with a new effective date.
      </p>
    </>
  );
}

export function TermsContent() {
  return (
    <>
      <p><strong>Effective date: July 13, 2026.</strong></p>
      <h2>Using the service</h2>
      <p>
        Simple Collection Manager is an independent tool for organizing and publishing Nexus Mods collections. You must
        use a Nexus account you are authorized to access, comply with applicable law and Nexus Mods terms and API rules,
        and review collection contents before publishing them.
      </p>
      <p>
        You may not misuse the service, probe or bypass security controls, overload it, upload malicious or deceptive
        content, infringe another person's rights, or use another person's account. Access may be limited or blocked to
        protect the service or other users.
      </p>
      <h2>Your content and third-party services</h2>
      <p>
        You retain responsibility for collection names, descriptions, manifests, links, and other submitted content. You
        authorize the app to process and transmit that material as needed to perform your requests. Nexus Mods and other
        linked services are controlled by their operators and may change or become unavailable.
      </p>
      <h2>Availability and liability</h2>
      <p>
        The service is provided &quot;as is&quot; and &quot;as available,&quot; without warranties of uninterrupted operation,
        accuracy, or fitness for a particular purpose to the extent permitted by law. Viny Mods is not responsible for
        third-party services, mod content, account actions, data loss, or indirect or consequential losses.
      </p>
      <h2>Changes</h2>
      <p>
        Features or these terms may change as the project and external APIs evolve. Continued use after updated terms are
        posted means you accept them. If you do not agree, stop using the service and sign out.
      </p>
      <p>This project is not affiliated with, endorsed by, or operated by Nexus Mods.</p>
    </>
  );
}
