import express from 'express';
import * as swaggerUi from 'swagger-ui-express';
import usersRoutes from './routes/users.routes.js';
import { errorHandler } from './middleware/error.js';
import { swaggerSpec } from './config/swagger.js';

export function createApp() {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Swagger documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Routes
  app.use('/api/users', usersRoutes);

  // Error handling (must be last)
  app.use(errorHandler);

  return app;
}
