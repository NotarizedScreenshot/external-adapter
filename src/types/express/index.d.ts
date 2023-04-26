export {};

declare global {
  namespace Express {
    export interface Request {
      id?: string;
    }
  }
}

declare module 'socket.io' {
  interface Socket {
    userId: string;
  }
}
