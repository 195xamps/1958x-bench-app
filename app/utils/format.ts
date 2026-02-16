export function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString();
}

export function formatDateLong(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return hours + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
  }
  return minutes + ':' + String(seconds).padStart(2, '0');
}

export function formatAmpName(
  profile: { make?: string | null; model?: string | null } | null | undefined,
  fallback: string = 'Untitled Job'
): string {
  if (!profile) return fallback;
  const parts = [profile.make, profile.model].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : fallback;
}
