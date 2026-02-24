import { io, Socket } from 'socket.io-client';
import { API_BASE } from './http';

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    // API_BASE is always an absolute URL (set correctly for both browser and APK)
    const socketUrl = API_BASE || window.location.origin;

    console.log('[SOCKET] Connecting to:', socketUrl);

    socketInstance = io(socketUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 15,
      transports: ['websocket', 'polling'],
    });

    socketInstance.on('connect', () => {
      console.log('[SOCKET] Connected — ID:', socketInstance?.id);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[SOCKET] Disconnected:', reason);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('[SOCKET] Connection error:', error.message);
    });
  }

  return socketInstance;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
