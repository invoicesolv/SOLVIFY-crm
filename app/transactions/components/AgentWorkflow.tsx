import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Search, FileCheck, AlertCircle } from 'lucide-react';

interface AgentStep {
  id: string;
  agent: string;
  status: 'waiting' | 'processing' | 'complete' | 'error';
  message: string;
  detail?: string;
}

interface AgentWorkflowProps {
  isProcessing: boolean;
  onComplete: () => void;
}

export function AgentWorkflow({ isProcessing, onComplete }: AgentWorkflowProps) {
  const [steps, setSteps] = useState<AgentStep[]>([
    {
      id: 'fetcher',
      agent: 'Receipt Fetcher',
      status: 'waiting',
      message: 'Analyzing transaction patterns...',
      detail: 'Identifying suppliers and missing receipts'
    },
    {
      id: 'matcher',
      agent: 'Transaction Matcher',
      status: 'waiting',
      message: 'Finding potential matches...',
      detail: 'Using fuzzy matching and ML algorithms'
    },
    {
      id: 'suggester',
      agent: 'Smart Suggester',
      status: 'waiting',
      message: 'Generating suggestions...',
      detail: 'Preparing AI-powered recommendations'
    }
  ]);

  useEffect(() => {
    if (isProcessing) {
      // Simulate agent workflow
      const runWorkflow = async () => {
        // Receipt Fetcher
        setSteps(prev => prev.map(step =>
          step.id === 'fetcher' ? { ...step, status: 'processing' } : step
        ));
        await new Promise(resolve => setTimeout(resolve, 2000));
        setSteps(prev => prev.map(step =>
          step.id === 'fetcher' ? { ...step, status: 'complete' } : step
        ));

        // Transaction Matcher
        setSteps(prev => prev.map(step =>
          step.id === 'matcher' ? { ...step, status: 'processing' } : step
        ));
        await new Promise(resolve => setTimeout(resolve, 2500));
        setSteps(prev => prev.map(step =>
          step.id === 'matcher' ? { ...step, status: 'complete' } : step
        ));

        // Smart Suggester
        setSteps(prev => prev.map(step =>
          step.id === 'suggester' ? { ...step, status: 'processing' } : step
        ));
        await new Promise(resolve => setTimeout(resolve, 1500));
        setSteps(prev => prev.map(step =>
          step.id === 'suggester' ? { ...step, status: 'complete' } : step
        ));

        // Workflow complete
        onComplete();
      };

      runWorkflow();
    } else {
      // Reset steps when not processing
      setSteps(prev => prev.map(step => ({ ...step, status: 'waiting' })));
    }
  }, [isProcessing, onComplete]);

  return (
    <AnimatePresence>
      {isProcessing && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="bg-neutral-900 rounded-lg p-6 max-w-2xl w-full space-y-6"
          >
            <div className="text-center mb-8">
              <h3 className="text-xl font-semibold text-white mb-2">AI Agents Working</h3>
              <p className="text-neutral-400">Our AI agents are analyzing your data...</p>
            </div>

            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={step.id} className="relative">
                  {index < steps.length - 1 && (
                    <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-neutral-800" />
                  )}
                  
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.2 }}
                    className="flex items-start gap-4"
                  >
                    <div className="relative">
                      <motion.div
                        animate={{
                          scale: step.status === 'processing' ? [1, 1.1, 1] : 1,
                          rotate: step.status === 'processing' ? [0, 180, 360] : 0
                        }}
                        transition={{ repeat: step.status === 'processing' ? Infinity : 0, duration: 2 }}
                        className={`
                          w-10 h-10 rounded-full flex items-center justify-center
                          ${step.status === 'waiting' ? 'bg-neutral-800' :
                            step.status === 'processing' ? 'bg-blue-600' :
                            step.status === 'complete' ? 'bg-green-600' :
                            'bg-red-600'}
                        `}
                      >
                        <Brain className="h-5 w-5 text-white" />
                      </motion.div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-white font-medium">{step.agent}</h4>
                        <motion.div
                          animate={{
                            opacity: step.status === 'processing' ? [0.5, 1] : 1
                          }}
                          transition={{ repeat: step.status === 'processing' ? Infinity : 0, duration: 1 }}
                          className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400"
                        >
                          {step.status === 'waiting' ? 'Waiting...' :
                           step.status === 'processing' ? 'Processing...' :
                           step.status === 'complete' ? 'Complete' :
                           'Error'}
                        </motion.div>
                      </div>
                      <p className="text-sm text-neutral-400 mt-1">{step.message}</p>
                      {step.detail && (
                        <p className="text-xs text-neutral-500 mt-0.5">{step.detail}</p>
                      )}
                    </div>
                  </motion.div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 