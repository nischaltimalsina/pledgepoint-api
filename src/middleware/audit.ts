import { Request, Response, NextFunction } from 'express';

export const audit_middleware = (req: Request, res: Response, next: NextFunction) => {
  next();
};
