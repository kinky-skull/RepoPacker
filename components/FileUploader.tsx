import React, { useState, DragEvent, ChangeEvent } from 'react';
import { Icon } from './Icon';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, disabled }) => {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleDrag = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled) return;

    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.zip')) {
        onFileSelect(file);
      } else {
        alert("Пожалуйста, выберите ZIP файл.");
      }
    }
  };

  return (
    <div className={`w-full ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
      <label
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          flex flex-col items-center justify-center w-full h-64 
          border-2 border-dashed rounded-lg cursor-pointer 
          transition-all duration-300
          ${disabled 
            ? 'bg-slate-800/50 border-slate-700' 
            : isDragActive 
              ? 'bg-blue-500/10 border-blue-500' 
              : 'bg-slate-800 border-slate-600 hover:border-blue-500 hover:bg-slate-700/80'
          }
        `}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <Icon name="upload" className={`w-12 h-12 mb-4 ${disabled ? 'text-slate-500' : 'text-blue-400'}`} />
          <p className="mb-2 text-sm text-slate-300">
            <span className="font-semibold">Кликните</span> или перетащите файл
          </p>
          <p className="text-xs text-slate-500">ZIP архив (GitHub Repo)</p>
        </div>
        <input 
          type="file" 
          className="hidden" 
          accept=".zip" 
          onChange={handleChange}
          disabled={disabled}
        />
      </label>
    </div>
  );
};