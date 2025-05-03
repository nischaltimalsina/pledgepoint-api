import { Request, Response } from 'express';

export const userController = {
  async example(req: Request, res: Response) {
    res.send('user controller working');
  }
};
