"use client";

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { MessageSquare, Bot, Settings, Zap } from 'lucide-react';

export default function TestChatbotTrigger() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [testMessage, setTestMessage] = useState('Hello, can you help me with my project?');
  const [triggerConfig, setTriggerConfig] = useState({
    chat_platform: 'internal_chat',
    chat_channel: '',
    message_keywords: '',
    from_user: '',
    use_ai_chatbot: true,
    chatbot_instructions: 'You are a helpful project management assistant. Be friendly and provide useful advice about project management, task organization, and productivity.'
  });
  const [response, setResponse] = useState<any>(null);

  const testChatTrigger = async () => {
    if (!session?.user?.id) {
      toast.error('Please log in to test the chatbot trigger');
      return;
    }

    setIsLoading(true);
    setResponse(null);

    try {
      const response = await fetch('/api/automation/chat-trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: testMessage,
          platform: triggerConfig.chat_platform,
          channel: triggerConfig.chat_channel || 'test-channel',
          username: session.user.name || 'Test User',
          workspaceId: 'test-workspace-id',
          triggerConfig: triggerConfig
        })
      });

      const result = await response.json();
      setResponse(result);

      if (result.triggered && result.chatbot_response) {
        toast.success('Chatbot trigger successful!');
      } else if (result.error) {
        toast.error(result.error);
      } else {
        toast.info('Trigger conditions not met');
      }

    } catch (error) {
      console.error('Error testing chatbot trigger:', error);
      toast.error('Failed to test chatbot trigger');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Bot className="h-8 w-8 text-blue-600" />
          Chatbot Trigger Test
        </h1>
        <p className="text-muted-foreground">
          Test your AI chatbot integration with chat message triggers. Configure the trigger settings and test how the chatbot responds to messages.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Configuration Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Trigger Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Test Message</Label>
              <Textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Enter a test message..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Platform</Label>
              <Input
                value={triggerConfig.chat_platform}
                onChange={(e) => setTriggerConfig(prev => ({ ...prev, chat_platform: e.target.value }))}
                placeholder="internal_chat"
              />
            </div>

            <div className="space-y-2">
              <Label>Channel (optional)</Label>
              <Input
                value={triggerConfig.chat_channel}
                onChange={(e) => setTriggerConfig(prev => ({ ...prev, chat_channel: e.target.value }))}
                placeholder="Leave empty for any channel"
              />
            </div>

            <div className="space-y-2">
              <Label>Keywords (optional)</Label>
              <Input
                value={triggerConfig.message_keywords}
                onChange={(e) => setTriggerConfig(prev => ({ ...prev, message_keywords: e.target.value }))}
                placeholder="help, project, task (comma separated)"
              />
            </div>

            <div className="space-y-2">
              <Label>From User (optional)</Label>
              <Input
                value={triggerConfig.from_user}
                onChange={(e) => setTriggerConfig(prev => ({ ...prev, from_user: e.target.value }))}
                placeholder="Leave empty for any user"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={triggerConfig.use_ai_chatbot}
                  onCheckedChange={(checked) => setTriggerConfig(prev => ({ ...prev, use_ai_chatbot: checked }))}
                />
                <Label>Enable AI Chatbot Response</Label>
              </div>
            </div>

            {triggerConfig.use_ai_chatbot && (
              <div className="space-y-2">
                <Label>Chatbot Instructions</Label>
                <Textarea
                  value={triggerConfig.chatbot_instructions}
                  onChange={(e) => setTriggerConfig(prev => ({ ...prev, chatbot_instructions: e.target.value }))}
                  placeholder="You are a helpful assistant..."
                  rows={4}
                />
              </div>
            )}

            <Button 
              onClick={testChatTrigger} 
              disabled={isLoading || !testMessage.trim()}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Testing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Test Chatbot Trigger
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Response Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Response
            </CardTitle>
          </CardHeader>
          <CardContent>
            {response ? (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="text-sm font-medium mb-2">Trigger Status:</div>
                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    response.triggered 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                  }`}>
                    {response.triggered ? '✅ Triggered' : '⚠️ Not Triggered'}
                  </div>
                  {response.reason && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Reason: {response.reason}
                    </div>
                  )}
                </div>

                {response.chatbot_response && (
                  <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200/50 dark:border-blue-800/50">
                    <div className="text-sm font-medium mb-2 text-blue-600 dark:text-blue-400">
                      🤖 AI Assistant Response:
                    </div>
                    <div className="text-sm leading-relaxed">
                      {response.chatbot_response}
                    </div>
                  </div>
                )}

                {response.error && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200/50 dark:border-red-800/50">
                    <div className="text-sm font-medium mb-1 text-red-600 dark:text-red-400">
                      Error:
                    </div>
                    <div className="text-sm text-red-700 dark:text-red-300">
                      {response.error}
                    </div>
                  </div>
                )}

                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    View Raw Response
                  </summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                    {JSON.stringify(response, null, 2)}
                  </pre>
                </details>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Click "Test Chatbot Trigger" to see the response</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="font-medium text-foreground">1.</span>
            <span>Configure your trigger conditions (platform, channel, keywords, user)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium text-foreground">2.</span>
            <span>Enable AI chatbot response and set custom instructions</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium text-foreground">3.</span>
            <span>When a message matches your criteria, the AI chatbot automatically responds</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium text-foreground">4.</span>
            <span>For internal workspace chat, responses are sent directly to the chat</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 