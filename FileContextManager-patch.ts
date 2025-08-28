/**
 * Patch for FileContextManager to add findCallsFromMethod functionality
 * Add this to the FileContextManager class in src/core/FileContextManager.ts
 */

// Add to the FileContextManager class:

  /**
   * NEW METHOD: Find all calls made from within a specific method or function
   * This fixes the trace_execution_path functionality
   */
  findCallsFromMethod(className: string | null, methodName: string): MethodCall[] {
    const calls: MethodCall[] = [];
    
    // Build the key for lookup
    const methodKey = className ? `${className}::${methodName}` : methodName;
    
    // First, try to get from the call graph with enhanced filtering
    for (const [filePath, fileCalls] of this.callGraph.entries()) {
      // Get the parsed file to check line numbers
      const parsed = this.fileCache.get(filePath);
      if (!parsed) continue;
      
      if (className) {
        // Look for the class method
        const method = parsed.methods.find(
          m => m.className === className && m.name === methodName
        );
        if (method) {
          // Filter calls that are within the method's line range
          // This is a heuristic since we don't track exact method end lines yet
          const methodLine = method.line;
          const nextMethodLine = this.findNextMethodLine(parsed, methodLine);
          
          const methodCalls = fileCalls.filter(call => {
            // Check if the call is within the method's approximate range
            return call.line >= methodLine && 
                   (nextMethodLine === -1 || call.line < nextMethodLine);
          });
          
          // Update the 'from' field to be more specific
          methodCalls.forEach(call => {
            call.from = `${className}::${methodName}`;
          });
          
          calls.push(...methodCalls);
        }
      } else {
        // Look for the function
        const func = parsed.functions.find(f => f.name === methodName);
        if (func) {
          // Filter calls that are within the function's line range
          const funcLine = func.line;
          const nextFuncLine = this.findNextFunctionLine(parsed, funcLine);
          
          const funcCalls = fileCalls.filter(call => {
            return call.line >= funcLine && 
                   (nextFuncLine === -1 || call.line < nextFuncLine);
          });
          
          // Update the 'from' field to be more specific
          funcCalls.forEach(call => {
            call.from = methodName;
          });
          
          calls.push(...funcCalls);
        }
      }
    }
    
    return calls;
  }

  /**
   * Helper: Find the line number of the next method after the given line
   */
  private findNextMethodLine(parsed: ParsedFile, currentLine: number): number {
    let nextLine = -1;
    
    // Check all methods
    for (const method of parsed.methods) {
      if (method.line > currentLine) {
        if (nextLine === -1 || method.line < nextLine) {
          nextLine = method.line;
        }
      }
    }
    
    // Also check functions
    for (const func of parsed.functions) {
      if (func.line > currentLine) {
        if (nextLine === -1 || func.line < nextLine) {
          nextLine = func.line;
        }
      }
    }
    
    // Also check class definitions
    for (const cls of parsed.classes) {
      if (cls.line > currentLine) {
        if (nextLine === -1 || cls.line < nextLine) {
          nextLine = cls.line;
        }
      }
    }
    
    return nextLine;
  }

  /**
   * Helper: Find the line number of the next function after the given line
   */
  private findNextFunctionLine(parsed: ParsedFile, currentLine: number): number {
    let nextLine = -1;
    
    // Check all functions
    for (const func of parsed.functions) {
      if (func.line > currentLine) {
        if (nextLine === -1 || func.line < nextLine) {
          nextLine = func.line;
        }
      }
    }
    
    // Also check methods
    for (const method of parsed.methods) {
      if (method.line > currentLine) {
        if (nextLine === -1 || method.line < nextLine) {
          nextLine = method.line;
        }
      }
    }
    
    // Also check class definitions
    for (const cls of parsed.classes) {
      if (cls.line > currentLine) {
        if (nextLine === -1 || cls.line < nextLine) {
          nextLine = cls.line;
        }
      }
    }
    
    return nextLine;
  }

  /**
   * Get parsed file data (for debugging and advanced analysis)
   * Add this if it doesn't exist
   */
  getParsedFile(filePath: string): ParsedFile | undefined {
    return this.fileCache.get(path.normalize(filePath));
  }

  /**
   * Get the call graph (for debugging and advanced analysis)
   * Add this if it doesn't exist
   */
  getCallGraph(): Map<string, MethodCall[]> {
    return this.callGraph;
  }
