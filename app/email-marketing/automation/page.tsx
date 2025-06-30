"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-client';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { 
  Plus, 
  Play, 
  Pause, 
  Save, 
  Eye, 
  Settings,
  Zap,
  Mail,
  Clock,
  Users,
  Filter,
  MousePointer,
  GitBranch,
  Target,
  Timer,
  Bell,
  Share,
  BarChart3,
  Edit3,
  Trash2,
  Copy,
  ArrowRight,
  Workflow,
  CheckCircle,
  Calendar,
  Split,
  Merge,
  Network,
  Code
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedBorderCard } from '@/components/ui/animated-border-card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { SidebarDemo } from "@/components/ui/code.demo";
import { cn } from '@/lib/utils';
import { EmailMarketingNav } from '@/components/email-marketing/EmailMarketingNav';



interface AutomationWorkflow {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'draft';
  trigger_type: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  created_at: string;
  stats: {
    triggered: number;
    completed: number;
    active_contacts: number;
  };
}

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'delay' | 'split' | 'aggregate' | 'code';
  subtype: string;
  position: { x: number; y: number };
  data: any;
  title: string;
  description: string;
}

interface WorkflowConnection {
  id: string;
  from: string;
  to: string;
  condition?: string;
}

const TRIGGER_TYPES = [
  { value: 'contact_added', label: 'Contact Added to List', icon: Users, description: 'When a new contact joins a list' },
  { value: 'email_opened', label: 'Email Opened', icon: Eye, description: 'When a contact opens an email' },
  { value: 'link_clicked', label: 'Link Clicked', icon: MousePointer, description: 'When a contact clicks a link' },
  { value: 'date_based', label: 'Date & Time', icon: Clock, description: 'On a specific date or recurring schedule' },
  { value: 'api_webhook', label: 'API Webhook', icon: Zap, description: 'When an external system triggers via API' },
  { value: 'contact_property', label: 'Contact Property Changed', icon: Edit3, description: 'When contact data is updated' }
];

const ACTION_TYPES = [
  { value: 'send_email', label: 'Send Email', icon: Mail, description: 'Send a personalized email' },
  { value: 'add_to_list', label: 'Add to List', icon: Users, description: 'Add contact to another list' },
  { value: 'remove_from_list', label: 'Remove from List', icon: Users, description: 'Remove contact from a list' },
  { value: 'update_property', label: 'Update Contact', icon: Edit3, description: 'Update contact properties' },
  { value: 'send_notification', label: 'Send Notification', icon: Bell, description: 'Notify team members' },
  { value: 'api_webhook', label: 'API Webhook', icon: Zap, description: 'Send data to external system' }
];

const CONDITION_TYPES = [
  { value: 'email_engagement', label: 'Email Engagement', icon: BarChart3, description: 'Based on email opens/clicks' },
  { value: 'contact_property', label: 'Contact Property', icon: Filter, description: 'Based on contact data' },
  { value: 'list_membership', label: 'List Membership', icon: Users, description: 'Based on list membership' },
  { value: 'time_based', label: 'Time Based', icon: Timer, description: 'Based on time conditions' }
];

const FLOW_CONTROL_TYPES = [
  { value: 'split_out', label: 'Split Out', icon: Split, description: 'Split workflow into multiple parallel paths' },
  { value: 'aggregate', label: 'Aggregate', icon: Merge, description: 'Merge multiple paths back together' },
  { value: 'parallel', label: 'Parallel', icon: Network, description: 'Execute multiple actions simultaneously' },
  { value: 'code', label: 'Code', icon: Code, description: 'Execute custom JavaScript code to transform data' }
];

export default function EmailAutomationPage() {
  const { user, session } = useAuth();
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkflow, setSelectedWorkflow] = useState<AutomationWorkflow | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);

  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchWorkflows();
    }
  }, [user?.id]);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      // Fetch automation workflows from database
      // For now, showing sample data
      const sampleWorkflows: AutomationWorkflow[] = [
        {
          id: '1',
          name: 'Welcome Series',
          description: 'Automated welcome email sequence for new subscribers',
          status: 'active',
          trigger_type: 'contact_added',
          nodes: [],
          connections: [],
          created_at: new Date().toISOString(),
          stats: {
            triggered: 145,
            completed: 132,
            active_contacts: 23
          }
        },
        {
          id: '2',
          name: 'Re-engagement Campaign',
          description: 'Win back inactive subscribers with targeted emails',
          status: 'paused',
          trigger_type: 'email_engagement',
          nodes: [],
          connections: [],
          created_at: new Date().toISOString(),
          stats: {
            triggered: 89,
            completed: 67,
            active_contacts: 8
          }
        }
      ];
      setWorkflows(sampleWorkflows);
    } catch (error) {
      console.error('Error fetching workflows:', error);
      toast.error('Failed to load automation workflows');
    } finally {
      setLoading(false);
    }
  };

  const createNewWorkflow = () => {
    const newWorkflow: AutomationWorkflow = {
      id: crypto.randomUUID(),
      name: 'New Automation',
      description: 'Describe your automation workflow',
      status: 'draft',
      trigger_type: '',
      nodes: [],
      connections: [],
      created_at: new Date().toISOString(),
      stats: {
        triggered: 0,
        completed: 0,
        active_contacts: 0
      }
    };
    setSelectedWorkflow(newWorkflow);
    setIsBuilding(true);
  };

  const toggleWorkflowStatus = async (workflowId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    setWorkflows(prev => 
      prev.map(w => 
        w.id === workflowId 
          ? { ...w, status: newStatus as 'active' | 'paused' | 'draft' }
          : w
      )
    );
    toast.success(`Workflow ${newStatus === 'active' ? 'activated' : 'paused'}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'draft':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const NodePalette = () => (
    <div className="w-80 bg-background border-r p-4 space-y-6">


      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Triggers
        </h3>
        <div className="space-y-2">
          {TRIGGER_TYPES.map((trigger) => (
            <div
              key={trigger.value}
              className="p-3 border rounded-lg cursor-grab hover:border-primary/50 transition-colors hover:shadow-md select-none"
              draggable={true}
              onDragStart={(e) => {
                console.log('🚀 TRIGGER DRAG STARTED:', trigger.label);
                e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'trigger', ...trigger }));
              }}
              onDragEnd={() => {
                console.log('🏁 TRIGGER DRAG ENDED');
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <trigger.icon className="h-4 w-4" />
                <span className="font-medium text-sm">{trigger.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{trigger.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Actions
        </h3>
        <div className="space-y-2">
          {ACTION_TYPES.map((action) => (
            <div
              key={action.value}
              className="p-3 border rounded-lg cursor-grab hover:border-primary/50 transition-colors active:scale-95"
              draggable
              onDragStart={(e) => {
                console.log('🚀 ACTION DRAG STARTED:', action.label);
                e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'action', ...action }));
              }}
              onDragEnd={() => {
                console.log('🏁 ACTION DRAG ENDED');
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <action.icon className="h-4 w-4" />
                <span className="font-medium text-sm">{action.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{action.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          Conditions
        </h3>
        <div className="space-y-2">
          {CONDITION_TYPES.map((condition) => (
            <div
              key={condition.value}
              className="p-3 border rounded-lg cursor-grab hover:border-primary/50 transition-colors active:scale-95"
              draggable
              onDragStart={(e) => {
                console.log('🚀 CONDITION DRAG STARTED:', condition.label);
                e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'condition', ...condition }));
              }}
              onDragEnd={() => {
                console.log('🏁 CONDITION DRAG ENDED');
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <condition.icon className="h-4 w-4" />
                <span className="font-medium text-sm">{condition.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{condition.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Timer className="h-4 w-4" />
          Wait & Delay
        </h3>
        <div className="p-3 border rounded-lg cursor-grab hover:border-primary/50 transition-colors active:scale-95"
             draggable
             onDragStart={(e) => {
               console.log('🚀 DELAY DRAG STARTED: Wait');
               e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'delay', value: 'wait', label: 'Wait', description: 'Add a delay before the next action' }));
             }}
             onDragEnd={() => {
               console.log('🏁 DELAY DRAG ENDED');
             }}>
          <div className="flex items-center gap-2 mb-1">
            <Timer className="h-4 w-4" />
            <span className="font-medium text-sm">Wait</span>
          </div>
          <p className="text-xs text-muted-foreground">Add a delay before the next action</p>
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Network className="h-4 w-4" />
          Flow Control
        </h3>
        <div className="space-y-2">
          {FLOW_CONTROL_TYPES.map((flowControl) => (
            <div
              key={flowControl.value}
              className="p-3 border rounded-lg cursor-grab hover:border-primary/50 transition-colors active:scale-95"
              draggable
              onDragStart={(e) => {
                console.log('🚀 FLOW CONTROL DRAG STARTED:', flowControl.label);
                const nodeType = flowControl.value === 'split_out' ? 'split' : 
                                flowControl.value === 'aggregate' ? 'aggregate' : 
                                flowControl.value === 'code' ? 'code' : 'action';
                e.dataTransfer.setData('text/plain', JSON.stringify({ type: nodeType, ...flowControl }));
              }}
              onDragEnd={() => {
                console.log('🏁 FLOW CONTROL DRAG ENDED');
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <flowControl.icon className="h-4 w-4" />
                <span className="font-medium text-sm">{flowControl.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{flowControl.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

      const [canvasNodes, setCanvasNodes] = useState<WorkflowNode[]>([]);
    const [connections, setConnections] = useState<WorkflowConnection[]>([]);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

  const WorkflowCanvas = () => {
    
    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      
      console.log('🎊 CANVAS DROP SUCCESS!');
      
      const textData = e.dataTransfer.getData('text/plain');
      console.log('Drop data:', textData);
      
      if (!textData) {
        console.warn('No drag data found');
        return;
      }
      
      try {
        const nodeData = JSON.parse(textData);
        console.log('Parsed node data:', nodeData);
        
        // Auto-position nodes in a vertical flow
        const nodeCount = canvasNodes.length;
        const x = 100 + (nodeCount * 250); // Horizontal spacing
        const y = 100; // Fixed vertical position for flow layout
        
        const newNode: WorkflowNode = {
          id: `node-${Date.now()}`,
          type: nodeData.type as 'trigger' | 'action' | 'condition' | 'delay' | 'split' | 'aggregate' | 'code',
          subtype: nodeData.value || nodeData.type,
          position: { x, y },
          data: {},
          title: nodeData.label,
          description: nodeData.description || ''
        };
        
        console.log('✨ Creating new node:', newNode);
        setCanvasNodes(prev => {
          const updated = [...prev, newNode];
          
          // Auto-connect to previous node if exists (but not for aggregate nodes)
          if (prev.length > 0 && newNode.type !== 'aggregate') {
            const lastNode = prev[prev.length - 1];
            setTimeout(() => {
              connectNodes(lastNode.id, newNode.id);
            }, 100);
          }
          
          return updated;
        });
        toast.success(`✨ Added ${nodeData.label} to workflow!`);
      } catch (error) {
        console.error('Error in drop handler:', error);
        toast.error('Failed to add node');
      }
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      console.log('🎯 DRAG OVER CANVAS!', e.target);
      setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      console.log('👋 DRAG LEAVE CANVAS');
      setIsDragOver(false);
    };

    const removeNode = (nodeId: string) => {
      setCanvasNodes(prev => prev.filter(node => node.id !== nodeId));
      setConnections(prev => prev.filter(conn => conn.from !== nodeId && conn.to !== nodeId));
      toast.success('Node removed');
    };

    const connectNodes = (fromId: string, toId: string) => {
      // Check if connection already exists
      const existingConnection = connections.find(conn => 
        conn.from === fromId && conn.to === toId
      );
      
      if (existingConnection) {
        toast.error('Connection already exists');
        return;
      }

      const newConnection: WorkflowConnection = {
        id: `conn-${Date.now()}`,
        from: fromId,
        to: toId
      };
      setConnections(prev => [...prev, newConnection]);
      toast.success('Nodes connected');
    };

    const removeConnection = (connectionId: string) => {
      setConnections(prev => prev.filter(conn => conn.id !== connectionId));
      toast.success('Connection removed');
    };

    const handleNodeConnectionClick = (nodeId: string, isOutput: boolean) => {
      if (!isConnecting) {
        // Start connection mode
        setIsConnecting(true);
        setSelectedNode(nodeId);
        toast.info('Click on another node to connect');
      } else {
        // Complete connection
        if (selectedNode && selectedNode !== nodeId) {
          if (isOutput) {
            // Clicked on output, so connect FROM this node TO the selected node
            connectNodes(nodeId, selectedNode);
          } else {
            // Clicked on input, so connect FROM selected node TO this node
            connectNodes(selectedNode, nodeId);
          }
        }
        setIsConnecting(false);
        setSelectedNode(null);
      }
    };

    const autoConnectNodes = () => {
      if (canvasNodes.length >= 2) {
        const sortedNodes = [...canvasNodes].sort((a, b) => a.position.x - b.position.x);
        const newConnections: WorkflowConnection[] = [];
        
        for (let i = 0; i < sortedNodes.length - 1; i++) {
          const fromNode = sortedNodes[i];
          const toNode = sortedNodes[i + 1];
          
          // Check if connection already exists
          const exists = connections.some(conn => 
            conn.from === fromNode.id && conn.to === toNode.id
          );
          
          if (!exists) {
            newConnections.push({
              id: `conn-${Date.now()}-${i}`,
              from: fromNode.id,
              to: toNode.id
            });
          }
        }
        
        if (newConnections.length > 0) {
          setConnections(prev => [...prev, ...newConnections]);
          toast.success(`Connected ${newConnections.length} nodes`);
        }
      }
    };

    const renderConnections = () => {
      return connections.map(connection => {
        const fromNode = canvasNodes.find(n => n.id === connection.from);
        const toNode = canvasNodes.find(n => n.id === connection.to);
        
        if (!fromNode || !toNode) return null;
        
        const fromX = fromNode.position.x + 96; // Half of node width (192px / 2)
        const fromY = fromNode.position.y + 80; // Bottom of node
        const toX = toNode.position.x + 96;
        const toY = toNode.position.y; // Top of node
        
        const midY = fromY + (toY - fromY) / 2;
        
        return (
          <g key={connection.id}>
            {/* Connection line with curve */}
            <path
              d={`M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`}
              stroke="#6366f1"
              strokeWidth="2"
              fill="none"
              className="drop-shadow-sm cursor-pointer hover:stroke-red-500 transition-colors"
              onClick={() => removeConnection(connection.id)}
            >
              <title>Click to remove connection</title>
            </path>
            {/* Arrow head */}
            <polygon
              points={`${toX-6},${toY-10} ${toX+6},${toY-10} ${toX},${toY}`}
              fill="#6366f1"
              className="cursor-pointer hover:fill-red-500 transition-colors"
              onClick={() => removeConnection(connection.id)}
            />
            {/* Connection dot */}
            <circle
              cx={fromX}
              cy={fromY}
              r="4"
              fill="#6366f1"
              className="drop-shadow-sm cursor-pointer hover:fill-red-500 transition-colors"
              onClick={() => removeConnection(connection.id)}
            />
            {/* Connection label for identification */}
            <text
              x={(fromX + toX) / 2}
              y={midY - 10}
              textAnchor="middle"
              className="text-xs fill-gray-500 pointer-events-none"
            >
              {fromNode.title.split(' ')[0]} → {toNode.title.split(' ')[0]}
            </text>
          </g>
        );
      });
    };

    const getNodeIcon = (type: string, subtype: string) => {
      switch (type) {
        case 'trigger':
          return <Zap className="h-4 w-4" />;
        case 'action':
          return <Mail className="h-4 w-4" />;
        case 'condition':
          return <GitBranch className="h-4 w-4" />;
        case 'delay':
          return <Timer className="h-4 w-4" />;
        case 'split':
          return <Split className="h-4 w-4" />;
        case 'aggregate':
          return <Merge className="h-4 w-4" />;
        case 'code':
          return <Code className="h-4 w-4" />;
        default:
          return <Mail className="h-4 w-4" />;
      }
    };

    const getNodeColor = (type: string) => {
      switch (type) {
        case 'trigger':
          return 'bg-blue-500';
        case 'action':
          return 'bg-green-500';
        case 'condition':
          return 'bg-yellow-500';
        case 'delay':
          return 'bg-purple-500';
        case 'split':
          return 'bg-orange-500';
        case 'aggregate':
          return 'bg-teal-500';
        case 'code':
          return 'bg-pink-500';
        default:
          return 'bg-gray-500';
      }
    };

         return (
       <div 
         className={cn(
           "flex-1 relative overflow-hidden transition-all duration-200",
           isDragOver 
             ? "bg-blue-50 dark:bg-blue-950/30 border-2 border-dashed border-blue-400" 
             : "bg-gray-50 dark:bg-gray-900/50"
         )}
         onDragOver={handleDragOver}
         onDrop={handleDrop}
         onDragLeave={handleDragLeave}
       >
      {/* Grid Background */}
      <div className="absolute inset-0 opacity-20">
        <div className="w-full h-full" 
             style={{ 
               backgroundImage: `
                 radial-gradient(circle, #6366f1 1px, transparent 1px)
               `,
               backgroundSize: '20px 20px' 
             }} 
        />
      </div>

      {/* Canvas Content */}
      <div className="relative z-10 p-8 min-h-full">
        {canvasNodes.length === 0 ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              {isDragOver ? (
                <div className="animate-bounce">
                  <div className="w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mx-auto mb-4">
                    <Plus className="h-12 w-12 text-blue-500" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-blue-600">Drop Here!</h3>
                  <p className="text-blue-500">Release to add this component to your workflow</p>
                </div>
              ) : (
                <>
                  <Workflow className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-semibold mb-2">Start Building Your Workflow</h3>
                  <p className="text-muted-foreground mb-4">
                    Drag any trigger, action, or condition from the sidebar to begin
                  </p>
                  <div className="text-sm text-muted-foreground">
                    The entire canvas area is your drop zone
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="relative">
            {/* SVG for connections */}
            <svg 
              className="absolute inset-0 w-full h-full pointer-events-none z-0"
              style={{ minHeight: '600px' }}
            >
              {renderConnections()}
            </svg>
            
            {/* Auto-connect button */}
            {canvasNodes.length >= 2 && (
              <div className="absolute top-4 right-4 z-20">
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setIsConnecting(!isConnecting);
                      setSelectedNode(null);
                    }}
                    variant={isConnecting ? "default" : "outline"}
                    size="sm"
                    className="bg-white/90 backdrop-blur-sm"
                  >
                    <Network className="h-4 w-4 mr-2" />
                    {isConnecting ? 'Cancel Connect' : 'Manual Connect'}
                  </Button>
                <Button
                  onClick={autoConnectNodes}
                  variant="outline"
                  size="sm"
                  className="bg-white/90 backdrop-blur-sm"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Auto Connect
                </Button>
                </div>
              </div>
            )}
            
            {/* Render workflow nodes */}
            {canvasNodes.map((node, index) => (
              <div
                key={node.id}
                className={cn(
                  "absolute bg-white dark:bg-gray-800 border-2 rounded-xl p-4 shadow-lg min-w-48 cursor-move z-10",
                  "hover:shadow-xl transition-all duration-200 hover:scale-105",
                  selectedNode === node.id && "ring-2 ring-blue-500 ring-offset-2",
                  isConnecting && "cursor-pointer"
                )}
                style={{
                  left: node.position.x,
                  top: node.position.y,
                  borderColor: getNodeColor(node.type).replace('bg-', '#').replace('500', ''),
                  width: '192px'
                }}
                draggable={!isConnecting}
                onClick={() => {
                  if (isConnecting) {
                    handleNodeConnectionClick(node.id, false);
                  } else {
                    setSelectedNode(selectedNode === node.id ? null : node.id);
                  }
                }}
                onDragStart={(e) => {
                  if (!isConnecting) {
                  e.dataTransfer.setData('text/plain', node.id);
                  }
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white", getNodeColor(node.type))}>
                      {getNodeIcon(node.type, node.subtype)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">{node.title}</h4>
                      <p className="text-xs text-muted-foreground capitalize">{node.type}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNode(node.id);
                    }}
                    className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                
                <p className="text-xs text-muted-foreground mb-3">{node.description}</p>
                
                {/* Connection points */}
                {/* Input connection point (top) - not for trigger nodes */}
                {node.type !== 'trigger' && (
                  <div 
                    className={cn(
                      "absolute -top-2 left-1/2 transform -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white cursor-pointer hover:scale-110 transition-transform",
                      isConnecting ? "bg-blue-500" : "bg-gray-300"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isConnecting) {
                        handleNodeConnectionClick(node.id, false);
                      }
                    }}
                    title="Input connection point"
                  />
                )}
                
                {/* Output connection point (bottom) - not for aggregate nodes unless they have outputs */}
                {(node.type !== 'aggregate' || node.type === 'aggregate') && (
                  <div 
                    className={cn(
                      "absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white cursor-pointer hover:scale-110 transition-transform",
                      isConnecting ? "bg-green-500" : "bg-gray-300"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isConnecting) {
                        handleNodeConnectionClick(node.id, true);
                      }
                    }}
                    title="Output connection point"
                  />
                )}

                {/* Split nodes get multiple output points */}
                {node.type === 'split' && (
                  <>
                    <div 
                      className={cn(
                        "absolute -bottom-2 left-1/4 transform -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white cursor-pointer hover:scale-110 transition-transform",
                        isConnecting ? "bg-green-500" : "bg-gray-300"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isConnecting) {
                          handleNodeConnectionClick(node.id, true);
                        }
                      }}
                      title="Output 1"
                    />
                    <div 
                      className={cn(
                        "absolute -bottom-2 right-1/4 transform translate-x-1/2 w-3 h-3 rounded-full border-2 border-white cursor-pointer hover:scale-110 transition-transform",
                        isConnecting ? "bg-green-500" : "bg-gray-300"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isConnecting) {
                          handleNodeConnectionClick(node.id, true);
                        }
                      }}
                      title="Output 2"
                    />
                  </>
                )}

                {/* Aggregate nodes get multiple input points */}
                {node.type === 'aggregate' && (
                  <>
                    <div 
                      className={cn(
                        "absolute -top-2 left-1/4 transform -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white cursor-pointer hover:scale-110 transition-transform",
                        isConnecting ? "bg-blue-500" : "bg-gray-300"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isConnecting) {
                          handleNodeConnectionClick(node.id, false);
                        }
                      }}
                      title="Input 1"
                    />
                    <div 
                      className={cn(
                        "absolute -top-2 right-1/4 transform translate-x-1/2 w-3 h-3 rounded-full border-2 border-white cursor-pointer hover:scale-110 transition-transform",
                        isConnecting ? "bg-blue-500" : "bg-gray-300"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isConnecting) {
                          handleNodeConnectionClick(node.id, false);
                        }
                      }}
                      title="Input 2"
                    />
                  </>
                )}
                
                {/* Node configuration */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t">
                  <Badge variant="outline" className="text-xs">
                    {node.subtype}
                  </Badge>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Settings className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            
            {/* Success message for first node */}
            {canvasNodes.length === 1 && (
              <div className="absolute top-4 right-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Great! Now add more nodes to build your workflow.</span>
                </div>
              </div>
            )}
          </div>
        )}
              </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isBuilding) {
    return (
      <div className="h-screen flex flex-col">
        {/* Builder Header */}
        <div className="border-b bg-background p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => setIsBuilding(false)}>
                ← Back to Automations
              </Button>
              <div>
                <h1 className="text-xl font-bold">{selectedWorkflow?.name}</h1>
                <p className="text-sm text-muted-foreground">
                  Visual Automation Builder • {canvasNodes.length} nodes • {connections.length} connections
                </p>
              </div>
            </div>
                      <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                toast.success('Workflow saved successfully!');
                console.log('Saving workflow:', { 
                  name: selectedWorkflow?.name,
                  nodes: canvasNodes, 
                  connections 
                });
              }}
              disabled={canvasNodes.length === 0}
            >
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button size="sm">
              <Play className="h-4 w-4 mr-2" />
              Activate
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open('/debug-drag-drop', '_blank')}>
              🐛 Debug D&D
            </Button>
          </div>
          </div>
        </div>

        {/* Builder Content */}
        <div className="flex flex-1">
          <NodePalette />
          <WorkflowCanvas />
        </div>
      </div>
    );
  }

  return (
    <SidebarDemo>
      <EmailMarketingNav />
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between p-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                Email Automation
              </h1>
              <p className="text-muted-foreground">Create powerful automated email workflows</p>
            </div>
            
            <div className="flex gap-3">
              <Link href="/settings/cron">
                <Button variant="outline" className="bg-gradient-to-r from-green-600 to-blue-600 text-white border-0 hover:from-green-700 hover:to-blue-700">
                  <Calendar className="h-4 w-4 mr-2" />
                  Scheduled Automations
                </Button>
              </Link>
              {isBuilding && (
                <Button 
                  onClick={() => {
                    setCanvasNodes([]);
                    setConnections([]);
                    setSelectedNode(null);
                  }}
                  variant="outline"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
              )}
              <Button onClick={createNewWorkflow}>
                <Plus className="h-4 w-4 mr-2" />
                Create Automation
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="p-6 border-b">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Workflows</p>
                    <p className="text-2xl font-bold">{workflows.filter(w => w.status === 'active').length}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                    <Play className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </AnimatedBorderCard>

            <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Contacts</p>
                    <p className="text-2xl font-bold">
                      {workflows.reduce((sum, w) => sum + w.stats.active_contacts, 0)}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </AnimatedBorderCard>

            <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Triggered</p>
                    <p className="text-2xl font-bold">
                      {workflows.reduce((sum, w) => sum + w.stats.triggered, 0)}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </AnimatedBorderCard>

            <AnimatedBorderCard className="bg-background/50 backdrop-blur-sm border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Completion Rate</p>
                    <p className="text-2xl font-bold">
                      {workflows.length > 0 
                        ? Math.round((workflows.reduce((sum, w) => sum + w.stats.completed, 0) / 
                          workflows.reduce((sum, w) => sum + w.stats.triggered, 0)) * 100) || 0
                        : 0}%
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                    <Target className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
              </CardContent>
            </AnimatedBorderCard>
          </div>
        </div>

        {/* Workflows Grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {workflows.map((workflow) => (
              <AnimatedBorderCard key={workflow.id} className="cursor-pointer hover:shadow-lg transition-all duration-200">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{workflow.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{workflow.description}</p>
                    </div>
                    <Badge className={getStatusColor(workflow.status)}>
                      {workflow.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Workflow Stats */}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-lg font-bold text-blue-600">{workflow.stats.triggered}</div>
                      <div className="text-xs text-muted-foreground">Triggered</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-green-600">{workflow.stats.completed}</div>
                      <div className="text-xs text-muted-foreground">Completed</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-purple-600">{workflow.stats.active_contacts}</div>
                      <div className="text-xs text-muted-foreground">Active</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setSelectedWorkflow(workflow);
                        setIsBuilding(true);
                      }}
                    >
                      <Edit3 className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => toggleWorkflowStatus(workflow.id, workflow.status)}
                      >
                        {workflow.status === 'active' ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </AnimatedBorderCard>
            ))}

            {/* Create New Card */}
            <AnimatedBorderCard 
              className="cursor-pointer hover:shadow-lg transition-all duration-200 border-dashed"
              onClick={createNewWorkflow}
            >
              <CardContent className="flex flex-col items-center justify-center h-64">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Plus className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Create New Automation</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Build powerful email workflows with our visual automation builder
                </p>
              </CardContent>
            </AnimatedBorderCard>
          </div>
        </div>
      </div>
    </SidebarDemo>
  );
} 