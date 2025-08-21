export enum TaskType {
  CODE_STRUCTURE = 'code_structure',
  GENERATE_TESTS = 'generate_tests',
  DOCUMENT_FUNCTION = 'document_function',
  SUGGEST_REFACTOR = 'suggest_refactor',
  CHECK_PATTERNS = 'check_patterns',
  EXPLAIN_CODE = 'explain_code',
  FIND_BUGS = 'find_bugs',
  OPTIMISE_PERFORMANCE = 'optimise_performance',
  GENERATE_TYPES = 'generate_types',
  CREATE_EXAMPLES = 'create_examples',
  ANALYZE_FILE = 'analyze_file',
  ANALYZE_CSV_DATA = 'analyze_csv_data'
}

export interface OffloadTask {
  task: TaskType;
  content?: string;
  filePath?: string;
  language?: string;
  instructions?: string;
  extractFormat?: 'json' | 'list' | 'summary';
  filterCriteria?: string;
  columns?: string[];
  returnFormat?: 'json' | 'csv' | 'list';
}

export interface TaskPrompt {
  systemPrompt: string;
  prompt: (content: string, language?: string, additionalParams?: any) => string;
}

export interface Config {
  lmStudioUrl: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  timeout: number;
  maxFileSize: number;
  supportedFileTypes: string[];
  taskPrompts: Record<TaskType, TaskPrompt>;
}

export interface FileAnalysisParams {
  filePath: string;
  instructions?: string;
  extractFormat?: 'json' | 'list' | 'summary';
}

export interface CsvAnalysisParams {
  filePath: string;
  filterCriteria: string;
  columns?: string[];
  returnFormat?: 'json' | 'csv' | 'list';
}
