import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

export interface InviteEmailParams {
  to: string
  inviteUrl: string
  organizationName: string
  role: string
  expiresInDays: number
  inviterName: string
}

export async function sendInviteEmail(params: InviteEmailParams) {
  if (!resend) {
    console.warn('[launchwhitly] RESEND_API_KEY not set — skipping invite email')
    return
  }

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM || 'Launchwhitly <noreply@lowkeydev.me>',
      to: params.to,
      subject: `${params.inviterName} invited you to ${params.organizationName}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px;">
          <div style="font-size: 20px; font-weight: 600; color: #18181b; margin-bottom: 24px;">
            You've been invited to Launchwhitly
          </div>

          <p style="color: #52525b; font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
            <strong style="color: #18181b;">${params.inviterName}</strong> has invited you to
            join <strong style="color: #18181b;">${params.organizationName}</strong> as a
            <strong style="color: #18181b;">${params.role}</strong>.
          </p>

          <div style="margin: 24px 0;">
            <a href="${params.inviteUrl}" style="
              display: inline-block;
              background: #4f46e5;
              color: white;
              padding: 10px 24px;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 500;
              text-decoration: none;
            ">Accept invitation</a>
          </div>

          <p style="color: #a1a1aa; font-size: 13px;">
            This invite expires in ${params.expiresInDays} day${params.expiresInDays === 1 ? '' : 's'}.
            If the button doesn't work, copy and paste this URL:<br/><br/>
            <span style="color: #3b82f6;">${params.inviteUrl}</span>
          </p>

          <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />

          <p style="color: #a1a1aa; font-size: 11px;">
            You're receiving this email because someone invited you to Launchwhitly, an
            open-source feature flag platform. If you weren't expecting this, you can ignore it.
          </p>
        </div>
      `,
    })
  } catch (error) {
    console.error('[launchwhitly] Failed to send invite email', error)
  }
}
