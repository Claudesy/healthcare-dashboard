/**
 * Sentra EMR Auto-Fill Engine — Socket.IO Bridge
 * Singleton yang decouples lib/ dari server.ts.
 * setSocketIO() dipanggil dari server.ts setelah io dibuat.
 * emitEMRProgress() dipanggil dari engine.ts untuk kirim progress ke client.
 */

import type { Server as SocketIOServer } from 'socket.io';
import type { EMRProgressEvent } from './types';

let _io: SocketIOServer | null = null;

export function setSocketIO(io: SocketIOServer): void {
  _io = io;
}

export function emitEMRProgress(event: EMRProgressEvent): void {
  if (!_io) return;
  _io.emit('emr:progress', event);
}
