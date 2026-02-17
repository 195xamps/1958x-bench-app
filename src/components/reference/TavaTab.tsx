import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { podcastApi } from '../../services/endpoints/reference';
import { showAlert, showError } from '../../utils/alert';
import { styles } from './referenceStyles';

interface PodcastTopic {
  id: string;
  topic: string;
  timestamp: string | null;
  timestampSeconds: number | null;
  circuitFamily: string | null;
  episodeNumber: number;
  episodeTitle: string;
  episodeUrl: string;
}

export function TavaTab() {
  const [topics, setTopics] = useState<PodcastTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<PodcastTopic[]>([]);
  const [searching, setSearching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    setLoading(true);
    try {
      const data = await podcastApi.listTopics();
      setTopics(data);
    } catch (error) {
      console.error('Error fetching podcast topics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearch(query);
    if (!query.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const data = await podcastApi.search(query);
      setSearchResults(data);
    } catch (error) {
      console.error('Error searching podcast:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await podcastApi.sync();
      fetchTopics();
      const msg = result.newEpisodes > 0
        ? `Added ${result.newEpisodes} new episodes! Total: ${result.totalEpisodes} episodes, ${result.totalTopics} topics`
        : `Already up to date: ${result.totalEpisodes} episodes, ${result.totalTopics} topics`;
      showAlert('Sync Complete', msg);
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to sync podcast data');
    } finally {
      setSyncing(false);
    }
  };

  const toggleEpisode = (episodeNumber: number) => {
    setExpandedEpisodes(prev => {
      const newSet = new Set(prev);
      newSet.has(episodeNumber) ? newSet.delete(episodeNumber) : newSet.add(episodeNumber);
      return newSet;
    });
  };

  const topicsToShow = search.trim() ? searchResults : topics;
  const groupedByEpisode = topicsToShow.reduce((acc, topic) => {
    const epKey = `${topic.episodeNumber}-${topic.episodeTitle}`;
    if (!acc[epKey]) {
      acc[epKey] = { episodeNumber: topic.episodeNumber, episodeTitle: topic.episodeTitle, episodeUrl: topic.episodeUrl, topics: [] };
    }
    acc[epKey].topics.push(topic);
    return acc;
  }, {} as Record<string, { episodeNumber: number; episodeTitle: string; episodeUrl: string; topics: PodcastTopic[] }>);

  const episodes = Object.values(groupedByEpisode).sort((a, b) => a.episodeNumber - b.episodeNumber);
  const isSearching = search.trim().length > 0;

  return (
    <ScrollView style={styles.tavaContainer}>
      <View style={styles.tavaHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>TAVA Podcast Index</Text>
          <Text style={styles.sectionSubtitle}>The Truth About Vintage Amps</Text>
        </View>
        <TouchableOpacity style={[styles.syncButton, syncing && styles.syncButtonDisabled]} onPress={handleSync} disabled={syncing}>
          {syncing ? <ActivityIndicator size="small" color="#1f2937" /> : <Ionicons name="refresh" size={18} color="#1f2937" />}
          <Text style={styles.syncButtonText}>{syncing ? 'Syncing...' : 'Check Updates'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.podcastSearchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" />
        <TextInput style={styles.podcastSearchInput} placeholder="Search topics..." placeholderTextColor="#6b7280" value={search} onChangeText={handleSearch} />
        {searching && <ActivityIndicator size="small" color="#f59e0b" />}
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(''); setSearchResults([]); }}>
            <Ionicons name="close-circle" size={20} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>Loading podcast topics...</Text>
        </View>
      ) : episodes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="mic-outline" size={64} color="#374151" />
          <Text style={styles.emptyTitle}>{search.trim() ? 'No Results' : 'No Episodes Yet'}</Text>
          <Text style={styles.emptySubtitle}>{search.trim() ? `No topics match "${search}"` : 'Tap "Check Updates" to sync episodes'}</Text>
        </View>
      ) : (
        <View style={styles.episodesList}>
          {episodes.map((ep) => {
            const isExpanded = isSearching || expandedEpisodes.has(ep.episodeNumber);
            return (
              <View key={`ep-${ep.episodeNumber}`} style={styles.episodeCard}>
                <TouchableOpacity style={styles.episodeHeader} onPress={() => toggleEpisode(ep.episodeNumber)}>
                  <View style={styles.episodeNumberBadge}>
                    <Text style={styles.episodeNumberText}>#{ep.episodeNumber}</Text>
                  </View>
                  <Text style={styles.episodeTitleText} numberOfLines={2}>{ep.episodeTitle}</Text>
                  <View style={styles.episodeHeaderIcons}>
                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); Linking.openURL(ep.episodeUrl); }} style={styles.openLinkButton}>
                      <Ionicons name="open-outline" size={16} color="#9ca3af" />
                    </TouchableOpacity>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color="#9ca3af" />
                  </View>
                </TouchableOpacity>
                {isExpanded && (
                  <View style={styles.topicsList}>
                    {ep.topics.map((topic) => (
                      <View key={topic.id} style={styles.topicItem}>
                        {topic.timestamp && <Text style={styles.topicTimestamp}>{topic.timestamp}</Text>}
                        <Text style={styles.topicText}>{topic.topic}</Text>
                        {topic.circuitFamily && (
                          <View style={styles.circuitBadge}>
                            <Text style={styles.circuitBadgeText}>{topic.circuitFamily}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.creditSection}>
        <TouchableOpacity onPress={() => Linking.openURL('https://fretboardjournal.com/the-truth-about-vintage-amps-podcast/')}>
          <Text style={styles.creditText}>Podcast from <Text style={styles.creditLink}>The Fretboard Journal</Text></Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
