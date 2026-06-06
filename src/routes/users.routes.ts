import { Router } from 'express';
import { z } from 'zod';
import { usersController } from '../controllers/users.controller.js';
import { validate } from '../middleware/validate.js';

const router = Router();

/**
 * @openapi
 * /api/users:
 *   post:
 *     tags:
 *       - Users
 *     summary: Create a new user
 *     description: Creates a new user in the system
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - age
 *               - city
 *               - educationLevel
 *               - scoreSelfGrowth
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               age:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 120
 *                 example: 25
 *               city:
 *                 type: string
 *                 example: Tehran
 *               educationLevel:
 *                 type: string
 *                 enum: [high_school, associate, bachelor, master, phd]
 *                 example: bachelor
 *               goals:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ['career_growth', 'networking']
 *               scoreSelfGrowth:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 example: 85
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get list of users
 *     description: Retrieves a paginated list of users
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *           default: 50
 *         description: Number of users to return
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Cursor for pagination
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 nextCursor:
 *                   type: string
 *                   format: uuid
 *                   nullable: true
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @openapi
 * /api/users/{id}/match:
 *   get:
 *     tags:
 *       - Users
 *     summary: Find matches for a user
 *     description: Finds compatible user matches based on compatibility algorithm
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID to find matches for
 *     responses:
 *       200:
 *         description: Matches found successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserMatch'
 *       400:
 *         description: Invalid user ID format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

// Validation schemas
const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.number().int().min(0).max(120, 'Age must be between 0 and 120'),
  city: z.string().min(1, 'City is required'),
  educationLevel: z.enum(['high_school', 'associate', 'bachelor', 'master', 'phd']),
  goals: z.array(z.string().min(1)).default([]),
  scoreSelfGrowth: z.number().min(0).max(100, 'Score must be between 0 and 100'),
});

const listQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .default('50')
    .transform(Number)
    .refine((val) => val >= 1 && val <= 200, 'Limit must be between 1 and 200'),
  cursor: z.string().uuid().optional(),
});

const matchParamsSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
});

// Routes
router.post(
  '/',
  validate(createUserSchema, 'body'),
  usersController.createUser.bind(usersController)
);

router.get('/', validate(listQuerySchema, 'query'), usersController.getUsers.bind(usersController));

router.get(
  '/:id/match',
  validate(matchParamsSchema, 'params'),
  usersController.getMatches.bind(usersController)
);

export default router;
