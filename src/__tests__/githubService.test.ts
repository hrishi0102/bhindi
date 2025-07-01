import { GitHubService } from '@/services/githubService.js';

// Mock fetch globally
global.fetch = jest.fn();

describe('GitHubService', () => {
  let githubService: GitHubService;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    githubService = new GitHubService();
    mockFetch.mockClear();
  });

  describe('parseGitHubUrl', () => {
    it('should parse standard GitHub HTTPS URL', () => {
      const result = githubService.parseGitHubUrl('https://github.com/owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should parse GitHub HTTPS URL with .git suffix', () => {
      const result = githubService.parseGitHubUrl('https://github.com/owner/repo.git');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should parse GitHub SSH URL', () => {
      const result = githubService.parseGitHubUrl('git@github.com:owner/repo.git');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should parse simple owner/repo format', () => {
      const result = githubService.parseGitHubUrl('owner/repo');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should handle URLs with trailing paths', () => {
      const result = githubService.parseGitHubUrl('https://github.com/owner/repo/tree/main');
      expect(result).toEqual({ owner: 'owner', repo: 'repo' });
    });

    it('should throw error for invalid URLs', () => {
      expect(() => {
        githubService.parseGitHubUrl('invalid-url');
      }).toThrow('Invalid GitHub repository URL: invalid-url');
    });

    it('should throw error for non-GitHub URLs', () => {
      expect(() => {
        githubService.parseGitHubUrl('https://gitlab.com/owner/repo');
      }).toThrow('Invalid GitHub repository URL: https://gitlab.com/owner/repo');
    });
  });

  describe('validateRepository', () => {
    const mockRepoData = {
      owner: { login: 'testowner' },
      name: 'testrepo',
      default_branch: 'main',
      private: false,
      full_name: 'testowner/testrepo',
    };

    beforeEach(() => {
      // Mock the Octokit constructor and methods
      jest.doMock('@octokit/rest', () => ({
        Octokit: jest.fn().mockImplementation(() => ({
          rest: {
            repos: {
              get: jest.fn(),
            },
          },
        })),
      }));
    });

    it('should return repository info for valid public repository', async () => {
      const { Octokit } = await import('@octokit/rest');
      const mockOctokit = new Octokit();
      (mockOctokit.rest.repos.get as unknown as jest.Mock).mockResolvedValue({
        data: mockRepoData,
      });

      const result = await githubService.validateRepository(
        'valid-token',
        'https://github.com/testowner/testrepo'
      );

      expect(result).toEqual({
        owner: 'testowner',
        repo: 'testrepo',
        defaultBranch: 'main',
        isPrivate: false,
        fullName: 'testowner/testrepo',
      });
    });

    it('should return repository info for private repository', async () => {
      const privateRepoData = { ...mockRepoData, private: true };
      const { Octokit } = await import('@octokit/rest');
      const mockOctokit = new Octokit();
      (mockOctokit.rest.repos.get as unknown as jest.Mock).mockResolvedValue({
        data: privateRepoData,
      });

      const result = await githubService.validateRepository('valid-token', 'testowner/testrepo');

      expect(result).toEqual({
        owner: 'testowner',
        repo: 'testrepo',
        defaultBranch: 'main',
        isPrivate: true,
        fullName: 'testowner/testrepo',
      });
    });

    it('should throw error for 404 (repository not found)', async () => {
      const { Octokit } = await import('@octokit/rest');
      const mockOctokit = new Octokit();
      (mockOctokit.rest.repos.get as unknown as jest.Mock).mockRejectedValue({ status: 404 });

      await expect(
        githubService.validateRepository('valid-token', 'owner/nonexistent')
      ).rejects.toThrow('Repository not found or not accessible: owner/nonexistent');
    });

    it('should throw error for 401 (invalid token)', async () => {
      const { Octokit } = await import('@octokit/rest');
      const mockOctokit = new Octokit();
      (mockOctokit.rest.repos.get as unknown as jest.Mock).mockRejectedValue({ status: 401 });

      await expect(githubService.validateRepository('invalid-token', 'owner/repo')).rejects.toThrow(
        'GitHub token is invalid or expired'
      );
    });

    it('should throw error for 403 (insufficient permissions)', async () => {
      const { Octokit } = await import('@octokit/rest');
      const mockOctokit = new Octokit();
      (mockOctokit.rest.repos.get as unknown as jest.Mock).mockRejectedValue({ status: 403 });

      await expect(
        githubService.validateRepository('limited-token', 'owner/private-repo')
      ).rejects.toThrow('GitHub token does not have permission to access this repository');
    });

    it('should throw error for other API errors', async () => {
      const { Octokit } = await import('@octokit/rest');
      const mockOctokit = new Octokit();
      (mockOctokit.rest.repos.get as unknown as jest.Mock).mockRejectedValue({
        status: 500,
        message: 'Internal Server Error',
      });

      await expect(githubService.validateRepository('valid-token', 'owner/repo')).rejects.toThrow(
        'GitHub API error: Internal Server Error'
      );
    });

    it('should handle different URL formats', async () => {
      const { Octokit } = await import('@octokit/rest');
      const mockOctokit = new Octokit();
      (mockOctokit.rest.repos.get as unknown as jest.Mock).mockResolvedValue({
        data: mockRepoData,
      });

      // Test with SSH URL
      const result1 = await githubService.validateRepository(
        'valid-token',
        'git@github.com:testowner/testrepo.git'
      );
      expect(result1.owner).toBe('testowner');
      expect(result1.repo).toBe('testrepo');

      // Test with HTTPS URL with .git
      const result2 = await githubService.validateRepository(
        'valid-token',
        'https://github.com/testowner/testrepo.git'
      );
      expect(result2.owner).toBe('testowner');
      expect(result2.repo).toBe('testrepo');
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
