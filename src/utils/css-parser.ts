import * as csstree from 'css-tree';

export interface SimpleSelector {
  selector: string;
  file: string;
  line?: number;
  mediaQuery?: string;
}

export class CssParser {
  
  /**
   * Extract all CSS selectors from content with basic metadata
   */
  static extractSelectors(cssContent: string, fileName: string = ''): SimpleSelector[] {
    const selectors: SimpleSelector[] = [];
    
    try {
      const ast = csstree.parse(cssContent, {
        onParseError: (error) => {
          console.warn(`CSS parse warning in ${fileName}: ${error.message}`);
        }
      });

      csstree.walk(ast, (node, item, list) => {
        if (node.type === 'Rule') {
          const selectorList = node.prelude;
          if (selectorList && selectorList.type === 'SelectorList') {
            selectorList.children.forEach((selector) => {
              const selectorText = csstree.generate(selector);
              selectors.push({
                selector: selectorText,
                file: fileName,
                line: node.loc?.start.line
              });
            });
          }
        }
        
        // Handle @media rules
        if (node.type === 'Atrule' && node.name === 'media') {
          const mediaQuery = csstree.generate(node.prelude);
          if (node.block) {
            csstree.walk(node.block, (innerNode) => {
              if (innerNode.type === 'Rule') {
                const selectorList = innerNode.prelude;
                if (selectorList && selectorList.type === 'SelectorList') {
                  selectorList.children.forEach((selector) => {
                    const selectorText = csstree.generate(selector);
                    selectors.push({
                      selector: selectorText,
                      file: fileName,
                      line: innerNode.loc?.start.line,
                      mediaQuery: mediaQuery
                    });
                  });
                }
              }
            });
          }
        }
      });

    } catch (error) {
      console.warn(`Failed to parse CSS in ${fileName}: ${error}`);
      // Fallback to simple regex parsing
      return this.extractSelectorsSimple(cssContent, fileName);
    }

    return selectors;
  }

  /**
   * Fallback simple selector extraction using regex
   */
  private static extractSelectorsSimple(css: string, fileName: string): SimpleSelector[] {
    const selectors: SimpleSelector[] = [];
    
    // Remove comments and clean up
    css = css.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Simple rule matching
    const ruleRegex = /([^{}]+)\s*{[^{}]*}/g;
    let match;
    let lineNumber = 1;
    
    while ((match = ruleRegex.exec(css)) !== null) {
      const selectorPart = match[1].trim();
      if (selectorPart && !selectorPart.startsWith('@')) {
        const multiSelectors = selectorPart.split(',');
        multiSelectors.forEach(sel => {
          const trimmed = sel.trim();
          if (trimmed) {
            selectors.push({
              selector: trimmed,
              file: fileName,
              line: lineNumber
            });
          }
        });
      }
      // Rough line counting
      lineNumber += (match[0].match(/\n/g) || []).length;
    }
    
    return selectors;
  }

  /**
   * Get CSS file size in KB for reporting
   */
  static getFileSizeKB(cssContent: string): number {
    return Math.round(Buffer.byteLength(cssContent, 'utf8') / 1024);
  }

  /**
   * Basic framework detection (just names, let LLM do the analysis)
   */
  static detectBasicFrameworks(cssContent: string): string[] {
    const frameworks: string[] = [];
    
    if (/\.(btn|col|row|container|d-|text-|bg-|border-)/g.test(cssContent)) {
      frameworks.push('Bootstrap');
    }
    
    if (/@tailwind|@apply|\.(w-|h-|p-|m-|flex|grid)/g.test(cssContent)) {
      frameworks.push('Tailwind');
    }
    
    if (/\.(wp-|block-|aligncenter|alignleft|sticky)/g.test(cssContent)) {
      frameworks.push('WordPress');
    }
    
    if (/\.(foundation|grid-|cell|grid-x)/g.test(cssContent)) {
      frameworks.push('Foundation');
    }
    
    return frameworks;
  }
}

export default CssParser;