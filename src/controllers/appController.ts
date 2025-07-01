import { Request, Response } from 'express';
import { DeploymentService } from '../services/deploymentService.js';
import { BaseSuccessResponseDto, BaseErrorResponseDto } from '../types/agent.js';

/**
 * App Controller for GitHub to Vercel deployment
 */
export class AppController {
  private deploymentService: DeploymentService;

  constructor() {
    this.deploymentService = new DeploymentService();
  }

  /**
   * Handle tool execution - routes to appropriate handler based on tool type
   */
  async handleTool(req: Request, res: Response): Promise<void> {
    const { toolName } = req.params;
    const params = req.body;

    try {
      // All deployment tools require authentication
      const token = this.extractBearerToken(req);
      if (!token) {
        const errorResponse = new BaseErrorResponseDto(
          'Deployment tools require authentication. Please provide Bearer token in format "github_token:vercel_token"',
          401,
          'Missing Authorization header with Bearer token'
        );
        res.status(401).json(errorResponse);
        return;
      }

      // Parse tokens
      let tokens;
      try {
        tokens = this.deploymentService.parseTokens(token);
      } catch (error: any) {
        const errorResponse = new BaseErrorResponseDto(
          error.message,
          400,
          'Token format should be "github_token:vercel_token"'
        );
        res.status(400).json(errorResponse);
        return;
      }

      // Handle deployment tools
      if (toolName === 'deployRepo') {
        await this.handleDeployRepo(tokens, params, res);
        return;
      }

      if (toolName === 'getDeploymentStatus') {
        await this.handleGetDeploymentStatus(tokens.vercelToken, params, res);
        return;
      }

      // Unknown tool
      const errorResponse = new BaseErrorResponseDto(
        `Unknown tool: ${toolName}`,
        404,
        'Available tools: deployRepo, getDeploymentStatus'
      );
      res.status(404).json(errorResponse);
    } catch (error) {
      console.error('Tool execution error:', error);
      const errorResponse = new BaseErrorResponseDto(
        error instanceof Error ? error.message : 'Unknown error occurred',
        500,
        'Tool execution failed'
      );
      res.status(500).json(errorResponse);
    }
  }

  /**
   * Handle repository deployment
   */
  private async handleDeployRepo(tokens: any, params: any, res: Response): Promise<void> {
    // Validate required parameters
    this.validateDeployRepoParameters(params);

    try {
      const result = await this.deploymentService.deployRepository(tokens, {
        repoUrl: params.repoUrl,
        projectName: params.projectName,
        framework: params.framework || 'static',
      });

      const response = new BaseSuccessResponseDto(
        {
          deploymentId: result.deployment.id,
          deploymentUrl: `https://${result.deployment.url}`,
          projectName: result.project.name,
          status: result.deployment.state,
          message: result.message,
          repository: params.repoUrl,
          framework: params.framework || 'static',
          inspectorUrl: result.deployment.inspectorUrl,
          tool_type: 'deployment',
        },
        'mixed'
      );

      res.json(response);
    } catch (error: any) {
      const errorResponse = new BaseErrorResponseDto(error.message, 400, 'Deployment failed');
      res.status(400).json(errorResponse);
    }
  }

  /**
   * Handle deployment status check
   */
  private async handleGetDeploymentStatus(
    vercelToken: string,
    params: any,
    res: Response
  ): Promise<void> {
    // Validate required parameters
    if (!params.deploymentId) {
      throw new Error('Missing required parameter: deploymentId');
    }

    try {
      const result = await this.deploymentService.getDeploymentStatus(
        vercelToken,
        params.deploymentId
      );

      const response = new BaseSuccessResponseDto(
        {
          deploymentId: result.deployment.id,
          status: result.deployment.state,
          deploymentUrl: `https://${result.deployment.url}`,
          message: result.message,
          isLive: result.isLive,
          hasError: result.hasError,
          createdAt: new Date(result.deployment.createdAt).toISOString(),
          inspectorUrl: result.deployment.inspectorUrl,
          tool_type: 'deployment_status',
        },
        'mixed'
      );

      res.json(response);
    } catch (error: any) {
      const errorResponse = new BaseErrorResponseDto(
        error.message,
        400,
        'Failed to get deployment status'
      );
      res.status(400).json(errorResponse);
    }
  }

  /**
   * Validate deployRepo parameters
   */
  private validateDeployRepoParameters(params: any): void {
    if (!params.repoUrl) {
      throw new Error('Missing required parameter: repoUrl');
    }

    if (typeof params.repoUrl !== 'string') {
      throw new Error("Parameter 'repoUrl' must be a string");
    }

    // Basic URL validation
    if (!params.repoUrl.includes('github.com')) {
      throw new Error("Parameter 'repoUrl' must be a valid GitHub repository URL");
    }

    // Optional parameters validation
    if (params.projectName && typeof params.projectName !== 'string') {
      throw new Error("Parameter 'projectName' must be a string");
    }

    if (params.framework && typeof params.framework !== 'string') {
      throw new Error("Parameter 'framework' must be a string");
    }
  }

  /**
   * Extract Bearer token from request
   */
  private extractBearerToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  }
}
