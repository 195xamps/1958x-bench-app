import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

// Curated external links that techs and hobbyists actually use at the bench.
// Edit this constant to add/remove entries — no schema, no admin UI.
// Tap a link → opens in the system browser via Linking.openURL.

interface LinkEntry {
  title: string;
  url: string;
  description?: string;
}

interface LinkSection {
  title: string;
  icon: string;
  links: LinkEntry[];
}

const SECTIONS: LinkSection[] = [
  {
    title: 'Forums & Communities',
    icon: 'people-outline',
    links: [
      {
        title: 'AmpGarage Forum',
        url: 'https://ampgarage.com/forum/',
        description: 'Active amp builder + tech community',
      },
      {
        title: 'The Gear Page — Amps',
        url: 'https://www.thegearpage.net/board/index.php?forums/amps-cabs-tech-corner-amplifier-cab-speakers.11/',
        description: 'Amps, cabs, speakers, and tech corner',
      },
      {
        title: 'TDPRI — Glowing Bottle',
        url: 'https://www.tdpri.com/forums/glowing-bottle-tube-amp-forum.96/',
        description: 'Telecaster Discussion Page tube amp forum',
      },
      {
        title: 'Music Electronics Forum',
        url: 'https://music-electronics-forum.com/',
        description: 'Active amp tech discussion',
      },
    ],
  },
  {
    title: 'Reference Sites',
    icon: 'book-outline',
    links: [
      {
        title: 'Rob Robinette',
        url: 'https://robrobinette.com',
        description: 'Detailed Fender circuit explanations and how-to guides',
      },
      {
        title: 'El34World',
        url: 'https://el34world.com',
        description: 'Hoffman Amplifiers + huge schematic and tutorial archive',
      },
      {
        title: 'Aiken Amplification — Tech Articles',
        url: 'https://www.aikenamps.com/index.php/articles',
        description: "Randall Aiken's deep technical write-ups",
      },
      {
        title: 'The Valve Wizard',
        url: 'https://www.valvewizard.co.uk/',
        description: "Merlin Blencowe's amp design reference",
      },
      {
        title: 'Geofex',
        url: 'http://www.geofex.com/',
        description: "R.G. Keen's amp + effects technology articles",
      },
    ],
  },
  {
    title: 'Schematic Archives',
    icon: 'document-text-outline',
    links: [
      {
        title: 'Schematic Heaven',
        url: 'https://www.schematicheaven.net/',
        description: 'Searchable archive of vintage amp schematics',
      },
      {
        title: 'Dr. Tube Schematics',
        url: 'https://www.drtube.com/schematics.htm',
        description: 'Public schematic library',
      },
    ],
  },
  {
    title: 'Tube Data',
    icon: 'hardware-chip-outline',
    links: [
      {
        title: "Frank's Electron Tube Pages",
        url: 'https://frank.pocnet.net/',
        description: 'The canonical tube datasheet archive',
      },
      {
        title: 'Tubebooks.org',
        url: 'https://www.tubebooks.org/',
        description: 'Free historical tube and electronics service manuals',
      },
    ],
  },
  {
    title: 'Podcasts',
    icon: 'mic-outline',
    links: [
      {
        title: 'The Truth About Vintage Amps',
        url: 'https://www.fretboardjournal.com/podcasts/the-truth-about-vintage-amps-big-index-page/',
        description: 'Skip Simmons + Jason Verlinde — the canonical vintage amp podcast',
      },
    ],
  },
  {
    title: 'Parts Vendors',
    icon: 'cube-outline',
    links: [
      {
        title: 'Tube Depot',
        url: 'https://www.tubedepot.com/',
        description: 'Major US tube and parts retailer',
      },
      {
        title: 'Antique Electronic Supply',
        url: 'https://www.tubesandmore.com/',
        description: 'Classic amp parts, tubes, transformers',
      },
      {
        title: 'Mojotone',
        url: 'https://www.mojotone.com/',
        description: 'Boutique amp parts, kits, transformers',
      },
      {
        title: 'Amplified Parts',
        url: 'https://www.amplifiedparts.com/',
        description: 'Tubes, capacitors, resistors, transformers, kits',
      },
    ],
  },
];

export function LinksTab() {
  const open = (url: string) => Linking.openURL(url);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {SECTIONS.map((section) => (
        <View key={section.title} style={s.section}>
          <View style={s.sectionHeader}>
            <Ionicons name={section.icon as any} size={18} color={colors.accent} />
            <Text style={s.sectionTitle}>{section.title}</Text>
          </View>
          {section.links.map((link) => (
            <TouchableOpacity
              key={link.url}
              style={s.linkCard}
              onPress={() => open(link.url)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.linkTitle}>{link.title}</Text>
                {link.description && (
                  <Text style={s.linkDescription}>{link.description}</Text>
                )}
              </View>
              <Ionicons name="open-outline" size={18} color={colors.text.muted} />
            </TouchableOpacity>
          ))}
        </View>
      ))}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  content: { padding: 16 },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  linkTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: 2,
  },
  linkDescription: {
    fontSize: 12,
    color: colors.text.muted,
    lineHeight: 16,
  },
});
