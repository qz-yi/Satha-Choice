/**
 * Socket.io Client Configuration
 * EMERGENCY FIX: Force localhost connection for now
 */

import { io, Socket } from 'socket.io-client';

// Singleton socket instance
let socketInstance: Socket | null = null;

/**
 * Get or create socket instance
 * EMERGENCY: Using current origin (localhost/Replit) instead of env vars
 */
export function getSocket(): Socket {
  if (!socketInstance) {
    // CRITICAL FIX: Use current window.location.origin instead of env vars
    const socketUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000';
    
    console.log('🔌 [SOCKET EMERGENCY FIX] Connecting to:', socketUrl);
    
    socketInstance = io(socketUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      transports: ['websocket', 'polling'],
    });

    socketInstance.on('connect', () => {
      console.log('✅ [SOCKET] Connected successfully - ID:', socketInstance?.id);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('⚠️ [SOCKET] Disconnected:', reason);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('❌ [SOCKET] Connection error:', error);
      console.error('❌ [SOCKET] URL attempted:', socketUrl);
    });
  }

  return socketInstance;
}

/**
 * Disconnect socket (useful for cleanup)
 */
export function disconnectSocket(): void {
  if (socketInstance) {
    console.log('🔌 [SOCKET] Disconnecting...');
    socketInstance.disconnect();
    socketInstance = null;
  }
}
