// Migration tracker for plugin architecture refactoring
// This file helps track the migration progress of all 17 functions

export interface MigrationItem {
  name: string;
  source: string;
  target: string;
  status?: 'pending' | 'in-progress' | 'completed' | 'tested';
  notes?: string;
}

export interface MigrationCategory {
  [key: string]: MigrationItem[];
}

export const FUNCTIONS_TO_MIGRATE: MigrationCategory = {
  analyze: [
    { 
      name: 'analyze_single_file', 
      source: 'enhanced-tool-definitions.ts', 
      target: 'prompts/analyze/single-file.ts',
      status: 'pending'
    },
    { 
      name: 'security_audit', 
      source: 'enhanced-tool-definitions.ts', 
      target: 'prompts/analyze/security-audit.ts',
      status: 'pending'
    },
    { 
      name: 'analyze_n8n_workflow', 
      source: 'enhanced-tool-definitions.ts', 
      target: 'prompts/analyze/n8n-workflow.ts',
      status: 'pending'
    },
    { 
      name: 'analyze_project_structure', 
      source: 'enhanced-tool-definitions-multifile.ts', 
      target: 'prompts/analyze/project-structure.ts',
      status: 'pending'
    }
  ],
  generate: [
    { 
      name: 'generate_unit_tests', 
      source: 'enhanced-tool-definitions.ts', 
      target: 'prompts/generate/unit-tests.ts',
      status: 'pending'
    },
    { 
      name: 'generate_documentation', 
      source: 'enhanced-tool-definitions.ts', 
      target: 'prompts/generate/documentation.ts',
      status: 'pending'
    },
    { 
      name: 'suggest_refactoring', 
      source: 'enhanced-tool-definitions.ts', 
      target: 'prompts/generate/refactoring.ts',
      status: 'pending'
    },
    { 
      name: 'generate_wordpress_plugin', 
      source: 'enhanced-tool-definitions.ts', 
      target: 'prompts/generate/wordpress-plugin.ts',
      status: 'pending'
    },
    { 
      name: 'generate_responsive_component', 
      source: 'enhanced-tool-definitions.ts', 
      target: 'prompts/generate/responsive-component.ts',
      status: 'pending'
    },
    { 
      name: 'convert_to_typescript', 
      source: 'enhanced-tool-definitions.ts', 
      target: 'prompts/generate/typescript-conversion.ts',
      status: 'pending'
    }
  ],
  multifile: [
    { 
      name: 'compare_integration', 
      source: 'enhanced-tool-definitions-multifile.ts', 
      target: 'prompts/multifile/compare-integration.ts',
      status: 'pending'
    },
    { 
      name: 'trace_execution_path', 
      source: 'enhanced-tool-definitions-multifile.ts', 
      target: 'prompts/multifile/trace-execution.ts',
      status: 'pending'
    },
    { 
      name: 'find_pattern_usage', 
      source: 'enhanced-tool-definitions-multifile.ts', 
      target: 'prompts/multifile/find-patterns.ts',
      status: 'pending'
    },
    { 
      name: 'diff_method_signatures', 
      source: 'enhanced-tool-definitions-multifile.ts', 
      target: 'prompts/multifile/diff-signatures.ts',
      status: 'pending'
    }
  ],
  system: [
    { 
      name: 'health_check', 
      source: 'enhanced-tool-definitions.ts', 
      target: 'system/health-check.ts',
      status: 'pending',
      notes: 'Already mostly completed in placeholder'
    },
    { 
      name: 'clear_analysis_cache', 
      source: 'enhanced-tool-definitions-multifile.ts', 
      target: 'prompts/shared/cache-manager.ts',
      status: 'pending'
    },
    { 
      name: 'get_cache_statistics', 
      source: 'enhanced-tool-definitions-multifile.ts', 
      target: 'prompts/shared/cache-manager.ts',
      status: 'pending'
    }
  ]
};

// Helper function to get migration progress
export function getMigrationProgress(): {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  percentage: number;
} {
  let total = 0;
  let completed = 0;
  let inProgress = 0;
  let pending = 0;

  Object.values(FUNCTIONS_TO_MIGRATE).forEach(category => {
    category.forEach(item => {
      total++;
      switch (item.status) {
        case 'completed':
          completed++;
          break;
        case 'in-progress':
          inProgress++;
          break;
        case 'pending':
        default:
          pending++;
          break;
      }
    });
  });

  return {
    total,
    completed,
    inProgress,
    pending,
    percentage: Math.round((completed / total) * 100)
  };
}

// Helper function to get functions by status
export function getFunctionsByStatus(status: 'pending' | 'in-progress' | 'completed' | 'tested'): MigrationItem[] {
  const functions: MigrationItem[] = [];
  
  Object.values(FUNCTIONS_TO_MIGRATE).forEach(category => {
    category.forEach(item => {
      if (item.status === status) {
        functions.push(item);
      }
    });
  });

  return functions;
}

// Helper function to update migration status
export function updateMigrationStatus(functionName: string, newStatus: 'pending' | 'in-progress' | 'completed' | 'tested', notes?: string): void {
  Object.values(FUNCTIONS_TO_MIGRATE).forEach(category => {
    const item = category.find(f => f.name === functionName);
    if (item) {
      item.status = newStatus;
      if (notes) {
        item.notes = notes;
      }
    }
  });
}

// Export a summary of the migration plan
export function printMigrationSummary(): void {
  console.log('\n=== Migration Plan Summary ===\n');
  
  const progress = getMigrationProgress();
  console.log(`Total Functions: ${progress.total}`);
  console.log(`Completed: ${progress.completed} (${progress.percentage}%)`);
  console.log(`In Progress: ${progress.inProgress}`);
  console.log(`Pending: ${progress.pending}\n`);
  
  Object.entries(FUNCTIONS_TO_MIGRATE).forEach(([category, items]) => {
    console.log(`\n${category.toUpperCase()} (${items.length} functions):`);
    items.forEach(item => {
      const status = item.status || 'pending';
      const statusIcon = status === 'completed' ? '✓' : status === 'in-progress' ? '⚡' : '○';
      console.log(`  ${statusIcon} ${item.name} -> ${item.target}`);
      if (item.notes) {
        console.log(`    Note: ${item.notes}`);
      }
    });
  });
  
  console.log('\n');
}
