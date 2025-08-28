// Fixed parseClassBody implementation for FileContextManager
// This file contains the corrected method parsing logic

/**
 * Parse class body to extract methods and properties
 * FIXED VERSION - properly detects methods in modern JavaScript classes
 */
function parseClassBody(lines, startIndex, classInfo) {
    let braceCount = 0;
    let inClass = false;
    let currentIndent = 0;
    
    // Get the class line indentation
    const classLine = lines[startIndex];
    const classIndent = classLine ? classLine.match(/^(\s*)/)[1].length : 0;
    
    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        
        const trimmedLine = line.trim();
        const lineIndent = line.match(/^(\s*)/)[1].length;
        
        // Track braces to know when class ends
        for (const char of line) {
            if (char === '{') {
                braceCount++;
                inClass = true;
            } else if (char === '}') {
                braceCount--;
                if (braceCount === 0 && inClass) {
                    return; // Class ended
                }
            }
        }
        
        if (inClass && braceCount > 0) {
            // Skip comments
            if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine.startsWith('*')) {
                continue;
            }
            
            // Parse constructor
            const constructorMatch = trimmedLine.match(/^constructor\s*\(/);
            if (constructorMatch) {
                classInfo.methods.push({
                    name: 'constructor',
                    line: i + 1,
                    type: 'constructor'
                });
                continue;
            }
            
            // Parse methods (including async, static, get/set)
            // Match patterns like: methodName() {, async methodName() {, static methodName() {, get methodName() {
            const methodMatch = trimmedLine.match(/^(static\s+)?(async\s+)?(get\s+|set\s+)?(\w+)\s*\([^)]*\)\s*{?/);
            if (methodMatch && !trimmedLine.includes('function') && methodMatch[4] !== 'if' && methodMatch[4] !== 'for' && methodMatch[4] !== 'while') {
                const methodName = methodMatch[4];
                // Store both simple name and detailed info
                if (typeof classInfo.methods[0] === 'string') {
                    // If methods array contains strings, just add the name
                    classInfo.methods.push(methodName);
                } else {
                    // If methods array can contain objects, add detailed info
                    classInfo.methods.push({
                        name: methodName,
                        line: i + 1,
                        isStatic: !!methodMatch[1],
                        isAsync: !!methodMatch[2],
                        isGetter: methodMatch[3] === 'get ',
                        isSetter: methodMatch[3] === 'set '
                    });
                }
                continue;
            }
            
            // Parse arrow function methods
            // Match patterns like: methodName = () => {, methodName = async () => {
            const arrowMethodMatch = trimmedLine.match(/^(\w+)\s*=\s*(async\s+)?\([^)]*\)\s*=>/);
            if (arrowMethodMatch) {
                const methodName = arrowMethodMatch[1];
                if (typeof classInfo.methods[0] === 'string') {
                    classInfo.methods.push(methodName);
                } else {
                    classInfo.methods.push({
                        name: methodName,
                        line: i + 1,
                        isArrow: true,
                        isAsync: !!arrowMethodMatch[2]
                    });
                }
                continue;
            }
            
            // Parse properties
            // Match patterns like: propertyName = value, propertyName;
            const propMatch = trimmedLine.match(/^(static\s+)?(\w+)\s*([:=;])/);
            if (propMatch && !methodMatch && propMatch[2] !== 'this' && propMatch[2] !== 'super') {
                const propName = propMatch[2];
                if (!classInfo.properties.includes(propName)) {
                    classInfo.properties.push(propName);
                }
            }
        }
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseClassBody };
}
