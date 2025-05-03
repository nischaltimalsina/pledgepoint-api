import { Request, Response } from 'express';

export const officialController = {
  async example(req: Request, res: Response) {
    res.send('official controller working');
  }
};
