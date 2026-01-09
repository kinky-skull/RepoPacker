export interface ProcessedFile {
  path: string;
  content: string;
  extension: string;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  READING_ZIP = 'READING_ZIP',
  GENERATING_MD = 'GENERATING_MD',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface ProcessingState {
  status: ProcessingStatus;
  message: string;
  progress: number;
  error?: string;
  resultUrl?: string;
  fileName?: string;
  stats?: {
    fileCount: number;
    totalSize: number;
    tokenEstimate: number;
  };
}