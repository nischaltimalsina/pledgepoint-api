import { Request, Response } from 'express';

export const promiseController = {
  async example(req: Request, res: Response) {
    res.send('promise controller working');
  }
};
