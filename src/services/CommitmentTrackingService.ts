import DatabaseService from './DatabaseService';
import OpenAIService, { CommitmentExtractionResult } from './OpenAIService';
import NotificationService from './NotificationService';

export interface Commitment {
  id: string;
  conversationId: string;
  contactId: string;
  text: string;
  whoCommitted: 'user' | 'contact';
  dueDate?: Date;
  priority: 'low' | 'medium' | 'high';
  category: string;
  status: 'pending' | 'completed' | 'overdue' | 'cancelled';
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
  reminderSet: boolean;
  notes?: string;
}

export interface CommitmentStats {
  totalCommitments: number;
  userCommitments: number;
  contactCommitments: number;
  completedCommitments: number;
  overdueCommitments: number;
  completionRate: number;
  averageTimeToComplete: number; // in days
}

export interface CommitmentFilter {
  status?: Commitment['status'][];
  whoCommitted?: Commitment['whoCommitted'][];
  priority?: Commitment['priority'][];
  category?: string[];
  contactId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

class CommitmentTrackingService {
  private commitments: Map<string, Commitment> = new Map();
  private isInitialized = false;

  constructor() {
    this.loadCommitments();
  }

  /**
   * Load commitments from SQLite database
   */
  private async loadCommitments(): Promise<void> {
    try {
      await DatabaseService.initialize();
      // Load all commitments from database into memory cache
      const commitments = await DatabaseService.getCommitments();
      
      commitments.forEach(commitment => {
        // Convert date strings back to Date objects
        const parsedCommitment: Commitment = {
          ...commitment,
          createdAt: new Date(commitment.createdAt),
          updatedAt: new Date(commitment.updatedAt),
          dueDate: commitment.dueDate ? new Date(commitment.dueDate) : undefined,
        };
        this.commitments.set(commitment.id, parsedCommitment);
      });
      
      this.isInitialized = true;
      console.log(`Loaded ${this.commitments.size} commitments from SQLite`);
    } catch (error) {
      console.error('Failed to load commitments from SQLite:', error);
      this.isInitialized = true;
    }
  }

  /**
   * Save commitment to database (replaced AsyncStorage with SQLite)
   */
  private async saveCommitment(commitment: Commitment): Promise<boolean> {
    try {
      const success = await DatabaseService.insertCommitment({
        id: commitment.id,
        conversationId: commitment.conversationId,
        contactId: commitment.contactId,
        text: commitment.text,
        whoCommitted: commitment.whoCommitted,
        dueDate: commitment.dueDate?.toISOString(),
        priority: commitment.priority,
        category: commitment.category,
        status: commitment.status,
        confidence: commitment.confidence,
        reminderSet: commitment.reminderSet
      });

      return success;
    } catch (error) {
      console.error('Failed to save commitment to database:', error);
      return false;
    }
  }

  /**
   * Extract and add commitments from conversation
   */
  async extractCommitmentsFromConversation(
    conversationId: string,
    contactId: string,
    transcript: string,
    contactName?: string
  ): Promise<Commitment[]> {
    try {
      const result = await OpenAIService.extractCommitments(transcript, contactName);
      if (!result || result.commitments.length === 0) {
        return [];
      }

      const extractedCommitments: Commitment[] = [];

      for (const commitment of result.commitments) {
        const newCommitment: Commitment = {
          id: this.generateCommitmentId(),
          conversationId,
          contactId,
          text: commitment.text,
          whoCommitted: commitment.whoCommitted,
          dueDate: commitment.dueDate ? new Date(commitment.dueDate) : undefined,
          priority: commitment.priority,
          category: commitment.category,
          status: 'pending',
          confidence: commitment.confidence,
          createdAt: new Date(),
          updatedAt: new Date(),
          reminderSet: false,
        };

        await this.addCommitment(newCommitment);
        extractedCommitments.push(newCommitment);

        // Set reminder if due date exists
        if (newCommitment.dueDate && newCommitment.whoCommitted === 'user') {
          await this.setCommitmentReminder(newCommitment.id);
        }
      }

      console.log(`Extracted ${extractedCommitments.length} commitments from conversation`);
      return extractedCommitments;
    } catch (error) {
      console.error('Failed to extract commitments:', error);
      return [];
    }
  }

  /**
   * Add a new commitment
   */
  async addCommitment(commitment: Commitment): Promise<boolean> {
    try {
      this.commitments.set(commitment.id, commitment);
      await this.saveCommitment(commitment);
      return true;
    } catch (error) {
      console.error('Failed to add commitment:', error);
      return false;
    }
  }

  /**
   * Update commitment status
   */
  async updateCommitmentStatus(
    commitmentId: string,
    status: Commitment['status'],
    notes?: string
  ): Promise<boolean> {
    try {
      const commitment = this.commitments.get(commitmentId);
      if (!commitment) {
        return false;
      }

      commitment.status = status;
      commitment.updatedAt = new Date();
      if (notes) {
        commitment.notes = notes;
      }

      // Cancel reminder if commitment is completed or cancelled
      if (status === 'completed' || status === 'cancelled') {
        await NotificationService.cancelCommitmentReminder(commitmentId);
        commitment.reminderSet = false;
      }

      this.commitments.set(commitmentId, commitment);
      await DatabaseService.updateCommitmentStatus(commitmentId, status);

      console.log(`Updated commitment ${commitmentId} status to ${status}`);
      return true;
    } catch (error) {
      console.error('Failed to update commitment status:', error);
      return false;
    }
  }

  /**
   * Update commitment details
   */
  async updateCommitment(
    commitmentId: string,
    updates: Partial<Omit<Commitment, 'id' | 'createdAt'>>
  ): Promise<boolean> {
    try {
      const commitment = this.commitments.get(commitmentId);
      if (!commitment) {
        return false;
      }

      Object.assign(commitment, updates, { updatedAt: new Date() });

      // Update reminder if due date changed
      if (updates.dueDate) {
        if (commitment.reminderSet) {
          await NotificationService.cancelCommitmentReminder(commitmentId);
        }
        await this.setCommitmentReminder(commitmentId);
      }

      this.commitments.set(commitmentId, commitment);
      await this.saveCommitment(commitment);

      return true;
    } catch (error) {
      console.error('Failed to update commitment:', error);
      return false;
    }
  }

  /**
   * Delete commitment
   */
  async deleteCommitment(commitmentId: string): Promise<boolean> {
    try {
      const commitment = this.commitments.get(commitmentId);
      if (!commitment) {
        return false;
      }

      // Cancel any reminders
      if (commitment.reminderSet) {
        await NotificationService.cancelCommitmentReminder(commitmentId);
      }

      this.commitments.delete(commitmentId);
      
      // Delete from database
      await DatabaseService.executeSQL('DELETE FROM commitments WHERE id = ?', [commitmentId]);

      return true;
    } catch (error) {
      console.error('Failed to delete commitment:', error);
      return false;
    }
  }

  /**
   * Get commitment by ID
   */
  getCommitment(commitmentId: string): Commitment | null {
    return this.commitments.get(commitmentId) || null;
  }

  /**
   * Get all commitments with optional filtering
   */
  getCommitments(filter?: CommitmentFilter): Commitment[] {
    let commitments = Array.from(this.commitments.values());

    if (filter) {
      if (filter.status) {
        commitments = commitments.filter(c => filter.status!.includes(c.status));
      }

      if (filter.whoCommitted) {
        commitments = commitments.filter(c => filter.whoCommitted!.includes(c.whoCommitted));
      }

      if (filter.priority) {
        commitments = commitments.filter(c => filter.priority!.includes(c.priority));
      }

      if (filter.category) {
        commitments = commitments.filter(c => filter.category!.includes(c.category));
      }

      if (filter.contactId) {
        commitments = commitments.filter(c => c.contactId === filter.contactId);
      }

      if (filter.dateRange) {
        commitments = commitments.filter(c => {
          const createdAt = c.createdAt.getTime();
          return createdAt >= filter.dateRange!.start.getTime() &&
                 createdAt <= filter.dateRange!.end.getTime();
        });
      }
    }

    return commitments.sort((a, b) => {
      // Sort by priority, then by due date, then by created date
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];

      if (priorityDiff !== 0) return priorityDiff;

      if (a.dueDate && b.dueDate) {
        return a.dueDate.getTime() - b.dueDate.getTime();
      } else if (a.dueDate && !b.dueDate) {
        return -1;
      } else if (!a.dueDate && b.dueDate) {
        return 1;
      }

      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }

  /**
   * Get overdue commitments
   */
  getOverdueCommitments(): Commitment[] {
    const now = new Date();
    return this.getCommitments()
      .filter(commitment =>
        commitment.status === 'pending' &&
        commitment.dueDate &&
        commitment.dueDate < now
      )
      .map(commitment => {
        // Mark as overdue
        if (commitment.status === 'pending') {
          commitment.status = 'overdue';
          this.updateCommitmentStatus(commitment.id, 'overdue');
        }
        return commitment;
      });
  }

  /**
   * Get upcoming commitments (due in next 7 days)
   */
  getUpcomingCommitments(daysAhead: number = 7): Commitment[] {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + daysAhead);

    return this.getCommitments()
      .filter(commitment =>
        commitment.status === 'pending' &&
        commitment.dueDate &&
        commitment.dueDate >= now &&
        commitment.dueDate <= futureDate
      );
  }

  /**
   * Get commitment statistics
   */
  getCommitmentStats(contactId?: string): CommitmentStats {
    const commitments = contactId
      ? this.getCommitments({ contactId })
      : this.getCommitments();

    const totalCommitments = commitments.length;
    const userCommitments = commitments.filter(c => c.whoCommitted === 'user').length;
    const contactCommitments = commitments.filter(c => c.whoCommitted === 'contact').length;
    const completedCommitments = commitments.filter(c => c.status === 'completed').length;
    const overdueCommitments = commitments.filter(c => c.status === 'overdue').length;

    const completionRate = totalCommitments > 0 ? (completedCommitments / totalCommitments) * 100 : 0;

    // Calculate average time to complete
    const completedWithDates = commitments.filter(c =>
      c.status === 'completed' && c.dueDate && c.updatedAt
    );

    const averageTimeToComplete = completedWithDates.length > 0
      ? completedWithDates.reduce((sum, c) => {
          const daysToComplete = Math.max(0, Math.floor(
            (c.updatedAt.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          ));
          return sum + daysToComplete;
        }, 0) / completedWithDates.length
      : 0;

    return {
      totalCommitments,
      userCommitments,
      contactCommitments,
      completedCommitments,
      overdueCommitments,
      completionRate,
      averageTimeToComplete,
    };
  }

  /**
   * Set reminder for commitment
   */
  private async setCommitmentReminder(commitmentId: string): Promise<boolean> {
    try {
      const commitment = this.commitments.get(commitmentId);
      if (!commitment || !commitment.dueDate || commitment.whoCommitted !== 'user') {
        return false;
      }

      // Set reminder 1 day before due date
      const reminderDate = new Date(commitment.dueDate);
      reminderDate.setDate(reminderDate.getDate() - 1);

      const success = await NotificationService.scheduleCommitmentReminder(
        commitmentId,
        commitment.text,
        reminderDate
      );

      if (success) {
        commitment.reminderSet = true;
        this.commitments.set(commitmentId, commitment);
        await this.saveCommitment(commitment);
      }

      return success;
    } catch (error) {
      console.error('Failed to set commitment reminder:', error);
      return false;
    }
  }

  /**
   * Search commitments by text
   */
  searchCommitments(query: string): Commitment[] {
    const lowercaseQuery = query.toLowerCase();
    return this.getCommitments().filter(commitment =>
      commitment.text.toLowerCase().includes(lowercaseQuery) ||
      commitment.category.toLowerCase().includes(lowercaseQuery) ||
      (commitment.notes && commitment.notes.toLowerCase().includes(lowercaseQuery))
    );
  }

  /**
   * Export commitments as text
   */
  exportCommitments(filter?: CommitmentFilter): string {
    const commitments = this.getCommitments(filter);

    let output = 'COMMITMENT TRACKER EXPORT\n';
    output += `Generated: ${new Date().toLocaleString()}\n`;
    output += `Total Commitments: ${commitments.length}\n\n`;

    commitments.forEach((commitment, index) => {
      output += `${index + 1}. ${commitment.text}\n`;
      output += `   Who: ${commitment.whoCommitted === 'user' ? 'You' : 'Contact'}\n`;
      output += `   Status: ${commitment.status.toUpperCase()}\n`;
      output += `   Priority: ${commitment.priority.toUpperCase()}\n`;
      output += `   Category: ${commitment.category}\n`;

      if (commitment.dueDate) {
        output += `   Due Date: ${commitment.dueDate.toLocaleDateString()}\n`;
      }

      if (commitment.notes) {
        output += `   Notes: ${commitment.notes}\n`;
      }

      output += `   Created: ${commitment.createdAt.toLocaleString()}\n`;
      output += '\n';
    });

    return output;
  }

  /**
   * Generate unique commitment ID
   */
  private generateCommitmentId(): string {
    return `commitment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check for overdue commitments and update statuses
   */
  async checkOverdueCommitments(): Promise<void> {
    const overdueCommitments = this.getOverdueCommitments();
    console.log(`Found ${overdueCommitments.length} overdue commitments`);

    // Send notification about overdue commitments
    if (overdueCommitments.length > 0) {
      await NotificationService.sendOverdueCommitmentsNotification(overdueCommitments);
    }
  }

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    if (!this.isInitialized) {
      await this.loadCommitments();
    }

    // Check for overdue commitments on startup
    await this.checkOverdueCommitments();
  }
}

export default new CommitmentTrackingService();