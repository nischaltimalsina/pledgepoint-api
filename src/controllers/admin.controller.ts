import { Request, Response } from 'express';

export const adminController = {
  async example(req: Request, res: Response) {
    res.send('admin controller working');
  }
};
