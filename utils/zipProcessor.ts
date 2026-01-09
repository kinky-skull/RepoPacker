import JSZip from 'jszip';
import { ProcessedFile } from '../types';

// List of extensions to treat as text
const TEXT_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'json', 'css', 'scss', 'html', 'md', 'txt', 
  'py', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs', 'php', 'rb', 'sh', 
  'yaml', 'yml', 'xml', 'sql', 'gitignore', 'env', 'dockerfile'
]);

// Directories to ignore
const IGNORE_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'coverage', '.idea', '.vscode', '__pycache__'
]);

// Files to ignore
const IGNORE_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.DS_Store'
]);

const isTextFile = (filename: string): boolean => {
  const parts = filename.split('.');
  const ext = parts.pop()?.toLowerCase();
  if (!ext) return false; // files without extension often binary or config, allow some safe ones?
  // Check against allowlist or if it's a known config file
  if (['dockerfile', 'makefile', 'license'].includes(parts.join('.').toLowerCase())) return true;
  return TEXT_EXTENSIONS.has(ext);
};

const shouldIgnore = (path: string): boolean => {
  const parts = path.split('/');
  
  // Check if any part of the path is in ignored dirs
  for (const part of parts) {
    if (IGNORE_DIRS.has(part)) return true;
  }

  // Check filename
  const filename = parts[parts.length - 1];
  if (IGNORE_FILES.has(filename)) return true;
  
  // Ignore dotfiles generally (except .gitignore, .env which are handled in text check usually)
  // But let's keep it simple: strict ignore list
  return false;
};

export const generateTreeString = (paths: string[]): string => {
  let output = '';
  // Simple flat sort for tree view
  paths.sort().forEach(path => {
    const depth = path.split('/').length - 1;
    const indent = '  '.repeat(depth);
    const name = path.split('/').pop();
    output += `${indent}- ${name}\n`;
  });
  return output;
};

export const processZipFile = async (
  file: File, 
  onProgress: (percent: number, message: string) => void
): Promise<{ files: ProcessedFile[], tree: string, stats: { fileCount: number, totalSize: number, tokenEstimate: number } }> => {
  
  onProgress(10, "Чтение ZIP архива...");
  
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);
  
  const files: ProcessedFile[] = [];
  const paths: string[] = [];
  let totalSize = 0;

  const fileEntries = Object.keys(loadedZip.files);
  const totalFiles = fileEntries.length;
  let processedCount = 0;

  onProgress(20, "Фильтрация и распаковка...");

  for (const filename of fileEntries) {
    const zipEntry = loadedZip.files[filename];
    
    processedCount++;
    if (processedCount % 10 === 0) {
      const progress = 20 + Math.floor((processedCount / totalFiles) * 70); // Up to 90%
      onProgress(progress, `Обработка: ${filename}`);
    }

    if (zipEntry.dir) continue;
    if (shouldIgnore(filename)) continue;

    if (isTextFile(filename)) {
      paths.push(filename);
      const content = await zipEntry.async('string');
      totalSize += content.length;
      
      files.push({
        path: filename,
        content: content,
        extension: filename.split('.').pop() || ''
      });
    }
  }

  const tree = generateTreeString(paths);

  return {
    files,
    tree,
    stats: {
      fileCount: files.length,
      totalSize,
      tokenEstimate: Math.ceil(totalSize / 4)
    }
  };
};

export const createMarkdownContent = (
  repoName: string,
  tree: string,
  files: ProcessedFile[]
): string => {
  let md = `# Project: ${repoName}\n\n`;
  
  md += `## 📂 Project Structure\n\n\`\`\`\n${tree}\n\`\`\`\n\n`;
  
  md += `## 💻 File Contents\n\n`;

  files.forEach(f => {
    md += `### ${f.path}\n`;
    md += `\`\`\`${f.extension}\n`;
    md += f.content;
    md += `\n\`\`\`\n\n`;
  });

  return md;
};