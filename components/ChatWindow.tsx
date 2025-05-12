"use client"

import { useState, useRef, useEffect } from "react"
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input"
import { Button } from "@/components/ui/button"
import { ArrowUp, Paperclip, Square, X, MessageCircle, Loader2, Settings } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"

type Message = {
  id: string
  content: string
  role: "user" | "assistant" | "system"
  timestamp: Date
}

export function ChatWindow() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [hasApiKey, setHasApiKey] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      content: "Hello! How can I help you today? I can answer questions about your CRM data if you have an OpenAI API key set.",
      role: "assistant",
      timestamp: new Date(),
    },
  ])
  
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Check if API key exists on mount and on window focus
  useEffect(() => {
    const checkApiKey = async () => {
      console.log("ChatWindow: Checking API key status...");
      if (!session) {
        console.log("ChatWindow: No session, API key check skipped");
        setHasApiKey(false);
        return;
      }
      
      try {
        // Try three methods to verify API key exists
        // Method 1: Use the direct test endpoint that bypasses RLS
        console.log("ChatWindow: Trying API key test endpoint with RLS bypass...");
        try {
          const testResponse = await fetch('/api/api-key-test?bypass_rls=true', {
            method: 'GET',
            credentials: 'include'
          });
          
          if (testResponse.ok) {
            const testData = await testResponse.json();
            
            // If this endpoint shows any workspace with an API key
            if (testData.workspaces && testData.workspaces.length > 0) {
              console.log("ChatWindow: Found API keys in test endpoint:", testData.workspaces.length);
              setHasApiKey(true);
              return; // Successfully verified API key exists
            }
          }
          console.log("ChatWindow: No API keys found in test endpoint");
        } catch (testError) {
          console.error("ChatWindow: Error using test endpoint:", testError);
        }
        
        // Method 2: Direct check with the API that processes messages
        console.log("ChatWindow: Checking API key via chat API...");
        const response = await fetch('/api/chat', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: "system",
                content: "API_KEY_CHECK_ONLY"
              }
            ]
          })
        });
        
        console.log("ChatWindow: API key check response status:", response.status);
        
        // If we get a 400 error with code API_KEY_MISSING, it means the backend found the workspace but no key
        // If we get a 200, it means the key exists and is valid
        if (response.ok) {
          console.log("ChatWindow: API key is valid");
          setHasApiKey(true);
        } else {
          const errorData = await response.json();
          
          console.log("ChatWindow: API key check result:", {
            status: response.status,
            code: errorData.code,
            error: errorData.error
          });
          
          // Any error other than API_KEY_MISSING might be a system error
          // 400 with API_KEY_MISSING means workspace was found but key is missing
          if (response.status === 400 && errorData.code === 'API_KEY_MISSING') {
            console.log("ChatWindow: API key is missing");
            setHasApiKey(false);
          } else if (response.status === 400 && errorData.code === 'API_KEY_INVALID_FORMAT') {
            console.log("ChatWindow: API key has invalid format");
            setHasApiKey(false);
          } else {
            // For other errors like 500, assume the key might exist
            console.log("ChatWindow: API check failed, fallback to default");
            setHasApiKey(!!session);
          }
        }
      } catch (error) {
        console.error("ChatWindow: Error checking API key:", error);
        // Fall back to assuming key might exist if logged in
        setHasApiKey(!!session);
      }
    };
    
    checkApiKey();
    
    // Also check when window regains focus
    const handleFocus = () => {
      console.log("ChatWindow: Window focus detected, rechecking API key");
      checkApiKey();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [session]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSubmit = async () => {
    if (input.trim() || files.length > 0) {
      // Add user message
      const userMessage: Message = {
        id: crypto.randomUUID(),
        content: input.trim(),
        role: "user",
        timestamp: new Date(),
      }
      
      setMessages(prev => [...prev, userMessage])
      setIsLoading(true)
      setInput("")
      
      try {
        // Filter to just the content and role for the API
        const messageHistory = messages
          .filter(msg => msg.id !== "welcome" && msg.role !== "system")
          .concat(userMessage)
          .map(({ content, role }) => ({ content, role }));
          
        // Make API request with streaming enabled
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: messageHistory,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          const error = new Error(errorData.error || "Failed to get a response");
          // Add additional properties to the error object
          (error as any).code = errorData.code;
          (error as any).details = errorData.details;
          (error as any).workspaceId = errorData.workspaceId;
          throw error;
        }
        
        // Create a placeholder for the streaming response
        const aiResponseId = crypto.randomUUID();
        const aiResponse: Message = {
          id: aiResponseId,
          content: "",
          role: "assistant",
          timestamp: new Date(),
        };
        
        setMessages(prev => [...prev, aiResponse]);
        
        // Handle the stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        
        if (!reader) {
          throw new Error("Failed to get response reader");
        }
        
        let done = false;
        let accumulatedResponse = "";
        
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            accumulatedResponse += chunk;
            
            // Update the AI message content
            setMessages(messages => 
              messages.map(message => 
                message.id === aiResponseId 
                  ? { ...message, content: accumulatedResponse } 
                  : message
              )
            );
          }
        }
      } catch (error) {
        console.error("Error getting AI response:", error);
        // Add error message
        let errorMessage: Message;
        
        // Check for specific error codes
        const errorCode = (error as any).code;
        
        if (errorCode === 'API_KEY_MISSING') {
          errorMessage = {
            id: crypto.randomUUID(),
            content: "⚠️ **OpenAI API Key Required** ⚠️\n\n" +
                     "Your chatbot needs an OpenAI API key to function. Please:\n\n" +
                     "1. Go to the [Settings Page](/settings)\n" +
                     "2. Scroll to the 'AI Configuration' section\n" +
                     "3. Enter your OpenAI API key (starts with 'sk-')\n" +
                     "4. Click 'Save Key'\n\n" +
                     "If you don't have an API key, you can get one from [OpenAI's website](https://platform.openai.com/api-keys).",
            role: "assistant",
            timestamp: new Date(),
          };
        } else if (errorCode === 'API_KEY_INVALID_FORMAT') {
          errorMessage = {
            id: crypto.randomUUID(),
            content: "⚠️ **Invalid API Key Format** ⚠️\n\n" +
                     "The OpenAI API key saved in your workspace has an invalid format. A valid key:\n\n" +
                     "• Starts with 'sk-'\n" +
                     "• Is at least 30 characters long\n\n" +
                     "Please update your key in the [Settings Page](/settings) under AI Configuration.",
            role: "assistant",
            timestamp: new Date(),
          };
        } else if (errorCode === 'DB_SETTINGS_ERROR') {
          errorMessage = {
            id: crypto.randomUUID(),
            content: "⚠️ **Database Connection Error** ⚠️\n\n" +
                     "There was a problem connecting to the database to retrieve your workspace settings. " +
                     "This might be a temporary issue. Please try again later or contact support if the problem persists.",
            role: "assistant",
            timestamp: new Date(),
          };
        } else {
          // Generic error message
          errorMessage = {
            id: crypto.randomUUID(),
            content: "⚠️ **Error Processing Request** ⚠️\n\n" +
                     "I encountered an error while processing your request. This might be due to:\n\n" +
                     "• An invalid or expired API key\n" +
                     "• A temporary server issue\n" +
                     "• Problems with the OpenAI service\n\n" +
                     "Please check your API key in the [Settings Page](/settings) or try again later.\n\n" +
                     "Error details: " + (error instanceof Error ? error.message : "Unknown error"),
            role: "assistant",
            timestamp: new Date(),
          };
        }
        
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsLoading(false)
        setFiles([])
      }
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files)
      setFiles(prev => [...prev, ...newFiles])
    }
  }

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
    if (uploadInputRef?.current) {
      uploadInputRef.current.value = ""
    }
  }

  // Function to render message content with links
  const renderMessageContent = (content: string) => {
    // Replace markdown-style links with HTML links
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = content.split(linkRegex);
    
    if (parts.length === 1) {
      // No links, return plain text
      return <p className="whitespace-pre-wrap">{content}</p>;
    }
    
    const elements: React.ReactNode[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (i % 3 === 0) {
        // This is text before/after/between links
        if (parts[i]) {
          elements.push(<span key={i}>{parts[i]}</span>);
        }
      } else if (i % 3 === 1) {
        // This is the link text
        const linkText = parts[i];
        const linkUrl = parts[i + 1];
        
        elements.push(
          <a 
            key={i} 
            className="text-blue-400 hover:underline cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              if (linkUrl.startsWith('/')) {
                router.push(linkUrl);
              } else {
                window.open(linkUrl, '_blank');
              }
            }}
          >
            {linkText}
          </a>
        );
      }
      // Skip the URL part as we've already used it
    }
    
    return <p className="whitespace-pre-wrap">{elements}</p>;
  };

  return (
    <>
      {/* Chat Button */}
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsOpen(prev => !prev)}
          className="size-12 rounded-full bg-primary shadow-lg"
        >
          <MessageCircle className="size-6" />
        </Button>
      </div>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-20 right-4 z-50 w-full max-w-md"
          >
            <div className="flex h-[500px] flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
                <h2 className="text-lg font-medium text-white">AI Assistant</h2>
                <div className="flex items-center gap-2">
                  {!hasApiKey && session && (
                    <Link href="/settings">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Configure API Key in Settings"
                        className="text-neutral-400 hover:text-white"
                      >
                        <Settings className="size-5" />
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="text-neutral-400 hover:text-white"
                  >
                    <X className="size-5" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex w-full mb-4",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-2",
                        message.role === "user"
                          ? "bg-neutral-900 text-primary-foreground border border-neutral-800"
                          : "bg-neutral-900 text-white border border-neutral-800"
                      )}
                    >
                      {renderMessageContent(message.content)}
                      <div className="mt-1 text-right text-xs opacity-70">
                        {message.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex w-full justify-start mb-4">
                    <div className="max-w-[80%] rounded-lg px-4 py-2 bg-neutral-900 text-white border border-neutral-800">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <p>AI is thinking...</p>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-neutral-800 p-4">
                {!hasApiKey && (
                  <div className="mb-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-sm text-yellow-300">
                    <p className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Please set your OpenAI API key in <Link href="/settings" className="underline hover:text-yellow-200">workspace settings</Link>.
                    </p>
                  </div>
                )}
                <PromptInput
                  value={input}
                  onValueChange={setInput}
                  isLoading={isLoading}
                  onSubmit={handleSubmit}
                  className="w-full bg-neutral-900 border-neutral-800"
                >
                  {files.length > 0 && (
                    <div className="flex flex-wrap gap-2 pb-2">
                      {files.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 rounded-lg bg-neutral-800 px-3 py-2 text-sm"
                        >
                          <Paperclip className="size-4" />
                          <span className="max-w-[120px] truncate">{file.name}</span>
                          <button
                            onClick={() => handleRemoveFile(index)}
                            className="rounded-full p-1 hover:bg-neutral-700"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <PromptInputTextarea 
                    placeholder={hasApiKey ? "Ask about your CRM data..." : "Set API key in workspace settings to enable AI chat"}
                    className="text-neutral-100 placeholder:text-neutral-500" 
                    disabled={!hasApiKey}
                  />

                  <PromptInputActions className="flex items-center justify-between gap-2 pt-2">
                    <PromptInputAction tooltip="Attach files">
                      <label
                        htmlFor="chat-file-upload"
                        className={cn(
                          "flex h-8 w-8 cursor-pointer items-center justify-center rounded-2xl hover:bg-neutral-800",
                          !hasApiKey && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <input
                          type="file"
                          multiple
                          ref={uploadInputRef}
                          onChange={handleFileChange}
                          className="hidden"
                          id="chat-file-upload"
                          disabled={!hasApiKey}
                        />
                        <Paperclip className="size-5 text-neutral-400" />
                      </label>
                    </PromptInputAction>

                    <PromptInputAction
                      tooltip={isLoading ? "Stop generation" : "Send message"}
                    >
                      <Button
                        variant="default"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={handleSubmit}
                        disabled={!hasApiKey || isLoading || (!input.trim() && files.length === 0)}
                      >
                        {isLoading ? (
                          <Square className="size-5 fill-current" />
                        ) : (
                          <ArrowUp className="size-5" />
                        )}
                      </Button>
                    </PromptInputAction>
                  </PromptInputActions>
                </PromptInput>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
} 