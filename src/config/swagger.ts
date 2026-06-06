import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Prestige Club API',
      version: '1.0.0',
      description: 'User matching service for Prestige Club',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      schemas: {
        User: {
          type: 'object',
          required: ['name', 'age', 'city', 'educationLevel', 'scoreSelfGrowth'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'User unique identifier',
            },
            name: {
              type: 'string',
              minLength: 1,
              description: 'User full name',
              example: 'John Doe',
            },
            age: {
              type: 'integer',
              minimum: 0,
              maximum: 120,
              description: 'User age',
              example: 25,
            },
            city: {
              type: 'string',
              minLength: 1,
              description: 'User city',
              example: 'Tehran',
            },
            educationLevel: {
              type: 'string',
              enum: ['high_school', 'associate', 'bachelor', 'master', 'phd'],
              description: 'User education level',
              example: 'bachelor',
            },
            goals: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'User personal goals',
              example: ['career_growth', 'networking'],
            },
            scoreSelfGrowth: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: 'Self-growth score',
              example: 85,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'User creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'User last update timestamp',
            },
          },
        },
        UserMatch: {
          type: 'object',
          properties: {
            user: {
              $ref: '#/components/schemas/User',
            },
            score: {
              type: 'number',
              description: 'Match compatibility score',
              example: 92.5,
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type',
            },
            message: {
              type: 'string',
              description: 'Error message',
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
              },
              description: 'Additional error details',
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
