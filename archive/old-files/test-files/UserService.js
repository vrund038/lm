// UserService.js
class UserService {
  constructor(database) {
    this.db = database;
    this.cache = new Map();
  }

  async getUser(userId) {
    // Check cache first
    if (this.cache.has(userId)) {
      return this.cache.get(userId);
    }
    
    // Fetch from database
    const user = await this.db.findUser(userId);
    if (user) {
      this.cache.set(userId, user);
    }
    return user;
  }

  async createUser(userData) {
    // Validate input
    if (!userData.email || !userData.name) {
      throw new Error('Email and name are required');
    }
    
    // Check for duplicate
    const existing = await this.db.findUserByEmail(userData.email);
    if (existing) {
      throw new Error('User already exists');
    }
    
    // Create user
    const user = await this.db.createUser(userData);
    this.cache.set(user.id, user);
    return user;
  }
}

module.exports = UserService;