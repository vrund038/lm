# Getting Started Guide - From Zero to Working Local LLM MCP

This guide takes you from nothing installed to a fully working Local LLM MCP setup with Claude Desktop.

## Table of Contents
1. [System Requirements](#system-requirements)
2. [Step 1: Install LM Studio](#step-1-install-lm-studio)
3. [Step 2: Download and Load a Model](#step-2-download-and-load-a-model)
4. [Step 3: Install Node.js](#step-3-install-nodejs)
5. [Step 4: Set Up Local LLM MCP](#step-4-set-up-local-llm-mcp)
6. [Step 5: Configure Claude Desktop](#step-5-configure-claude-desktop)
7. [Step 6: Test Everything Works](#step-6-test-everything-works)
8. [Troubleshooting](#troubleshooting)

## System Requirements

### Minimum Requirements
- **RAM**: 8GB (16GB recommended)
- **Storage**: 10GB free space for models
- **OS**: Windows 10/11, macOS 10.15+, or Linux
- **CPU**: 4 cores (8 cores recommended)

### GPU (Optional but Recommended)
- NVIDIA GPU with 6GB+ VRAM for faster processing
- CUDA support improves performance significantly

## Step 1: Install LM Studio

### 1.1 Download LM Studio

1. Visit [https://lmstudio.ai](https://lmstudio.ai)
2. Click "Download" and select your operating system
3. Run the installer:
   - **Windows**: Run the `.exe` file
   - **macOS**: Open the `.dmg` file and drag to Applications
   - **Linux**: Extract and run the AppImage

### 1.2 First Launch

1. Open LM Studio
2. You'll see the main interface with:
   - Model browser on the left
   - Chat interface in the center
   - Server controls at the bottom

## Step 2: Download and Load a Model

### 2.1 Choose a Model

For beginners, I recommend starting with **Qwen 2.5 Coder 7B**:

1. Click the **"Browse"** tab in LM Studio
2. In the search bar, type: `qwen 2.5 coder`
3. Look for `Qwen2.5-Coder-7B-Instruct-GGUF`
4. Choose a quantisation:
   - **Q4_K_M** (4.3GB) - Good balance of size and quality
   - **Q5_K_M** (5.2GB) - Better quality, needs more RAM
   - **Q8_0** (7.7GB) - Best quality, needs 16GB+ RAM

### 2.2 Download the Model

1. Click the **download** button next to your chosen quantisation
2. Wait for download (this may take 10-30 minutes)
3. You'll see a progress bar at the bottom

### 2.3 Load the Model

1. Once downloaded, go to the **"Local Server"** tab
2. Click **"Select a model to load"**
3. Choose the model you just downloaded
4. Click **"Load"**
5. Wait for loading (30 seconds to 2 minutes)

### 2.4 Start the Server

1. In the Local Server tab, you should see:
   ```
   Model loaded successfully
   Server Address: http://localhost:1234
   ```
2. Click **"Start Server"** if not already started
3. You should see: `Server is running`

## Step 3: Install Node.js

### 3.1 Download Node.js

1. Visit [https://nodejs.org](https://nodejs.org)
2. Download the **LTS version** (should be 18.x or higher)
3. Run the installer with default settings

### 3.2 Verify Installation

Open Command Prompt (Windows) or Terminal (Mac/Linux):

```bash
node --version
# Should show: v18.x.x or higher

npm --version
# Should show: 9.x.x or higher
```

## Step 4: Set Up Local LLM MCP

### 4.1 Create MCP Directory

```bash
# Windows
mkdir C:\MCP
cd C:\MCP

# Mac/Linux
mkdir ~/MCP
cd ~/MCP
```

### 4.2 Download Local LLM MCP

Option A - Using Git:
```bash
git clone https://github.com/richardbaxterseo/local-llm-mcp.git
cd local-llm-mcp
```

Option B - Download ZIP:
1. Visit https://github.com/richardbaxterseo/local-llm-mcp
2. Click "Code" → "Download ZIP"
3. Extract to `C:\MCP\local-llm-mcp`

### 4.3 Install Dependencies

```bash
cd local-llm-mcp
npm install
```

You should see output like:
```
added 23 packages, and audited 24 packages in 5s
found 0 vulnerabilities
```

### 4.4 Build the Project

```bash
npm run build
```

You should see:
```
> @mcp/local-llm-server@2.0.0 build
> tsc

# No errors means success!
```

## Step 5: Configure Claude Desktop

### 5.1 Find Configuration File

The location depends on your OS:

**Windows:**
```
C:\Users\[YourUsername]\AppData\Roaming\Claude\claude_desktop_config.json
```

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

### 5.2 Edit Configuration

1. Open the file in a text editor (Notepad, TextEdit, etc.)
2. Add the local-llm configuration:

```json
{
  "mcpServers": {
    "local-llm": {
      "command": "node",
      "args": ["C:\\MCP\\local-llm-mcp\\dist\\index.js"]
    }
  }
}
```

**For Mac/Linux**, use forward slashes:
```json
{
  "mcpServers": {
    "local-llm": {
      "command": "node",
      "args": ["/Users/[YourUsername]/MCP/local-llm-mcp/dist/index.js"]
    }
  }
}
```

### 5.3 Save and Restart Claude

1. Save the configuration file
2. Completely quit Claude Desktop
3. Start Claude Desktop again

## Step 6: Test Everything Works

### 6.1 Check LM Studio

1. LM Studio should show:
   - Model loaded
   - Server running on `http://localhost:1234`

### 6.2 Test in Claude

Type this in Claude:
```
Can you check if the local LLM is working?
```

Claude should use the `health_check` tool and respond with something like:
```
✓ LM Studio is running
✓ Model loaded: qwen2.5-coder-7b-instruct
✓ Server URL: ws://localhost:1234
```

### 6.3 Test Code Analysis

Create a test file `C:\test.js`:
```javascript
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

Then ask Claude:
```
Can you analyse the code structure in C:\test.js?
```

You should see Claude using the `analyze_code_structure` tool and providing analysis.

## Troubleshooting

### "LM Studio is not running"

1. Check LM Studio is open
2. Check a model is loaded
3. Check server is started
4. Try restarting LM Studio

### "Command not found: node"

1. Reinstall Node.js
2. Restart your computer
3. Check PATH environment variable

### "Cannot find module"

1. Make sure you ran `npm install`
2. Make sure you ran `npm run build`
3. Check the path in claude_desktop_config.json

### "File not found" errors

1. Use absolute paths (C:\file.txt not just file.txt)
2. Check file permissions
3. Make sure file exists

### Claude doesn't show local-llm tools

1. Check claude_desktop_config.json syntax
2. Make sure you restarted Claude Desktop
3. Check for typos in the configuration

### Model runs slowly

1. Try a smaller quantisation (Q4_K_M instead of Q8_0)
2. Close other applications
3. Check CPU/RAM usage in Task Manager
4. Consider using GPU acceleration

## Next Steps

Now that everything is working:

1. **Try different models**: Experiment with CodeLlama, Mistral, or Phi-3
2. **Explore all tools**: Test unit test generation, documentation, etc.
3. **Process your files**: Analyse your own code projects
4. **Adjust settings**: Modify temperature and max tokens in config.ts

## Getting Help

- **LM Studio Help**: https://lmstudio.ai/docs
- **Local LLM MCP Issues**: https://github.com/richardbaxterseo/local-llm-mcp/issues
- **Claude Desktop Help**: https://support.anthropic.com

---

Congratulations! You now have a working Local LLM MCP setup that will save you thousands of tokens when working with Claude.