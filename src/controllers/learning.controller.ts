import { Request, Response } from 'express';

export const learningController = {
  async example(req: Request, res: Response) {
    res.send('learning controller working');
  }
};
