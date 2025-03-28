"use client";

import { useState, useEffect } from "react";
import { SidebarDemo } from "@/components/ui/code.demo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { FolderOpen, FileText, Loader2, ChevronLeft } from "lucide-react";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  iconLink?: string;
  size?: string;
  modifiedTime?: string;
  downloadUrl?: string;
  exportLinks?: {
    [key: string]: string;
  };
}

interface FolderPath {
  id: string;
  name: string;
}

export default function DrivePage() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<FolderPath[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadFiles(currentFolder);
  }, [currentFolder]);

  const loadFiles = async (folderId?: string | null) => {
    try {
      const response = await fetch("/api/drive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "list_files",
          folderId: folderId || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to load files");
      }

      const data = await response.json();
      setFiles(data.files);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load files from Google Drive",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (file: DriveFile) => {
    if (file.mimeType.includes("folder")) {
      setFolderPath((prev) => [...prev, { id: file.id, name: file.name }]);
      setCurrentFolder(file.id);
    } else {
      window.open(file.webViewLink, "_blank");
    }
  };

  const handleBackClick = () => {
    if (folderPath.length > 0) {
      const newPath = [...folderPath];
      newPath.pop();
      setFolderPath(newPath);
      setCurrentFolder(newPath.length > 0 ? newPath[newPath.length - 1].id : null);
    }
  };

  const handleFileAction = async (file: DriveFile) => {
    try {
      // Get the access token from the session
      const response = await fetch("/api/drive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "get_token",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get access token");
      }

      const { accessToken } = await response.json();

      // Download the file
      const downloadResponse = await fetch(file.downloadUrl!, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!downloadResponse.ok) {
        throw new Error("Failed to download file");
      }

      // Get the blob
      const blob = await downloadResponse.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: "File downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download file",
        variant: "destructive",
      });
    }
  };

  function formatFileSize(bytes?: string): string {
    if (!bytes) return '';
    const size = parseInt(bytes);
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let filesize = size;
    while (filesize > 1024) {
      filesize = filesize / 1024;
      i++;
    }
    return Math.round(filesize * 100) / 100 + ' ' + units[i];
  }

  function formatDate(dateString?: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return (
    <SidebarDemo>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            {folderPath.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleBackClick}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <h1 className="text-2xl font-semibold text-white">
              {folderPath.length > 0
                ? folderPath[folderPath.length - 1].name
                : "Google Drive"}
            </h1>
          </div>
          <Button variant="outline" onClick={() => window.open("https://drive.google.com", "_blank")}>
            <FolderOpen className="h-4 w-4 mr-2" />
            Open in Drive
          </Button>
        </div>

        {folderPath.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-neutral-400 mb-4">
            <button
              onClick={() => {
                setFolderPath([]);
                setCurrentFolder(null);
              }}
              className="hover:text-white transition-colors"
            >
              Root
            </button>
            {folderPath.map((folder, index) => (
              <div key={folder.id} className="flex items-center">
                <span className="mx-2">/</span>
                <button
                  onClick={() => {
                    const newPath = folderPath.slice(0, index + 1);
                    setFolderPath(newPath);
                    setCurrentFolder(folder.id);
                  }}
                  className="hover:text-white transition-colors"
                >
                  {folder.name}
                </button>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((file) => (
              <Card
                key={file.id}
                className="p-4 bg-neutral-900 border-neutral-800 hover:bg-neutral-800 transition-colors"
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <FileText className="h-8 w-8 text-neutral-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {file.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-neutral-400">
                        {file.mimeType.split(".").pop()?.toUpperCase()}
                      </p>
                      {file.size && (
                        <>
                          <span className="text-xs text-neutral-600">•</span>
                          <p className="text-xs text-neutral-400">
                            {formatFileSize(file.size)}
                          </p>
                        </>
                      )}
                      {file.modifiedTime && (
                        <>
                          <span className="text-xs text-neutral-600">•</span>
                          <p className="text-xs text-neutral-400">
                            {formatDate(file.modifiedTime)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(file.webViewLink, "_blank");
                      }}
                    >
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFileAction(file);
                      }}
                    >
                      Download
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </SidebarDemo>
  );
} 