import JSZip from 'jszip';
import { ProcessedFile } from '../types';

// List of extensions to treat as text
const TEXT_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'json', 'css', 'scss', 'html', 'md', 'txt', 
  'py', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs', 'php', 'rb', 'sh', 
  'yaml', 'yml', 'xml', 'sql', 'gitignore', 'env', 'dockerfile', 'toml', 'gradle', 'properties'
]);

// Directories to ignore
const IGNORE_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'coverage', '.idea', '.vscode', '__pycache__', 'bin', 'obj'
]);

// Files to ignore
const IGNORE_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.DS_Store', 'thumbs.db'
]);

const isTextFile = (filename: string): boolean => {
  // Get basename (filename without path)
  const basename = filename.split('/').pop()?.toLowerCase();
  if (!basename) return false;

  // Check known config files without extension
  if (['dockerfile', 'makefile', 'license', 'jenkinsfile', 'vagrantfile'].includes(basename)) return true;

  // Get extension
  const parts = basename.split('.');
  if (parts.length === 1) return false; // Binary file or script without extension not in whitelist
  
  const ext = parts.pop();
  return ext ? TEXT_EXTENSIONS.has(ext) : false;
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
  
  return false;
};

/**
 * Generates a visual directory tree structure string
 */
export const generateTreeString = (paths: string[]): string => {
  const tree: any = {};

  // Build tree object
  paths.forEach(path => {
    const parts = path.split('/');
    let current = tree;
    parts.forEach(part => {
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    });
  });

  // Recursive print function
  const printTree = (node: any, prefix = ''): string => {
    let output = '';
    const keys = Object.keys(node).sort();
    
    keys.forEach((key, index) => {
      const isLast = index === keys.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const childPrefix = isLast ? '    ' : '│   ';
      const isFile = Object.keys(node[key]).length === 0;
      
      output += `${prefix}${connector}${key}${isFile ? '' : '/'}\n`;
      
      if (!isFile) {
        output += printTree(node[key], prefix + childPrefix);
      }
    });
    
    return output;
  };

  return printTree(tree).trim();
};

export const processZipFile = async (
  file: File, 
  onProgress: (percent: number, message: string) => void
): Promise<{ files: ProcessedFile[], tree: string, stats: { fileCount: number, totalSize: number, tokenEstimate: number } }> => {
  
  onProgress(5, "Чтение ZIP архива...");
  
  const zip = new JSZip();
  let loadedZip;
  try {
    loadedZip = await zip.loadAsync(file);
  } catch (e) {
    throw new Error("Не удалось открыть ZIP файл. Возможно он поврежден.");
  }
  
  const files: ProcessedFile[] = [];
  const paths: string[] = [];
  let totalSize = 0;

  const fileEntries = Object.keys(loadedZip.files);
  const totalFiles = fileEntries.length;
  
  // Check for empty zip
  if (totalFiles === 0) {
    onProgress(100, "Архив пустой");
    return {
      files: [],
      tree: "(Empty Archive)",
      stats: { fileCount: 0, totalSize: 0, tokenEstimate: 0 }
    };
  }

  let processedCount = 0;
  const textEncoder = new TextEncoder();

  onProgress(10, "Анализ файлов...");

  for (const filename of fileEntries) {
    const zipEntry = loadedZip.files[filename];
    processedCount++;

    // Update progress periodically or on last file to ensure we hit 100% of this phase
    if (totalFiles > 0 && (processedCount % 5 === 0 || processedCount === totalFiles)) {
      const progress = 10 + Math.floor((processedCount / totalFiles) * 80); // 10% -> 90%
      onProgress(progress, `Обработка: ${filename.split('/').pop()}`);
    }

    if (zipEntry.dir) continue;
    if (shouldIgnore(filename)) continue;

    if (isTextFile(filename)) {
      paths.push(filename);
      const content = await zipEntry.async('string');
      // Calculate accurate byte size for UTF-8
      const byteLength = textEncoder.encode(content).length;
      totalSize += byteLength;
      
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
      tokenEstimate: Math.ceil(totalSize / 4) // Crude estimate: 4 chars (approx) per token
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
    // Generate a code fence that is longer than any fence inside the content
    let fenceLength = 3;
    const backticks = f.content.match(/`+/g);
    if (backticks) {
      for (const match of backticks) {
        if (match.length >= fenceLength) {
          fenceLength = match.length + 1;
        }
      }
    }
    const fence = '`'.repeat(fenceLength);

    md += `### ${f.path}\n`;
    md += `${fence}${f.extension}\n`;
    md += f.content;
    md += `\n${fence}\n\n`;
  });

  return md;
};