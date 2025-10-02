import DatabaseService from './DatabaseService';
import TranscriptionService, { TranscriptionSession } from './TranscriptionService';
import CommitmentTrackingService, { Commitment } from './CommitmentTrackingService';
import ConversationAnalysisService, { ConversationAnalysis } from './ConversationAnalysisService';

export interface SearchResult {
  id: string;
  type: 'conversation' | 'commitment' | 'transcript' | 'insight';
  title: string;
  description: string;
  content: string;
  relevanceScore: number; // 0-1
  matchedTerms: string[];
  metadata: {
    contactId?: string;
    conversationId?: string;
    date: Date;
    duration?: number;
    category?: string;
  };
  highlights: SearchHighlight[];
}

export interface SearchHighlight {
  field: string;
  text: string;
  startIndex: number;
  endIndex: number;
}

export interface SearchQuery {
  text: string;
  filters?: SearchFilters;
  options?: SearchOptions;
}

export interface SearchFilters {
  types?: SearchResult['type'][];
  contactIds?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  categories?: string[];
  commitmentStatus?: string[];
  emotionalTone?: string[];
  minRelevanceScore?: number;
}

export interface SearchOptions {
  maxResults?: number;
  includeHighlights?: boolean;
  sortBy?: 'relevance' | 'date' | 'title';
  sortOrder?: 'asc' | 'desc';
  fuzzyMatching?: boolean;
  caseSensitive?: boolean;
}

export interface SearchHistory {
  id: string;
  query: string;
  timestamp: Date;
  resultCount: number;
  executionTime: number;
}

export interface SearchStats {
  totalSearches: number;
  averageExecutionTime: number;
  popularQueries: string[];
  mostSearchedContacts: string[];
  searchesByType: Record<SearchResult['type'], number>;
}

class SearchService {
  private searchHistory: SearchHistory[] = [];
  private searchIndex: Map<string, string[]> = new Map(); // word -> document IDs
  private documents: Map<string, any> = new Map(); // document ID -> document data
  private isInitialized = false;

  constructor() {
    this.initializeService();
  }

  /**
   * Initialize search service
   */
  private async initializeService(): Promise<void> {
    try {
      await this.loadSearchHistory();
      await this.buildSearchIndex();
      this.isInitialized = true;
      console.log('Search service initialized');
    } catch (error) {
      console.error('Failed to initialize search service:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Build search index from all available data (now using SQLite database)
   */
  private async buildSearchIndex(): Promise<void> {
    console.log('Building search index from SQLite database...');

    // Clear existing index
    this.searchIndex.clear();
    this.documents.clear();

    // Initialize database
    await DatabaseService.initialize();

    // Index conversations from database
    await this.indexConversationsFromDB();

    // Index commitments from database
    await this.indexCommitmentsFromDB();

    // Index conversation analyses from memory cache
    await this.indexConversationAnalyses();

    console.log(`Search index built with ${this.documents.size} documents`);
  }

  /**
   * Index conversations from SQLite database
   */
  private async indexConversationsFromDB(): Promise<void> {
    try {
      const conversations = await DatabaseService.getConversations(1000); // Get up to 1000 conversations

      conversations.forEach(conversation => {
        const docId = `conversation_${conversation.id}`;
        const text = [
          conversation.transcript || '',
          conversation.contactName || '',
          conversation.phoneNumber || '',
          conversation.emotionalTone || ''
        ].join(' ');

        this.documents.set(docId, {
          type: 'conversation',
          id: conversation.id,
          data: conversation,
          searchableText: text,
        });

        this.addToIndex(text, docId);
      });

      console.log(`Indexed ${conversations.length} conversations from database`);
    } catch (error) {
      console.error('Failed to index conversations from database:', error);
    }
  }

  /**
   * Index commitments from SQLite database
   */
  private async indexCommitmentsFromDB(): Promise<void> {
    try {
      const commitments = await DatabaseService.getCommitments({ limit: 1000 });

      commitments.forEach(commitment => {
        const docId = `commitment_${commitment.id}`;
        const text = [
          commitment.text || '',
          commitment.category || '',
          commitment.priority || '',
          commitment.status || '',
          commitment.whoCommitted || ''
        ].join(' ');

        this.documents.set(docId, {
          type: 'commitment',
          id: commitment.id,
          data: commitment,
          searchableText: text,
        });

        this.addToIndex(text, docId);
      });

      console.log(`Indexed ${commitments.length} commitments from database`);
    } catch (error) {
      console.error('Failed to index commitments from database:', error);
    }
  }

  /**
   * Index conversation analyses
   */
  private async indexConversationAnalyses(): Promise<void> {
    try {
      const analyses = ConversationAnalysisService.getAnalyses();

      analyses.forEach(analysis => {
        const docId = `analysis_${analysis.id}`;
        const text = analysis.transcript + ' ' +
                    analysis.conversationInsights.keyTopics.join(' ') + ' ' +
                    analysis.conversationInsights.actionItems.join(' ') + ' ' +
                    analysis.conversationInsights.followUpSuggestions.join(' ');

        this.documents.set(docId, {
          type: 'insight',
          id: analysis.id,
          data: analysis,
          searchableText: text,
        });

        this.addToIndex(text, docId);
      });
    } catch (error) {
      console.error('Failed to index conversation analyses:', error);
    }
  }

  /**
   * Add text to search index
   */
  private addToIndex(text: string, docId: string): void {
    const words = this.tokenizeText(text);

    words.forEach(word => {
      if (!this.searchIndex.has(word)) {
        this.searchIndex.set(word, []);
      }
      const docIds = this.searchIndex.get(word)!;
      if (!docIds.includes(docId)) {
        docIds.push(docId);
      }
    });
  }

  /**
   * Tokenize text into searchable words
   */
  private tokenizeText(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 2) // Filter out short words
      .filter(word => !this.isStopWord(word)); // Remove stop words
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'been', 'be', 'have',
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    ]);
    return stopWords.has(word);
  }

  /**
   * Perform search using both SQLite database and in-memory index
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      if (!this.isInitialized) {
        await this.initializeService();
      }

      if (!query.text.trim()) {
        return [];
      }

      // Use database advanced search for better performance on large datasets
      const dbResults = await DatabaseService.advancedSearch(query.text, {
        types: query.filters?.types?.includes('conversation') || query.filters?.types?.includes('commitment') 
          ? query.filters.types.map(t => t === 'conversation' ? 'conversations' : 'commitments') as any
          : ['conversations', 'commitments'],
        limit: query.options?.maxResults || 50,
        minRelevance: query.filters?.minRelevanceScore ? query.filters.minRelevanceScore * 10 : 1
      });

      // Convert database results to SearchResult format
      const searchResults: SearchResult[] = dbResults.map(result => ({
        id: result.id,
        type: result.type as 'conversation' | 'commitment',
        title: result.title,
        description: result.snippet,
        content: result.snippet,
        relevanceScore: Math.min(1, result.relevance / 10), // Normalize to 0-1
        matchedTerms: this.tokenizeText(query.text),
        metadata: {
          contactId: result.data.contactId,
          conversationId: result.type === 'conversation' ? result.id : result.data.conversationId,
          date: new Date(result.data.startTime || result.data.createdAt),
          duration: result.data.duration,
          category: result.data.category,
        },
        highlights: []
      }));

      // Also search in-memory index for additional results (analyses, insights)
      const searchTerms = this.tokenizeText(query.text);
      const candidateDocIds = this.findCandidateDocuments(searchTerms, query.options?.fuzzyMatching);
      const memoryResults = this.scoreResults(candidateDocIds, searchTerms, query);

      // Combine results and remove duplicates
      const allResults = [...searchResults];
      
      memoryResults.forEach(memResult => {
        // Only add if not already in database results and is insight/transcript type
        if (!searchResults.some(r => r.id === memResult.id) && 
            (memResult.type === 'insight' || memResult.type === 'transcript')) {
          allResults.push(memResult);
        }
      });

      // Apply filters
      const filteredResults = this.applyFilters(allResults, query.filters);

      // Sort results
      const sortedResults = this.sortResults(filteredResults, query.options);

      // Limit results
      const maxResults = query.options?.maxResults || 50;
      const finalResults = sortedResults.slice(0, maxResults);

      // Add search to history
      const executionTime = Date.now() - startTime;
      await this.addToSearchHistory(query.text, finalResults.length, executionTime);

      console.log(`Hybrid search completed in ${executionTime}ms, found ${finalResults.length} results (${searchResults.length} from DB, ${memoryResults.length} from memory)`);
      return finalResults;
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  /**
   * Find candidate documents that might match the search
   */
  private findCandidateDocuments(searchTerms: string[], fuzzyMatching: boolean = false): Set<string> {
    const candidates = new Set<string>();

    searchTerms.forEach(term => {
      // Exact matches
      const exactMatches = this.searchIndex.get(term) || [];
      exactMatches.forEach(docId => candidates.add(docId));

      // Fuzzy matches if enabled
      if (fuzzyMatching) {
        this.searchIndex.forEach((docIds, indexedTerm) => {
          if (this.calculateLevenshteinDistance(term, indexedTerm) <= 2) {
            docIds.forEach(docId => candidates.add(docId));
          }
        });
      }
    });

    return candidates;
  }

  /**
   * Calculate Levenshtein distance for fuzzy matching
   */
  private calculateLevenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Score search results based on relevance
   */
  private scoreResults(candidateDocIds: Set<string>, searchTerms: string[], query: SearchQuery): SearchResult[] {
    const results: SearchResult[] = [];

    candidateDocIds.forEach(docId => {
      const doc = this.documents.get(docId);
      if (!doc) return;

      const relevanceScore = this.calculateRelevanceScore(doc.searchableText, searchTerms);
      const highlights = query.options?.includeHighlights
        ? this.generateHighlights(doc.searchableText, searchTerms)
        : [];

      const result = this.createSearchResult(doc, relevanceScore, searchTerms, highlights);
      if (result) {
        results.push(result);
      }
    });

    return results;
  }

  /**
   * Calculate relevance score
   */
  private calculateRelevanceScore(text: string, searchTerms: string[]): number {
    const lowerText = text.toLowerCase();
    let score = 0;

    searchTerms.forEach(term => {
      const termCount = (lowerText.match(new RegExp(term, 'g')) || []).length;
      const termFrequency = termCount / text.length;
      const inverseDocumentFrequency = Math.log(this.documents.size / (this.searchIndex.get(term)?.length || 1));

      // TF-IDF scoring
      score += termFrequency * inverseDocumentFrequency;
    });

    return Math.min(1, score * 100); // Normalize to 0-1 range
  }

  /**
   * Generate search highlights
   */
  private generateHighlights(text: string, searchTerms: string[]): SearchHighlight[] {
    const highlights: SearchHighlight[] = [];
    const lowerText = text.toLowerCase();

    searchTerms.forEach(term => {
      let startIndex = 0;
      while (true) {
        const index = lowerText.indexOf(term, startIndex);
        if (index === -1) break;

        highlights.push({
          field: 'content',
          text: text.substring(index, index + term.length),
          startIndex: index,
          endIndex: index + term.length,
        });

        startIndex = index + term.length;
      }
    });

    return highlights.sort((a, b) => a.startIndex - b.startIndex);
  }

  /**
   * Create search result from document
   */
  private createSearchResult(
    doc: any,
    relevanceScore: number,
    matchedTerms: string[],
    highlights: SearchHighlight[]
  ): SearchResult | null {
    try {
      const data = doc.data;

      switch (doc.type) {
        case 'conversation':
          const startTime = data.startTime instanceof Date ? data.startTime : new Date(data.startTime);
          return {
            id: `conversation_${data.id}`,
            type: 'conversation',
            title: `📞 ${data.contactName || 'Unknown Contact'}`,
            description: `Call from ${startTime.toLocaleDateString()} • ${Math.floor(data.duration / 60)}m`,
            content: (data.transcript || '').substring(0, 200) + (data.transcript && data.transcript.length > 200 ? '...' : ''),
            relevanceScore,
            matchedTerms,
            metadata: {
              contactId: data.contactId,
              conversationId: data.id,
              date: startTime,
              duration: data.duration,
            },
            highlights,
          };

        case 'transcript':
          return {
            id: `transcript_${data.id}`,
            type: 'transcript',
            title: `Transcript ${data.id}`,
            description: `Transcription from ${data.createdAt.toLocaleDateString()}`,
            content: data.transcript.substring(0, 200) + '...',
            relevanceScore,
            matchedTerms,
            metadata: {
              conversationId: data.id,
              date: data.createdAt,
              duration: data.duration,
            },
            highlights,
          };

        case 'commitment':
          const createdAt = data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt);
          const dueDate = data.dueDate ? (data.dueDate instanceof Date ? data.dueDate : new Date(data.dueDate)) : null;
          return {
            id: `commitment_${data.id}`,
            type: 'commitment',
            title: `🤝 ${data.text.length > 50 ? data.text.substring(0, 50) + '...' : data.text}`,
            description: `${data.status.toUpperCase()} • ${data.priority.toUpperCase()} • ${data.whoCommitted === 'user' ? 'You' : 'Contact'}${dueDate ? ` • Due: ${dueDate.toLocaleDateString()}` : ''}`,
            content: data.text,
            relevanceScore,
            matchedTerms,
            metadata: {
              contactId: data.contactId,
              conversationId: data.conversationId,
              date: createdAt,
              category: data.category,
            },
            highlights,
          };

        case 'insight':
          return {
            id: `insight_${data.id}`,
            type: 'insight',
            title: 'Conversation Insight',
            description: `Analysis from ${data.analyzedAt.toLocaleDateString()}`,
            content: data.conversationInsights.keyTopics.join(', '),
            relevanceScore,
            matchedTerms,
            metadata: {
              contactId: data.contactId,
              conversationId: data.conversationId,
              date: data.analyzedAt,
              duration: data.duration,
            },
            highlights,
          };

        default:
          return null;
      }
    } catch (error) {
      console.error('Failed to create search result:', error);
      return null;
    }
  }

  /**
   * Apply search filters
   */
  private applyFilters(results: SearchResult[], filters?: SearchFilters): SearchResult[] {
    if (!filters) return results;

    return results.filter(result => {
      if (filters.types && !filters.types.includes(result.type)) {
        return false;
      }

      if (filters.contactIds && result.metadata.contactId &&
          !filters.contactIds.includes(result.metadata.contactId)) {
        return false;
      }

      if (filters.dateRange) {
        const resultDate = result.metadata.date.getTime();
        if (resultDate < filters.dateRange.start.getTime() ||
            resultDate > filters.dateRange.end.getTime()) {
          return false;
        }
      }

      if (filters.categories && result.metadata.category &&
          !filters.categories.includes(result.metadata.category)) {
        return false;
      }

      if (filters.minRelevanceScore && result.relevanceScore < filters.minRelevanceScore) {
        return false;
      }

      return true;
    });
  }

  /**
   * Sort search results
   */
  private sortResults(results: SearchResult[], options?: SearchOptions): SearchResult[] {
    const sortBy = options?.sortBy || 'relevance';
    const sortOrder = options?.sortOrder || 'desc';

    return results.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'relevance':
          comparison = a.relevanceScore - b.relevanceScore;
          break;
        case 'date':
          comparison = a.metadata.date.getTime() - b.metadata.date.getTime();
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * Get search suggestions based on query
   */
  async getSearchSuggestions(partialQuery: string, maxSuggestions: number = 5): Promise<string[]> {
    const suggestions: string[] = [];
    const query = partialQuery.toLowerCase();

    // Get suggestions from search history
    const historySuggestions = this.searchHistory
      .filter(history => history.query.toLowerCase().includes(query))
      .map(history => history.query)
      .slice(0, maxSuggestions);

    suggestions.push(...historySuggestions);

    // Get suggestions from indexed terms
    if (suggestions.length < maxSuggestions) {
      const termSuggestions = Array.from(this.searchIndex.keys())
        .filter(term => term.startsWith(query))
        .slice(0, maxSuggestions - suggestions.length);

      suggestions.push(...termSuggestions);
    }

    return [...new Set(suggestions)].slice(0, maxSuggestions);
  }

  /**
   * Get search statistics
   */
  getSearchStats(): SearchStats {
    const totalSearches = this.searchHistory.length;
    const averageExecutionTime = totalSearches > 0
      ? this.searchHistory.reduce((sum, h) => sum + h.executionTime, 0) / totalSearches
      : 0;

    // Get popular queries
    const queryCount: Record<string, number> = {};
    this.searchHistory.forEach(history => {
      queryCount[history.query] = (queryCount[history.query] || 0) + 1;
    });

    const popularQueries = Object.entries(queryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([query]) => query);

    // Count searches by type (based on document types in index)
    const searchesByType: Record<SearchResult['type'], number> = {
      conversation: 0,
      commitment: 0,
      transcript: 0,
      insight: 0,
    };

    Array.from(this.documents.values()).forEach(doc => {
      if (searchesByType.hasOwnProperty(doc.type)) {
        searchesByType[doc.type as SearchResult['type']]++;
      }
    });

    return {
      totalSearches,
      averageExecutionTime,
      popularQueries,
      mostSearchedContacts: [], // Would need to track this separately
      searchesByType,
    };
  }

  /**
   * Rebuild search index (useful after data changes)
   */
  async rebuildIndex(): Promise<void> {
    console.log('Rebuilding search index...');
    await this.buildSearchIndex();
  }

  /**
   * Add search to history
   */
  private async addToSearchHistory(query: string, resultCount: number, executionTime: number): Promise<void> {
    try {
      const historyEntry: SearchHistory = {
        id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        query,
        timestamp: new Date(),
        resultCount,
        executionTime,
      };

      this.searchHistory.push(historyEntry);

      // Keep only last 100 searches
      if (this.searchHistory.length > 100) {
        this.searchHistory = this.searchHistory.slice(-100);
      }

      await this.saveSearchHistory();
    } catch (error) {
      console.error('Failed to add search to history:', error);
    }
  }

  /**
   * Load search history from SQLite database settings
   */
  private async loadSearchHistory(): Promise<void> {
    try {
      await DatabaseService.initialize();
      
      // Load from database settings table
      const result = await DatabaseService.executeSQL(
        'SELECT value FROM settings WHERE key = ? AND encrypted = 0',
        ['search_history']
      );

      if (result.rows.length > 0) {
        const historyArray: SearchHistory[] = JSON.parse(result.rows.item(0).value);
        this.searchHistory = historyArray.map(entry => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        }));
      }
    } catch (error) {
      console.error('Failed to load search history from database:', error);
    }
  }

  /**
   * Save search history to SQLite database settings
   */
  private async saveSearchHistory(): Promise<void> {
    try {
      const historyJSON = JSON.stringify(this.searchHistory);
      const now = new Date().toISOString();
      
      // Use INSERT OR REPLACE to update or insert the search history
      await DatabaseService.executeSQL(`
        INSERT OR REPLACE INTO settings (key, value, encrypted, updatedAt)
        VALUES (?, ?, 0, ?)
      `, ['search_history', historyJSON, now]);
      
    } catch (error) {
      console.error('Failed to save search history to database:', error);
    }
  }

  /**
   * Clear search history
   */
  async clearSearchHistory(): Promise<void> {
    try {
      this.searchHistory = [];
      await DatabaseService.executeSQL(
        'DELETE FROM settings WHERE key = ?',
        ['search_history']
      );
    } catch (error) {
      console.error('Failed to clear search history from database:', error);
    }
  }

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeService();
    }
  }
}

export default new SearchService();