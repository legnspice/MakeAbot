import { Resend } from "resend";
import { createAdminClient } from "../supabase/admin";
import * as notificationsRepo from "../repo/notifications.repo";
import { escapeHtml, siteBaseUrl, isEmailSafeBase } from "@/lib/email-format";

const resend = new Resend(process.env.RESEND_API_KEY!);

function buildEmailHtml(
  title: string,
  body: string | undefined,
  fullUrl: string,
): string {
  const base = siteBaseUrl();
  const logo = isEmailSafeBase(base)
    ? `<img src="${base}/icons/icon-192x192.png" alt="MakeAbot" width="40" height="40" style="border-radius:8px;display:block;" />`
    : `<span style="font-size:20px;font-weight:700;color:#3761B0;">MakeAbot</span>`;
  const safeTitle = escapeHtml(title);
  const safeBody = body ? escapeHtml(body) : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#3761B0;height:4px;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0;text-align:left;">
              ${logo}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;">
              <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#111827;">${safeTitle}</p>
              ${safeBody ? `<p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">${safeBody}</p>` : ""}
              <a href="${fullUrl}"
                 style="display:inline-block;padding:12px 24px;background:#3761B0;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
                View on MakeAbot
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                You're receiving this because you have email notifications enabled.<br />
                Manage your preferences in the MakeAbot app under Settings → Notifications.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendTransactionalEmail(
  toEmail: string,
  subject: string,
  body: string | undefined,
  url: string,
): Promise<void> {
  if (!process.env.RESEND_FROM) return;
  const fullUrl = url.startsWith("http") ? url : `${siteBaseUrl()}${url}`;
  await resend.emails.send({
    from: process.env.RESEND_FROM,
    to: toEmail,
    subject,
    text: `${body ?? ""}\n\nView: ${fullUrl}`,
    html: buildEmailHtml(subject, body, fullUrl),
  });
}

export async function sendDailyDigest(): Promise<void> {
  if (!process.env.RESEND_FROM) return;

  const usersWithUnread =
    await notificationsRepo.findUsersWithUnreadMessageNotifications();
  if (usersWithUnread.length === 0) return;

  const adminClient = await createAdminClient();

  await Promise.allSettled(
    usersWithUnread.map(async ({ user_id, rows }) => {
      try {
        const { data: userData } =
          await adminClient.auth.admin.getUserById(user_id);
        const email = userData?.user?.email;
        if (!email) return;

        const threadCount = rows.length;
        const subject =
          threadCount === 1
            ? `You have 1 unread conversation on MakeAbot`
            : `You have ${threadCount} unread conversations on MakeAbot`;

        const base = siteBaseUrl();
        const logo = isEmailSafeBase(base)
          ? `<img src="${base}/icons/icon-192x192.png" alt="MakeAbot" width="40" height="40" style="border-radius:8px;display:block;" />`
          : `<span style="font-size:20px;font-weight:700;color:#3761B0;">MakeAbot</span>`;

        const listItems = rows
          .map((r) => {
            const url = r.url
              ? r.url.startsWith("http")
                ? r.url
                : `${base}${r.url}`
              : base || "/";
            return `<li style="margin-bottom:12px;">
              <a href="${url}" style="font-size:14px;font-weight:600;color:#3761B0;text-decoration:none;">${escapeHtml(r.title)}</a>
              ${r.body ? `<p style="margin:2px 0 0;font-size:13px;color:#6b7280;">${escapeHtml(r.body)}</p>` : ""}
            </li>`;
          })
          .join("");

        const fullUrl = `${base}/notifications`;
        const safeSubject = escapeHtml(subject);
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeSubject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr><td style="background:#3761B0;height:4px;font-size:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:24px 32px 0;text-align:left;">
              ${logo}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;">
              <p style="margin:0 0 16px;font-size:20px;font-weight:600;color:#111827;">${safeSubject}</p>
              <ul style="margin:0 0 24px;padding-left:0;list-style:none;">${listItems}</ul>
              <a href="${fullUrl}"
                 style="display:inline-block;padding:12px 24px;background:#3761B0;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">
                View all notifications
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                You're receiving this daily digest because you have unread conversations.<br />
                Manage your preferences in the MakeAbot app under Settings → Notifications.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        await resend.emails.send({
          from: process.env.RESEND_FROM!,
          to: email,
          subject,
          text: `You have ${threadCount} unread conversation(s) on MakeAbot. View them at ${fullUrl}`,
          html,
        });
      } catch {
        // email failure must never block the digest loop
      }
    }),
  );
}
