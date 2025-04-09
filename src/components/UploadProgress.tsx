import React from 'react';

interface UploadProgressProps {
  isUploading: boolean;
  progress: number;
  fileName: string;
}

const UploadProgress: React.FC<UploadProgressProps> = ({ isUploading, progress, fileName }) => {
  if (!isUploading) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
        <h3 className="text-lg font-medium mb-4">Uploading File</h3>
        <p className="text-sm text-gray-500 mb-4 truncate">{fileName}</p>
        
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-in-out" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        
        <p className="text-center text-sm">{progress}% Complete</p>
        <p className="text-center text-xs text-gray-500 mt-2">Please don't close this window during upload</p>
      </div>
    </div>
  );
};

export default UploadProgress; 