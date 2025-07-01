import fetch from 'node-fetch';
import type { GitHubRepoInfo } from './githubService.js';

export interface VercelProject {
  id: string;
  name: string;
  accountId: string;
  createdAt: number;
  updatedAt: number;
}

export interface VercelDeployment {
  id: string;
  url: string;
  name: string;
  state: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED';
  createdAt: number;
  projectId: string;
  inspectorUrl?: string;
}

export interface DeploymentResult {
  deployment: VercelDeployment;
  project: VercelProject;
  message: string;
}

/**
 * Vercel Service for project creation and deployments
 */
export class VercelService {
  private readonly baseUrl = 'https://api.vercel.com';

  /**
   * Create or get existing Vercel project
   */
  async createProject(
    token: string,
    projectName: string,
    repoInfo: GitHubRepoInfo,
    framework: string = 'static'
  ): Promise<VercelProject> {
    try {
      // First try to get existing project
      try {
        const existing = await this.getProject(token, projectName);
        if (existing) {
          return existing;
        }
      } catch (error) {
        // Project doesn't exist, continue to create
      }

      const projectData = {
        name: projectName,
        gitRepository: {
          type: 'github',
          repo: repoInfo.fullName,
        },
        framework: framework === 'static' ? null : framework,
      };

      const response = await fetch(`${this.baseUrl}/v9/projects`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Bhindi-Agent-Vercel-Deployer/1.0',
        },
        body: JSON.stringify(projectData),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as any;
        throw new Error(`Vercel API error: ${errorData.error?.message || response.statusText}`);
      }

      return (await response.json()) as VercelProject;
    } catch (error: any) {
      throw new Error(`Failed to create Vercel project: ${error.message}`);
    }
  }

  /**
   * Get existing project by name
   */
  async getProject(token: string, projectName: string): Promise<VercelProject | null> {
    try {
      const response = await fetch(`${this.baseUrl}/v9/projects/${projectName}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'Bhindi-Agent-Vercel-Deployer/1.0',
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as VercelProject;
    } catch (error: any) {
      if (error.message.includes('404')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create deployment from GitHub repository with proper repoId
   */
  async createDeployment(
    token: string,
    project: VercelProject,
    repoInfo: GitHubRepoInfo
  ): Promise<VercelDeployment> {
    try {
      const deploymentData = {
        name: project.name,
        project: project.id,
        gitSource: {
          type: 'github',
          repo: repoInfo.fullName,
          ref: repoInfo.defaultBranch,
          repoId: repoInfo.repoId, // Include the repository ID
        },
      };

      const response = await fetch(`${this.baseUrl}/v13/deployments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Bhindi-Agent-Vercel-Deployer/1.0',
        },
        body: JSON.stringify(deploymentData),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as any;
        throw new Error(
          `Vercel deployment error: ${errorData.error?.message || response.statusText}`
        );
      }

      return (await response.json()) as VercelDeployment;
    } catch (error: any) {
      throw new Error(`Failed to create deployment: ${error.message}`);
    }
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(token: string, deploymentId: string): Promise<VercelDeployment> {
    try {
      const response = await fetch(`${this.baseUrl}/v13/deployments/${deploymentId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'Bhindi-Agent-Vercel-Deployer/1.0',
        },
      });

      if (!response.ok) {
        const errorData = (await response.json()) as any;
        throw new Error(`Vercel API error: ${errorData.error?.message || response.statusText}`);
      }

      return (await response.json()) as VercelDeployment;
    } catch (error: any) {
      throw new Error(`Failed to get deployment status: ${error.message}`);
    }
  }
}
