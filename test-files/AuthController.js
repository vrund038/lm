// AuthController.js
const UserService = require('./UserService');
const TokenManager = require('./TokenManager');

class AuthController {
  constructor(userService, tokenManager) {
    this.userService = userService;
    this.tokenManager = tokenManager;
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;
      
      // Get user
      const user = await this.userService.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Verify password
      const isValid = await this.verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Generate token
      const token = this.tokenManager.generateToken(user.id);
      
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async register(req, res) {
    try {
      const userData = req.body;
      
      // Hash password
      userData.passwordHash = await this.hashPassword(userData.password);
      delete userData.password;
      
      // Create user
      const user = await this.userService.createUser(userData);
      
      // Generate token
      const token = this.tokenManager.generateToken(user.id);
      
      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
  
  async verifyPassword(password, hash) {
    // Simplified for testing
    return password === hash;
  }
  
  async hashPassword(password) {
    // Simplified for testing
    return password;
  }
}

module.exports = AuthController;