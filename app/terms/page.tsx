import { LegalLayout } from "@/components/legal-layout";

export const metadata = { title: "Terms of Use — MakeAbot" };

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Use" lastUpdated="August 10, 2026">
      <section>
        <p>
          Welcome to MakeAbot. These Terms of Use (&quot;Terms&quot;) govern your
          use of the MakeAbot platform. By creating an account or using the app,
          you agree to these Terms. If you do not agree, please do not use
          MakeAbot.
        </p>
      </section>

      <section>
        <h2>1. About MakeAbot</h2>
        <p>
          MakeAbot is an independent, student-led platform that helps students
          coordinate to offer and request items and services within their
          community. It is <strong>not affiliated with, maintained by, or
          endorsed by the Ateneo de Manila University</strong>. MakeAbot only
          provides a space to connect — we do not participate in, oversee, or
          guarantee any transaction, exchange, or arrangement made between users.
        </p>
      </section>

      <section>
        <h2>2. Eligibility</h2>
        <p>
          MakeAbot is intended for students of the Ateneo community. You are
          responsible for ensuring you are permitted to use the platform and for
          all activity under your account.
        </p>
      </section>

      <section>
        <h2>3. Your Account</h2>
        <p>
          You sign in with your Google account. Keep your profile information
          accurate, and do not impersonate anyone or misrepresent your identity.
          You are responsible for activity that happens through your account.
        </p>
      </section>

      <section>
        <h2>4. Posting Offers and Requests</h2>
        <p>
          You may post offers (things you can lend or provide) and requests
          (things you need). Listings must be accurate and lawful. Any incentive
          you attach is an informal token of appreciation and is capped at
          ₱500 — MakeAbot is not a commercial marketplace and is not intended for
          profit-driven selling. Do not post prohibited, illegal, unsafe, or
          inappropriate items or services.
        </p>
      </section>

      <section>
        <h2>5. Bidding, Chat, and Completing Deals</h2>
        <p>
          Users express interest by bidding, then coordinate directly through
          in-app chat. Any actual exchange, meet-up, or payment is arranged
          between the users themselves and happens off-platform, at your own
          arrangement and risk. Marking a deal as done simply records that the
          interaction concluded.
        </p>
      </section>

      <section>
        <h2>6. Reviews and Reporting</h2>
        <p>
          After a completed deal, you may leave a review of the person you dealt
          with. Reviews must be honest and tied to a real interaction. If someone
          behaves in bad faith or a post looks unsafe, you can report them or the
          post; reports are reviewed by our team. Do not use reviews or reports to
          harass, retaliate against, or unfairly target other users.
        </p>
      </section>

      <section>
        <h2>7. Prohibited Conduct</h2>
        <ul>
          <li>Harassment, threats, hate speech, or abusive behavior.</li>
          <li>Scams, fraud, or deceptive practices.</li>
          <li>Posting illegal, stolen, unsafe, or prohibited items or services.</li>
          <li>Spam, impersonation, or misuse of other users&apos; information.</li>
          <li>Attempting to disrupt, exploit, or gain unauthorized access to the platform.</li>
        </ul>
      </section>

      <section>
        <h2>8. Disclaimers and Limitation of Liability</h2>
        <p>
          MakeAbot is provided &quot;as is,&quot; without warranties of any kind.
          Because we only provide the communication platform and do not oversee
          the actual transactions, all exchanges are made at your own risk. To the
          fullest extent permitted by law, the creators and administrators of
          MakeAbot are not responsible or liable for any disputes, financial
          losses, property damage, or other harm resulting from interactions or
          transactions initiated through this platform. Please exercise caution
          and common sense.
        </p>
      </section>

      <section>
        <h2>9. Suspension and Termination</h2>
        <p>
          We may suspend or remove accounts that violate these Terms or that
          threaten the safety of the community, at our discretion.
        </p>
      </section>

      <section>
        <h2>10. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. Significant changes will be
          reflected by an updated date above, and continued use of MakeAbot after
          changes take effect constitutes acceptance of the revised Terms.
        </p>
      </section>

      <section>
        <h2>11. Governing Law</h2>
        <p>
          These Terms are governed by the laws of the Republic of the Philippines.
        </p>
      </section>

      <section>
        <h2>12. Contact</h2>
        <p>
          Questions about these Terms? Reach us on{" "}
          <a
            href="https://www.facebook.com/people/MakeAbot/61575401159655/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Facebook
          </a>{" "}
          or at{" "}
          <a href="mailto:niles.tristan.cabrera@student.ateneo.edu">
            niles.tristan.cabrera@student.ateneo.edu
          </a>
          .
        </p>
      </section>
    </LegalLayout>
  );
}
