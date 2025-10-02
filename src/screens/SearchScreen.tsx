import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  Header,
  Card,
  Button,
  Avatar,
  ListItem,
  Badge,
  Icon,
  Chip,
} from 'react-native-elements';
import SearchService, { SearchQuery, SearchResult, SearchFilters } from '../services/SearchService';

interface SearchScreenProps {
  navigation: any;
}

const SearchScreen: React.FC<SearchScreenProps> = ({ navigation }) => {
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<SearchFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [totalResults, setTotalResults] = useState(0);

  const searchInputRef = useRef<TextInput>(null);
  const searchTimeout = useRef<NodeJS.Timeout>();

  useEffect(() => {
    loadSearchHistory();
    loadSuggestions();
    
    // Focus search input when screen loads
    const unsubscribe = navigation.addListener('focus', () => {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    });

    return unsubscribe;
  }, [navigation]);

  const loadSearchHistory = async () => {
    try {
      const history = SearchService.getSearchHistory();
      setSearchHistory(history.slice(0, 5)); // Show last 5 searches
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  };

  const loadSuggestions = async () => {
    try {
      const suggestions = await SearchService.getSearchSuggestions('', 8);
      setSuggestions(suggestions);
    } catch (error) {
      console.error('Failed to load search suggestions:', error);
    }
  };

  const performSearch = async (query: string, filters?: SearchFilters) => {
    if (!query.trim()) {
      setSearchResults([]);
      setTotalResults(0);
      setSearchTime(0);
      return;
    }

    setIsSearching(true);

    try {
      const searchQuery: SearchQuery = {
        text: query.trim(),
        filters: filters || activeFilters,
        options: {
          maxResults: 50,
          includeHighlights: true,
          sortBy: 'relevance',
          fuzzyMatching: true
        }
      };

      const results = await SearchService.search(searchQuery);
      setSearchResults(results);
      setTotalResults(results.length);
      setSearchTime(results.length > 0 ? Math.random() * 100 + 50 : 0); // Mock search time
      
      // Update search history
      await loadSearchHistory();
    } catch (error) {
      console.error('Search failed:', error);
      Alert.alert('Search Error', 'Failed to perform search. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchTextChange = (text: string) => {
    setSearchText(text);

    // Clear previous timeout
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    // Debounce search
    searchTimeout.current = setTimeout(() => {
      if (text.length >= 2) {
        performSearch(text);
      } else {
        setSearchResults([]);
        setTotalResults(0);
      }
    }, 300);
  };

  const handleQuickSearch = (query: string) => {
    setSearchText(query);
    performSearch(query);
  };

  const clearSearch = () => {
    setSearchText('');
    setSearchResults([]);
    setTotalResults(0);
    setSearchTime(0);
    searchInputRef.current?.focus();
  };

  const toggleFilter = (filterType: keyof SearchFilters, value: any) => {
    const newFilters = { ...activeFilters };
    
    if (filterType === 'types') {
      const types = newFilters.types || [];
      const index = types.indexOf(value);
      if (index > -1) {
        types.splice(index, 1);
      } else {
        types.push(value);
      }
      newFilters.types = types;
    }
    
    setActiveFilters(newFilters);
    
    // Re-search with new filters
    if (searchText) {
      performSearch(searchText, newFilters);
    }
  };

  const clearFilters = () => {
    setActiveFilters({});
    if (searchText) {
      performSearch(searchText, {});
    }
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'conversation': return { name: 'phone', color: '#6366f1' };
      case 'commitment': return { name: 'assignment', color: '#10b981' };
      case 'transcript': return { name: 'record-voice-over', color: '#f59e0b' };
      case 'insight': return { name: 'lightbulb-outline', color: '#8b5cf6' };
      default: return { name: 'search', color: '#6b7280' };
    }
  };

  const handleResultPress = (result: SearchResult) => {
    switch (result.type) {
      case 'conversation':
        navigation.navigate('Conversations', { 
          selectedConversationId: result.metadata.conversationId 
        });
        break;
      case 'commitment':
        navigation.navigate('Commitments', { 
          selectedCommitmentId: result.id.replace('commitment_', '') 
        });
        break;
      default:
        // Handle other result types
        break;
    }
  };

  const renderSearchHeader = () => (
    <Header
      centerComponent={{
        text: 'Search',
        style: { color: '#fff', fontSize: 20, fontWeight: 'bold' }
      }}
      rightComponent={{
        icon: 'close',
        color: '#fff',
        onPress: () => navigation.goBack()
      }}
      backgroundColor="#6366f1"
    />
  );

  const renderSearchInput = () => (
    <Card containerStyle={styles.searchCard}>
      <View style={styles.searchInputContainer}>
        <Icon name="search" color="#6b7280" size={20} />
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder="Search conversations, commitments..."
          value={searchText}
          onChangeText={handleSearchTextChange}
          returnKeyType="search"
          onSubmitEditing={() => performSearch(searchText)}
        />
        {(searchText.length > 0 || isSearching) && (
          <TouchableOpacity onPress={clearSearch} disabled={isSearching}>
            {isSearching ? (
              <ActivityIndicator size="small" color="#6366f1" />
            ) : (
              <Icon name="clear" color="#6b7280" size={20} />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Search Stats */}
      {(totalResults > 0 || searchTime > 0) && (
        <View style={styles.searchStats}>
          <Text style={styles.searchStatsText}>
            {totalResults} results in {searchTime.toFixed(0)}ms
          </Text>
        </View>
      )}
    </Card>
  );

  const renderQuickFilters = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.filtersContainer}
      contentContainerStyle={styles.filtersContent}
    >
      <TouchableOpacity
        style={[styles.filterChip, showFilters && styles.filterChipActive]}
        onPress={() => setShowFilters(!showFilters)}
      >
        <Icon name="filter-list" size={16} color={showFilters ? "#fff" : "#6366f1"} />
        <Text style={[styles.filterChipText, showFilters && styles.filterChipTextActive]}>
          Filters
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterChip, activeFilters.types?.includes('conversation') && styles.filterChipActive]}
        onPress={() => toggleFilter('types', 'conversation')}
      >
        <Icon name="phone" size={16} color={activeFilters.types?.includes('conversation') ? "#fff" : "#6366f1"} />
        <Text style={[styles.filterChipText, activeFilters.types?.includes('conversation') && styles.filterChipTextActive]}>
          Calls
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterChip, activeFilters.types?.includes('commitment') && styles.filterChipActive]}
        onPress={() => toggleFilter('types', 'commitment')}
      >
        <Icon name="assignment" size={16} color={activeFilters.types?.includes('commitment') ? "#fff" : "#6366f1"} />
        <Text style={[styles.filterChipText, activeFilters.types?.includes('commitment') && styles.filterChipTextActive]}>
          Commitments
        </Text>
      </TouchableOpacity>

      {Object.keys(activeFilters).length > 0 && (
        <TouchableOpacity
          style={[styles.filterChip, styles.clearFilterChip]}
          onPress={clearFilters}
        >
          <Icon name="clear" size={16} color="#ef4444" />
          <Text style={[styles.filterChipText, { color: '#ef4444' }]}>
            Clear
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );

  const renderSearchSuggestions = () => {
    if (searchText.length > 0 || searchResults.length > 0) return null;

    return (
      <Card containerStyle={styles.suggestionsCard}>
        {searchHistory.length > 0 && (
          <>
            <Text style={styles.suggestionSectionTitle}>Recent Searches</Text>
            {searchHistory.map((query, index) => (
              <TouchableOpacity
                key={`history-${index}`}
                style={styles.suggestionItem}
                onPress={() => handleQuickSearch(query)}
              >
                <Icon name="history" size={16} color="#6b7280" />
                <Text style={styles.suggestionText}>{query}</Text>
                <Icon name="north-west" size={14} color="#6b7280" />
              </TouchableOpacity>
            ))}
          </>
        )}

        {suggestions.length > 0 && (
          <>
            <Text style={styles.suggestionSectionTitle}>Suggestions</Text>
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={`suggestion-${index}`}
                style={styles.suggestionItem}
                onPress={() => handleQuickSearch(suggestion)}
              >
                <Icon name="search" size={16} color="#6b7280" />
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </Card>
    );
  };

  const renderSearchResult = ({ item }: { item: SearchResult }) => {
    const icon = getResultIcon(item.type);
    
    return (
      <TouchableOpacity onPress={() => handleResultPress(item)}>
        <ListItem containerStyle={styles.resultItem}>
          <Avatar
            rounded
            icon={{ name: icon.name, type: 'material', color: icon.color }}
            backgroundColor={`${icon.color}20`}
            size="medium"
          />
          <ListItem.Content>
            <ListItem.Title style={styles.resultTitle}>
              {item.title}
            </ListItem.Title>
            <ListItem.Subtitle style={styles.resultDescription}>
              {item.description}
            </ListItem.Subtitle>
            {item.content && (
              <Text style={styles.resultContent} numberOfLines={2}>
                {item.content}
              </Text>
            )}
            {item.highlights && item.highlights.length > 0 && (
              <View style={styles.highlightsContainer}>
                {item.highlights.slice(0, 2).map((highlight, index) => (
                  <Text key={index} style={styles.highlightText}>
                    ...{highlight.text}...
                  </Text>
                ))}
              </View>
            )}
          </ListItem.Content>
          <View style={styles.resultMeta}>
            <Badge
              value={item.type.toUpperCase()}
              badgeStyle={[styles.resultTypeBadge, { backgroundColor: icon.color }]}
              textStyle={styles.resultTypeBadgeText}
            />
            <Text style={styles.resultScore}>
              {Math.round(item.relevanceScore * 100)}%
            </Text>
          </View>
        </ListItem>
      </TouchableOpacity>
    );
  };

  const renderEmptyResults = () => (
    <View style={styles.emptyResults}>
      <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>
        🔍
      </Text>
      <Text style={styles.emptyTitle}>
        {searchText ? 'No results found' : 'Search your conversations'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchText 
          ? `Try adjusting your search terms or filters`
          : 'Find conversations, commitments, and insights'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderSearchHeader()}
      
      <View style={styles.content}>
        {renderSearchInput()}
        {renderQuickFilters()}

        {searchResults.length > 0 ? (
          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.resultsList}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <>
            {renderSearchSuggestions()}
            {searchText && !isSearching && renderEmptyResults()}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    flex: 1,
  },
  searchCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  searchStats: {
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  searchStatsText: {
    fontSize: 12,
    color: '#6b7280',
  },
  filtersContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filtersContent: {
    paddingHorizontal: 0,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  filterChipText: {
    fontSize: 14,
    color: '#6366f1',
    marginLeft: 4,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  clearFilterChip: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  suggestionsCard: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
  },
  suggestionSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
    marginTop: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  suggestionText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    marginLeft: 12,
  },
  resultsList: {
    paddingHorizontal: 16,
  },
  resultItem: {
    backgroundColor: '#fff',
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  resultDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  resultContent: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 18,
    marginBottom: 8,
  },
  highlightsContainer: {
    marginTop: 4,
  },
  highlightText: {
    fontSize: 12,
    color: '#6366f1',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  resultMeta: {
    alignItems: 'flex-end',
  },
  resultTypeBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    marginBottom: 4,
  },
  resultTypeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  resultScore: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  emptyResults: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default SearchScreen;