import { Octokit } from '@octokit/rest';

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  defaultBranch: string;
  isPrivate: boolean;
  fullName: string;
  repoId: number; // Add repository ID for Vercel API
}

/**
 * GitHub Service for repository validation and metadata
 */
export class GitHubService {
  /**
   * Parse GitHub URL and extract owner/repo
   */
  parseGitHubUrl(repoUrl: string): { owner: string; repo: string } {
    // Handle various GitHub URL formats
    const patterns = [
      /^https:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/.*)?$/,
      /^git@github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/,
      /^([^\/]+)\/([^\/]+)$/, // Simple owner/repo format
    ];

    for (const pattern of patterns) {
      const match = repoUrl.match(pattern);
      if (match) {
        return { owner: match[1], repo: match[2] };
      }
    }

    throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
  }

  /**
   * Validate repository exists and get metadata including repository ID
   */
  async validateRepository(token: string, repoUrl: string): Promise<GitHubRepoInfo> {
    try {
      const { owner, repo } = this.parseGitHubUrl(repoUrl);

      const octokit = new Octokit({
        auth: token,
        userAgent: 'Bhindi-Agent-Vercel-Deployer/1.0',
      });

      const { data } = await octokit.rest.repos.get({
        owner,
        repo,
      });

      return {
        owner: data.owner.login,
        repo: data.name,
        defaultBranch: data.default_branch,
        isPrivate: data.private,
        fullName: data.full_name,
        repoId: data.id, // Include repository ID for Vercel API
      };
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error(`Repository not found or not accessible: ${repoUrl}`);
      } else if (error.status === 401) {
        throw new Error('GitHub token is invalid or expired');
      } else if (error.status === 403) {
        throw new Error('GitHub token does not have permission to access this repository');
      }
      throw new Error(`GitHub API error: ${error.message}`);
    }
  }
}
