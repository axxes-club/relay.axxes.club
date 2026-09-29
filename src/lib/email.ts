import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@axxes.club"
const APP_NAME = "members.axxes.club"

export async function sendPasswordResetEmail({
  email,
  resetLink,
}: {
  email: string
  resetLink: string
}) {
  try {
    await transporter.sendMail({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: email,
      subject: "Reset your password",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 40px 20px;">
            <div style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="background-color: #0a0a0a; padding: 24px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">
                  members.axxes.<span style="color: #a855f7;">club</span>
                </h1>
              </div>
              <div style="padding: 32px 24px;">
                <h2 style="margin: 0 0 16px; font-size: 24px; font-weight: 600; color: #0a0a0a;">
                  Reset your password
                </h2>
                <p style="margin: 0 0 24px; color: #525252; line-height: 1.6;">
                  We received a request to reset your password. Click the button below to create a new password.
                </p>
                <a href="${resetLink}" style="display: inline-block; background-color: #0a0a0a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; font-size: 14px;">
                  Reset Password
                </a>
                <p style="margin: 24px 0 0; color: #737373; font-size: 14px; line-height: 1.6;">
                  This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
                </p>
              </div>
              <div style="padding: 16px 24px; background-color: #fafafa; border-top: 1px solid #e5e5e5;">
                <p style="margin: 0; color: #a3a3a3; font-size: 12px; text-align: center;">
                  &copy; ${new Date().getFullYear()} AXXES. All rights reserved.
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
    })
  } catch (error) {
    console.error("Failed to send password reset email:", error)
    throw new Error("Failed to send password reset email")
  }
}
