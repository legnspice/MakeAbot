import { LegalLayout } from "@/components/legal-layout";

export const metadata = { title: "Data Privacy Policy — MakeAbot" };

export default function PrivacyPage() {
  return (
    <LegalLayout title="Data Privacy Policy" lastUpdated="August 10, 2026">
      <section>
        <p>
          This Data Privacy Policy explains how MakeAbot collects, uses, and
          protects your personal information. We are committed to handling your
          data responsibly and in line with the Philippine Data Privacy Act of
          2012 (Republic Act No. 10173). By using MakeAbot, you consent to the
          practices described here.
        </p>
      </section>

      <section>
        <h2>1. Information We Collect</h2>
        <ul>
          <li>
            <strong>From your Google sign-in:</strong> your email address, name,
            and profile photo.
          </li>
          <li>
            <strong>Profile information you provide:</strong> your display name,
            phone number, ID number, and a short bio/description.
          </li>
          <li>
            <strong>Content you create:</strong> your posts (offers and requests),
            chat messages, reviews, and any reports you submit.
          </li>
          <li>
            <strong>Technical data:</strong> push-notification subscriptions and
            in-app notification records used to deliver updates.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>To operate the platform and let you post, bid, and chat.</li>
          <li>To connect you with the right counterparties.</li>
          <li>To send you in-app, push, and email notifications you&apos;ve enabled.</li>
          <li>To keep the community safe (moderation and handling reports).</li>
        </ul>
      </section>

      <section>
        <h2>3. Legal Basis</h2>
        <p>
          We process your information based on your consent (given when you accept
          this policy) and as necessary to provide the service you request, in
          accordance with the Data Privacy Act.
        </p>
      </section>

      <section>
        <h2>4. How We Share Your Information</h2>
        <p>
          We <strong>do not sell your personal data</strong>. Your contact details
          (phone number and ID number) are shown only to users you have actually
          dealt with — that is, someone you share a bid or deal with — and never to
          the general public or to users you have not interacted with. Reports you
          submit are visible only to MakeAbot administrators for review, and are
          not shown to the person reported.
        </p>
      </section>

      <section>
        <h2>5. Service Providers</h2>
        <p>
          We rely on trusted third-party services to run MakeAbot, and your data
          may be processed on their infrastructure:
        </p>
        <ul>
          <li><strong>Supabase</strong> — database, authentication, and file storage.</li>
          <li><strong>Google</strong> — sign-in (OAuth).</li>
          <li><strong>Resend</strong> — sending email notifications.</li>
          <li><strong>Web Push</strong> — delivering browser push notifications.</li>
        </ul>
      </section>

      <section>
        <h2>6. Data Retention</h2>
        <p>
          We keep your information while your account is active. If you delete your
          account, we delete or anonymize your personal data on a best-effort basis,
          except where we are required to retain it.
        </p>
      </section>

      <section>
        <h2>7. Your Rights</h2>
        <p>
          Under the Data Privacy Act, you have the right to access, correct, and
          request deletion or blocking of your personal data, and to object to its
          processing. To exercise these rights, contact us using the details below.
        </p>
      </section>

      <section>
        <h2>8. Security</h2>
        <p>
          We use managed authentication and access controls to protect your data.
          No system is perfectly secure, however, so we cannot guarantee absolute
          security — please protect your account and share sensitive details
          carefully.
        </p>
      </section>

      <section>
        <h2>9. Cookies and Local Storage</h2>
        <p>
          We use session cookies to keep you signed in, and your browser&apos;s
          local storage to remember small preferences (such as that you&apos;ve
          acknowledged our notices and seen the tutorial). We do not use
          third-party advertising or tracking cookies.
        </p>
      </section>

      <section>
        <h2>10. Who Can Use MakeAbot</h2>
        <p>
          MakeAbot is intended for students of the Ateneo community. It is not
          directed at children.
        </p>
      </section>

      <section>
        <h2>11. Changes to This Policy</h2>
        <p>
          We may update this policy; the &quot;Last updated&quot; date above will
          reflect the latest version.
        </p>
      </section>

      <section>
        <h2>12. Contact and Complaints</h2>
        <p>
          For privacy questions or requests, reach us on{" "}
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
          . You also have the right to lodge a complaint with the National Privacy
          Commission (NPC) of the Philippines.
        </p>
      </section>
    </LegalLayout>
  );
}
