import { Request, Response, NextFunction } from 'express';

export const auth_middleware = (req: Request, res: Response, next: NextFunction) => {
  next();
};
