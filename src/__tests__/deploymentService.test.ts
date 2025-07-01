import { DeploymentService } from '@/services/deploymentService.js';

describe('DeploymentService', () => {
  let deploymentService: DeploymentService;

  beforeEach(() => {
    deploymentService = new DeploymentService();
  });

  describe('parseTokens', () => {
    it('should parse valid token pair', () => {
      const result = deploymentService.parseTokens('github_token_123:vercel_token_456');
      expect(result).toEqual({
        githubToken: 'github_token_123',
        vercelToken: 'vercel_token_456',
      });
    });

    it('should handle tokens with extra whitespace', () => {
      const result = deploymentService.parseTokens(' github_token_123 : vercel_token_456 ');
      expect(result).toEqual({
        githubToken: 'github_token_123',
        vercelToken: 'vercel_token_456',
      });
    });

    it('should throw error for invalid format (no colon)', () => {
      expect(() => {
        deploymentService.parseTokens('github_token_123');
      }).toThrow('Token format should be "github_token:vercel_token"');
    });

    it('should throw error for invalid format (too many colons)', () => {
      expect(() => {
        deploymentService.parseTokens('github:token:vercel:token');
      }).toThrow('Token format should be "github_token:vercel_token"');
    });

    it('should throw error for empty github token', () => {
      expect(() => {
        deploymentService.parseTokens(':vercel_token_456');
      }).toThrow('Both GitHub and Vercel tokens are required');
    });

    it('should throw error for empty vercel token', () => {
      expect(() => {
        deploymentService.parseTokens('github_token_123:');
      }).toThrow('Both GitHub and Vercel tokens are required');
    });

    it('should throw error for both tokens empty', () => {
      expect(() => {
        deploymentService.parseTokens(':');
      }).toThrow('Both GitHub and Vercel tokens are required');
    });
  });
});
