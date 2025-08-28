// Helper function to provide complete Record types for all ProjectTypes
import { ProjectType } from './enhanced-types.js';

export function getCompleteRecord<T>(partial: Partial<Record<ProjectType, T>>, defaultValue: T): Record<ProjectType, T> {
  const allTypes: ProjectType[] = [
    'wordpress-plugin', 'wordpress-theme', 'react-app', 'react-component',
    'n8n-node', 'n8n-workflow', 'node-api', 'html-component',
    'browser-extension', 'cli-tool', 'generic'
  ];
  
  const complete: Record<ProjectType, T> = {} as Record<ProjectType, T>;
  allTypes.forEach(type => {
    complete[type] = partial[type] || defaultValue;
  });
  
  return complete;
}

// Use this helper to fix the incomplete Record types in the file
