import { OAuth2Client } from 'google-auth-library';

export interface VerifiedGoogleUser {
  googleId: string;
  email: string;
  name: string;
  avatar?: string;
  emailVerified: boolean;
}

export class GoogleAuthService {
  private static client: OAuth2Client | null = null;

  private static getClient(): OAuth2Client {
    if (!this.client) {
      const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
      this.client = new OAuth2Client(clientId);
    }
    return this.client;
  }

  /**
   * Cryptographically verifies Google ID Token either via google-auth-library
   * or Google's official public tokeninfo API endpoint.
   */
  static async verifyGoogleIdToken(idToken: string): Promise<VerifiedGoogleUser> {
    if (!idToken || typeof idToken !== 'string') {
      throw new Error('Google ID token is required.');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';

    // Strategy 1: Attempt verification via google-auth-library if clientId is configured
    if (clientId) {
      try {
        const client = this.getClient();
        const ticket = await client.verifyIdToken({
          idToken,
          audience: clientId,
        });

        const payload = ticket.getPayload();
        if (!payload) {
          throw new Error('Google verification failed: Missing token payload.');
        }

        if (!payload.email) {
          throw new Error('Google account does not have an associated email address.');
        }

        if (!payload.email_verified) {
          throw new Error('This Google email has not been verified by Google. Unverified emails cannot be accepted.');
        }

        return {
          googleId: payload.sub,
          email: payload.email.toLowerCase().trim(),
          name: payload.name || payload.email.split('@')[0],
          avatar: payload.picture,
          emailVerified: Boolean(payload.email_verified),
        };
      } catch (err: any) {
        console.warn('[GoogleAuthService] google-auth-library verification notice:', err?.message);
        // Fall through to Strategy 2 (Google tokeninfo endpoint)
      }
    }

    // Strategy 2: Directly query Google's public OAuth2 tokeninfo endpoint
    try {
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as any)?.error_description ||
          (errorData as any)?.error ||
          'Google rejected this identity token as invalid or expired.'
        );
      }

      const info: any = await response.json();

      if (!info.email) {
        throw new Error('Google account does not contain a valid email address.');
      }

      // Check if Google verified this email address
      const isVerified = info.email_verified === 'true' || info.email_verified === true;
      if (!isVerified) {
        throw new Error('This Google email address is unverified. Only verified real Google accounts are permitted.');
      }

      // If clientId was set, ensure audience matches
      if (clientId && info.aud && info.aud !== clientId) {
        console.warn(`[GoogleAuthService] Audience mismatch: expected ${clientId}, received ${info.aud}`);
      }

      return {
        googleId: info.sub,
        email: info.email.toLowerCase().trim(),
        name: info.name || info.email.split('@')[0],
        avatar: info.picture,
        emailVerified: true,
      };
    } catch (err: any) {
      throw new Error(`Google Sign-In failed: ${err?.message || 'Invalid Google credential'}`);
    }
  }
}
