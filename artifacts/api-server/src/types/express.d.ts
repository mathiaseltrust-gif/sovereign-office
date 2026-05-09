declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        roles: string[];
        entraId?: string;
        dbId?: number;
      };
    }
  }
}

export {};
