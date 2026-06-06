import { Request, Response, NextFunction } from 'express';
import { usersService } from '../services/users.service.js';

export class UsersController {
  async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await usersService.createUser(req.body);
      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  }

  async getUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit, cursor } = req.query;
      const result = await usersService.getUsers(
        limit as unknown as number,
        cursor as string | undefined
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async getMatches(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const matches = await usersService.findMatches(id);
      res.json(matches);
    } catch (error) {
      next(error);
    }
  }
}

export const usersController = new UsersController();
