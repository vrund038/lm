/**
 * Text Adventure Generator - Fun Plugin for Local LLM MCP
 * 
 * Creates complete interactive text adventure games with branching storylines,
 * inventory systems, character stats, and multiple endings.
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

// Common Node.js modules
import { basename, dirname, extname, join, relative } from 'path';
import { readFile, stat, readdir } from 'fs/promises';

export class TextAdventureGenerator extends BasePlugin implements IPromptPlugin {
  name = 'create_text_adventure';
  category = 'generate' as const;
  description = 'Generate complete interactive text adventure games with branching storylines, inventory systems, and multiple endings';
  
  parameters = {
    // Single-file parameters (for analyzing existing adventures)
    code: {
      type: 'string' as const,
      description: 'Existing adventure code to enhance (for single-file analysis)',
      required: false
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to existing adventure file to enhance',
      required: false
    },
    
    // Multi-file parameters (for generating complete adventure projects)
    projectPath: {
      type: 'string' as const,
      description: 'Path to project root where adventure will be created',
      required: false
    },
    files: {
      type: 'array' as const,
      description: 'Array of specific adventure files to analyze/enhance',
      required: false,
      items: { type: 'string' as const }
    },
    maxDepth: {
      type: 'number' as const,
      description: 'Maximum directory depth for adventure file discovery (1-5)',
      required: false,
      default: 3
    },
    
    // Adventure-specific parameters
    theme: {
      type: 'string' as const,
      description: 'Adventure theme',
      enum: ['fantasy', 'sci-fi', 'mystery', 'horror', 'historical', 'modern', 'steampunk', 'cyberpunk'],
      default: 'fantasy',
      required: false
    },
    complexity: {
      type: 'string' as const,
      description: 'Adventure complexity level',
      enum: ['simple', 'intermediate', 'advanced'],
      default: 'intermediate',
      required: false
    },
    length: {
      type: 'string' as const,
      description: 'Expected adventure length',
      enum: ['short', 'medium', 'long', 'epic'],
      default: 'medium',
      required: false
    },
    features: {
      type: 'array' as const,
      description: 'Adventure features to include',
      items: { type: 'string' as const },
      default: ['inventory', 'stats', 'save_game', 'multiple_endings'],
      required: false
    },
    playerClass: {
      type: 'string' as const,
      description: 'Player character class/type',
      enum: ['warrior', 'mage', 'rogue', 'ranger', 'detective', 'scientist', 'explorer', 'custom'],
      default: 'custom',
      required: false
    }
  };

  private analysisCache = getAnalysisCache();
  private multiFileAnalysis = new MultiFileAnalysis();

  constructor() {
    super();
  }

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      try {
        // Auto-detect analysis mode
        const analysisMode = this.detectAnalysisMode(secureParams);
        
        // Validate parameters
        this.validateParameters(secureParams, analysisMode);
        
        // Setup model
        const { model, contextLength } = await ModelSetup.getReadyModel(llmClient);
        
        // Route to appropriate generation method
        if (analysisMode === 'single-file') {
          return await this.executeSingleFileGeneration(secureParams, model, contextLength);
        } else {
          return await this.executeMultiFileGeneration(secureParams, model, contextLength);
        }
        
      } catch (error: any) {
        return ErrorHandler.createExecutionError('create_text_adventure', error);
      }
    });
  }

  private detectAnalysisMode(params: any): 'single-file' | 'multi-file' {
    // Single-file: enhancing existing adventure
    if (params.code || params.filePath) {
      return 'single-file';
    }
    
    // Multi-file: creating new adventure project
    if (params.projectPath || params.files) {
      return 'multi-file';
    }
    
    // Default for text adventures: multi-file project generation
    return 'multi-file';
  }

  private validateParameters(params: any, mode: 'single-file' | 'multi-file'): void {
    if (mode === 'single-file') {
      ParameterValidator.validateCodeOrFile(params);
    } else {
      ParameterValidator.validateProjectPath(params);
    }
    
    // Adventure-specific validations
    ParameterValidator.validateEnum(params, 'theme', ['fantasy', 'sci-fi', 'mystery', 'horror', 'historical', 'modern', 'steampunk', 'cyberpunk']);
    ParameterValidator.validateEnum(params, 'complexity', ['simple', 'intermediate', 'advanced']);
    ParameterValidator.validateEnum(params, 'length', ['short', 'medium', 'long', 'epic']);
    ParameterValidator.validateEnum(params, 'playerClass', ['warrior', 'mage', 'rogue', 'ranger', 'detective', 'scientist', 'explorer', 'custom']);
  }

  private async executeSingleFileGeneration(params: any, model: any, contextLength: number) {
    // Process existing adventure code
    let adventureCode = params.code;
    if (params.filePath) {
      adventureCode = await readFileContent(params.filePath);
    }
    
    // Generate enhancement prompt
    const promptStages = this.getSingleFilePromptStages({
      ...params,
      code: adventureCode
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
        'create_text_adventure',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'create_text_adventure'
      );
    }
  }

  private async executeMultiFileGeneration(params: any, model: any, contextLength: number) {
    // For new adventure generation, we create the complete project
    const promptStages = this.getMultiFilePromptStages(params);
    
    // Always use chunking for complete adventure generation
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
      'create_text_adventure',
      'multifile'
    );
  }

  private getSingleFilePromptStages(params: any): PromptStages {
    const { code, theme, complexity, length, features, playerClass } = params;
    
    const systemAndContext = `You are a master game designer and interactive fiction writer with 20+ years of experience creating engaging text adventures. You specialize in narrative design, player engagement, and technical implementation of interactive storytelling systems.

**Your Mission**: Enhance and expand the existing text adventure code to create a more engaging, feature-rich experience.

**Your Expertise**:
- Interactive fiction design and narrative structure
- Player choice consequences and branching storylines  
- Game mechanics integration (inventory, stats, combat)
- Technical implementation of text-based game systems
- User experience optimization for text adventures

**Enhancement Context**:
- Theme: ${theme}
- Complexity: ${complexity}
- Target Length: ${length}
- Features: ${features.join(', ')}
- Player Class: ${playerClass}

**Enhancement Approach**:
1. Analyze existing adventure structure and identify expansion opportunities
2. Enhance narrative depth and player choice consequences
3. Improve game mechanics and feature integration
4. Optimize user interface and experience
5. Add replayability elements and multiple story paths`;

    const dataPayload = `Existing adventure code to enhance:

\`\`\`javascript
${code}
\`\`\``;

    const outputInstructions = `Provide your enhanced text adventure as complete, working code with the following structure:

**Return the enhanced code in this format:**

\`\`\`javascript
// Enhanced adventure code here
\`\`\`

**Requirements for Enhancement:**
- Expand narrative depth with richer descriptions and character development
- Add new story branches and meaningful player choices
- Implement requested features: ${features.join(', ')}
- Improve game mechanics and user interface
- Add multiple endings based on player choices
- Include save/load functionality if requested
- Optimize code structure and readability

**Technical Standards:**
- Clean, modular JavaScript code
- Comprehensive error handling
- Intuitive user interface
- Mobile-friendly design
- Local storage for save games
- Proper game state management

Focus on creating an enhanced adventure that's significantly more engaging than the original while maintaining technical excellence.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  private getMultiFilePromptStages(params: any): PromptStages {
    const { theme, complexity, length, features, playerClass } = params;
    
    const systemAndContext = `You are a master game designer and interactive fiction writer with 20+ years of experience creating captivating text adventures. You specialize in complete game architecture, narrative design, and creating immersive interactive experiences.

**Your Mission**: Create a complete, professional-quality text adventure game from scratch.

**Your Expertise**:
- Interactive fiction architecture and game engine design
- Compelling narrative structure with branching storylines
- Advanced game mechanics (inventory, combat, character progression)
- Professional web development for gaming applications
- User experience design for text-based adventures
- Replayability and engagement optimization

**Adventure Specifications**:
- Theme: ${theme}
- Complexity Level: ${complexity}
- Expected Length: ${length}
- Features: ${features.join(', ')}
- Player Class: ${playerClass}

**Game Architecture Approach**:
1. Design modular game engine with extensible components
2. Create rich, atmospheric narrative with meaningful choices
3. Implement sophisticated game mechanics and systems
4. Build intuitive, responsive user interface
5. Include multiple story paths and endings for replayability
6. Ensure professional code quality and structure

**Quality Standards**:
- Professional game architecture with clean separation of concerns
- Engaging storytelling with character development and world-building
- Sophisticated game mechanics appropriate for the complexity level
- Modern web technologies with responsive design
- Comprehensive save/load system and game state management
- Multiple difficulty levels and replayability features`;

    const dataPayload = `Adventure Generation Requirements:

**Theme**: ${theme}
**Complexity**: ${complexity} 
**Length**: ${length}
**Features**: ${features.join(', ')}
**Player Class**: ${playerClass}

**Expected Output**: Complete, multi-file text adventure game project

**Feature Details**:
${this.getFeatureDescriptions(features).map(f => `- ${f}`).join('\n')}

**Complexity Guidelines**:
${this.getComplexityGuidelines(complexity)}

**Length Specifications**:
${this.getLengthSpecifications(length)}`;

    const outputInstructions = `Create a complete text adventure game with the following file structure:

**File Structure Required:**
1. **index.html** - Main game interface with modern styling
2. **game-engine.js** - Core game engine and state management
3. **story-data.js** - All story content, choices, and narrative text
4. **game-mechanics.js** - Inventory, combat, stats, and game systems
5. **ui-manager.js** - User interface management and interactions
6. **save-system.js** - Save/load functionality and persistence
7. **styles.css** - Professional styling with theme-appropriate design

**Output Format:**
For each file, provide:

\`\`\`
// File: [filename]
[complete file content]
\`\`\`

**Technical Requirements:**
- Modern, clean JavaScript with ES6+ features
- Responsive CSS design that works on mobile and desktop
- Comprehensive error handling and edge case management
- Modular architecture for easy expansion
- Local storage save system with multiple save slots
- Professional UI/UX with smooth transitions and feedback
- Accessibility features (keyboard navigation, screen reader support)

**Game Content Requirements:**
- Rich, immersive storyline appropriate for ${theme} theme
- At least ${this.getMinimumScenes(length)} unique scenes/locations
- Multiple story paths leading to different outcomes
- Character development and meaningful player choices
- Atmospheric descriptions and engaging dialogue
- ${this.getMinimumEndings(complexity)} distinct endings based on player choices

**Quality Assurance:**
- All code must be production-ready and fully functional
- Include comprehensive comments and documentation
- Implement proper game state validation
- Handle all user input edge cases gracefully
- Provide clear instructions for players

Create an adventure that demonstrates professional game development standards while delivering an engaging, memorable interactive experience.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  // Backwards compatibility
  getPromptStages(params: any): PromptStages {
    const mode = this.detectAnalysisMode(params);
    
    if (mode === 'single-file') {
      return this.getSingleFilePromptStages(params);
    } else {
      return this.getMultiFilePromptStages(params);
    }
  }

  // Helper methods for adventure generation
  private getFeatureDescriptions(features: string[]): string[] {
    const featureMap: Record<string, string> = {
      'inventory': 'Advanced inventory system with item interactions and combinations',
      'stats': 'Character statistics (health, strength, intelligence, etc.) affecting gameplay',
      'save_game': 'Multiple save slot system with game state persistence',
      'multiple_endings': 'At least 3-5 different endings based on player choices and actions',
      'combat': 'Turn-based or choice-based combat system with strategic elements',
      'puzzles': 'Logic puzzles and riddles integrated into the narrative',
      'character_creation': 'Detailed character creation affecting story and gameplay',
      'dialogue_trees': 'Complex conversation systems with relationship impacts',
      'time_system': 'Day/night cycle or time progression affecting story events',
      'reputation': 'Reputation system tracking player actions and NPC relationships'
    };
    
    return features.map(f => featureMap[f] || `${f} system integration`);
  }

  private getComplexityGuidelines(complexity: string): string {
    const guidelines: Record<string, string> = {
      'simple': '- Linear story with 2-3 major choice points\n- Basic inventory (5-10 items)\n- Simple text interface\n- 2-3 possible endings',
      'intermediate': '- Branching narrative with multiple story paths\n- Full inventory and stats system\n- Enhanced UI with images/styling\n- 4-6 different endings\n- Character progression elements',
      'advanced': '- Complex multi-layered narrative with consequences\n- Sophisticated game mechanics and systems\n- Professional-grade UI and animations\n- 6+ unique endings with variations\n- Advanced features like crafting, relationships, or time mechanics'
    };
    
    return guidelines[complexity] || guidelines.intermediate;
  }

  private getLengthSpecifications(length: string): string {
    const specs: Record<string, string> = {
      'short': '- 15-30 minutes gameplay\n- 8-12 unique scenes\n- 2,000-4,000 words of content',
      'medium': '- 45-90 minutes gameplay\n- 15-25 unique scenes\n- 5,000-10,000 words of content',
      'long': '- 2-4 hours gameplay\n- 25-40 unique scenes\n- 10,000-20,000 words of content',
      'epic': '- 4+ hours gameplay\n- 40+ unique scenes\n- 20,000+ words of content\n- Multiple character arcs and subplots'
    };
    
    return specs[length] || specs.medium;
  }

  private getMinimumScenes(length: string): string {
    const scenes: Record<string, string> = {
      'short': '10-15',
      'medium': '20-30', 
      'long': '35-50',
      'epic': '50+'
    };
    
    return scenes[length] || scenes.medium;
  }

  private getMinimumEndings(complexity: string): string {
    const endings: Record<string, string> = {
      'simple': '2-3',
      'intermediate': '4-6',
      'advanced': '6+'
    };
    
    return endings[complexity] || endings.intermediate;
  }
}

export default TextAdventureGenerator;