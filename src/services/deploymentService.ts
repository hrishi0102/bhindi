import { GitHubService, type GitHubRepoInfo } from './githubService.js';
import { VercelService, type DeploymentResult } from './vercelService.js';

export interface DeployRepoParams {
  repoUrl: string;
  projectName?: string;
  framework?: string;
}

export interface TokenPair {
  githubToken: string;
  vercelToken: string;
}

/**
 * Deployment Service that orchestrates GitHub and Vercel operations
 */
export class DeploymentService {
  private githubService: GitHubService;
  private vercelService: VercelService;

  constructor() {
    this.githubService = new GitHubService();
    this.vercelService = new VercelService();
  }

  /**
   * Parse combined token (github_token:vercel_token)
   */
  parseTokens(combinedToken: string): TokenPair {
    const parts = combinedToken.split(':');
    if (parts.length !== 2) {
      throw new Error('Token format should be "github_token:vercel_token"');
    }

    const [githubToken, vercelToken] = parts;
    if (!githubToken.trim() || !vercelToken.trim()) {
      throw new Error('Both GitHub and Vercel tokens are required');
    }

    return {
      githubToken: githubToken.trim(),
      vercelToken: vercelToken.trim(),
    };
  }

  /**
   * Generate project name from repository
   */
  private generateProjectName(
    repoInfo: { owner: string; repo: string },
    customName?: string
  ): string {
    if (customName) {
      // Sanitize custom name for Vercel (lowercase, no special chars except hyphens)
      return customName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }

    // Use repo name with owner prefix to avoid conflicts
    return `${repoInfo.owner}-${repoInfo.repo}`.toLowerCase();
  }

  /**
   * Deploy repository to Vercel
   */
  async deployRepository(tokens: TokenPair, params: DeployRepoParams): Promise<DeploymentResult> {
    try {
      // Step 1: Validate GitHub repository
      console.log('🔍 Validating GitHub repository...');
      const repoInfo = await this.githubService.validateRepository(
        tokens.githubToken,
        params.repoUrl
      );

      // Step 2: Generate project name
      const projectName = this.generateProjectName(repoInfo, params.projectName);

      // Step 3: Create or get Vercel project
      console.log('🏗️ Creating/getting Vercel project...');
      const project = await this.vercelService.createProject(
        tokens.vercelToken,
        projectName,
        repoInfo,
        params.framework || 'static'
      );

      // Step 4: Create deployment
      console.log('🚀 Creating deployment...');
      const deployment = await this.vercelService.createDeployment(
        tokens.vercelToken,
        project,
        repoInfo
      );

      return {
        deployment,
        project,
        message: `Successfully initiated deployment of ${repoInfo.fullName} to Vercel`,
      };
    } catch (error: any) {
      throw new Error(`Deployment failed: ${error.message}`);
    }
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(vercelToken: string, deploymentId: string) {
    try {
      const deployment = await this.vercelService.getDeploymentStatus(vercelToken, deploymentId);

      const statusMessages = {
        BUILDING: 'Deployment is currently building',
        ERROR: 'Deployment failed with errors',
        INITIALIZING: 'Deployment is initializing',
        QUEUED: 'Deployment is queued and waiting to start',
        READY: 'Deployment is live and ready',
        CANCELED: 'Deployment was canceled',
      };

      return {
        deployment,
        status: deployment.state,
        message: statusMessages[deployment.state] || 'Unknown deployment status',
        isLive: deployment.state === 'READY',
        hasError: deployment.state === 'ERROR',
      };
    } catch (error: any) {
      throw new Error(`Failed to get deployment status: ${error.message}`);
    }
  }
}
