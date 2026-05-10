/**
 * Feishu Authentication Manager
 * 
 * Handles lark-cli authentication and token management:
 * - App credentials configuration
 * - User/Bot identity switching
 * - Token refresh
 * - Scope management
 */

const { execSync, spawn } = require('child_process');

class FeishuAuth {
  constructor(config = {}) {
    this.config = {
      appId: process.env.FEISHU_APP_ID || '',
      appSecret: process.env.FEISHU_APP_SECRET || '',
      cliPath: 'lark-cli',
      ...config
    };

    this.currentIdentity = 'auto';
    this.tokenCache = new Map();
  }

  async init() {
    // Check if lark-cli is installed
    if (!this.isCLIInstalled()) {
      throw new Error(
        'lark-cli not found. Please install it first: ' +
        'npm install -g @larksuite/cli'
      );
    }

    // Check if configured
    if (!this.config.appId || !this.config.appSecret) {
      console.warn('[FeishuAuth] App credentials not configured, running in limited mode');
    }

    return { status: 'ready' };
  }

  isCLIInstalled() {
    try {
      execSync(`${this.config.cliPath} --version`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  async getVersion() {
    try {
      const output = execSync(`${this.config.cliPath} --version`, { encoding: 'utf8' });
      return output.trim();
    } catch (error) {
      throw new Error(`Failed to get CLI version: ${error.message}`);
    }
  }

  async login(options = {}) {
    const {
      recommend = true,
      domain = null,
      wait = true,
      timeout = 300000 // 5 minutes
    } = options;

    let command = `${this.config.cliPath} auth login`;

    if (recommend) {
      command += ' --recommend';
    }
    if (domain) {
      command += ` --domain ${domain}`;
    }
    if (!wait) {
      command += ' --no-wait';
    }

    try {
      const output = execSync(command, { encoding: 'utf8', timeout });
      return { success: true, output };
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async getStatus() {
    try {
      const output = execSync(`${this.config.cliPath} auth status --format json`, {
        encoding: 'utf8'
      });
      return JSON.parse(output);
    } catch (error) {
      throw new Error(`Failed to get auth status: ${error.message}`);
    }
  }

  async switchIdentity(identity) {
    if (!['user', 'bot', 'auto'].includes(identity)) {
      throw new Error('Invalid identity. Must be: user, bot, or auto');
    }

    this.currentIdentity = identity;
    return { identity: this.currentIdentity };
  }

  getCurrentIdentity() {
    return this.currentIdentity;
  }

  async getAvailableScopes() {
    try {
      const output = execSync(`${this.config.cliPath} auth scopes --format json`, {
        encoding: 'utf8'
      });
      return JSON.parse(output);
    } catch (error) {
      throw new Error(`Failed to get scopes: ${error.message}`);
    }
  }

  async doctor() {
    try {
      const output = execSync(`${this.config.cliPath} doctor --format json`, {
        encoding: 'utf8'
      });
      return JSON.parse(output);
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async configInit(options = {}) {
    const { newApp = false, noWait = false } = options;

    let command = `${this.config.cliPath} config init`;
    if (newApp) {
      command += ' --new';
    }
    if (noWait) {
      command += ' --no-wait';
    }

    return new Promise((resolve, reject) => {
      const proc = spawn(command, { shell: true, stdio: 'pipe' });
      let output = '';
      let authUrl = null;

      proc.stdout.on('data', (data) => {
        output += data.toString();
        // Extract authorization URL if present
        const urlMatch = data.toString().match(/https?:\/\/[^\s]+/);
        if (urlMatch && !authUrl) {
          authUrl = urlMatch[0];
        }
      });

      proc.stderr.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output, authUrl });
        } else {
          reject(new Error(`Config init failed with code ${code}: ${output}`));
        }
      });

      // If noWait, return early with auth URL if found
      if (noWait && authUrl) {
        setTimeout(() => resolve({ success: true, authUrl, waiting: true }), 1000);
      }
    });
  }

  async getAppInfo() {
    try {
      const output = execSync(`${this.config.cliPath} config show --format json`, {
        encoding: 'utf8'
      });
      return JSON.parse(output);
    } catch (error) {
      throw new Error(`Failed to get app info: ${error.message}`);
    }
  }

  // Helper for building commands with identity
  wrapCommand(command, identity = null) {
    const id = identity || this.currentIdentity;
    if (id && id !== 'auto') {
      return `${command} --as ${id}`;
    }
    return command;
  }

  // Health check for Feishu integration
  async healthCheck() {
    const checks = {
      cliInstalled: this.isCLIInstalled(),
      cliVersion: null,
      authStatus: null,
      scopesAvailable: null
    };

    try {
      checks.cliVersion = await this.getVersion();
    } catch (e) {
      checks.cliVersion = `Error: ${e.message}`;
    }

    try {
      checks.authStatus = await this.getStatus();
    } catch (e) {
      checks.authStatus = `Error: ${e.message}`;
    }

    try {
      checks.scopesAvailable = await this.getAvailableScopes();
    } catch (e) {
      checks.scopesAvailable = `Error: ${e.message}`;
    }

    const healthy = checks.cliInstalled && 
      typeof checks.authStatus === 'object' && 
      checks.authStatus.authenticated;

    return {
      healthy,
      checks,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { FeishuAuth };
