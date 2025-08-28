// TokenManager.js
class TokenManager {
  constructor(secret) {
    this.secret = secret;
    this.tokens = new Map();
  }

  generateToken(userId) {
    // Simplified token generation
    const token = `token_${userId}_${Date.now()}_${Math.random()}`;
    this.tokens.set(token, {
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    });
    return token;
  }

  verifyToken(token) {
    const tokenData = this.tokens.get(token);
    if (!tokenData) {
      return null;
    }
    
    if (Date.now() > tokenData.expiresAt) {
      this.tokens.delete(token);
      return null;
    }
    
    return tokenData.userId;
  }

  revokeToken(token) {
    return this.tokens.delete(token);
  }
}

module.exports = TokenManager;