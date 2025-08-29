export enum TaskType {
  ANALYZE_SINGLE_FILE = 'analyze_single_file',
  GENERATE_TESTS = 'generate_unit_tests',
  DOCUMENT_FUNCTION = 'generate_documentation',
  SUGGEST_REFACTOR = 'suggest_refactoring',
  CHECK_PATTERNS = 'detect_patterns',
  EXPLAIN_CODE = 'explain_code',
  FIND_BUGS = 'validate_syntax',
  OPTIMISE_PERFORMANCE = 'optimise_performance',
  GENERATE_TYPES = 'generate_types',
  CREATE_EXAMPLES = 'create_examples',
  VARIABLE_NAMES = 'suggest_variable_names',
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
  security?: {
    enableSanitisation: boolean;
    enableInjectionDetection: boolean;
    enableOutputEncoding: boolean;
    injectionThreshold: number;
    allowedDirectories: string[];
    maxInputSize: Record<string, number>;
  };
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
