/**
 * Arcade Game Generator Plugin - Modern v4.3
 * 
 * Generates complete playable 2D arcade games using HTML5 Canvas
 * Automatically detects single-game or multi-game generation mode
 * 
 * Built with the universal template for consistency and performance
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../shared/types.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';
import { withSecurity } from '../../security/integration-helpers.js';
import { readFileContent } from '../shared/helpers.js';
import { 
  ModelSetup, 
  ResponseProcessor, 
  ParameterValidator, 
  ErrorHandler,
  MultiFileAnalysis
} from '../../utils/plugin-utilities.js';
import { getAnalysisCache } from '../../cache/index.js';

// Common Node.js modules - Use these instead of require()
import { basename, dirname, extname, join, relative } from 'path';
import { readFile, stat, readdir } from 'fs/promises';

export class ArcadeGameGenerator extends BasePlugin implements IPromptPlugin {
  name = 'arcade_game';
  category = 'generate' as const;
  description = 'Generate complete playable 2D arcade games using HTML5 Canvas with player controls, enemies, and game mechanics';
  
  // Universal parameter set - supports both single and multi-game scenarios
  parameters = {
    // Single-game parameters
    code: {
      type: 'string' as const,
      description: 'Existing game code to enhance (for single-game analysis)',
      required: false
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to existing game file to enhance',
      required: false
    },
    
    // Multi-game parameters  
    projectPath: {
      type: 'string' as const,
      description: 'Path to project root (for multi-game generation)',
      required: false
    },
    files: {
      type: 'array' as const,
      description: 'Array of specific game files (for multi-game analysis)',
      required: false,
      items: { type: 'string' as const }
    },
    maxDepth: {
      type: 'number' as const,
      description: 'Maximum directory depth for game file discovery (1-3)',
      required: false,
      default: 2
    },
    
    // Arcade game specific parameters
    gameType: {
      type: 'string' as const,
      description: 'Type of arcade game to generate',
      enum: ['shooter', 'platformer', 'puzzle', 'snake', 'breakout', 'asteroids', 'custom'],
      default: 'shooter',
      required: false
    },
    difficulty: {
      type: 'string' as const,
      description: 'Game difficulty level',
      enum: ['easy', 'medium', 'hard', 'adaptive'],
      default: 'medium',
      required: false
    },
    features: {
      type: 'array' as const,
      description: 'Game features to include',
      items: { type: 'string' as const },
      default: ['score', 'lives', 'powerups', 'sound'],
      required: false
    },
    theme: {
      type: 'string' as const,
      description: 'Visual theme for the game',
      enum: ['retro', 'neon', 'pixel', 'minimal', 'space', 'nature', 'custom'],
      default: 'retro',
      required: false
    },
    controls: {
      type: 'string' as const,
      description: 'Control scheme',
      enum: ['wasd', 'arrows', 'mouse', 'touch', 'hybrid'],
      default: 'hybrid',
      required: false
    },
    
    // Universal parameters
    language: {
      type: 'string' as const,
      description: 'Programming language',
      required: false,
      default: 'javascript'
    },
    analysisDepth: {
      type: 'string' as const,
      description: 'Level of game complexity',
      enum: ['basic', 'detailed', 'comprehensive'],
      default: 'detailed',
      required: false
    },
    analysisType: {
      type: 'string' as const,
      description: 'Type of game generation to perform',
      enum: ['prototype', 'polished', 'comprehensive'],
      default: 'comprehensive',
      required: false
    }
  };

  private analysisCache = getAnalysisCache();
  private multiFileAnalysis = new MultiFileAnalysis();

  constructor() {
    super();
    // Cache and analysis utilities are initialized above
  }

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      try {
        // 1. Auto-detect analysis mode based on parameters
        const analysisMode = this.detectAnalysisMode(secureParams);
        
        // 2. Validate parameters based on detected mode
        this.validateParameters(secureParams, analysisMode);
        
        // 3. Setup model
        const { model, contextLength } = await ModelSetup.getReadyModel(llmClient);
        
        // 4. Route to appropriate generation method
        if (analysisMode === 'single-file') {
          return await this.executeSingleGameGeneration(secureParams, model, contextLength);
        } else {
          return await this.executeMultiGameGeneration(secureParams, model, contextLength);
        }
        
      } catch (error: any) {
        return ErrorHandler.createExecutionError('arcade_game', error);
      }
    });
  }

  /**
   * Auto-detect whether this is single-game or multi-game generation
   * 
   * For arcade games, single-game is the primary use case
   * Multi-game mode used for generating game collections or enhancing existing projects
   */
  private detectAnalysisMode(params: any): 'single-file' | 'multi-file' {
    // Single-file indicators take priority (avoids default parameter issues)
    if (params.code || params.filePath) {
      return 'single-file';
    }
    
    // Multi-file indicators (game collections, project enhancement)
    if (params.projectPath || params.files) {
      return 'multi-file';
    }
    
    // Default to single-file for arcade game generation (game-focused)
    return 'single-file';
  }

  /**
   * Validate parameters based on detected analysis mode
   */
  private validateParameters(params: any, mode: 'single-file' | 'multi-file'): void {
    if (mode === 'single-file') {
      // Single-game generation doesn't require code/file - can generate from scratch
    } else {
      ParameterValidator.validateProjectPath(params);
      ParameterValidator.validateDepth(params);
    }
    
    // Universal validations
    ParameterValidator.validateEnum(params, 'analysisType', ['prototype', 'polished', 'comprehensive']);
    ParameterValidator.validateEnum(params, 'analysisDepth', ['basic', 'detailed', 'comprehensive']);
    ParameterValidator.validateEnum(params, 'gameType', ['shooter', 'platformer', 'puzzle', 'snake', 'breakout', 'asteroids', 'custom']);
  }

  /**
   * Execute single-game generation
   */
  private async executeSingleGameGeneration(params: any, model: any, contextLength: number) {
    // Process existing game input (if any)
    let existingGameCode = params.code;
    if (params.filePath) {
      existingGameCode = await readFileContent(params.filePath);
    }
    
    // Generate prompt stages for single game
    const promptStages = this.getSingleGamePromptStages({
      ...params,
      code: existingGameCode
    });
    
    // Execute with appropriate method
    const promptManager = new ThreeStagePromptManager(contextLength);
    const needsChunking = promptManager.needsChunking(promptStages);
    
    if (needsChunking) {
      const conversation = promptManager.createChunkedConversation(promptStages);
      const messages = [
        conversation.systemMessage,
        ...conversation.dataMessages,
        conversation.analysisMessage
      ];
      
      return await ResponseProcessor.executeChunked(
        messages,
        model,
        contextLength,
        'arcade_game',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'arcade_game'
      );
    }
  }

  /**
   * Execute multi-game generation
   */
  private async executeMultiGameGeneration(params: any, model: any, contextLength: number) {
    // Discover existing game files
    let filesToAnalyze: string[] = params.files || 
      await this.discoverRelevantFiles(
        params.projectPath, 
        params.maxDepth,
        params.analysisType
      );
    
    // Perform multi-game analysis with caching
    const analysisResult = await this.performMultiGameAnalysis(
      filesToAnalyze,
      params,
      model,
      contextLength
    );
    
    // Generate prompt stages for multi-game
    const promptStages = this.getMultiGamePromptStages({
      ...params,
      analysisResult,
      gameCount: filesToAnalyze.length
    });
    
    // Always use chunking for multi-game
    const promptManager = new ThreeStagePromptManager(contextLength);
    const conversation = promptManager.createChunkedConversation(promptStages);
    const messages = [
      conversation.systemMessage,
      ...conversation.dataMessages,
      conversation.analysisMessage
    ];
    
    return await ResponseProcessor.executeChunked(
      messages,
      model,
      contextLength,
      'arcade_game',
      'multifile'
    );
  }

  /**
   * Single-game prompt stages - Generate a complete playable arcade game
   */
  private getSingleGamePromptStages(params: any): PromptStages {
    const { gameType, difficulty, features, theme, controls, analysisDepth, analysisType, code } = params;
    
    const systemAndContext = `You are a legendary game developer and creative genius specializing in ${analysisDepth} ${analysisType} arcade game creation.

**Your Mission**: Create a complete, playable, and FUN ${gameType} arcade game that will immediately delight and engage players.

**Game Development Context:**
- Game Type: ${gameType}
- Difficulty: ${difficulty}
- Theme: ${theme}
- Controls: ${controls}
- Features: ${JSON.stringify(features)}
- Complexity: ${analysisDepth}
- Polish Level: ${analysisType}

**Your World-Class Expertise:**
- 20+ years creating addictive arcade games that players can't put down
- Master of HTML5 Canvas, game physics, and smooth 60fps gameplay
- Expert in player psychology - you know what makes games instantly fun
- Specialized in clean, readable code that's easy to understand and modify
- Pioneer of elegant game architectures with proper separation of concerns

**Game Development Philosophy:**
1. **Instant Fun** - Game should be enjoyable within 5 seconds of loading
2. **Progressive Challenge** - Start easy, gradually increase difficulty
3. **Juicy Feedback** - Visual and audio feedback for every player action
4. **Clean Architecture** - Organized code with clear game loop, entities, and systems
5. **Responsive Design** - Works perfectly on any screen size
6. **Educational Value** - Code should teach good game development practices

**Technical Requirements:**
- Pure HTML5 Canvas and JavaScript (no external dependencies)
- Smooth 60fps gameplay with proper game loop timing
- Responsive canvas that adapts to screen size
- Clean object-oriented design with Player, Enemy, and Game classes
- Collision detection system optimized for performance
- Particle effects for visual polish (explosions, trails, etc.)
- Score system with local storage persistence
- Professional code comments explaining game development concepts

**Creative Requirements:**
- Engaging visual style that matches the ${theme} theme
- Intuitive ${controls} controls that feel responsive
- Satisfying game mechanics that create flow state
- Progressive difficulty that keeps players engaged
- Polish details that make the game feel professional

Your task is to create a masterpiece arcade game that showcases both technical excellence and creative brilliance.`;

    const dataPayload = code ? `**Existing Game Code to Enhance:**

\`\`\`javascript
${code}
\`\`\`

**Enhancement Request:**
Please analyze the existing game and enhance it with the requested features while maintaining the core gameplay.` : 

`**New Game Generation Request:**
Create a brand new ${gameType} game from scratch with the specified parameters.

**Inspiration for ${gameType} games:**
${this.getGameTypeInspiration(gameType)}

**Theme Guidelines for ${theme}:**
${this.getThemeGuidelines(theme)}`;

    const outputInstructions = `**Generate a complete, playable arcade game as a single HTML file:**

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${gameType.charAt(0).toUpperCase() + gameType.slice(1)} Game</title>
    <style>
        /* Beautiful ${theme}-themed CSS styling */
        /* Responsive design that works on all screen sizes */
        /* Professional visual polish */
    </style>
</head>
<body>
    <canvas id="gameCanvas"></canvas>
    <script>
        // Complete, production-ready game code including:
        
        // 1. GAME CONFIGURATION
        const GAME_CONFIG = {
            // All game constants and settings
        };
        
        // 2. UTILITY FUNCTIONS
        class Vector2 {
            // 2D vector math for positions and movement
        }
        
        class Utils {
            // Collision detection, random generators, etc.
        }
        
        // 3. GAME ENTITIES
        class Player {
            // Player character with movement, animation, abilities
        }
        
        class Enemy {
            // Enemy AI, spawning, different types
        }
        
        class Projectile {
            // Bullets, missiles, etc. with physics
        }
        
        class Powerup {
            // Power-ups, collectibles, bonuses
        }
        
        class Particle {
            // Visual effects system for polish
        }
        
        // 4. GAME SYSTEMS
        class InputManager {
            // ${controls} input handling with smooth controls
        }
        
        class AudioManager {
            // Sound effects using Web Audio API (optional)
        }
        
        class ScoreManager {
            // Scoring, high scores, local storage
        }
        
        // 5. MAIN GAME CLASS
        class Game {
            constructor() {
                // Initialize game systems
            }
            
            init() {
                // Setup canvas, event listeners, initial state
            }
            
            gameLoop() {
                // Main 60fps game loop
                this.update();
                this.render();
                requestAnimationFrame(() => this.gameLoop());
            }
            
            update() {
                // Update all game entities and systems
            }
            
            render() {
                // Draw everything to canvas
            }
            
            // Additional game state methods (start, pause, gameOver, etc.)
        }
        
        // 6. GAME INITIALIZATION
        const game = new Game();
        game.init();
        game.gameLoop();
    </script>
</body>
</html>
\`\`\`

**Critical Requirements:**
✅ Complete, runnable HTML file - no external dependencies
✅ Smooth 60fps gameplay with proper timing
✅ Responsive design that works on any screen size  
✅ Professional code organization with clear separation of concerns
✅ Engaging ${gameType} gameplay that's immediately fun
✅ Beautiful ${theme} visual style with polished UI
✅ Intuitive ${controls} controls that feel responsive
✅ All requested features: ${JSON.stringify(features)}
✅ Educational code comments explaining game development concepts
✅ Ready to copy-paste and play immediately

**Visual Polish Standards:**
- Smooth animations and transitions
- Particle effects for explosions, collection, etc.
- Screen shake for impact feedback
- Color-coded UI elements for clarity
- Professional typography and layout
- Visual feedback for all player actions

**Code Quality Standards:**
- Clean, readable, well-documented code
- Proper object-oriented design patterns
- Performance optimizations for smooth gameplay
- Error handling and edge case management
- Easy to understand and modify for learning

Create an arcade game that players will love and developers will learn from!`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Multi-game prompt stages - Generate game collections or enhance projects
   */
  private getMultiGamePromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, gameCount, gameType, theme } = params;
    
    const systemAndContext = `You are a master game designer and technical architect specializing in ${analysisDepth} ${analysisType} game collection development.

**Your Mission**: Create a comprehensive game collection or enhance an existing game project with multiple interconnected games.

**Collection Development Context:**
- Collection Type: ${analysisType}
- Collection Depth: ${analysisDepth}  
- Games in Collection: ${gameCount}
- Primary Game Type: ${gameType}
- Unifying Theme: ${theme}
- Mode: Multi-Game Collection Development

**Your Elite Expertise:**
- 20+ years architecting game collections and interactive experiences
- Expert in creating cohesive game ecosystems with shared systems
- Master of scalable game architectures and reusable components
- Specialized in player progression across multiple game experiences
- Pioneer of elegant multi-game frameworks with shared resources

**Collection Architecture Philosophy:**
1. **Shared Foundation** - Common systems across all games (input, audio, graphics)
2. **Progressive Complexity** - Games build on each other's mechanics
3. **Unified Experience** - Consistent visual style and interaction patterns
4. **Modular Design** - Easy to add new games to the collection
5. **Player Journey** - Meaningful progression and unlocks across games
6. **Technical Excellence** - Optimized performance and clean architecture

Your task is to create a masterful game collection that showcases both individual game brilliance and cohesive ecosystem design.`;

    const dataPayload = `**Game Collection Analysis Results:**

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `**Generate a comprehensive multi-game collection as multiple coordinated files:**

\`\`\`
// File Structure:
index.html              // Main game collection launcher
shared/
  game-engine.js        // Shared game engine and utilities
  ui-framework.js       // Common UI components
  asset-manager.js      // Resource loading and management
  audio-system.js       // Unified audio management
games/
  ${gameType}-1.js      // Individual game modules
  ${gameType}-2.js      // Each game as a separate module
  ${gameType}-3.js      // Following consistent architecture
styles/
  collection.css        // Unified ${theme} styling
  responsive.css        // Mobile-friendly design
\`\`\`

**Collection Features:**
- **Game Launcher**: Beautiful menu system for selecting games
- **Shared Progress**: Unified scoring and achievement system
- **Consistent UX**: Same controls and UI patterns across games
- **Progressive Unlocks**: Games unlock as players progress
- **Leaderboards**: Competition across the entire collection
- **Modular Architecture**: Easy to add new games to the collection
- **Professional Polish**: Cohesive ${theme} visual identity

**Technical Architecture:**
- Shared game engine with common systems (physics, rendering, input)
- Plugin-style game modules that extend the base engine
- Event-driven communication between games and shared systems
- Optimized asset loading and caching across games
- Responsive design that works on all devices
- Clean separation between engine, games, and presentation

**Individual Game Quality:**
Each game in the collection must be:
✅ Complete and immediately playable
✅ Built on the shared architecture
✅ Following the unified ${theme} visual style
✅ Demonstrating unique gameplay mechanics
✅ Connected to the collection's progression system

Create a game collection that demonstrates mastery of both individual game design and ecosystem architecture!`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Backwards compatibility method - routes to appropriate stages
   */
  getPromptStages(params: any): PromptStages {
    const mode = this.detectAnalysisMode(params);
    
    if (mode === 'single-file') {
      return this.getSingleGamePromptStages(params);
    } else {
      return this.getMultiGamePromptStages(params);
    }
  }

  // Multi-game helper methods
  private async discoverRelevantFiles(
    projectPath: string, 
    maxDepth: number,
    analysisType: string
  ): Promise<string[]> {
    const extensions = this.getFileExtensions(analysisType);
    return await this.multiFileAnalysis.discoverFiles(projectPath, extensions, maxDepth);
  }

  private async performMultiGameAnalysis(
    files: string[],
    params: any,
    model: any,
    contextLength: number
  ): Promise<any> {
    const cacheKey = this.analysisCache.generateKey(
      'arcade_game', 
      params, 
      files
    );
    
    const cached = await this.analysisCache.get(cacheKey);
    if (cached) return cached;
    
    const gameAnalysisResults = await this.multiFileAnalysis.analyzeBatch(
      files,
      (file: string) => this.analyzeGameFile(file, params, model),
      contextLength
    );
    
    // Aggregate results into game collection analysis
    const aggregatedResult = {
      summary: `Game collection analysis of ${files.length} game files`,
      findings: gameAnalysisResults,
      data: {
        gameCount: files.length,
        totalGameSize: gameAnalysisResults.reduce((sum: number, result: any) => sum + (result.size || 0), 0),
        gameTypes: this.identifyGameTypes(gameAnalysisResults),
        sharedSystems: this.identifySharedSystems(gameAnalysisResults),
        collectionTheme: params.theme || 'retro',
        analysisTimestamp: new Date().toISOString()
      }
    };
    
    await this.analysisCache.cacheAnalysis(cacheKey, aggregatedResult, {
      modelUsed: model.identifier || 'unknown',
      executionTime: Date.now() - Date.now(), // TODO: Track actual execution time
      timestamp: new Date().toISOString()
    });
    
    return aggregatedResult;
  }

  private async analyzeGameFile(file: string, params: any, model: any): Promise<any> {
    const content = await readFile(file, 'utf-8');
    const stats = await stat(file);
    
    return {
      filePath: file,
      fileName: basename(file),
      size: content.length,
      lines: content.split('\n').length,
      extension: extname(file),
      relativePath: relative(params.projectPath || '', file),
      lastModified: stats.mtime.toISOString(),
      hasCanvas: /canvas|ctx|getContext/i.test(content),
      hasGameLoop: /requestAnimationFrame|setInterval|gameLoop/i.test(content),
      hasPlayer: /player|character|avatar/i.test(content),
      hasEnemies: /enemy|enemies|monster|opponent/i.test(content),
      gameType: this.detectGameType(content),
      isPlayable: this.isPlayableGame(content)
    };
  }

  private identifyGameTypes(results: any[]): string[] {
    const types = new Set<string>();
    results.forEach(result => {
      if (result.gameType) {
        types.add(result.gameType);
      }
    });
    return Array.from(types);
  }

  private identifySharedSystems(results: any[]): string[] {
    const systems: string[] = [];
    const hasCanvas = results.some(r => r.hasCanvas);
    const hasGameLoop = results.some(r => r.hasGameLoop);
    
    if (hasCanvas) systems.push('Canvas Rendering System');
    if (hasGameLoop) systems.push('Game Loop Framework');
    
    return systems;
  }

  private detectGameType(content: string): string {
    if (/shoot|bullet|projectile/i.test(content)) return 'shooter';
    if (/jump|platform|gravity/i.test(content)) return 'platformer';
    if (/puzzle|match|tile/i.test(content)) return 'puzzle';
    if (/snake|grow|segment/i.test(content)) return 'snake';
    if (/brick|paddle|ball|breakout/i.test(content)) return 'breakout';
    if (/asteroid|space|ship/i.test(content)) return 'asteroids';
    return 'arcade';
  }

  private isPlayableGame(content: string): boolean {
    return content.includes('canvas') && 
           content.includes('gameLoop') && 
           (content.includes('player') || content.includes('character'));
  }

  private getGameTypeInspiration(gameType: string): string {
    const inspirations: Record<string, string> = {
      'shooter': 'Classic space invaders, bullet hell mechanics, power-ups, wave-based enemies',
      'platformer': 'Super Mario-style jumping, moving platforms, collectibles, level progression',
      'puzzle': 'Tetris-like block manipulation, match-3 mechanics, spatial reasoning challenges',
      'snake': 'Classic snake growth mechanics, food collection, increasingly difficult navigation',
      'breakout': 'Paddle and ball physics, brick destruction, power-up variety, level design',
      'asteroids': 'Space ship movement, rotating controls, asteroid destruction, wrap-around edges',
      'custom': 'Unique game mechanics that combine elements from multiple genres'
    };
    
    return inspirations[gameType] || inspirations.custom;
  }

  private getThemeGuidelines(theme: string): string {
    const themes: Record<string, string> = {
      'retro': '8-bit pixel art style, classic arcade colors (neon green, bright blue, orange), chunky fonts',
      'neon': 'Glowing effects, dark backgrounds, electric blues and magentas, cyberpunk aesthetic',
      'pixel': 'Crisp pixel art, limited color palettes, authentic retro game feel, blocky sprites',
      'minimal': 'Clean lines, simple shapes, monochromatic or limited colors, elegant simplicity',
      'space': 'Stars, galaxies, metallic surfaces, deep space blues and purples, sci-fi elements',
      'nature': 'Earth tones, organic shapes, forest greens and sky blues, natural textures',
      'custom': 'Unique visual style that fits the specific game concept and target audience'
    };
    
    return themes[theme] || themes.custom;
  }

  private getFileExtensions(analysisType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'prototype': ['.html', '.js', '.css'],
      'polished': ['.html', '.js', '.css', '.json', '.png', '.wav'],
      'comprehensive': ['.html', '.js', '.css', '.json', '.png', '.jpg', '.svg', '.wav', '.mp3']
    };
    
    return extensionMap[analysisType] || extensionMap.comprehensive;
  }

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default ArcadeGameGenerator;
