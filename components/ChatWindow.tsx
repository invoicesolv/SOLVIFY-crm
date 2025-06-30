"use client"

import { useState, useRef, useEffect } from "react"
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input"
import { Button } from "@/components/ui/button"
import { ArrowUp, Paperclip, Square, X, MessageCircle, Loader2, Settings, Bot, Calendar, FolderOpen, Target, ChevronDown, ChevronUp, Brain } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { useAuth } from '@/lib/auth-client';
import Link from "next/link"
import { useRouter } from "next/navigation"
import { supabaseClient } from '@/lib/supabase-client'
import { AutomationMemory } from '@/lib/automation-memory'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

type Message = {
  id: string
  content: string
  role: "user" | "assistant" | "system"
  timestamp: Date
  thinking_process?: string
  automated?: boolean
  model?: string
}

type AutomationWorkflow = {
  id: string
  name: string
  description: string
  status: 'active' | 'paused' | 'draft'
  settings: {
    automation_config?: {
      nodes?: Array<{
        subtype: string
        data: any
      }>
    }
  }
  config?: {
    model: string
    systemInstructions: string
    integrations: {
      projects: boolean
      calendar: boolean
      reasoning: boolean
    }
    trigger: {
      keywords: string[]
      chatPlatform: string
    }
  }
  isPrimary?: boolean
}

const supabase = supabaseClient;

export function ChatWindow({ fullPage = false }: { fullPage?: boolean } = {}) {
  const { user, session } = useAuth()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(fullPage ? true : false)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [showAutomationSettings, setShowAutomationSettings] = useState(false)
  const [availableWorkflows, setAvailableWorkflows] = useState<AutomationWorkflow[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null)
  const [automationEnabled, setAutomationEnabled] = useState(false)
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set())
  const [currentThinking, setCurrentThinking] = useState<string>("")
  const [isThinkingComplete, setIsThinkingComplete] = useState(false)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
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

  const toggleThinking = (messageId: string) => {
    setExpandedThinking(prev => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  // Load chat history from automation memory
  const loadChatHistory = async (workspaceId: string, workflowId: string) => {
    try {
      console.log('📚 Loading chat history from automation memory...', { workspaceId, workflowId });
      
      const memory = new AutomationMemory(workspaceId, workflowId);
      const result = await memory.get('chat_history');
      
      if (result.success && result.exists && result.data) {
        console.log('✅ Loaded chat history:', result.data.length, 'messages');
        const loadedMessages = result.data.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        
        // Keep welcome message and add loaded messages
        const welcomeMessage = messages.find(m => m.id === "welcome");
        const allMessages = welcomeMessage ? [welcomeMessage, ...loadedMessages] : loadedMessages;
        setMessages(allMessages);
      } else {
        console.log('📝 No existing chat history found, starting fresh');
      }
    } catch (error) {
      console.error('❌ Error loading chat history:', error);
    }
  };

  // Save chat history to automation memory
  const saveChatHistory = async (workspaceId: string, workflowId: string, messages: Message[]) => {
    try {
      // Filter out welcome message and only save user/assistant messages
      const messagesToSave = messages.filter(msg => 
        msg.id !== "welcome" && 
        (msg.role === "user" || msg.role === "assistant")
      );
      
      if (messagesToSave.length === 0) return;
      
      console.log('💾 Saving chat history to automation memory...', messagesToSave.length, 'messages');
      
      const memory = new AutomationMemory(workspaceId, workflowId);
      const result = await memory.store('chat_history', messagesToSave, 24); // Expire after 24 hours
      
      if (result.success) {
        console.log('✅ Chat history saved successfully');
      } else {
        console.error('❌ Failed to save chat history:', result.error);
      }
    } catch (error) {
      console.error('❌ Error saving chat history:', error);
    }
  };

  // Get workspace ID from team membership
  const getWorkspaceId = async () => {
    if (!user?.id) return null;
    
    try {
      // Get user's workspace from team_members (prioritize admin role)
      const { data: membership } = await supabase
        .from('team_members')
        .select('workspace_id, role')
        .eq('user_id', user.id)
        .order('role', { ascending: true }) // admin comes first
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      return membership?.workspace_id || null;
    } catch (error) {
      console.error('❌ Error fetching workspace ID:', error);
      return null;
    }
  };

  // Load available automation workflows and chat history
  useEffect(() => {
    const loadWorkflows = async () => {
      if (!user?.id) return
      
      try {
        console.log('🔄 Loading workflows for user:', user.id);
        
        // Get workspace ID first
        const wsId = await getWorkspaceId();
        setWorkspaceId(wsId);
        
        const { data: workflows, error } = await supabase
          .from('cron_jobs')
          .select('*')
          .eq('user_id', user.id)
          .eq('job_type', 'workflow')
        
        if (error) {
          console.error('❌ Error loading workflows:', error)
          return
        }

        console.log('📋 Found workflows:', workflows?.length || 0);

        // Filter workflows that have chatbot integration (matching chat API logic)
        const chatbotWorkflows = workflows?.filter(workflow => {
          const configNodes = workflow.settings?.automation_config?.nodes || [];
          const workflowNodes = workflow.settings?.workflow_data?.nodes || [];
          const nodes = configNodes.length > 0 ? configNodes : workflowNodes;
          
          const hasChatbotNode = nodes.some((node: any) => node.subtype === 'chatbot_integration');
          
          console.log('🔍 Workflow check:', {
            id: workflow.id,
            name: workflow.settings?.workflow_data?.name || 'Unnamed',
            status: workflow.status,
            hasChatbotNode,
            nodeCount: nodes.length,
            nodeTypes: nodes.map((n: any) => n.subtype)
          });
          
          return hasChatbotNode;
        }) || []

        console.log('🤖 Found chatbot workflows:', chatbotWorkflows.length);
        setAvailableWorkflows(chatbotWorkflows)
        
        // Auto-enable automation if workflows are found
        if (chatbotWorkflows.length > 0 && !selectedWorkflow) {
          const firstWorkflow = chatbotWorkflows[0];
          console.log('🎯 Auto-selecting first workflow:', firstWorkflow.id);
          setSelectedWorkflow(firstWorkflow.id);
          setAutomationEnabled(true);
          
          // Load chat history for this workflow
          if (wsId) {
            await loadChatHistory(wsId, firstWorkflow.id);
          }
        }
      } catch (error) {
        console.error('❌ Error loading automation workflows:', error)
      }
    }

    loadWorkflows()
  }, [user])

  // Load chat history when selected workflow changes
  useEffect(() => {
    const loadHistoryForWorkflow = async () => {
      if (workspaceId && selectedWorkflow && automationEnabled) {
        console.log('🔄 Loading chat history for workflow change:', selectedWorkflow);
        await loadChatHistory(workspaceId, selectedWorkflow);
      }
    };

    loadHistoryForWorkflow();
  }, [selectedWorkflow, workspaceId, automationEnabled])

  // Fetch automation settings for chatbot
  const fetchAutomationSettings = async () => {
    try {
      console.log('⚙️ Fetching automation settings for chatbot...');
      
      if (!user?.id) {
        console.log('⚙️ No user session, skipping automation settings fetch');
        return null;
      }

      // Get all automation workflows for the user
      const { data: workflows, error } = await supabase
        .from('cron_jobs')
        .select('*')
        .eq('user_id', user.id)
        .eq('job_type', 'workflow');

      if (error) {
        console.error('❌ Error fetching automation workflows:', error);
        return null;
      }

      console.log('📋 Found automation workflows:', workflows?.length || 0);

      // Filter for workflows with chatbot integration (matching chat API logic)
      const chatbotWorkflows = workflows?.filter(workflow => {
        // Check both automation_config and workflow_data for nodes
        const configNodes = workflow.settings?.automation_config?.nodes || [];
        const workflowNodes = workflow.settings?.workflow_data?.nodes || [];
        const nodes = configNodes.length > 0 ? configNodes : workflowNodes;
        
        const hasChatbotNode = nodes.some((node: any) => node.subtype === 'chatbot_integration');
        
        console.log('🔍 Checking workflow:', {
          id: workflow.id,
          name: workflow.settings?.workflow_data?.name || workflow.settings?.name || 'Unnamed',
          status: workflow.status,
          hasChatbotNode,
          nodeTypes: nodes.map((n: any) => n.subtype),
          hasConfigNodes: configNodes.length > 0,
          hasWorkflowNodes: workflowNodes.length > 0
        });
        
        return hasChatbotNode;
      }) || [];

      console.log('🤖 Found chatbot workflows:', chatbotWorkflows.length);

      if (chatbotWorkflows.length > 0) {
        // Process workflows with additional metadata
        const processedWorkflows = chatbotWorkflows.map(workflow => {
          // Get nodes from the correct location
          const configNodes = workflow.settings?.automation_config?.nodes || [];
          const workflowNodes = workflow.settings?.workflow_data?.nodes || [];
          const nodes = configNodes.length > 0 ? configNodes : workflowNodes;
          
          const chatbotNode = nodes.find((node: any) => node.subtype === 'chatbot_integration');
          const triggerNode = nodes.find((node: any) => node.subtype === 'chat_message_received');
          
          return {
            id: workflow.id,
            name: workflow.settings?.workflow_data?.name || workflow.settings?.name || `Workflow ${workflow.id.slice(-8)}`,
            description: workflow.settings?.workflow_data?.description || workflow.settings?.description || 'Automation workflow with chatbot integration',
            status: workflow.status,
            settings: workflow.settings,
            config: {
              model: chatbotNode?.data?.model || 'gpt-4o',
              systemInstructions: chatbotNode?.data?.systemInstructions || '',
              integrations: {
                projects: chatbotNode?.data?.connectToProjects || false,
                calendar: chatbotNode?.data?.connectToCalendar || false,
                reasoning: chatbotNode?.data?.connectToReasoning || false
              },
              trigger: {
                keywords: triggerNode?.data?.keywords || [],
                chatPlatform: triggerNode?.data?.chatPlatform || 'all'
              }
            },
            isPrimary: workflow.status === 'active' && workflow.settings?.isPrimary
          };
        });

        console.log('✅ Processed chatbot workflows:', processedWorkflows);

        // Update available workflows
        setAvailableWorkflows(processedWorkflows);

        // Auto-select primary or first active workflow
        const primaryWorkflow = processedWorkflows.find(w => w.isPrimary) || 
                               processedWorkflows.find(w => w.status === 'active');

                 if (primaryWorkflow && !selectedWorkflow) {
           console.log('🎯 Auto-selecting chatbot workflow:', primaryWorkflow.name);
           setSelectedWorkflow(primaryWorkflow.id);
           setAutomationEnabled(true);
         }

        return {
          success: true,
          workflows: processedWorkflows,
          primaryWorkflow: primaryWorkflow || null,
          totalCount: processedWorkflows.length,
          activeCount: processedWorkflows.filter(w => w.status === 'active').length
        };
      } else {
        console.log('⚠️ No chatbot automation workflows found');
        return {
          success: true,
          workflows: [],
          primaryWorkflow: null,
          totalCount: 0,
          activeCount: 0
        };
      }
    } catch (error) {
      console.error('❌ Error fetching automation settings:', error);
      return null;
    }
  };

  // Load automation settings on component mount
  useEffect(() => {
    if (user?.id) {
      fetchAutomationSettings();
    }
     }, [user?.id]);

  // Get workflow details by ID
  const getWorkflowById = (workflowId: string) => {
    return availableWorkflows.find(w => w.id === workflowId);
  };

  // Get current workflow configuration
  const getCurrentWorkflowConfig = () => {
    if (!selectedWorkflow) return null;
    const workflow = getWorkflowById(selectedWorkflow);
    return workflow?.config || null;
  };

  // Check if API key exists on mount and on window focus
  useEffect(() => {
    const checkApiKey = async () => {
      // Don't check if we already know the status and user hasn't changed
      if (hasApiKey !== null && user?.id) {
        console.log("ChatWindow: API key status already known, skipping check");
        return;
      }
      
      if (!user?.id) {
        console.log("ChatWindow: No session, API key check skipped");
        setHasApiKey(false);
        return;
      }
      
      try {
        // Check API key via the chat API directly
        console.log("ChatWindow: Checking API key via chat API...");
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
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
            setHasApiKey(!!user);
          }
        }
      } catch (error) {
        console.error("ChatWindow: Error checking API key:", error);
        // Fall back to assuming key might exist if logged in
        setHasApiKey(!!user);
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
  }, [user?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSubmit = async () => {
    if (input.trim() || files.length > 0) {
      // Debug automation state
      console.log('🔍 Chat submit debug:', {
        automationEnabled,
        selectedWorkflow,
        availableWorkflows: availableWorkflows.length,
        hasSession: !!user?.id
      });

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
      setCurrentThinking("")
      setIsThinkingComplete(false)
      
      try {
        let response: Response;
        
        // If automation is enabled and a workflow is selected, use streaming automation API
        if (automationEnabled && selectedWorkflow) {
          console.log('🤖 Using streaming automation workflow:', {
            enabled: automationEnabled,
            workflow: selectedWorkflow,
            hasSession: !!user?.id
          });
          
          // Use streaming API for real-time thinking
          try {
            console.log('🚀 Starting streaming request...', {
              workflowId: selectedWorkflow,
              userId: user?.id,
              messageLength: input.trim().length
            });
            
            const streamResponse = await fetch("/api/automation/chat-trigger-stream", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: input.trim(),
                workflowId: selectedWorkflow,
                userId: user?.id
              }),
            });

            console.log('📡 Stream response status:', streamResponse.status, streamResponse.statusText);

            if (!streamResponse.ok) {
              const errorText = await streamResponse.text();
              console.error('❌ Streaming request failed:', {
                status: streamResponse.status,
                statusText: streamResponse.statusText,
                error: errorText
              });
              throw new Error(`Streaming request failed: ${streamResponse.status} ${errorText}`);
            }
            
            console.log('✅ Streaming response OK, starting to read stream...');

            const reader = streamResponse.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
              throw new Error('No response reader available');
            }

            let accumulatedThinking = '';
            let accumulatedResponse = '';
            let finalResponse = '';
            let done = false;

            while (!done) {
              const { value, done: readerDone } = await reader.read();
              done = readerDone;

              if (value) {
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try {
                      const data = JSON.parse(line.slice(6));
                      
                      switch (data.type) {
                        case 'status':
                          console.log('📡 Status:', data.message);
                          break;
                          
                        case 'thinking_start':
                          console.log('🧠 Thinking started');
                          setCurrentThinking('Claude is analyzing your request...');
                          break;
                          
                        case 'thinking_delta':
                          // Real-time thinking update!
                          accumulatedThinking = data.full_thinking || accumulatedThinking + data.content;
                          setCurrentThinking(accumulatedThinking);
                          break;
                          
                        case 'thinking_complete':
                          console.log('🧠 Thinking completed');
                          setIsThinkingComplete(true);
                          setCurrentThinking(accumulatedThinking);
                          break;
                          
                        case 'response_delta':
                          accumulatedResponse += data.content;
                          break;
                          
                        case 'complete':
                          console.log('✅ Streaming complete');
                          finalResponse = accumulatedResponse || data.full_response?.replace(/<thinking>[\s\S]*?<\/thinking>\s*/, '').trim() || 'No response generated';
                          
                          const aiResponse: Message = {
                            id: crypto.randomUUID(),
                            content: finalResponse,
                            role: "assistant",
                            timestamp: new Date(),
                            thinking_process: accumulatedThinking || data.thinking_process,
                            automated: true,
                            model: 'claude-3-7-sonnet-20250219',
                          };
                          
                          const updatedMessages = [...messages, userMessage, aiResponse];
                          setMessages(updatedMessages);
                          
                          // Save to memory
                          if (workspaceId && selectedWorkflow) {
                            await saveChatHistory(workspaceId, selectedWorkflow, updatedMessages);
                          }
                          
                          setIsLoading(false);
                          setCurrentThinking("");
                          setIsThinkingComplete(false);
                          return;
                          
                        case 'error':
                          throw new Error(data.message);
                      }
                    } catch (parseError) {
                      console.error('❌ Error parsing stream data:', parseError);
                    }
                  }
                }
              }
            }
            
            return; // Exit early for streaming
          } catch (streamError) {
            console.error('❌ Streaming failed, falling back to regular automation:', streamError);
            // Fall back to regular automation API
            response = await fetch("/api/automation/chat-trigger", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: input.trim(),
                workflowId: selectedWorkflow,
                userId: user?.id,
                context: {
                  previousMessages: messages.slice(-5)
                }
              }),
            });
          }
        } else {
          // Use regular chat API
        const messageHistory = messages
          .filter(msg => msg.id !== "welcome" && msg.role !== "system")
          .concat(userMessage)
          .map(({ content, role }) => ({ content, role }));
          
          response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            messages: messageHistory,
          }),
        });
        }
        
        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch {
            // If response is not JSON, get text
            const errorText = await response.text();
            errorData = { error: errorText };
          }
          
          const error = new Error(errorData.error || "Failed to get a response");
          // Add additional properties to the error object
          (error as any).code = errorData.code;
          (error as any).details = errorData.details;
          (error as any).workspaceId = errorData.workspaceId;
          throw error;
        }
        
        // Handle both automation and regular responses
        const responseData = await response.json();
        
        console.log('🔍 Response data:', responseData);
        
        if (responseData.error) {
          throw new Error(responseData.error);
        }

        // Check if this was an automated response
        const isAutomated = responseData.automated || (automationEnabled && selectedWorkflow);
        
        if (isAutomated) {
          console.log('🤖 Automated response received:', responseData.workflowName || 'Automation');
          
          // Update thinking process if available
          if (responseData.thinking_process) {
            setCurrentThinking(responseData.thinking_process);
            setIsThinkingComplete(true);
            
            // Add a small delay to show the thinking process before showing final response
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
          
          // Build response content with calendar events and reasoning info
          let responseContent = responseData.response || 'No response from automation';
          
          // Add calendar event confirmation if created
          if (responseData.calendar_event_created) {
            responseContent += `\n\n✅ **Calendar Event Created!** I've added this event to your calendar.`;
          }

          // Add reasoning info for o1 models if available
          if (responseData.reasoning_tokens) {
            responseContent += `\n\n🧠 *Used ${responseData.reasoning_tokens} reasoning tokens (${Math.round((responseData.reasoning_tokens / responseData.total_tokens) * 100)}% of response was reasoning)*`;
            console.log('🧠 Added reasoning info to response:', {
              reasoning_tokens: responseData.reasoning_tokens,
              total_tokens: responseData.total_tokens,
              percentage: Math.round((responseData.reasoning_tokens / responseData.total_tokens) * 100)
            });
          } else {
            console.log('⚠️ No reasoning tokens found in response data');
          }

          const aiResponse: Message = {
            id: crypto.randomUUID(),
            content: responseContent,
            role: "assistant",
            timestamp: new Date(),
            thinking_process: responseData.thinking_process,
            automated: true,
            model: responseData.model,
          };
          
          const updatedMessages = [...messages, userMessage, aiResponse];
          setMessages(updatedMessages);
          
          // Save chat history to automation memory
          if (workspaceId && selectedWorkflow) {
            console.log('💾 Saving conversation to automation memory...');
            await saveChatHistory(workspaceId, selectedWorkflow, updatedMessages);
          }
          
          setIsLoading(false);
          setCurrentThinking("");
          setIsThinkingComplete(false);
          return;
        }
        
        // Handle regular chat response with streaming
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
        
        // Set loading to false after streaming is complete
        setIsLoading(false);
        
        // Save chat history for regular chat too (if automation is enabled)
        if (workspaceId && selectedWorkflow && automationEnabled) {
          const finalMessages = [...messages, userMessage, { ...aiResponse, content: accumulatedResponse }];
          await saveChatHistory(workspaceId, selectedWorkflow, finalMessages);
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

  // Function to render message content with links and HTML tables
  const renderMessageContent = (content: string) => {
    // Check if content contains HTML table tags
    if (content.includes('<table>') || content.includes('<tr>') || content.includes('<td>')) {
      // Content has HTML tables, render as HTML with custom styling
      return (
        <div 
          className="prose prose-invert max-w-none"
          style={{
            '--tw-prose-body': '#e5e7eb',
            '--tw-prose-headings': '#f9fafb',
            '--tw-prose-bold': '#f9fafb',
            '--tw-prose-links': '#60a5fa',
            '--tw-prose-th-borders': '#374151',
            '--tw-prose-td-borders': '#374151',
          } as React.CSSProperties}
          dangerouslySetInnerHTML={{ 
            __html: content
              // Process markdown-style links within HTML content
              .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-400 hover:underline">$1</a>')
              // Add table styling classes
              .replace(/<table>/g, '<table class="w-full border-collapse border border-gray-600 my-4">')
              .replace(/<th>/g, '<th class="border border-gray-600 px-3 py-2 bg-gray-700 text-left font-medium">')
              .replace(/<td>/g, '<td class="border border-gray-600 px-3 py-2">')
          }}
        />
      );
    }

    // Handle markdown-style links for plain text content
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

  // Render full-page mode
  if (fullPage) {
    return (
      <div className="flex-1 flex flex-col h-full min-h-0">
        <div className="flex h-full flex-col overflow-hidden bg-background">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-medium text-foreground">AI Assistant</h2>
              {automationEnabled && selectedWorkflow && (
                <Badge variant="secondary" className="text-xs">
                  <Bot className="size-3 mr-1" />
                  Auto
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Always show automation button */}
              <Dialog open={showAutomationSettings} onOpenChange={setShowAutomationSettings}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Automation Settings"
                    className={cn(
                      "text-muted-foreground hover:text-foreground",
                      automationEnabled && "text-blue-500 hover:text-blue-400"
                    )}
                  >
                    <Bot className="size-5" />
                  </Button>
                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Chatbot Automation</DialogTitle>
                    <DialogDescription>
                      Connect your chat to automation workflows for enhanced AI capabilities
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="automation-enabled"
                        checked={automationEnabled}
                        onCheckedChange={setAutomationEnabled}
                      />
                      <Label htmlFor="automation-enabled">Enable Automation</Label>
                    </div>
                    
                    {automationEnabled && (
                      <div className="space-y-3">
                        <Label>Select Workflow</Label>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchAutomationSettings}
                            className="text-xs"
                          >
                            🔄 Refresh Settings
                          </Button>
                          {selectedWorkflow && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const response = await fetch('/api/automation/chat-trigger', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      message: 'Test automation integration - show me my current projects and calendar',
                                      workflowId: selectedWorkflow,
                                      userId: user?.id,
                                      context: { test: true }
                                    })
                                  });
                                  const result = await response.json();
                                  console.log('Test result:', result);
                                  if (result.success) {
                                    setMessages(prev => [...prev, {
                                      id: crypto.randomUUID(),
                                      content: result.response,
                                      role: "assistant",
                                      timestamp: new Date(),
                                    }]);
                                  }
                                } catch (error) {
                                  console.error('Test failed:', error);
                                }
                              }}
                              className="text-xs"
                            >
                              🧪 Test Integration
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {availableWorkflows.map((workflow) => {
                            const config = workflow.config || {
                              model: '',
                              systemInstructions: '',
                              integrations: { projects: false, calendar: false, reasoning: false },
                              trigger: { keywords: [], chatPlatform: 'all' }
                            };
                            
                            return (
                              <div
                                key={workflow.id}
                                className={cn(
                                  "p-3 border rounded-lg cursor-pointer transition-colors",
                                  selectedWorkflow === workflow.id
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-primary/50"
                                )}
                                onClick={() => setSelectedWorkflow(workflow.id)}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h4 className="font-medium">{workflow.name}</h4>
                                    <p className="text-sm text-muted-foreground">
                                      {workflow.description || 'No description'}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge variant="secondary" className="text-xs">
                                        {workflow.status}
                                      </Badge>
                                      {workflow.isPrimary && (
                                        <Badge variant="default" className="text-xs">
                                          Primary
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-1 flex-wrap">
                                    {config.integrations?.projects && (
                                      <Badge variant="outline" className="text-xs">
                                        <FolderOpen className="size-3 mr-1" />
                                        Projects
                                      </Badge>
                                    )}
                                    {config.integrations?.calendar && (
                                      <Badge variant="outline" className="text-xs">
                                        <Calendar className="size-3 mr-1" />
                                        Calendar
                                      </Badge>
                                    )}
                                    {config.integrations?.reasoning && (
                                      <Badge variant="outline" className="text-xs">
                                        <Target className="size-3 mr-1" />
                                        AI Reasoning
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="mt-2 space-y-1">
                                  {config.model && (
                                    <div className="text-xs text-muted-foreground">
                                      <span className="font-medium">Model:</span> {config.model}
                                    </div>
                                  )}
                                  {config.trigger?.keywords && config.trigger.keywords.length > 0 && (
                                    <div className="text-xs text-muted-foreground">
                                      <span className="font-medium">Keywords:</span> {config.trigger.keywords.join(', ')}
                                    </div>
                                  )}
                                  {config.systemInstructions && (
                                    <div className="text-xs text-muted-foreground max-w-sm truncate">
                                      <span className="font-medium">Instructions:</span> {config.systemInstructions}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
              {!hasApiKey && !!user && (
                <Link href="/settings">
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Configure API Key in Settings"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Settings className="size-5" />
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {messages.map(message => (
              <div
                key={message.id}
                className={cn(
                  "flex w-full",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/80 text-foreground border border-border/50"
                  )}
                >
                  {/* Thinking process for assistant messages */}
                  {message.role === "assistant" && message.thinking_process && (
                    <div className="mb-3 border-b border-border/30 pb-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleThinking(message.id)}
                        className="p-1 h-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        <Brain className="size-3" />
                        <span>Claude's thinking process</span>
                        {expandedThinking.has(message.id) ? (
                          <ChevronUp className="size-3" />
                        ) : (
                          <ChevronDown className="size-3" />
                        )}
                      </Button>
                      {expandedThinking.has(message.id) && (
                        <div className="mt-2 p-3 bg-muted/40 rounded-lg border border-border/30">
                          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                            <Brain className="size-3" />
                            <span>Internal reasoning process</span>
                            {message.model && (
                              <Badge variant="outline" className="text-xs ml-auto">
                                {message.model}
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm whitespace-pre-wrap font-mono text-muted-foreground bg-background/50 p-2 rounded border">
                            {message.thinking_process}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Main message content */}
                  {renderMessageContent(message.content)}
                  
                  {/* Message metadata */}
                  <div className="mt-1.5 text-right text-xs opacity-70 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {message.automated && (
                        <Badge variant="secondary" className="text-xs">
                          <Bot className="size-2 mr-1" />
                          Auto
                        </Badge>
                      )}
                    </div>
                    <span>
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex w-full justify-start">
                <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-muted/80 text-foreground border border-border/50 shadow-sm">
                  {automationEnabled && selectedWorkflow ? (
                    <div className="space-y-3">
                      {/* Thinking process section */}
                      <div className="border-b border-border/30 pb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="h-4 w-4 text-blue-400" />
                          <span className="text-sm font-medium text-blue-400">Claude's thinking process</span>
                          <Badge variant="outline" className="text-xs">
                            claude-3-7-sonnet
                          </Badge>
                        </div>
                        <div className="p-3 bg-muted/40 rounded-lg border border-border/30">
                          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                            <Brain className="size-3" />
                            <span>Internal reasoning process</span>
                          </div>
                          <div className="text-sm font-mono text-muted-foreground bg-background/50 p-2 rounded border min-h-[100px]">
                            {currentThinking || (
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span className="italic">Claude is analyzing your request and formulating a response...</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Response generation status */}
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <p className="text-sm">
                          {isThinkingComplete ? "Generating response..." : "Processing with automation..."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <p className="text-sm">AI is thinking...</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border/50 p-4 bg-card/50 flex-shrink-0">
            {!hasApiKey && (
              <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-sm text-yellow-300">
                <p className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Please set your OpenAI API key in <Link href="/settings" className="underline hover:text-yellow-200">workspace settings</Link>.
                </p>
              </div>
            )}
            
            <div className="relative">
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-muted/80 rounded-xl px-3 py-1.5 text-sm border border-border/50"
                    >
                      <span className="truncate max-w-[150px]">{file.name}</span>
                      <button
                        onClick={() => handleRemoveFile(index)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
                placeholder={hasApiKey ? "Ask about your CRM data..." : "Set API key in workspace settings to enable AI chat"}
                className="w-full px-4 py-3 pr-24 pb-12 border border-border/60 rounded-2xl resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 bg-background/80 backdrop-blur-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 text-sm"
                rows={1}
                style={{ minHeight: '60px', maxHeight: '120px' }}
                disabled={!hasApiKey}
              />

              {/* Bottom row with attach and send buttons */}
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="chat-file-upload"
                    className={cn(
                      "p-2 cursor-pointer rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground",
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
                    <Paperclip className="h-4 w-4" />
                  </label>
                </div>

                <Button
                  variant="default"
                  size="icon"
                  className="h-8 w-8 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                  onClick={handleSubmit}
                  disabled={!hasApiKey || isLoading || (!input.trim() && files.length === 0)}
                >
                  {isLoading ? (
                    <Square className="size-4 fill-current" />
                  ) : (
                    <ArrowUp className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render popup mode
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
            <div className="flex h-[500px] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-4 py-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                <h2 className="text-lg font-medium text-foreground">AI Assistant</h2>
                  {automationEnabled && selectedWorkflow && (
                    <Badge variant="secondary" className="text-xs">
                      <Bot className="size-3 mr-1" />
                      Auto
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Always show automation button */}
                  <Dialog open={showAutomationSettings} onOpenChange={setShowAutomationSettings}>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Automation Settings"
                        className={cn(
                          "text-muted-foreground hover:text-foreground",
                          automationEnabled && "text-blue-500 hover:text-blue-400"
                        )}
                      >
                        <Bot className="size-5" />
                      </Button>
                    </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Chatbot Automation</DialogTitle>
                          <DialogDescription>
                            Connect your chat to automation workflows for enhanced AI capabilities
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="automation-enabled"
                              checked={automationEnabled}
                              onCheckedChange={setAutomationEnabled}
                            />
                            <Label htmlFor="automation-enabled">Enable Automation</Label>
                          </div>
                          
                                                     {automationEnabled && (
                             <div className="space-y-3">
                               <Label>Select Workflow</Label>
                               <div className="flex gap-2">
                                 <Button
                                   variant="outline"
                                   size="sm"
                                   onClick={fetchAutomationSettings}
                                   className="text-xs"
                                 >
                                   🔄 Refresh Settings
                                 </Button>
                                 {selectedWorkflow && (
                                   <Button
                                     variant="outline"
                                     size="sm"
                                     onClick={async () => {
                                       try {
                                         const response = await fetch('/api/automation/chat-trigger', {
                                           method: 'POST',
                                           headers: { 'Content-Type': 'application/json' },
                                           body: JSON.stringify({
                                             message: 'Test automation integration - show me my current projects and calendar',
                                             workflowId: selectedWorkflow,
                                             userId: user?.id,
                                             context: { test: true }
                                           })
                                         });
                                         const result = await response.json();
                                         console.log('Test result:', result);
                                         if (result.success) {
                                           setMessages(prev => [...prev, {
                                             id: crypto.randomUUID(),
                                             content: result.response,
                                             role: "assistant",
                                             timestamp: new Date(),
                                           }]);
                                         }
                                       } catch (error) {
                                         console.error('Test failed:', error);
                                       }
                                     }}
                                     className="text-xs"
                                   >
                                     🧪 Test Integration
                                   </Button>
                                 )}
                               </div>
                               <div className="space-y-2">
                                 {availableWorkflows.map((workflow) => {
                                  const config = workflow.config || {
                                    model: '',
                                    systemInstructions: '',
                                    integrations: { projects: false, calendar: false, reasoning: false },
                                    trigger: { keywords: [], chatPlatform: 'all' }
                                  };
                                  
                                  return (
                                    <div
                                      key={workflow.id}
                                      className={cn(
                                        "p-3 border rounded-lg cursor-pointer transition-colors",
                                        selectedWorkflow === workflow.id
                                          ? "border-primary bg-primary/5"
                                          : "border-border hover:border-primary/50"
                                      )}
                                      onClick={() => setSelectedWorkflow(workflow.id)}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <h4 className="font-medium">{workflow.name}</h4>
                                          <p className="text-sm text-muted-foreground">
                                            {workflow.description || 'No description'}
                                          </p>
                                          <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="secondary" className="text-xs">
                                              {workflow.status}
                                            </Badge>
                                            {workflow.isPrimary && (
                                              <Badge variant="default" className="text-xs">
                                                Primary
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex gap-1 flex-wrap">
                                          {config.integrations?.projects && (
                                            <Badge variant="outline" className="text-xs">
                                              <FolderOpen className="size-3 mr-1" />
                                              Projects
                                            </Badge>
                                          )}
                                          {config.integrations?.calendar && (
                                            <Badge variant="outline" className="text-xs">
                                              <Calendar className="size-3 mr-1" />
                                              Calendar
                                            </Badge>
                                          )}
                                          {config.integrations?.reasoning && (
                                            <Badge variant="outline" className="text-xs">
                                              <Target className="size-3 mr-1" />
                                              AI Reasoning
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                      <div className="mt-2 space-y-1">
                                        {config.model && (
                                          <div className="text-xs text-muted-foreground">
                                            <span className="font-medium">Model:</span> {config.model}
                                          </div>
                                        )}
                                        {config.trigger?.keywords && config.trigger.keywords.length > 0 && (
                                          <div className="text-xs text-muted-foreground">
                                            <span className="font-medium">Keywords:</span> {config.trigger.keywords.join(', ')}
                                          </div>
                                        )}
                                        {config.systemInstructions && (
                                          <div className="text-xs text-muted-foreground max-w-sm truncate">
                                            <span className="font-medium">Instructions:</span> {config.systemInstructions}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  {"}"}
                  {!hasApiKey && !!user && (
                    <Link href="/settings">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Configure API Key in Settings"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Settings className="size-5" />
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-5" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex w-full",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/80 text-foreground border border-border/50"
                      )}
                    >
                      {/* Thinking process for assistant messages */}
                      {message.role === "assistant" && message.thinking_process && (
                        <div className="mb-3 border-b border-border/30 pb-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleThinking(message.id)}
                            className="p-1 h-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            <Brain className="size-3" />
                            <span>Claude's thinking process</span>
                            {expandedThinking.has(message.id) ? (
                              <ChevronUp className="size-3" />
                            ) : (
                              <ChevronDown className="size-3" />
                            )}
                          </Button>
                          {expandedThinking.has(message.id) && (
                            <div className="mt-2 p-3 bg-muted/40 rounded-lg border border-border/30">
                              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                <Brain className="size-3" />
                                <span>Internal reasoning process</span>
                                {message.model && (
                                  <Badge variant="outline" className="text-xs ml-auto">
                                    {message.model}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm whitespace-pre-wrap font-mono text-muted-foreground bg-background/50 p-2 rounded border">
                                {message.thinking_process}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Main message content */}
                      {renderMessageContent(message.content)}
                      
                      {/* Message metadata */}
                      <div className="mt-1.5 text-right text-xs opacity-70 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {message.automated && (
                            <Badge variant="secondary" className="text-xs">
                              <Bot className="size-2 mr-1" />
                              Auto
                            </Badge>
                          )}
                        </div>
                        <span>
                        {message.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex w-full justify-start">
                    <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-muted/80 text-foreground border border-border/50 shadow-sm">
                      {automationEnabled && selectedWorkflow ? (
                        <div className="space-y-3">
                          {/* Thinking process section */}
                          <div className="border-b border-border/30 pb-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Brain className="h-4 w-4 text-blue-400" />
                              <span className="text-sm font-medium text-blue-400">Claude's thinking process</span>
                              <Badge variant="outline" className="text-xs">
                                claude-3-7-sonnet
                              </Badge>
                            </div>
                            <div className="p-3 bg-muted/40 rounded-lg border border-border/30">
                              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                                <Brain className="size-3" />
                                <span>Internal reasoning process</span>
                              </div>
                              <div className="text-sm font-mono text-muted-foreground bg-background/50 p-2 rounded border min-h-[100px]">
                                {currentThinking || (
                                  <div className="flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    <span className="italic">Claude is analyzing your request and formulating a response...</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Response generation status */}
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <p className="text-sm">
                              {isThinkingComplete ? "Generating response..." : "Processing with automation..."}
                            </p>
                          </div>
                        </div>
                      ) : (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <p className="text-sm">AI is thinking...</p>
                      </div>
                      )}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-border/50 p-4 bg-card/50 flex-shrink-0">
                {!hasApiKey && (
                  <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-sm text-yellow-300">
                    <p className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Please set your OpenAI API key in <Link href="/settings" className="underline hover:text-yellow-200">workspace settings</Link>.
                    </p>
                  </div>
                )}
                
                <div className="relative">
                  {files.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {files.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 bg-muted/80 rounded-xl px-3 py-1.5 text-sm border border-border/50"
                        >
                          <span className="truncate max-w-[150px]">{file.name}</span>
                          <button
                            onClick={() => handleRemoveFile(index)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleSubmit()
                      }
                    }}
                    placeholder={hasApiKey ? "Ask about your CRM data..." : "Set API key in workspace settings to enable AI chat"}
                    className="w-full px-4 py-3 pr-24 pb-12 border border-border/60 rounded-2xl resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 bg-background/80 backdrop-blur-sm text-foreground placeholder:text-muted-foreground transition-all duration-200 text-sm"
                    rows={1}
                    style={{ minHeight: '60px', maxHeight: '120px' }}
                    disabled={!hasApiKey}
                  />

                  {/* Bottom row with attach and send buttons */}
                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="chat-file-upload"
                        className={cn(
                          "p-2 cursor-pointer rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground",
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
                        <Paperclip className="h-4 w-4" />
                      </label>
                    </div>

                    <Button
                      variant="default"
                      size="icon"
                      className="h-8 w-8 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
                      onClick={handleSubmit}
                      disabled={!hasApiKey || isLoading || (!input.trim() && files.length === 0)}
                    >
                      {isLoading ? (
                        <Square className="size-4 fill-current" />
                      ) : (
                        <ArrowUp className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
} 