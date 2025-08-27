// Fixed streaming response handler for Local LLM MCP
// This fixes the [object Object] issue when streaming from LM Studio

export async function handleLLMResponse(prediction: AsyncIterable<any>): Promise<string> {
  let response = '';
  
  try {
    for await (const chunk of prediction) {
      // Handle different chunk types
      if (typeof chunk === 'string') {
        response += chunk;
      } else if (chunk && typeof chunk === 'object') {
        // If it's an object with content property (common in streaming)
        if ('content' in chunk) {
          response += chunk.content;
        } else if ('text' in chunk) {
          response += chunk.text;
        } else if ('choices' in chunk && Array.isArray(chunk.choices)) {
          // Handle OpenAI-style streaming format
          for (const choice of chunk.choices) {
            if (choice.delta?.content) {
              response += choice.delta.content;
            } else if (choice.text) {
              response += choice.text;
            }
          }
        } else {
          // Try to stringify if it's a plain object
          try {
            const str = JSON.stringify(chunk);
            if (str !== '[object Object]') {
              response += str;
            }
          } catch {
            console.warn('Skipping non-serializable chunk:', chunk);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error processing streaming response:', error);
    throw error;
  }
  
  return response;
}

// Enhanced response formatter with schema enforcement
export function formatWithSchema(response: string, schema?: any): any {
  // First, try to extract JSON from the response
  let jsonData = null;
  
  // Try direct JSON parse
  try {
    jsonData = JSON.parse(response);
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      try {
        jsonData = JSON.parse(jsonMatch[1]);
      } catch {
        // Continue with text processing
      }
    }
  }
  
  // If we have a schema and JSON data, validate and structure it
  if (schema && jsonData) {
    return enforceSchema(jsonData, schema);
  }
  
  // Otherwise, return structured text response
  return {
    summary: extractSummary(response),
    content: response,
    confidence: 0.85,
    metadata: {
      format: jsonData ? 'json' : 'text',
      length: response.length
    }
  };
}

function enforceSchema(data: any, schema: any): any {
  const result: any = {};
  
  if (schema.type === 'object' && schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      const prop = propSchema as any;
      
      if (data[key] !== undefined) {
        if (prop.type === 'string') {
          result[key] = String(data[key]);
        } else if (prop.type === 'number' || prop.type === 'integer') {
          result[key] = Number(data[key]) || 0;
        } else if (prop.type === 'boolean') {
          result[key] = Boolean(data[key]);
        } else if (prop.type === 'array') {
          result[key] = Array.isArray(data[key]) ? data[key] : [];
        } else if (prop.type === 'object') {
          result[key] = typeof data[key] === 'object' ? data[key] : {};
        } else {
          result[key] = data[key];
        }
      } else if (schema.required?.includes(key)) {
        // Provide default for required fields
        if (prop.type === 'string') result[key] = '';
        else if (prop.type === 'number' || prop.type === 'integer') result[key] = 0;
        else if (prop.type === 'boolean') result[key] = false;
        else if (prop.type === 'array') result[key] = [];
        else if (prop.type === 'object') result[key] = {};
      }
    }
  }
  
  return result;
}

function extractSummary(text: string): string {
  // Extract first meaningful line or paragraph
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length > 0) {
    // Remove markdown headers
    return lines[0].replace(/^#+\s*/, '').trim();
  }
  return 'Analysis complete';
}