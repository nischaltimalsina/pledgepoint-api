import { Request, Response, NextFunction } from 'express';

export const logger_middleware = (req: Request, res: Response, next: NextFunction) => {
  next();
};
