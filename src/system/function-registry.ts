import { readdirSync, readFileSync } from 'fs';
import { join, extname, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface FunctionInfo {
  name: string;
  category: string;
  file: string;
  description?: string;
  supportedModes: string[];
  primaryMode: string;
  exampleUsage?: {
    singleFile?: string;
    multiFile?: string;
  };
}

/**
 * Discover all available Local LLM functions by scanning prompt directories
 */
export async function discoverAvailableFunctions(): Promise<FunctionInfo[]> {
  const functions: FunctionInfo[] = [];
  const promptsDir = join(__dirname, '../prompts');
  
  // Known prompt categories
  const categories = ['analyze', 'generate', 'system', 'custom', 'fun'];
  
  for (const category of categories) {
    const categoryPath = join(promptsDir, category);
    
    try {
      const files = readdirSync(categoryPath);
      
      for (const file of files) {
        if (file.endsWith('.js') && !file.includes('legacy') && !file.includes('.d.ts')) {
          try {
            const functionInfo = await extractFunctionInfo(categoryPath, file, category);
            if (functionInfo) {
              functions.push(functionInfo);
            }
          } catch (error) {
            // Skip files that can't be analyzed
            console.warn(`Could not analyze ${file}:`, error.message);
          }
        }
      }
    } catch (error) {
      // Category directory doesn't exist or can't be read, skip
      console.warn(`Could not read category ${category}:`, error.message);
    }
  }
  
  return functions.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Extract function information from a compiled plugin file
 */
async function extractFunctionInfo(categoryPath: string, file: string, category: string): Promise<FunctionInfo | null> {
  const filePath = join(categoryPath, file);
  
  try {
    const content = readFileSync(filePath, 'utf8');
    
    // Extract function name (look for name = 'function_name' pattern)
    const nameMatch = content.match(/name\s*=\s*['"']([^'"]+)['"']/);
    const functionName = nameMatch ? nameMatch[1] : basename(file, '.js').replace(/-/g, '_');
    
    // Extract description (look for description = 'text' pattern)
    const descMatch = content.match(/description\s*=\s*['"']([^'"]+)['"']/);
    const description = descMatch ? descMatch[1] : `${category} function`;
    
    // Detect supported modes by looking for mode detection logic
    const supportedModes = detectSupportedModes(content);
    const primaryMode = determinePrimaryMode(content, category);
    
    // Generate example usage
    const exampleUsage = generateExampleUsage(functionName, supportedModes);
    
    return {
      name: functionName,
      category,
      file,
      description,
      supportedModes,
      primaryMode,
      exampleUsage
    };
    
  } catch (error) {
    console.warn(`Error reading ${file}:`, error.message);
    return null;
  }
}

/**
 * Detect which modes a function supports by analyzing its code
 */
function detectSupportedModes(content: string): string[] {
  const modes: string[] = [];
  
  // Check for single-file support
  if (content.includes('getSingleFile') || content.includes("'single-file'") || content.includes('params.code') || content.includes('params.filePath')) {
    modes.push('single-file');
  }
  
  // Check for multi-file support  
  if (content.includes('getMultiFile') || content.includes("'multi-file'") || content.includes('params.projectPath') || content.includes('params.files')) {
    modes.push('multi-file');
  }
  
  // Default if we can't detect
  if (modes.length === 0) {
    modes.push('single-file'); // Conservative default
  }
  
  return modes;
}

/**
 * Determine the primary mode based on function purpose and defaults
 */
function determinePrimaryMode(content: string, category: string): string {
  // Look for explicit default return in detectAnalysisMode
  const defaultMatch = content.match(/return\s+['"'](single-file|multi-file)['"'];?\s*$/m);
  if (defaultMatch) {
    return defaultMatch[1];
  }
  
  // Category-based heuristics
  if (category === 'system') {
    return 'multi-file'; // System functions typically work on projects
  }
  
  if (category === 'generate') {
    return 'single-file'; // Generation typically creates single items
  }
  
  // Default fallback
  return 'single-file';
}

/**
 * Generate helpful example usage for different modes
 */
function generateExampleUsage(functionName: string, supportedModes: string[]): { singleFile?: string; multiFile?: string } {
  const examples: any = {};
  
  if (supportedModes.includes('single-file')) {
    examples.singleFile = `local-llm:${functionName} filePath="C:/project/src/file.ts"`;
  }
  
  if (supportedModes.includes('multi-file')) {
    examples.multiFile = `local-llm:${functionName} projectPath="C:/project/src"`;
  }
  
  return examples;
}

/**
 * Get function categories with counts
 */
export async function getFunctionCategories(): Promise<{ [category: string]: number }> {
  const functions = await discoverAvailableFunctions();
  const categories: { [category: string]: number } = {};
  
  functions.forEach(func => {
    categories[func.category] = (categories[func.category] || 0) + 1;
  });
  
  return categories;
}