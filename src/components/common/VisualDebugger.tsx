import React, { useState, useEffect } from 'react';
import { X, Trash2, Minimize2, Maximize2 } from 'lucide-react';

interface LogEntry {
    id: string;
    type: 'log' | 'error' | 'warn' | 'info';
    message: string;
    timestamp: string;
}

export const VisualDebugger: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isVisible, setIsVisible] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    useEffect(() => {
        // Override console methods to capture logs
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        const addLog = (type: LogEntry['type'], args: any[]) => {
            const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');

            setLogs(prev => [...prev, {
                id: Math.random().toString(36).substr(2, 9),
                type,
                message,
                timestamp: new Date().toLocaleTimeString()
            }].slice(-50)); // Keep last 50 logs
        };

        console.log = (...args) => {
            originalLog(...args);
            addLog('log', args);
        };

        console.error = (...args) => {
            originalError(...args);
            addLog('error', args);
        };

        console.warn = (...args) => {
            originalWarn(...args);
            addLog('warn', args);
        };

        return () => {
            console.log = originalLog;
            console.error = originalError;
            console.warn = originalWarn;
        };
    }, []);

    if (!isVisible) {
        return (
            <button
                onClick={() => setIsVisible(true)}
                className="fixed bottom-24 right-4 z-[9999] bg-red-600 text-white p-2 rounded-full shadow-lg opacity-50 hover:opacity-100"
            >
                🐞
            </button>
        );
    }

    if (isMinimized) {
        return (
            <div className="fixed bottom-24 right-4 z-[9999] bg-black/90 border border-white/20 p-2 rounded-lg flex gap-2">
                <button onClick={() => setIsMinimized(false)}><Maximize2 size={16} className="text-white" /></button>
                <button onClick={() => setIsVisible(false)}><X size={16} className="text-white" /></button>
            </div>
        );
    }

    return (
        <div className="fixed inset-x-0 bottom-0 top-1/2 z-[9999] bg-black/95 border-t border-white/20 flex flex-col font-mono text-xs">
            <div className="flex justify-between items-center p-2 bg-gray-900 border-b border-white/10">
                <span className="text-white font-bold">Debug Console ({logs.length})</span>
                <div className="flex gap-4">
                    <button onClick={() => setLogs([])}><Trash2 size={16} className="text-gray-400 hover:text-white" /></button>
                    <button onClick={() => setIsMinimized(true)}><Minimize2 size={16} className="text-gray-400 hover:text-white" /></button>
                    <button onClick={() => setIsVisible(false)}><X size={16} className="text-red-400 hover:text-red-200" /></button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {logs.map(log => (
                    <div key={log.id} className={`border-b border-white/5 pb-1 ${log.type === 'error' ? 'text-red-400' :
                            log.type === 'warn' ? 'text-yellow-400' : 'text-green-400'
                        }`}>
                        <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
                    </div>
                ))}
            </div>
        </div>
    );
};
