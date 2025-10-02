import SQLite from 'react-native-sqlite-2';
import EncryptionService from './EncryptionService';

export interface DatabaseConfig {
  name: string;
  version: string;
  displayName: string;
  size: number;
}

export interface ConversationRecord {
  id: string;
  contactId: string;
  contactName?: string;
  phoneNumber?: string;
  startTime: string; // ISO string
  endTime?: string;
  duration: number;
  transcript: string; // Will be encrypted
  audioFilePath?: string;
  emotionalTone: string;
  engagementLevel: number;
  conversationQuality: number;
  analysisCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommitmentRecord {
  id: string;
  conversationId: string;
  contactId: string;
  text: string; // Will be encrypted
  whoCommitted: 'user' | 'contact';
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  status: 'pending' | 'completed' | 'overdue' | 'cancelled';
  confidence: number;
  reminderSet: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisRecord {
  id: string;
  conversationId: string;
  contactId: string;
  keyTopics: string; // JSON string
  relationshipDynamics: string; // JSON string, encrypted
  emotionalScores: string; // JSON string
  insights: string; // JSON string, encrypted
  processingTime: number;
  createdAt: string;
}

export interface ContactRecord {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  relationshipType: string;
  relationshipCloseness: number;
  lastContactDate?: string;
  relationshipScore: number;
  avatar?: string;
  notes?: string; // Encrypted
  createdAt: string;
  updatedAt: string;
}

class DatabaseService {
  private db: SQLite.Database | null = null;
  private isInitialized = false;
  private readonly config: DatabaseConfig = {
    name: 'donna_app.db',
    version: '1.0',
    displayName: 'Donna App Database',
    size: 5 * 1024 * 1024, // 5MB
  };

  /**
   * Initialize database connection and create tables
   */
  async initialize(): Promise<boolean> {
    try {
      this.db = SQLite.openDatabase(
        this.config.name,
        this.config.version,
        this.config.displayName,
        this.config.size
      );

      await this.createTables();
      await this.runMigrations();
      
      this.isInitialized = true;
      console.log('✅ Database initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      return false;
    }
  }

  /**
   * Create all necessary tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const tables = [
      // Conversations table
      `CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        contactId TEXT NOT NULL,
        contactName TEXT,
        phoneNumber TEXT,
        startTime TEXT NOT NULL,
        endTime TEXT,
        duration INTEGER NOT NULL,
        transcript TEXT,
        audioFilePath TEXT,
        emotionalTone TEXT DEFAULT 'neutral',
        engagementLevel INTEGER DEFAULT 5,
        conversationQuality INTEGER DEFAULT 5,
        analysisCompleted INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (contactId) REFERENCES contacts (id)
      )`,

      // Commitments table
      `CREATE TABLE IF NOT EXISTS commitments (
        id TEXT PRIMARY KEY,
        conversationId TEXT NOT NULL,
        contactId TEXT NOT NULL,
        text TEXT NOT NULL,
        whoCommitted TEXT NOT NULL CHECK (whoCommitted IN ('user', 'contact')),
        dueDate TEXT,
        priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
        category TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'overdue', 'cancelled')),
        confidence REAL NOT NULL,
        reminderSet INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (conversationId) REFERENCES conversations (id),
        FOREIGN KEY (contactId) REFERENCES contacts (id)
      )`,

      // Analyses table
      `CREATE TABLE IF NOT EXISTS analyses (
        id TEXT PRIMARY KEY,
        conversationId TEXT NOT NULL,
        contactId TEXT NOT NULL,
        keyTopics TEXT,
        relationshipDynamics TEXT,
        emotionalScores TEXT,
        insights TEXT,
        processingTime INTEGER NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (conversationId) REFERENCES conversations (id),
        FOREIGN KEY (contactId) REFERENCES contacts (id)
      )`,

      // Contacts table
      `CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        relationshipType TEXT NOT NULL,
        relationshipCloseness INTEGER DEFAULT 5,
        lastContactDate TEXT,
        relationshipScore INTEGER DEFAULT 5,
        avatar TEXT,
        notes TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,

      // Settings table for app configuration
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        encrypted INTEGER DEFAULT 0,
        updatedAt TEXT NOT NULL
      )`,

      // Audio files metadata table
      `CREATE TABLE IF NOT EXISTS audio_files (
        id TEXT PRIMARY KEY,
        conversationId TEXT,
        filePath TEXT NOT NULL,
        fileName TEXT NOT NULL,
        fileSize INTEGER NOT NULL,
        duration INTEGER,
        isEncrypted INTEGER DEFAULT 0,
        checksum TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (conversationId) REFERENCES conversations (id)
      )`
    ];

    for (const tableSQL of tables) {
      await this.executeSQL(tableSQL);
    }

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contactId)',
      'CREATE INDEX IF NOT EXISTS idx_conversations_date ON conversations(startTime)',
      'CREATE INDEX IF NOT EXISTS idx_commitments_status ON commitments(status)',
      'CREATE INDEX IF NOT EXISTS idx_commitments_due ON commitments(dueDate)',
      'CREATE INDEX IF NOT EXISTS idx_commitments_contact ON commitments(contactId)',
      'CREATE INDEX IF NOT EXISTS idx_analyses_conversation ON analyses(conversationId)',
      'CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone)',
    ];

    for (const indexSQL of indexes) {
      await this.executeSQL(indexSQL);
    }
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    // Future migrations will be added here
    // Example: ALTER TABLE conversations ADD COLUMN newField TEXT;
  }

  /**
   * Execute SQL statement
   */
  executeSQL(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          sql,
          params,
          (tx, result) => resolve(result),
          (tx, error) => {
            console.error('SQL Error:', error.message, 'SQL:', sql);
            reject(error);
            return false;
          }
        );
      });
    });
  }

  /**
   * Insert conversation record
   */
  async insertConversation(conversation: Omit<ConversationRecord, 'createdAt' | 'updatedAt'>): Promise<boolean> {
    try {
      if (!this.isInitialized) await this.initialize();

      const now = new Date().toISOString();
      let encryptedTranscript = '';
      
      if (conversation.transcript) {
        const encryptedData = await EncryptionService.encryptData(conversation.transcript, 'transcript');
        encryptedTranscript = encryptedData ? JSON.stringify(encryptedData) : '';
      }

      const sql = `
        INSERT INTO conversations (
          id, contactId, contactName, phoneNumber, startTime, endTime, duration,
          transcript, audioFilePath, emotionalTone, engagementLevel, 
          conversationQuality, analysisCompleted, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.executeSQL(sql, [
        conversation.id,
        conversation.contactId,
        conversation.contactName,
        conversation.phoneNumber,
        conversation.startTime,
        conversation.endTime,
        conversation.duration,
        encryptedTranscript,
        conversation.audioFilePath,
        conversation.emotionalTone,
        conversation.engagementLevel,
        conversation.conversationQuality,
        conversation.analysisCompleted ? 1 : 0,
        now,
        now
      ]);

      return true;
    } catch (error) {
      console.error('Failed to insert conversation:', error);
      return false;
    }
  }

  /**
   * Insert commitment record
   */
  async insertCommitment(commitment: Omit<CommitmentRecord, 'createdAt' | 'updatedAt'>): Promise<boolean> {
    try {
      if (!this.isInitialized) await this.initialize();

      const now = new Date().toISOString();
      const encryptedData = await EncryptionService.encryptData(commitment.text, 'commitment');
      const encryptedText = encryptedData ? JSON.stringify(encryptedData) : commitment.text;

      const sql = `
        INSERT INTO commitments (
          id, conversationId, contactId, text, whoCommitted, dueDate,
          priority, category, status, confidence, reminderSet, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.executeSQL(sql, [
        commitment.id,
        commitment.conversationId,
        commitment.contactId,
        encryptedText,
        commitment.whoCommitted,
        commitment.dueDate,
        commitment.priority,
        commitment.category,
        commitment.status,
        commitment.confidence,
        commitment.reminderSet ? 1 : 0,
        now,
        now
      ]);

      return true;
    } catch (error) {
      console.error('Failed to insert commitment:', error);
      return false;
    }
  }

  /**
   * Get conversations with pagination
   */
  async getConversations(limit: number = 50, offset: number = 0): Promise<ConversationRecord[]> {
    try {
      if (!this.isInitialized) await this.initialize();

      const sql = `
        SELECT * FROM conversations 
        ORDER BY startTime DESC 
        LIMIT ? OFFSET ?
      `;

      const result = await this.executeSQL(sql, [limit, offset]);
      const conversations: ConversationRecord[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        let decryptedTranscript = '';
        
        if (row.transcript) {
          try {
            const encryptedData = JSON.parse(row.transcript);
            const decrypted = await EncryptionService.decryptData(encryptedData, 'transcript');
            decryptedTranscript = decrypted || '';
          } catch (error) {
            // Fallback for unencrypted data
            decryptedTranscript = row.transcript;
          }
        }

        conversations.push({
          ...row,
          transcript: decryptedTranscript,
          analysisCompleted: Boolean(row.analysisCompleted)
        });
      }

      return conversations;
    } catch (error) {
      console.error('Failed to get conversations:', error);
      return [];
    }
  }

  /**
   * Get commitments with optional filters
   */
  async getCommitments(filters?: {
    status?: string;
    contactId?: string;
    dueDate?: string;
    limit?: number;
  }): Promise<CommitmentRecord[]> {
    try {
      if (!this.isInitialized) await this.initialize();

      let sql = 'SELECT * FROM commitments WHERE 1=1';
      const params: any[] = [];

      if (filters?.status) {
        sql += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters?.contactId) {
        sql += ' AND contactId = ?';
        params.push(filters.contactId);
      }

      if (filters?.dueDate) {
        sql += ' AND dueDate <= ?';
        params.push(filters.dueDate);
      }

      sql += ' ORDER BY dueDate ASC, priority DESC';

      if (filters?.limit) {
        sql += ' LIMIT ?';
        params.push(filters.limit);
      }

      const result = await this.executeSQL(sql, params);
      const commitments: CommitmentRecord[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        let decryptedText = '';
        
        try {
          const encryptedData = JSON.parse(row.text);
          const decrypted = await EncryptionService.decryptData(encryptedData, 'commitment');
          decryptedText = decrypted || row.text;
        } catch (error) {
          // Fallback for unencrypted data
          decryptedText = row.text;
        }

        commitments.push({
          ...row,
          text: decryptedText,
          reminderSet: Boolean(row.reminderSet)
        });
      }

      return commitments;
    } catch (error) {
      console.error('Failed to get commitments:', error);
      return [];
    }
  }

  /**
   * Update commitment status
   */
  async updateCommitmentStatus(id: string, status: string): Promise<boolean> {
    try {
      if (!this.isInitialized) await this.initialize();

      const sql = 'UPDATE commitments SET status = ?, updatedAt = ? WHERE id = ?';
      await this.executeSQL(sql, [status, new Date().toISOString(), id]);

      return true;
    } catch (error) {
      console.error('Failed to update commitment status:', error);
      return false;
    }
  }

  /**
   * Search conversations by transcript content and metadata
   */
  async searchConversations(query: string, limit: number = 20, filters?: {
    contactIds?: string[];
    dateRange?: { start: Date; end: Date };
    emotionalTone?: string[];
    hasTranscript?: boolean;
  }): Promise<ConversationRecord[]> {
    try {
      if (!this.isInitialized) await this.initialize();

      // Build SQL query with filters
      let sql = `
        SELECT * FROM conversations 
        WHERE (contactName LIKE ? OR phoneNumber LIKE ?)
      `;
      const params = [`%${query}%`, `%${query}%`];

      // Apply filters
      if (filters?.contactIds && filters.contactIds.length > 0) {
        const placeholders = filters.contactIds.map(() => '?').join(', ');
        sql += ` AND contactId IN (${placeholders})`;
        params.push(...filters.contactIds);
      }

      if (filters?.dateRange) {
        sql += ` AND startTime >= ? AND startTime <= ?`;
        params.push(filters.dateRange.start.toISOString(), filters.dateRange.end.toISOString());
      }

      if (filters?.emotionalTone && filters.emotionalTone.length > 0) {
        const placeholders = filters.emotionalTone.map(() => '?').join(', ');
        sql += ` AND emotionalTone IN (${placeholders})`;
        params.push(...filters.emotionalTone);
      }

      if (filters?.hasTranscript !== undefined) {
        if (filters.hasTranscript) {
          sql += ` AND transcript IS NOT NULL AND transcript != ''`;
        } else {
          sql += ` AND (transcript IS NULL OR transcript = '')`;
        }
      }

      sql += ` ORDER BY startTime DESC LIMIT ?`;
      params.push(limit);

      const result = await this.executeSQL(sql, params);
      const conversations: ConversationRecord[] = [];

      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i);
        let decryptedTranscript = '';
        
        if (row.transcript) {
          try {
            const encryptedData = JSON.parse(row.transcript);
            const decrypted = await EncryptionService.decryptData(encryptedData, 'transcript');
            decryptedTranscript = decrypted || '';
          } catch (error) {
            // Fallback for unencrypted data
            decryptedTranscript = row.transcript;
          }
        }

        // Additional filtering on decrypted transcript if no metadata matches
        const metadataMatch = row.contactName?.toLowerCase().includes(query.toLowerCase()) ||
                             row.phoneNumber?.toLowerCase().includes(query.toLowerCase());
        
        const transcriptMatch = decryptedTranscript.toLowerCase().includes(query.toLowerCase());

        if (metadataMatch || transcriptMatch) {
          conversations.push({
            ...row,
            transcript: decryptedTranscript,
            analysisCompleted: Boolean(row.analysisCompleted)
          });
        }
      }

      return conversations;
    } catch (error) {
      console.error('Failed to search conversations:', error);
      return [];
    }
  }

  /**
   * Advanced search across conversations and commitments with relevance scoring
   */
  async advancedSearch(query: string, options?: {
    types?: ('conversations' | 'commitments')[];
    limit?: number;
    minRelevance?: number;
  }): Promise<Array<{
    type: 'conversation' | 'commitment';
    id: string;
    title: string;
    snippet: string;
    relevance: number;
    data: any;
  }>> {
    try {
      if (!this.isInitialized) await this.initialize();

      const results: any[] = [];
      const searchTerm = query.toLowerCase();
      const types = options?.types || ['conversations', 'commitments'];
      const limit = options?.limit || 50;

      // Search conversations
      if (types.includes('conversations')) {
        const conversations = await this.searchConversations(query, Math.ceil(limit / types.length));
        
        conversations.forEach(conv => {
          let relevance = 0;
          const transcript = conv.transcript.toLowerCase();
          const contactName = (conv.contactName || '').toLowerCase();

          // Calculate relevance score
          if (contactName.includes(searchTerm)) relevance += 10;
          if (conv.phoneNumber?.includes(query)) relevance += 8;
          
          const transcriptMatches = (transcript.match(new RegExp(searchTerm, 'g')) || []).length;
          relevance += transcriptMatches * 2;

          // Bonus for recent conversations
          const daysSince = (Date.now() - new Date(conv.startTime).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince < 7) relevance += 3;
          else if (daysSince < 30) relevance += 1;

          if (relevance >= (options?.minRelevance || 1)) {
            results.push({
              type: 'conversation',
              id: conv.id,
              title: `📞 ${conv.contactName || 'Unknown Contact'}`,
              snippet: transcript.slice(0, 100) + (transcript.length > 100 ? '...' : ''),
              relevance,
              data: conv
            });
          }
        });
      }

      // Search commitments
      if (types.includes('commitments')) {
        const commitments = await this.getCommitments({ limit: Math.ceil(limit / types.length) });
        
        commitments.forEach(comm => {
          let relevance = 0;
          const text = comm.text.toLowerCase();

          // Calculate relevance score
          const textMatches = (text.match(new RegExp(searchTerm, 'g')) || []).length;
          relevance += textMatches * 5;

          if (comm.category?.toLowerCase().includes(searchTerm)) relevance += 3;

          // Bonus for high priority and pending status
          if (comm.priority === 'high') relevance += 4;
          else if (comm.priority === 'medium') relevance += 2;

          if (comm.status === 'pending') relevance += 3;
          else if (comm.status === 'overdue') relevance += 5;

          if (relevance >= (options?.minRelevance || 1)) {
            results.push({
              type: 'commitment',
              id: comm.id,
              title: `🤝 ${comm.text.slice(0, 50)}${comm.text.length > 50 ? '...' : ''}`,
              snippet: `${comm.status.toUpperCase()} • ${comm.priority.toUpperCase()} • ${comm.whoCommitted === 'user' ? 'You' : 'Contact'}`,
              relevance,
              data: comm
            });
          }
        });
      }

      // Sort by relevance and limit results
      return results
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);

    } catch (error) {
      console.error('Failed to perform advanced search:', error);
      return [];
    }
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<{
    totalConversations: number;
    totalCommitments: number;
    completedCommitments: number;
    totalContacts: number;
    dbSize: number;
  }> {
    try {
      if (!this.isInitialized) await this.initialize();

      const stats = await Promise.all([
        this.executeSQL('SELECT COUNT(*) as count FROM conversations'),
        this.executeSQL('SELECT COUNT(*) as count FROM commitments'),
        this.executeSQL('SELECT COUNT(*) as count FROM commitments WHERE status = "completed"'),
        this.executeSQL('SELECT COUNT(*) as count FROM contacts'),
      ]);

      return {
        totalConversations: stats[0].rows.item(0).count,
        totalCommitments: stats[1].rows.item(0).count,
        completedCommitments: stats[2].rows.item(0).count,
        totalContacts: stats[3].rows.item(0).count,
        dbSize: 0, // Would need native module to get actual file size
      };
    } catch (error) {
      console.error('Failed to get statistics:', error);
      return {
        totalConversations: 0,
        totalCommitments: 0,
        completedCommitments: 0,
        totalContacts: 0,
        dbSize: 0,
      };
    }
  }

  /**
   * Backup database (export all data as JSON)
   */
  async exportData(): Promise<string | null> {
    try {
      if (!this.isInitialized) await this.initialize();

      const [conversations, commitments, analyses, contacts] = await Promise.all([
        this.getConversations(1000),
        this.getCommitments({ limit: 1000 }),
        this.executeSQL('SELECT * FROM analyses'),
        this.executeSQL('SELECT * FROM contacts')
      ]);

      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        data: {
          conversations,
          commitments,
          analyses: Array.from({ length: analyses.rows.length }, (_, i) => analyses.rows.item(i)),
          contacts: Array.from({ length: contacts.rows.length }, (_, i) => contacts.rows.item(i))
        }
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Failed to export data:', error);
      return null;
    }
  }

  /**
   * Clean up old data
   */
  async cleanupOldData(daysToKeep: number = 365): Promise<number> {
    try {
      if (!this.isInitialized) await this.initialize();

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffISO = cutoffDate.toISOString();

      // Delete old conversations and related data
      const result = await this.executeSQL(
        'DELETE FROM conversations WHERE createdAt < ?',
        [cutoffISO]
      );

      // Cleanup orphaned commitments and analyses
      await this.executeSQL('DELETE FROM commitments WHERE conversationId NOT IN (SELECT id FROM conversations)');
      await this.executeSQL('DELETE FROM analyses WHERE conversationId NOT IN (SELECT id FROM conversations)');

      return result.rowsAffected || 0;
    } catch (error) {
      console.error('Failed to cleanup old data:', error);
      return 0;
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
      console.log('Database connection closed');
    }
  }
}

export default new DatabaseService();