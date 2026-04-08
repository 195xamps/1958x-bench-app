import React, { useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '../../theme/colors';
import { formatDate } from '../../utils';
import type { AdminUser, AdminChat } from '../../types/admin';
import { adminStyles as s } from './adminStyles';

interface ChatRow { chat: AdminChat; user: AdminUser | null }

interface Props {
  chats: ChatRow[];
  refreshing: boolean;
  onRefresh: () => void;
}

export function AdminChatsList({ chats, refreshing, onRefresh }: Props) {
  const router = useRouter();

  const renderItem = useCallback(({ item }: { item: ChatRow }) => {
    const { chat, user: chatUser } = item;
    return (
      <TouchableOpacity style={s.itemCard} onPress={() => router.push(`/chat/${chat.id}` as any)}>
        <View style={s.itemHeader}>
          <Text style={s.itemTitle}>{chat.title}</Text>
          <View style={[s.badge, { backgroundColor: chat.isStandalone ? colors.status.info : colors.status.purple }]}>
            <Text style={s.badgeText}>{chat.isStandalone ? 'Standalone' : 'Job Chat'}</Text>
          </View>
        </View>
        <Text style={s.itemSub}>User: {chatUser?.firstName} {chatUser?.lastName} ({chatUser?.email})</Text>
        <View style={s.itemFooter}>
          <Text style={s.itemDate}>Updated: {formatDate(chat.updatedAt)}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
        </View>
      </TouchableOpacity>
    );
  }, [router]);

  return (
    <FlatList
      data={chats}
      keyExtractor={(item) => item.chat.id}
      renderItem={renderItem}
      contentContainerStyle={s.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={11}
      removeClippedSubviews
    />
  );
}
