import React, { useState, useCallback, useEffect } from 'react';
import { FileUploader } from './components/FileUploader';
import { Icon } from './components/Icon';
import { ProcessingState, ProcessingStatus } from './types';
import { processZipFile, createMarkdownContent } from './utils/zipProcessor';

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

const App: React.FC = () => {
  const [state, setState] = useState<ProcessingState>({
    status: ProcessingStatus.IDLE,
    message: '',
    progress: 0,
  });

  // Cleanup blob URL on unmount or when URL changes
  useEffect(() => {
    return () => {
      if (state.resultUrl) {
        URL.revokeObjectURL(state.resultUrl);
      }
    };
  }, [state.resultUrl]);

  const handleProcess = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setState({
        status: ProcessingStatus.ERROR,
        message: 'Ошибка валидации',
        progress: 0,
        error: `Файл слишком большой. Максимальный размер: ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`
      });
      return;
    }

    try {
      // 1. Start Processing
      setState({
        status: ProcessingStatus.READING_ZIP,
        message: 'Чтение файла...',
        progress: 5,
        fileName: file.name
      });

      // 2. Unzip and extract text
      const { files, tree, stats } = await processZipFile(file, (pct, msg) => {
        setState(prev => ({ ...prev, progress: pct, message: msg }));
      });

      // 3. Generate Markdown
      setState(prev => ({
        ...prev,
        status: ProcessingStatus.GENERATING_MD,
        message: 'Сборка итогового Markdown...',
        progress: 95,
        stats
      }));

      // Removes .zip safely from the end of string (case insensitive)
      const repoName = file.name.replace(/\.zip$/i, '');
      const markdownContent = createMarkdownContent(repoName, tree, files);

      // 4. Create Blob URL
      const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      setState({
        status: ProcessingStatus.COMPLETED,
        message: 'Готово!',
        progress: 100,
        resultUrl: url,
        fileName: `${repoName}_packed.md`,
        stats
      });

    } catch (error: any) {
      console.error(error);
      setState({
        status: ProcessingStatus.ERROR,
        message: 'Произошла ошибка при обработке.',
        progress: 0,
        error: error.message || 'Unknown error'
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState(prev => {
      if (prev.resultUrl) URL.revokeObjectURL(prev.resultUrl);
      return {
        status: ProcessingStatus.IDLE,
        message: '',
        progress: 0
      };
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 flex flex-col items-center">
      
      <header className="mb-10 text-center max-w-2xl">
        <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 mb-4">
          RepoPacker
        </h1>
        <p className="text-slate-400 text-lg">
          Превратите любой GitHub репозиторий (ZIP) в единый контекстный файл для LLM.
        </p>
      </header>

      <main className="w-full max-w-xl bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6 md:p-8 shadow-2xl">
        
        {/* Status: IDLE */}
        {state.status === ProcessingStatus.IDLE && (
          <div className="space-y-6">
            <FileUploader onFileSelect={handleProcess} />
            <div className="text-xs text-center text-slate-500">
              Поддерживает .zip архивы (макс. 100MB). Обработка выполняется локально.
            </div>
          </div>
        )}

        {/* Status: PROCESSING */}
        {(state.status !== ProcessingStatus.IDLE && state.status !== ProcessingStatus.COMPLETED && state.status !== ProcessingStatus.ERROR) && (
          <div className="py-10 flex flex-col items-center">
            <div className="w-full bg-slate-700 rounded-full h-2.5 mb-6 overflow-hidden">
              <div 
                className="bg-blue-500 h-2.5 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${state.progress}%` }}
              ></div>
            </div>
            
            <div className="flex items-center space-x-3 text-blue-300 animate-pulse">
               <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
               <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
               <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
            
            <p className="mt-4 text-lg font-medium text-slate-200">{state.message}</p>
            {state.stats && (
              <p className="mt-2 text-sm text-slate-500">
                Найдено {state.stats.fileCount} файлов ({(state.stats.totalSize / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>
        )}

        {/* Status: ERROR */}
        {state.status === ProcessingStatus.ERROR && (
          <div className="text-center py-6">
            <div className="bg-red-500/10 text-red-400 p-4 rounded-lg mb-6 flex items-center justify-center flex-col">
              <Icon name="alert" className="w-10 h-10 mb-2" />
              <p>{state.error}</p>
            </div>
            <button 
              onClick={reset}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-white font-medium"
            >
              Попробовать снова
            </button>
          </div>
        )}

        {/* Status: COMPLETED */}
        {state.status === ProcessingStatus.COMPLETED && (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400">
                <Icon name="check" className="w-8 h-8" />
              </div>
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Архив обработан!</h2>
              <p className="text-slate-400 mb-1">
                Файл <strong>{state.fileName}</strong> готов.
              </p>
              <div className="flex justify-center gap-4 text-sm text-slate-500 mt-2">
                <span>📄 {state.stats?.fileCount} файлов</span>
                <span>📦 {(state.stats!.totalSize / 1024).toFixed(1)} KB текста</span>
              </div>
            </div>

            <a 
              href={state.resultUrl} 
              download={state.fileName}
              className="flex items-center justify-center space-x-2 w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 rounded-xl transition-all shadow-lg hover:shadow-blue-500/25"
            >
              <Icon name="download" />
              <span>Скачать Markdown</span>
            </a>

            <button 
              onClick={reset}
              className="text-slate-500 hover:text-slate-300 text-sm underline decoration-slate-600 hover:decoration-slate-400 underline-offset-4"
            >
              Обработать другой проект
            </button>
          </div>
        )}

      </main>

      <footer className="mt-12 text-slate-600 text-sm">
        <p>Built with React & Tailwind</p>
      </footer>
    </div>
  );
};

export default App;