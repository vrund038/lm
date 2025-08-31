/**
 * CSS Art Generator Plugin - Modern v4.3
 * 
 * Creates pure CSS drawings, animations, and interactive art
 * Automatically detects single-art or multi-art generation mode
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

export class CSSArtGenerator extends BasePlugin implements IPromptPlugin {
  name = 'css_art_generator';
  category = 'generate' as const;
  description = 'Create pure CSS drawings, animations, and interactive art with no images required - just clever CSS techniques';
  
  // Universal parameter set - supports both single and multi-art scenarios
  parameters = {
    // Single-art parameters
    code: {
      type: 'string' as const,
      description: 'Existing CSS art code to enhance (for single-art analysis)',
      required: false
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to existing CSS art file to enhance',
      required: false
    },
    
    // Multi-art parameters  
    projectPath: {
      type: 'string' as const,
      description: 'Working directory for CSS art project (e.g., C:\\dev\\css-art)',
      required: false
    },
    files: {
      type: 'array' as const,
      description: 'Array of specific CSS art files (for multi-art analysis)',
      required: false,
      items: { type: 'string' as const }
    },
    maxDepth: {
      type: 'number' as const,
      description: 'Maximum directory depth for art file discovery (1-3)',
      required: false,
      default: 2
    },
    
    // CSS Art specific parameters
    artType: {
      type: 'string' as const,
      description: 'Type of CSS art to create',
      enum: ['drawing', 'animation', 'interactive', 'logo', 'character', 'landscape', 'abstract', 'custom'],
      default: 'drawing',
      required: false
    },
    complexity: {
      type: 'string' as const,
      description: 'Art complexity level',
      enum: ['simple', 'intermediate', 'advanced', 'masterpiece'],
      default: 'intermediate',
      required: false
    },
    animationStyle: {
      type: 'string' as const,
      description: 'Animation style (if applicable)',
      enum: ['none', 'subtle', 'smooth', 'bouncy', 'dramatic', 'infinite'],
      default: 'smooth',
      required: false
    },
    colorScheme: {
      type: 'string' as const,
      description: 'Color palette for the art',
      enum: ['vibrant', 'pastel', 'monochrome', 'neon', 'earth', 'sunset', 'ocean', 'custom'],
      default: 'vibrant',
      required: false
    },
    theme: {
      type: 'string' as const,
      description: 'Art theme or subject',
      enum: ['nature', 'geometric', 'character', 'space', 'retro', 'modern', 'fantasy', 'custom'],
      default: 'modern',
      required: false
    },
    techniques: {
      type: 'array' as const,
      description: 'CSS techniques to showcase',
      items: { type: 'string' as const },
      default: ['gradients', 'shadows', 'transforms', 'pseudo-elements'],
      required: false
    },
    responsive: {
      type: 'boolean' as const,
      description: 'Make art responsive to screen size',
      default: true,
      required: false
    },
    
    // Universal parameters
    language: {
      type: 'string' as const,
      description: 'Programming language',
      required: false,
      default: 'css'
    },
    analysisDepth: {
      type: 'string' as const,
      description: 'Level of art complexity',
      enum: ['basic', 'detailed', 'comprehensive'],
      default: 'detailed',
      required: false
    },
    analysisType: {
      type: 'string' as const,
      description: 'Type of art generation to perform',
      enum: ['showcase', 'educational', 'comprehensive'],
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
          return await this.executeSingleArtGeneration(secureParams, model, contextLength);
        } else {
          return await this.executeMultiArtGeneration(secureParams, model, contextLength);
        }
        
      } catch (error: any) {
        return ErrorHandler.createExecutionError('css_art_generator', error);
      }
    });
  }

  /**
   * Auto-detect whether this is single-art or multi-art generation
   */
  private detectAnalysisMode(params: any): 'single-file' | 'multi-file' {
    // Multi-file indicators (art collections, project enhancement)
    if (params.projectPath || params.files || params.maxDepth !== undefined) {
      return 'multi-file';
    }
    
    // Single-file indicators (enhancing existing art)
    if (params.code || params.filePath) {
      return 'single-file';
    }
    
    // Default to single-file for CSS art generation (art-focused)
    return 'single-file';
  }

  /**
   * Validate parameters based on detected analysis mode
   */
  private validateParameters(params: any, mode: 'single-file' | 'multi-file'): void {
    if (mode === 'single-file') {
      // Single-art generation doesn't require code/file - can generate from scratch
    } else {
      ParameterValidator.validateProjectPath(params);
      ParameterValidator.validateDepth(params);
    }
    
    // Universal validations
    ParameterValidator.validateEnum(params, 'analysisType', ['showcase', 'educational', 'comprehensive']);
    ParameterValidator.validateEnum(params, 'analysisDepth', ['basic', 'detailed', 'comprehensive']);
    ParameterValidator.validateEnum(params, 'artType', ['drawing', 'animation', 'interactive', 'logo', 'character', 'landscape', 'abstract', 'custom']);
  }

  /**
   * Execute single-art generation
   */
  private async executeSingleArtGeneration(params: any, model: any, contextLength: number) {
    // Process existing art input (if any)
    let existingArtCode = params.code;
    if (params.filePath) {
      existingArtCode = await readFileContent(params.filePath);
    }
    
    // Generate prompt stages for single art piece
    const promptStages = this.getSingleArtPromptStages({
      ...params,
      code: existingArtCode
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
        'css_art_generator',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'css_art_generator'
      );
    }
  }

  /**
   * Execute multi-art generation
   */
  private async executeMultiArtGeneration(params: any, model: any, contextLength: number) {
    // Discover existing art files
    let filesToAnalyze: string[] = params.files || 
      await this.discoverRelevantFiles(
        params.projectPath, 
        params.maxDepth,
        params.analysisType
      );
    
    // Perform multi-art analysis with caching
    const analysisResult = await this.performMultiArtAnalysis(
      filesToAnalyze,
      params,
      model,
      contextLength
    );
    
    // Generate prompt stages for multi-art
    const promptStages = this.getMultiArtPromptStages({
      ...params,
      analysisResult,
      artCount: filesToAnalyze.length
    });
    
    // Always use chunking for multi-art
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
      'css_art_generator',
      'multifile'
    );
  }

  /**
   * Single-art prompt stages - Generate a beautiful CSS art piece
   */
  private getSingleArtPromptStages(params: any): PromptStages {
    const { artType, complexity, animationStyle, colorScheme, theme, techniques, responsive, analysisDepth, analysisType, code } = params;
    
    const systemAndContext = `You are a visionary CSS artist and master of web technologies specializing in ${analysisDepth} ${analysisType} pure CSS art creation.

**Your Mission**: Create stunning, mind-blowing CSS art that pushes the absolute boundaries of what's possible with pure CSS - no images, no JavaScript, just pure creative genius.

**CSS Art Context:**
- Art Type: ${artType}
- Complexity: ${complexity}
- Animation Style: ${animationStyle}
- Color Scheme: ${colorScheme}
- Theme: ${theme}
- CSS Techniques: ${JSON.stringify(techniques)}
- Responsive Design: ${responsive}
- Artistic Depth: ${analysisDepth}
- Showcase Level: ${analysisType}

**Your Legendary Expertise:**
- 15+ years creating impossible CSS art that makes developers say "How did they DO that?!"
- Master of advanced CSS properties: clip-path, filter, transform-3d, custom properties
- Expert in CSS animations and keyframes that bring art to life
- Pioneer of pseudo-element wizardry (:before, :after) for complex illustrations  
- Specialist in gradient artistry and shadow manipulation for photorealistic effects
- Genius of responsive CSS art that adapts beautifully to any screen size
- Teacher of advanced CSS techniques through beautiful, educational examples

**CSS Art Philosophy:**
1. **Pure CSS Magic** - No images, no SVG, no JavaScript - just CSS superpowers
2. **Visual Impact** - Art should make viewers stop and stare in amazement
3. **Technical Mastery** - Showcase advanced CSS techniques creatively
4. **Educational Value** - Code should inspire and teach other developers
5. **Responsive Beauty** - Art looks perfect on phones, tablets, and desktops
6. **Performance** - Smooth animations, optimized rendering, hardware acceleration
7. **Creative Innovation** - Push boundaries of what people think CSS can do

**Advanced CSS Techniques Mastery:**
- **Gradients**: Linear, radial, conic - create complex lighting and textures
- **Clip-path**: Cut out complex shapes and create stunning geometry
- **Filters**: blur(), drop-shadow(), hue-rotate() for photographic effects
- **Transforms**: 3D rotation, perspective, scaling for dimensional art
- **Pseudo-elements**: :before and :after for layered compositions
- **CSS Variables**: Dynamic colors and responsive scaling
- **Keyframes**: Smooth, captivating animations that tell stories
- **Box-shadow**: Multiple shadows for depth, glow, and complex shapes
- **Border-radius**: Create organic curves and perfect circles
- **Position absolute/relative**: Precise layering and composition

**${colorScheme.charAt(0).toUpperCase() + colorScheme.slice(1)} Color Psychology:**
${this.getColorSchemeGuidelines(colorScheme)}

**${theme.charAt(0).toUpperCase() + theme.slice(1)} Theme Inspiration:**
${this.getThemeInspiration(theme)}

Your task is to create CSS art so beautiful and technically impressive that it becomes a masterpiece showcase of pure CSS potential.`;

    const dataPayload = code ? `**Existing CSS Art to Enhance:**

\`\`\`css
${code}
\`\`\`

**Enhancement Request:**
Please analyze the existing CSS art and enhance it with the requested features while maintaining the artistic vision and improving the technical execution.` : 

`**New CSS Art Generation Request:**
Create a brand new ${artType} artwork from scratch with the specified parameters.

**${artType.charAt(0).toUpperCase() + artType.slice(1)} Art Inspiration:**
${this.getArtTypeInspiration(artType)}

**${complexity.charAt(0).toUpperCase() + complexity.slice(1)} Complexity Guidelines:**
${this.getComplexityGuidelines(complexity)}

**Animation Style - ${animationStyle}:**
${this.getAnimationGuidelines(animationStyle)}`;

    const outputInstructions = `**Generate a complete, stunning CSS art piece as a single HTML file:**

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CSS Art: ${artType.charAt(0).toUpperCase() + artType.slice(1)} - ${theme.charAt(0).toUpperCase() + theme.slice(1)} Theme</title>
    <style>
        /* RESET AND BASE STYLES */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            background: ${this.getBackgroundSuggestion(colorScheme, theme)};
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            overflow: hidden; /* For full-screen art */
        }
        
        /* MAIN ARTWORK CONTAINER */
        .css-art {
            /* Primary art container with perfect centering */
            position: relative;
            /* Responsive scaling based on screen size */
        }
        
        /* ADVANCED CSS ART TECHNIQUES */
        
        /* 1. COMPLEX SHAPES WITH CLIP-PATH */
        .shape-layer {
            /* Use clip-path for impossible geometric shapes */
        }
        
        /* 2. GRADIENT MASTERY */
        .gradient-layer {
            /* Multiple gradients for lighting and texture */
            background: 
                linear-gradient(...),
                radial-gradient(...),
                conic-gradient(...);
        }
        
        /* 3. PSEUDO-ELEMENT WIZARDRY */
        .detail::before,
        .detail::after {
            /* Create complex layered compositions */
            content: '';
            position: absolute;
            /* Intricate shapes and details */
        }
        
        /* 4. 3D TRANSFORMS AND PERSPECTIVE */
        .dimensional {
            transform-style: preserve-3d;
            perspective: 1000px;
            /* 3D rotation and depth effects */
        }
        
        /* 5. ADVANCED ANIMATIONS */
        @keyframes ${animationStyle}Animation {
            /* Smooth, captivating animation keyframes */
            0% { /* Initial state */ }
            50% { /* Mid-point transformation */ }
            100% { /* Final state */ }
        }
        
        /* 6. MULTIPLE BOX-SHADOWS FOR DEPTH */
        .shadow-art {
            box-shadow: 
                /* Multiple shadows for complex shapes */
                inset 0 0 20px rgba(...),
                0 0 40px rgba(...),
                0 0 80px rgba(...);
        }
        
        /* 7. CSS FILTERS FOR EFFECTS */
        .filter-effects {
            filter: 
                blur(2px)
                drop-shadow(0 0 10px rgba(...))
                hue-rotate(45deg)
                saturate(1.5);
        }
        
        /* 8. RESPONSIVE DESIGN */
        @media (max-width: 768px) {
            .css-art {
                /* Mobile-optimized scaling */
                transform: scale(0.8);
            }
        }
        
        @media (max-width: 480px) {
            .css-art {
                /* Small screen adaptations */
                transform: scale(0.6);
            }
        }
        
        /* 9. CSS CUSTOM PROPERTIES FOR THEMING */
        :root {
            --primary-color: ${this.getPrimaryColor(colorScheme)};
            --secondary-color: ${this.getSecondaryColor(colorScheme)};
            --accent-color: ${this.getAccentColor(colorScheme)};
            --art-size: clamp(200px, 50vw, 600px);
        }
        
        /* 10. INTERACTIVE HOVER EFFECTS (IF APPLICABLE) */
        .css-art:hover {
            /* Subtle interactive enhancements */
        }
        
        /* ARTWORK-SPECIFIC STYLES */
        /* [Generate detailed, creative CSS for the specific ${artType} artwork] */
        
    </style>
</head>
<body>
    <div class="css-art">
        <!-- HTML structure for the CSS art -->
        <!-- Minimal, semantic markup that enables CSS magic -->
        <div class="main-element">
            <div class="detail layer-1"></div>
            <div class="detail layer-2"></div>
            <div class="detail layer-3"></div>
            <!-- Additional elements as needed for complex compositions -->
        </div>
    </div>
    
    <!-- Optional: Art information overlay -->
    <div class="art-info" style="position: fixed; bottom: 20px; left: 20px; color: white; font-size: 14px; opacity: 0.7;">
        <strong>Pure CSS Art:</strong> ${artType} • ${theme} theme • ${colorScheme} colors
        <br><small>No images • No JavaScript • Just CSS magic ✨</small>
    </div>
</body>
</html>
\`\`\`

**Critical CSS Art Requirements:**
✅ **Pure CSS Only** - No images, no SVG, no JavaScript dependencies
✅ **Visual Impact** - Art should be immediately stunning and memorable
✅ **Advanced Techniques** - Showcase at least 5 advanced CSS properties creatively
✅ **${colorScheme} Color Mastery** - Beautiful, cohesive color palette execution
✅ **${animationStyle} Animation** - Smooth, purposeful animations that enhance the art
✅ **Responsive Design** - Perfect scaling on all devices (mobile to desktop)
✅ **Performance Optimized** - Smooth 60fps animations, hardware acceleration
✅ **Educational Value** - Code comments explaining advanced techniques
✅ **Technical Innovation** - Push boundaries of CSS art possibilities

**Advanced CSS Showcase Standards:**
- **Clip-path mastery** for impossible geometric shapes
- **Multiple gradient layers** for realistic lighting and texture
- **Pseudo-element wizardry** for complex layered compositions  
- **3D transforms** for dimensional depth and perspective
- **Filter combinations** for photographic effects and atmosphere
- **Custom property theming** for responsive and dynamic styling
- **Animation orchestration** for smooth, captivating movement
- **Box-shadow artistry** for depth, glow, and complex forms

**Artistic Excellence Standards:**
- Museum-quality visual composition and balance
- Color harmony that evokes emotion and atmosphere
- Technical execution that inspires other developers
- Responsive behavior that maintains artistic integrity
- Performance that runs smoothly on any device

Create CSS art so incredible that developers will study your code to learn how it's possible!`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Multi-art prompt stages - Generate CSS art collections or enhance projects
   */
  private getMultiArtPromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, artCount, artType, theme, colorScheme } = params;
    
    const systemAndContext = `You are a master CSS art curator and gallery director specializing in ${analysisDepth} ${analysisType} CSS art collection development.

**Your Mission**: Create a comprehensive CSS art gallery or enhance an existing art project with multiple interconnected artworks that tell a cohesive visual story.

**Art Collection Context:**
- Collection Type: ${analysisType}
- Collection Depth: ${analysisDepth}  
- Art Pieces in Collection: ${artCount}
- Primary Art Type: ${artType}
- Unifying Theme: ${theme}
- Color Harmony: ${colorScheme}
- Mode: Multi-Art Collection Development

**Your Elite Expertise:**
- 20+ years curating digital art galleries and interactive experiences
- Expert in creating cohesive visual narratives across multiple artworks
- Master of scalable CSS architectures with shared design systems
- Specialized in progressive art experiences that guide viewer journeys
- Pioneer of elegant multi-art frameworks with unified aesthetics

**Collection Architecture Philosophy:**
1. **Visual Cohesion** - Unified color palette and artistic style across all pieces
2. **Progressive Complexity** - Artworks build artistic narrative and technical sophistication
3. **Shared Design System** - Common CSS variables and reusable art components
4. **Interactive Gallery** - Elegant navigation between individual art pieces
5. **Responsive Exhibition** - Beautiful presentation on all devices and screen sizes
6. **Educational Journey** - Each artwork teaches different advanced CSS techniques

Your task is to create a masterful CSS art collection that showcases both individual artistic brilliance and cohesive gallery experience.`;

    const dataPayload = `**CSS Art Collection Analysis Results:**

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `**Generate a comprehensive CSS art gallery as multiple coordinated files:**

\`\`\`
// File Structure for CSS Art Collection:
index.html                    // Main gallery navigation and overview
shared/
  art-gallery.css            // Shared gallery framework and navigation
  css-variables.css          // Unified color schemes and design tokens
  responsive-gallery.css     // Mobile-friendly gallery layouts
artworks/
  ${artType}-piece-1.html    // Individual art pieces as standalone files
  ${artType}-piece-2.html    // Each showcasing different CSS techniques
  ${artType}-piece-3.html    // Progressive complexity and innovation
animations/
  gallery-transitions.css    // Smooth navigation animations
  artwork-interactions.css   // Interactive hover and focus effects
\`\`\`

**Gallery Collection Features:**
- **Art Navigation**: Beautiful gallery interface for browsing artworks
- **Unified Theme**: Cohesive ${theme} aesthetic with ${colorScheme} color harmony
- **Progressive Showcase**: Each artwork demonstrates different advanced CSS techniques
- **Interactive Experience**: Smooth transitions and elegant art presentation
- **Educational Value**: Gallery teaches CSS artistry through visual examples
- **Responsive Design**: Perfect viewing experience on all devices
- **Performance Optimized**: Fast loading, smooth animations throughout

**Individual Artwork Quality:**
Each art piece in the collection must be:
✅ **Visually Stunning** - Museum-quality CSS art execution
✅ **Technically Advanced** - Showcases unique CSS techniques and innovation
✅ **Thematically Consistent** - Follows the unified ${theme} visual narrative
✅ **Educationally Valuable** - Teaches specific advanced CSS concepts
✅ **Performance Optimized** - Smooth, hardware-accelerated animations
✅ **Responsive Excellence** - Beautiful on all screen sizes

**Gallery Architecture:**
- **CSS Design System**: Shared variables for colors, spacing, and typography
- **Modular Structure**: Each artwork as independent, reusable component  
- **Navigation Framework**: Elegant transitions between art pieces
- **Progressive Enhancement**: Advanced features for capable browsers
- **Educational Documentation**: Code comments explaining artistic techniques

**Collection Themes:**
- **${theme} Artistic Vision**: Unified visual story across all artworks
- **Technical Progression**: From foundational to advanced CSS techniques
- **Interactive Narrative**: User journey through CSS art possibilities
- **Responsive Gallery**: Adaptive layouts for optimal art viewing

Create a CSS art collection that establishes a new standard for web-based digital art galleries!`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Backwards compatibility method - routes to appropriate stages
   */
  getPromptStages(params: any): PromptStages {
    const mode = this.detectAnalysisMode(params);
    
    if (mode === 'single-file') {
      return this.getSingleArtPromptStages(params);
    } else {
      return this.getMultiArtPromptStages(params);
    }
  }

  // Multi-art helper methods
  private async discoverRelevantFiles(
    projectPath: string, 
    maxDepth: number,
    analysisType: string
  ): Promise<string[]> {
    const extensions = this.getFileExtensions(analysisType);
    return await this.multiFileAnalysis.discoverFiles(projectPath, extensions, maxDepth);
  }

  private async performMultiArtAnalysis(
    files: string[],
    params: any,
    model: any,
    contextLength: number
  ): Promise<any> {
    const cacheKey = this.analysisCache.generateKey(
      'css_art_generator', 
      params, 
      files
    );
    
    const cached = await this.analysisCache.get(cacheKey);
    if (cached) return cached;
    
    const artAnalysisResults = await this.multiFileAnalysis.analyzeBatch(
      files,
      (file: string) => this.analyzeArtFile(file, params, model),
      contextLength
    );
    
    // Aggregate results into art collection analysis
    const aggregatedResult = {
      summary: `CSS art collection analysis of ${files.length} art files`,
      findings: artAnalysisResults,
      data: {
        artCount: files.length,
        totalArtSize: artAnalysisResults.reduce((sum: number, result: any) => sum + (result.size || 0), 0),
        artTypes: this.identifyArtTypes(artAnalysisResults),
        cssFeatures: this.identifyCSSFeatures(artAnalysisResults),
        collectionTheme: params.theme || 'modern',
        colorScheme: params.colorScheme || 'vibrant',
        analysisTimestamp: new Date().toISOString()
      }
    };
    
    await this.analysisCache.cacheAnalysis(cacheKey, aggregatedResult, {
      modelUsed: model.identifier || 'unknown',
      executionTime: Date.now() - Date.now(),
      timestamp: new Date().toISOString()
    });
    
    return aggregatedResult;
  }

  private async analyzeArtFile(file: string, params: any, model: any): Promise<any> {
    const content = await readFileContent(file);
    
    return {
      filePath: file,
      size: content.length,
      lines: content.split('\n').length,
      hasAnimations: /@keyframes|animation:|transition:/.test(content),
      hasGradients: /gradient\(/.test(content),
      hasTransforms: /transform:/.test(content),
      hasPseudoElements: /::?(?:before|after)/.test(content),
      hasClipPath: /clip-path:/.test(content),
      hasFilters: /filter:/.test(content),
      artComplexity: this.assessArtComplexity(content),
      detectedTheme: this.detectTheme(content)
    };
  }

  private identifyArtTypes(results: any[]): string[] {
    const types = new Set<string>();
    results.forEach(result => {
      if (result.hasAnimations) types.add('animated');
      if (result.hasGradients) types.add('gradient-based');
      if (result.hasTransforms) types.add('transformed');
      if (result.hasPseudoElements) types.add('layered');
    });
    return Array.from(types);
  }

  private identifyCSSFeatures(results: any[]): string[] {
    const features: string[] = [];
    const hasAnimations = results.some(r => r.hasAnimations);
    const hasGradients = results.some(r => r.hasGradients);
    const hasTransforms = results.some(r => r.hasTransforms);
    const hasPseudoElements = results.some(r => r.hasPseudoElements);
    const hasClipPath = results.some(r => r.hasClipPath);
    const hasFilters = results.some(r => r.hasFilters);
    
    if (hasAnimations) features.push('CSS Animations & Keyframes');
    if (hasGradients) features.push('Advanced Gradients');
    if (hasTransforms) features.push('3D Transforms');
    if (hasPseudoElements) features.push('Pseudo-element Artistry');
    if (hasClipPath) features.push('Clip-path Mastery');
    if (hasFilters) features.push('CSS Filters & Effects');
    
    return features;
  }

  private assessArtComplexity(content: string): string {
    let complexity = 0;
    
    if (/@keyframes/.test(content)) complexity += 2;
    if (/gradient\(/.test(content)) complexity += 1;
    if (/transform:/.test(content)) complexity += 1;
    if (/::?(?:before|after)/.test(content)) complexity += 2;
    if (/clip-path:/.test(content)) complexity += 3;
    if (/filter:/.test(content)) complexity += 2;
    if (/box-shadow:/.test(content)) complexity += 1;
    
    if (complexity >= 8) return 'masterpiece';
    if (complexity >= 5) return 'advanced';
    if (complexity >= 3) return 'intermediate';
    return 'simple';
  }

  private detectTheme(content: string): string {
    if (/space|star|galaxy|cosmic/.test(content)) return 'space';
    if (/nature|leaf|tree|forest|flower/.test(content)) return 'nature';
    if (/geometric|polygon|triangle|circle/.test(content)) return 'geometric';
    if (/neon|glow|bright|electric/.test(content)) return 'neon';
    if (/retro|vintage|old|classic/.test(content)) return 'retro';
    return 'modern';
  }

  private getArtTypeInspiration(artType: string): string {
    const inspirations: Record<string, string> = {
      'drawing': 'Hand-drawn illustrations recreated in pure CSS - portraits, sketches, line art with creative pseudo-elements',
      'animation': 'Moving art that tells a story - rotating elements, morphing shapes, particle systems in CSS',
      'interactive': 'Art that responds to user interaction - hover effects, click transformations, dynamic color changes',
      'logo': 'Brand identities and iconography - scalable vector-style logos using CSS shapes and typography',
      'character': 'Cartoon characters and mascots - expressive faces, body proportions, personality through CSS',
      'landscape': 'Scenic environments and vistas - mountains, oceans, cities using layered CSS techniques',
      'abstract': 'Non-representational artistic expression - geometric patterns, color studies, experimental forms',
      'custom': 'Unique artistic vision that pushes the boundaries of CSS art possibilities'
    };
    
    return inspirations[artType] || inspirations.custom;
  }

  private getComplexityGuidelines(complexity: string): string {
    const guidelines: Record<string, string> = {
      'simple': 'Clean, elegant art using basic CSS properties - focus on composition and color harmony',
      'intermediate': 'Moderate use of advanced techniques - gradients, transforms, basic animations for visual interest',
      'advanced': 'Sophisticated CSS mastery - multiple advanced properties, complex animations, layered compositions',
      'masterpiece': 'Pushing absolute limits of CSS - mind-bending techniques, photorealistic effects, impossible geometries'
    };
    
    return guidelines[complexity] || guidelines.intermediate;
  }

  private getAnimationGuidelines(animationStyle: string): string {
    const guidelines: Record<string, string> = {
      'none': 'Static art with no movement - focus on composition, color, and form',
      'subtle': 'Gentle, barely noticeable animations - breathing effects, soft glows, minimal movement',
      'smooth': 'Fluid, purposeful animations that enhance the art - smooth transitions and organic motion',
      'bouncy': 'Playful, elastic animations with spring physics - fun, energetic movement patterns',
      'dramatic': 'Bold, attention-grabbing animations - striking transformations and dynamic effects',
      'infinite': 'Continuous looping animations - hypnotic patterns, rotating elements, endless motion'
    };
    
    return guidelines[animationStyle] || guidelines.smooth;
  }

  private getColorSchemeGuidelines(colorScheme: string): string {
    const guidelines: Record<string, string> = {
      'vibrant': 'Bold, saturated colors that pop - electric blues, hot pinks, bright greens for maximum visual impact',
      'pastel': 'Soft, dreamy colors - pale pinks, light blues, gentle yellows for calming, elegant aesthetics',
      'monochrome': 'Single-color variations - different shades and tones of one hue for sophisticated, focused art',
      'neon': 'Glowing, electric colors - bright magentas, cyber greens, electric blues with glow effects',
      'earth': 'Natural, organic colors - browns, greens, oranges inspired by nature and landscapes',
      'sunset': 'Warm gradient transitions - oranges, pinks, purples, yellows like golden hour lighting',
      'ocean': 'Cool blue and teal variations - deep navy, turquoise, seafoam for aquatic, serene moods',
      'custom': 'Unique color palette that perfectly matches the artistic vision and theme'
    };
    
    return guidelines[colorScheme] || guidelines.vibrant;
  }

  private getThemeInspiration(theme: string): string {
    const inspirations: Record<string, string> = {
      'nature': 'Organic forms, flowing lines, botanical elements - trees, leaves, flowers, landscapes with natural textures',
      'geometric': 'Mathematical precision, clean lines, perfect shapes - triangles, circles, polygons in harmonious compositions',
      'character': 'Expressive personalities, faces, figures - cartoon styles, mascots, portraits with emotional depth',
      'space': 'Cosmic wonder, celestial bodies, sci-fi elements - stars, planets, galaxies, futuristic designs',
      'retro': 'Nostalgic aesthetics, vintage vibes - 80s neon, art deco patterns, classic design elements',
      'modern': 'Contemporary design principles - minimalism, bold typography, clean layouts, current trends',
      'fantasy': 'Magical, mythical elements - dragons, castles, enchanted forests, otherworldly creatures',
      'custom': 'Original thematic vision that creates a unique artistic narrative and visual identity'
    };
    
    return inspirations[theme] || inspirations.modern;
  }

  private getBackgroundSuggestion(colorScheme: string, theme: string): string {
    const backgrounds: Record<string, string> = {
      'vibrant': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'pastel': 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
      'monochrome': 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
      'neon': 'radial-gradient(circle, #0f0f23 0%, #000000 100%)',
      'earth': 'linear-gradient(135deg, #8B4513 0%, #228B22 100%)',
      'sunset': 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
      'ocean': 'linear-gradient(135deg, #667db6 0%, #0082c8 100%)'
    };
    
    return backgrounds[colorScheme] || backgrounds.vibrant;
  }

  private getPrimaryColor(colorScheme: string): string {
    const colors: Record<string, string> = {
      'vibrant': '#ff6b6b',
      'pastel': '#ffeaa7',
      'monochrome': '#2d3436',
      'neon': '#00f0ff',
      'earth': '#8b4513',
      'sunset': '#ff7675',
      'ocean': '#0984e3'
    };
    
    return colors[colorScheme] || colors.vibrant;
  }

  private getSecondaryColor(colorScheme: string): string {
    const colors: Record<string, string> = {
      'vibrant': '#4ecdc4',
      'pastel': '#fab1a0',
      'monochrome': '#636e72',
      'neon': '#ff00ff',
      'earth': '#228b22',
      'sunset': '#fd79a8',
      'ocean': '#00cec9'
    };
    
    return colors[colorScheme] || colors.vibrant;
  }

  private getAccentColor(colorScheme: string): string {
    const colors: Record<string, string> = {
      'vibrant': '#ffe66d',
      'pastel': '#81ecec',
      'monochrome': '#ddd',
      'neon': '#39ff14',
      'earth': '#d2691e',
      'sunset': '#fdcb6e',
      'ocean': '#74b9ff'
    };
    
    return colors[colorScheme] || colors.vibrant;
  }

  private getFileExtensions(analysisType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'showcase': ['.html', '.css'],
      'educational': ['.html', '.css', '.md'],
      'comprehensive': ['.html', '.css', '.md', '.js']
    };
    
    return extensionMap[analysisType] || extensionMap.comprehensive;
  }
}

export default CSSArtGenerator;