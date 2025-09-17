// Mock Call Detection Service for development and testing
// This allows us to test the UI and flow without native modules

export class MockCallDetectionService {
  private isMonitoring = false;
  private mockCallActive = false;

  async initialize(): Promise<boolean> {
    console.log('🔧 Using Mock Call Detection Service for development');
    return true;
  }

  async startCallMonitoring(): Promise<boolean> {
    console.log('🔧 Mock: Starting call monitoring');
    this.isMonitoring = true;
    return true;
  }

  async stopCallMonitoring(): Promise<boolean> {
    console.log('🔧 Mock: Stopping call monitoring');
    this.isMonitoring = false;
    return true;
  }

  async requestPermissions(): Promise<boolean> {
    console.log('🔧 Mock: Permissions granted');
    return true;
  }

  async isCallActive(): Promise<boolean> {
    return this.mockCallActive;
  }

  isCurrentlyMonitoring(): boolean {
    return this.isMonitoring;
  }

  // Development helper methods
  simulateCallStart(): void {
    console.log('🔧 Mock: Simulating call start');
    this.mockCallActive = true;
  }

  simulateCallEnd(): void {
    console.log('🔧 Mock: Simulating call end');
    this.mockCallActive = false;
  }

  destroy(): void {
    this.isMonitoring = false;
    this.mockCallActive = false;
  }
}

export const mockCallDetectionService = new MockCallDetectionService();