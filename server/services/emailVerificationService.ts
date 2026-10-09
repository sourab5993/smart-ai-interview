import dns from 'dns';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

// List of common disposable / temporary / fake email providers
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  '10minutemail.com',
  '10minutemail.net',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.biz',
  'guerrillamail.org',
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  'throwawaymail.com',
  'sharklasers.com',
  'getairmail.com',
  'yopmail.com',
  'yopmail.net',
  'yopmail.fr',
  'dispostable.com',
  'fakemail.net',
  'burnermail.io',
  'nada.ltd',
  'trashmail.com',
  'trashmail.net',
  'trashmail.me',
  'maildrop.cc',
  'inboxkitten.com',
  'crazymailing.com',
  'mohmal.com',
  'generator.email',
  'tempmailaddress.com',
  'getnada.com',
  'fakeinbox.com',
  'mytemp.email',
  'mytempemail.com',
  'emailondeck.com',
  'luxusmail.org',
  'mailsac.com',
  'dropmail.me',
  'minuteinbox.com',
]);

// Interface for pending OTP verification
interface PendingOtpRecord {
  email: string;
  otp: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
  metadata?: Record<string, any>;
}

// In-Memory store for active OTPs (TTL: 10 minutes)
const otpStore = new Map<string, PendingOtpRecord>();

// Clean up expired OTP records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, record] of otpStore.entries()) {
    if (record.expiresAt < now) {
      otpStore.delete(email);
    }
  }
}, 5 * 60 * 1000);

export class EmailVerificationService {
  /**
   * 1. Check if email format is RFC 5322 compliant
   */
  static isValidEmailFormat(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    const trimmed = email.trim();
    if (trimmed.length > 254) return false;
    // Strict RFC 5322 regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    return emailRegex.test(trimmed);
  }

  /**
   * 2. Check if email domain is a known burner / disposable service
   */
  static isDisposableDomain(email: string): boolean {
    const domain = email.split('@')[1]?.toLowerCase().trim();
    if (!domain) return true;
    return DISPOSABLE_EMAIL_DOMAINS.has(domain);
  }

  /**
   * 3. Check if email domain actually has live Mail Exchange (MX) records
   * Rejects non-existent domains like @fakexyz12349876.com
   */
  static async verifyDomainMx(email: string): Promise<{ valid: boolean; reason?: string }> {
    const domain = email.split('@')[1]?.toLowerCase().trim();
    if (!domain) {
      return { valid: false, reason: 'Invalid email domain format.' };
    }

    if (this.isDisposableDomain(email)) {
      return {
        valid: false,
        reason: 'Temporary or disposable email addresses are not allowed. Please use your real email.',
      };
    }

    try {
      const records = await dns.promises.resolveMx(domain);
      if (!records || records.length === 0) {
        return {
          valid: false,
          reason: `The domain "@${domain}" does not appear to have active mail servers to receive emails.`,
        };
      }
      return { valid: true };
    } catch (error: any) {
      // If domain doesn't exist or has no MX
      if (error?.code === 'ENOTFOUND' || error?.code === 'ENODATA' || error?.code === 'SERVFAIL') {
        return {
          valid: false,
          reason: `The domain "@${domain}" does not exist on the internet. Please provide a real email address.`,
        };
      }
      // If DNS resolution timed out or network error, log warning but do not block legitimate domains if network is offline
      console.warn(`[DNS MX Check] Warning checking MX for domain ${domain}:`, error?.message);
      return { valid: true };
    }
  }

  /**
   * 4. Generate cryptographically secure 6-digit numeric OTP
   */
  static generateOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * 5. Create nodemailer transporter based on environment configuration
   */
  private static getTransporter() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    // Check if user has configured Gmail or custom SMTP
    if (smtpUser && smtpPass) {
      if (smtpHost) {
        return nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });
      } else {
        // Default to Gmail service if host not explicitly provided
        return nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });
      }
    }

    return null;
  }

  /**
   * 6. Generate, store, and dispatch OTP to recipient
   */
  static async sendVerificationOtp(
    email: string,
    metadata?: Record<string, any>
  ): Promise<{
    success: boolean;
    message: string;
    expiresInSeconds: number;
    devOtp?: string;
    deliveryMode: 'smtp' | 'console_development';
  }> {
    const normalizedEmail = email.toLowerCase().trim();

    // Rate-limit check: do not allow sending more than once every 45 seconds
    const existing = otpStore.get(normalizedEmail);
    if (existing && Date.now() - existing.createdAt < 45 * 1000) {
      const waitRemaining = Math.ceil((45 * 1000 - (Date.now() - existing.createdAt)) / 1000);
      throw new Error(`Please wait ${waitRemaining} seconds before requesting a new verification code.`);
    }

    // Generate fresh OTP
    const otp = this.generateOtp();
    const expiresInSeconds = 10 * 60; // 10 minutes
    const expiresAt = Date.now() + expiresInSeconds * 1000;

    otpStore.set(normalizedEmail, {
      email: normalizedEmail,
      otp,
      expiresAt,
      attempts: 0,
      createdAt: Date.now(),
      metadata,
    });

    const transporter = this.getTransporter();

    if (transporter) {
      try {
        const senderName = process.env.SMTP_FROM_NAME || 'Smart AI Interview Platform';
        const senderEmail = process.env.SMTP_USER;

        const htmlContent = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background-color: #020617; color: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
            <div style="background: linear-gradient(135deg, #0ea5e9, #6366f1); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">SMART AI INTERVIEW</h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: rgba(255, 255, 255, 0.9); font-weight: 500;">Email Identity Verification</p>
            </div>
            
            <div style="padding: 32px 28px; background-color: #0f172a;">
              <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-top: 0;">Hello Candidate,</p>
              <p style="font-size: 14px; line-height: 1.6; color: #94a3b8;">
                You are registering or authenticating an account on the <strong>Smart AI Interview Preparation & Evaluation Platform</strong>.
                Please enter the following 6-digit verification code to confirm that this real email address belongs to you:
              </p>

              <div style="margin: 28px 0; text-align: center;">
                <div style="display: inline-block; background-color: #020617; border: 2px solid #06b6d4; border-radius: 12px; padding: 16px 36px;">
                  <span style="font-family: monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #38bdf8;">${otp}</span>
                </div>
                <p style="margin-top: 10px; font-size: 12px; color: #64748b;">This code will expire in <strong>10 minutes</strong>.</p>
              </div>

              <div style="padding: 14px 18px; background-color: rgba(6, 182, 212, 0.08); border-left: 4px solid #06b6d4; border-radius: 6px; margin: 24px 0;">
                <p style="margin: 0; font-size: 12px; color: #7dd3fc; line-height: 1.5;">
                  🔒 <strong>Security Warning:</strong> Never share this OTP with anyone. Our administrators will never ask for your verification code.
                </p>
              </div>

              <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin-bottom: 0;">
                If you did not request this verification code, please ignore this email. No account will be created without this verification step.
              </p>
            </div>

            <div style="background-color: #020617; padding: 20px 24px; text-align: center; border-top: 1px solid #1e293b; font-size: 11px; color: #475569;">
              &copy; ${new Date().getFullYear()} Smart AI Interview Preparation System. All rights reserved.
            </div>
          </div>
        `;

        await transporter.sendMail({
          from: `"${senderName}" <${senderEmail}>`,
          to: normalizedEmail,
          subject: `${otp} is your Smart AI Interview verification code`,
          text: `Your Smart AI Interview verification code is: ${otp}. It will expire in 10 minutes.`,
          html: htmlContent,
        });

        console.log(`[Email Verification] Successfully dispatched OTP email to ${normalizedEmail}`);
        return {
          success: true,
          message: `Verification code sent to ${normalizedEmail}. Please check your inbox.`,
          expiresInSeconds,
          deliveryMode: 'smtp',
        };
      } catch (err: any) {
        console.error('[Email Verification] SMTP Delivery failed:', err?.message || err);
        // Fall back to console mode so users are never blocked in development
      }
    }

    // Development / Fallback mode: Print prominent console box with the OTP
    console.log('\n============================================================');
    console.log(`[EMAIL VERIFICATION OTP DISPATCHED]`);
    console.log(`Recipient Email: ${normalizedEmail}`);
    console.log(`Verification Code (OTP):  👉  ${otp}  👈`);
    console.log(`Expires in: 10 minutes`);
    console.log(`Note: To send to real inboxes, configure SMTP_USER & SMTP_PASS in .env`);
    console.log('============================================================\n');

    const isDev = process.env.NODE_ENV !== 'production';

    return {
      success: true,
      message: `Verification code generated for ${normalizedEmail}. ${
        isDev ? '(Development mode: Code logged in terminal)' : 'Please check your email.'
      }`,
      expiresInSeconds,
      devOtp: isDev ? otp : undefined,
      deliveryMode: 'console_development',
    };
  }

  /**
   * 7. Validate submitted OTP against store
   */
  static verifyOtp(
    email: string,
    submittedOtp: string
  ): {
    success: boolean;
    message?: string;
    metadata?: Record<string, any>;
  } {
    const normalizedEmail = email.toLowerCase().trim();
    const record = otpStore.get(normalizedEmail);

    if (!record) {
      return {
        success: false,
        message: 'No active verification code found for this email. Please request a new code.',
      };
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(normalizedEmail);
      return {
        success: false,
        message: 'Verification code has expired. Please request a new one.',
      };
    }

    record.attempts += 1;

    if (record.attempts > 5) {
      otpStore.delete(normalizedEmail);
      return {
        success: false,
        message: 'Too many incorrect attempts. Please request a new verification code.',
      };
    }

    const cleanInputOtp = submittedOtp.trim().replace(/\s+/g, '');
    if (cleanInputOtp !== record.otp) {
      const remaining = 5 - record.attempts;
      return {
        success: false,
        message: `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      };
    }

    // Success! Clear OTP from store so it cannot be reused
    const metadata = record.metadata;
    otpStore.delete(normalizedEmail);

    return {
      success: true,
      metadata,
    };
  }
}
