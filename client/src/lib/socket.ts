/**
 * Socket.io Client Configuration
 * Production-ready socket client with singleton pattern
 */

import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from './api';

// Singleton socket instance
let socketInstance: Socket | null = null;

/**
 * Get or create socket instance
 * Ensures only one socket connection exists
 */
export function getSocket(): Socket {
  if (!socketInstance) {
    console.log('🔌 [SOCKET] Creating new socket connection to:', SOCKET_URL);
    
    socketInstance = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      transports: ['websocket', 'polling'],
    });

    socketInstance.on('connect', () => {
      console.log('✅ [SOCKET] Connected successfully', socketInstance?.id);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('⚠️ [SOCKET] Disconnected:', reason);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('❌ [SOCKET] Connection error:', error);
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
