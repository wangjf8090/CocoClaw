/**
 * Authentication Middleware
 * Simple token-based authentication for the Gateway
 */

import { createHmac, randomBytes } from 'crypto';

export interface AuthContext {
  isAuthenticated: boolean;
  token?: string;
  clientId?: string;
}

export class AuthMiddleware {
  private authToken?: string;
  private activeTokens: Set<string> = new Set();

  constructor(authToken?: string) {
    this.authToken = authToken;
  }

  /**
   * Authenticate a connection request
   */
  authenticate(token?: string): AuthContext {
    // If no auth token configured, allow all connections
    if (!this.authToken) {
      return {
        isAuthenticated: true,
        clientId: this.generateClientId(),
      };
    }

    // Validate token
    if (token && this.verifyToken(token)) {
      this.activeTokens.add(token);
      return {
        isAuthenticated: true,
        token,
        clientId: this.generateClientId(),
      };
    }

    return {
      isAuthenticated: false,
    };
  }

  /**
   * Verify if token is valid
   */
  private verifyToken(token: string): boolean {
    return token === this.authToken;
  }

  /**
   * Generate a unique client ID
   */
  private generateClientId(): string {
    return `client_${randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate HMAC signature for message verification
   */
  signMessage(message: string, secret: string): string {
    return createHmac('sha256', secret).update(message).digest('hex');
  }

  /**
   * Verify message signature
   */
  verifySignature(message: string, signature: string, secret: string): boolean {
    const expected = this.signMessage(message, secret);
    return signature === expected;
  }

  /**
   * Logout a token
   */
  logout(token: string): void {
    this.activeTokens.delete(token);
  }
}
