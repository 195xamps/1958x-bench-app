import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';

const API_URL = '';

type SubTab = 'flowcharts' | 'voltages' | 'calculator' | 'articles' | 'tava';

interface ReferenceArticle {
  id: string;
  title: string;
  sourceUrl: string;
  sourceName: string;
  circuitFamily: string | null;
  createdAt: string;
}

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

interface FlowchartNode {
  id: string;
  question: string;
  yesNext?: string;
  noNext?: string;
  result?: string;
  tip?: string;
}

interface Flowchart {
  id: string;
  name: string;
  symptom: string;
  nodes: { [key: string]: FlowchartNode };
  startNode: string;
}

interface VoltageCard {
  id: string;
  name: string;
  circuitFamily: string;
  description: string;
  voltages: { node: string; expected: string; notes?: string }[];
}

const FLOWCHARTS: Flowchart[] = [
  {
    id: 'no-output',
    name: 'No Output',
    symptom: 'Amp powers on but no sound from speaker',
    startNode: 'start',
    nodes: {
      start: {
        id: 'start',
        question: 'Does the pilot light come on?',
        yesNext: 'tubes-glow',
        noNext: 'check-fuse',
      },
      'check-fuse': {
        id: 'check-fuse',
        question: 'Is the fuse intact?',
        yesNext: 'check-power-cord',
        noNext: 'fuse-blown',
      },
      'fuse-blown': {
        id: 'fuse-blown',
        result: 'Replace fuse. If it blows again, check rectifier and filter caps for shorts.',
        tip: 'A blown fuse often indicates a shorted rectifier tube or filter capacitor.',
      },
      'check-power-cord': {
        id: 'check-power-cord',
        result: 'Check power cord continuity and wall outlet. Verify power transformer primary.',
        tip: 'Use a multimeter to check for AC at the transformer primary.',
      },
      'tubes-glow': {
        id: 'tubes-glow',
        question: 'Do all tubes have heater glow (orange)?',
        yesNext: 'speaker-check',
        noNext: 'heater-issue',
      },
      'heater-issue': {
        id: 'heater-issue',
        result: 'Check heater wiring and heater voltage (should be ~6.3VAC). Replace non-glowing tubes.',
        tip: 'No heater glow = open heater. Check tube pins and socket contacts.',
      },
      'speaker-check': {
        id: 'speaker-check',
        question: 'Do you hear any hum or hiss from the speaker?',
        yesNext: 'preamp-issue',
        noNext: 'output-stage',
      },
      'output-stage': {
        id: 'output-stage',
        question: 'Is there B+ voltage at the output tube plates (250-450VDC typical)?',
        yesNext: 'output-tubes',
        noNext: 'power-supply',
      },
      'power-supply': {
        id: 'power-supply',
        result: 'Check rectifier tube/diodes and filter capacitors. Verify transformer secondary voltages.',
        tip: 'No B+ usually means rectifier failure or open filter cap.',
      },
      'output-tubes': {
        id: 'output-tubes',
        result: 'Swap output tubes with known good ones. Check output transformer primary and screen resistors.',
        tip: 'Bad output tubes or open screen resistors are common causes.',
      },
      'preamp-issue': {
        id: 'preamp-issue',
        question: 'Does tapping the first preamp tube (V1) produce sound?',
        yesNext: 'signal-trace',
        noNext: 'v1-check',
      },
      'v1-check': {
        id: 'v1-check',
        result: 'Replace V1 tube. Check V1 plate resistor and coupling cap to next stage.',
        tip: 'V1 is the most common tube failure point.',
      },
      'signal-trace': {
        id: 'signal-trace',
        result: 'Signal is reaching preamp. Trace signal stage-by-stage using audio probe or scope. Check coupling caps and plate resistors.',
        tip: 'Inject signal at each stage and listen for output.',
      },
    },
  },
  {
    id: 'hum',
    name: 'Excessive Hum',
    symptom: '60Hz or 120Hz hum from speaker',
    startNode: 'start',
    nodes: {
      start: {
        id: 'start',
        question: 'Does the hum change when you turn the volume control?',
        yesNext: 'preamp-hum',
        noNext: 'power-supply-hum',
      },
      'preamp-hum': {
        id: 'preamp-hum',
        question: 'Does the hum stop when you ground the input jack?',
        yesNext: 'input-stage',
        noNext: 'preamp-supply',
      },
      'input-stage': {
        id: 'input-stage',
        result: 'Hum is being picked up at input. Check input jack grounding, cable, and V1 heater dress.',
        tip: 'Heater wires should be twisted and routed away from signal wiring.',
      },
      'preamp-supply': {
        id: 'preamp-supply',
        result: 'Check preamp B+ filter caps. Replace if ESR is high or capacitance is low.',
        tip: 'Old electrolytics are the #1 cause of hum in vintage amps.',
      },
      'power-supply-hum': {
        id: 'power-supply-hum',
        question: 'Is the hum a low 60Hz buzz or a higher 120Hz buzz?',
        yesNext: 'hum-60hz',
        noNext: 'hum-120hz',
      },
      'hum-60hz': {
        id: 'hum-60hz',
        result: '60Hz hum indicates heater-to-cathode leakage or bad grounding. Check tubes, heater elevation, and ground scheme.',
        tip: 'Try a heater elevation resistor network or replace tubes.',
      },
      'hum-120hz': {
        id: 'hum-120hz',
        result: '120Hz hum indicates filter cap failure. Replace main filter capacitors.',
        tip: '120Hz = full-wave rectified AC ripple. Caps are definitely suspect.',
      },
    },
  },
  {
    id: 'distortion',
    name: 'Unwanted Distortion',
    symptom: 'Amp distorts at low volume or sounds harsh',
    startNode: 'start',
    nodes: {
      start: {
        id: 'start',
        question: 'Does the distortion happen on all inputs/channels?',
        yesNext: 'all-channels',
        noNext: 'single-channel',
      },
      'single-channel': {
        id: 'single-channel',
        result: 'Problem is in one channel. Check tubes, coupling caps, and resistors in that channel only.',
        tip: 'Swap tubes between channels to isolate the problem.',
      },
      'all-channels': {
        id: 'all-channels',
        question: 'Is the distortion present even with the volume at minimum?',
        yesNext: 'output-issue',
        noNext: 'preamp-issue',
      },
      'output-issue': {
        id: 'output-issue',
        question: 'Are the output tubes biased correctly?',
        yesNext: 'ot-check',
        noNext: 'bias-fix',
      },
      'bias-fix': {
        id: 'bias-fix',
        result: 'Rebias the output tubes. Cold bias causes crossover distortion, hot bias causes excessive distortion.',
        tip: 'Target 60-70% of max plate dissipation for most designs.',
      },
      'ot-check': {
        id: 'ot-check',
        result: 'Check output transformer for shorted turns. Check screen resistors and coupling caps to output tubes.',
        tip: 'A scope comparing input to output can reveal waveform clipping.',
      },
      'preamp-issue': {
        id: 'preamp-issue',
        question: 'Does the distortion clear up with fresh preamp tubes?',
        yesNext: 'bad-tube',
        noNext: 'component-check',
      },
      'bad-tube': {
        id: 'bad-tube',
        result: 'Replace the faulty preamp tube. Mark it and set aside for testing later.',
        tip: 'Microphonic or gassy tubes cause distortion.',
      },
      'component-check': {
        id: 'component-check',
        result: 'Check coupling caps for leakage (causes DC on grids). Check plate and cathode resistors for drift.',
        tip: 'A leaky coupling cap is a very common cause of distortion.',
      },
    },
  },
  {
    id: 'intermittent',
    name: 'Intermittent Problems',
    symptom: 'Sound cuts out, crackles, or changes randomly',
    startNode: 'start',
    nodes: {
      start: {
        id: 'start',
        question: 'Does tapping the chassis or tubes affect the problem?',
        yesNext: 'mechanical',
        noNext: 'thermal',
      },
      'mechanical': {
        id: 'mechanical',
        question: 'Does tapping a specific tube cause the problem?',
        yesNext: 'bad-tube',
        noNext: 'connection-issue',
      },
      'bad-tube': {
        id: 'bad-tube',
        result: 'Replace the microphonic or intermittent tube.',
        tip: 'Tap each tube gently with a chopstick while amp is on to identify the culprit.',
      },
      'connection-issue': {
        id: 'connection-issue',
        result: 'Check tube sockets, jacks, solder joints, and wire connections. Resolder any cold or cracked joints.',
        tip: 'Look for dull, grainy solder joints. Reflow with fresh solder.',
      },
      'thermal': {
        id: 'thermal',
        question: 'Does the problem appear after the amp warms up?',
        yesNext: 'thermal-component',
        noNext: 'cold-failure',
      },
      'thermal-component': {
        id: 'thermal-component',
        result: 'Use freeze spray to cool suspected components while amp is failing. When sprayed component fixes issue, you found it.',
        tip: 'Resistors and caps can fail when hot. Cool them one at a time.',
      },
      'cold-failure': {
        id: 'cold-failure',
        result: 'Use a heat gun or hair dryer to warm components. Problem may be a cold solder joint or cracked component.',
        tip: 'Flex the PCB gently while listening for changes.',
      },
    },
  },
];

const VOLTAGE_CARDS: VoltageCard[] = [
  {
    id: 'aa763',
    name: 'Fender AA763',
    circuitFamily: 'Blackface',
    description: 'Deluxe Reverb, Twin Reverb, Super Reverb (1963-1967)',
    voltages: [
      { node: 'B+ (main)', expected: '420-440V', notes: 'After rectifier' },
      { node: 'Output tube plates', expected: '420-440V', notes: '6L6 or 6V6' },
      { node: 'Output tube screens', expected: '415-435V' },
      { node: 'Phase inverter plates', expected: '200-220V', notes: '12AT7' },
      { node: 'Preamp plates', expected: '180-200V', notes: '12AX7' },
      { node: 'Preamp cathodes', expected: '1.2-1.8V', notes: 'Depends on stage' },
      { node: 'Bias voltage', expected: '-48 to -55V', notes: 'Adjustable' },
      { node: 'Heaters', expected: '6.3VAC' },
    ],
  },
  {
    id: 'ab763',
    name: 'Fender AB763',
    circuitFamily: 'Blackface',
    description: 'Similar to AA763, slightly different bias circuit',
    voltages: [
      { node: 'B+ (main)', expected: '420-450V' },
      { node: 'Output tube plates', expected: '420-450V' },
      { node: 'Output tube screens', expected: '420-445V' },
      { node: 'Phase inverter plates', expected: '200-225V' },
      { node: 'Preamp plates', expected: '175-200V' },
      { node: 'Bias voltage', expected: '-50 to -58V' },
      { node: 'Heaters', expected: '6.3VAC' },
    ],
  },
  {
    id: 'aa864',
    name: 'Fender AA864',
    circuitFamily: 'Silverface',
    description: 'Early Silverface, same circuit as Blackface',
    voltages: [
      { node: 'B+ (main)', expected: '420-440V' },
      { node: 'Output tube plates', expected: '420-440V' },
      { node: 'Output tube screens', expected: '415-435V' },
      { node: 'Phase inverter plates', expected: '200-220V' },
      { node: 'Preamp plates', expected: '180-200V' },
      { node: 'Bias voltage', expected: '-48 to -55V' },
      { node: 'Heaters', expected: '6.3VAC' },
    ],
  },
  {
    id: '5f1',
    name: 'Fender 5F1',
    circuitFamily: 'Tweed',
    description: 'Champ (1955-1964)',
    voltages: [
      { node: 'B+ (main)', expected: '355-375V', notes: 'From 5Y3 rectifier' },
      { node: 'Output tube plate', expected: '355-375V', notes: '6V6' },
      { node: 'Output tube screen', expected: '355-375V' },
      { node: 'Output cathode', expected: '16-20V', notes: 'Cathode bias' },
      { node: 'Preamp plate', expected: '150-165V', notes: '12AX7' },
      { node: 'Preamp cathode', expected: '1.0-1.5V' },
      { node: 'Heaters', expected: '6.3VAC' },
    ],
  },
  {
    id: '5e3',
    name: 'Fender 5E3',
    circuitFamily: 'Tweed',
    description: 'Deluxe (1955-1960)',
    voltages: [
      { node: 'B+ (main)', expected: '360-385V', notes: 'From 5Y3 rectifier' },
      { node: 'Output tube plates', expected: '360-385V', notes: '6V6 push-pull' },
      { node: 'Output cathode', expected: '20-24V', notes: 'Shared cathode bias' },
      { node: 'Phase inverter plate', expected: '175-195V', notes: 'Cathodyne' },
      { node: 'Preamp plates', expected: '150-175V' },
      { node: 'Heaters', expected: '6.3VAC' },
    ],
  },
  {
    id: '5f6a',
    name: 'Fender 5F6-A',
    circuitFamily: 'Tweed',
    description: 'Bassman (1958-1960)',
    voltages: [
      { node: 'B+ (main)', expected: '420-450V', notes: 'GZ34 rectifier' },
      { node: 'Output tube plates', expected: '420-450V', notes: '6L6' },
      { node: 'Output tube screens', expected: '405-430V' },
      { node: 'Phase inverter plates', expected: '215-235V' },
      { node: 'Preamp plates', expected: '160-180V' },
      { node: 'Bias voltage', expected: '-42 to -50V' },
      { node: 'Heaters', expected: '6.3VAC' },
    ],
  },
  {
    id: 'jtm45',
    name: 'Marshall JTM45',
    circuitFamily: 'Marshall',
    description: 'Based on 5F6-A Bassman',
    voltages: [
      { node: 'B+ (main)', expected: '430-465V', notes: 'GZ34 rectifier' },
      { node: 'Output tube plates', expected: '430-465V', notes: 'KT66 or 6L6' },
      { node: 'Output tube screens', expected: '415-445V' },
      { node: 'Phase inverter plates', expected: '220-240V' },
      { node: 'Preamp plates', expected: '165-190V' },
      { node: 'Bias voltage', expected: '-35 to -45V' },
      { node: 'Heaters', expected: '6.3VAC' },
    ],
  },
  {
    id: 'plexi',
    name: 'Marshall 1959/1987',
    circuitFamily: 'Marshall',
    description: 'Plexi Super Lead / Super Bass',
    voltages: [
      { node: 'B+ (main)', expected: '470-500V', notes: 'Solid state rectifier' },
      { node: 'Output tube plates', expected: '470-500V', notes: 'EL34' },
      { node: 'Output tube screens', expected: '450-480V' },
      { node: 'Phase inverter plates', expected: '230-260V' },
      { node: 'Preamp plates', expected: '180-210V' },
      { node: 'Bias voltage', expected: '-40 to -50V' },
      { node: 'Heaters', expected: '6.3VAC' },
    ],
  },
  {
    id: 'ac30',
    name: 'Vox AC30',
    circuitFamily: 'Vox',
    description: 'AC30 Top Boost',
    voltages: [
      { node: 'HT (main)', expected: '320-340V', notes: 'GZ34 rectifier' },
      { node: 'Output tube plates', expected: '320-340V', notes: 'EL84 quad' },
      { node: 'Output tube screens', expected: '310-330V' },
      { node: 'Output cathode', expected: '14-18V', notes: 'Cathode bias' },
      { node: 'Preamp plates', expected: '150-180V', notes: 'EF86/12AX7' },
      { node: 'Heaters', expected: '6.3VAC' },
    ],
  },
];

export default function ReferenceScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SubTab>('flowcharts');
  const [selectedFlowchart, setSelectedFlowchart] = useState<Flowchart | null>(null);
  const [currentNode, setCurrentNode] = useState<string>('');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  
  const [filterCapValue, setFilterCapValue] = useState('');
  const [filterResValue, setFilterResValue] = useState('');
  const [cathodeResValue, setCathodeResValue] = useState('');
  const [cathodeCurrent, setCathodeCurrent] = useState('');
  const [plateVoltage, setPlateVoltage] = useState('');
  const [plateCurrent, setPlateCurrent] = useState('');
  const [screenCurrent, setScreenCurrent] = useState('');

  const [articles, setArticles] = useState<ReferenceArticle[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);

  const [podcastTopics, setPodcastTopics] = useState<PodcastTopic[]>([]);
  const [loadingPodcast, setLoadingPodcast] = useState(false);
  const [podcastSearch, setPodcastSearch] = useState('');
  const [searchResults, setSearchResults] = useState<PodcastTopic[]>([]);
  const [searching, setSearching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (activeTab === 'articles') {
      fetchArticles();
    }
    if (activeTab === 'tava') {
      fetchPodcastTopics();
    }
  }, [activeTab]);

  const fetchArticles = async () => {
    setLoadingArticles(true);
    try {
      const response = await axios.get(`${API_URL}/api/reference-articles`);
      setArticles(response.data);
    } catch (error) {
      console.error('Error fetching articles:', error);
    } finally {
      setLoadingArticles(false);
    }
  };

  const handleImportArticle = async () => {
    if (!importUrl.trim()) return;
    setImporting(true);
    try {
      const response = await axios.post(`${API_URL}/api/reference-articles/import`, {
        url: importUrl.trim(),
      });
      setArticles([response.data, ...articles]);
      setShowImportModal(false);
      setImportUrl('');
      const msg = `Imported: ${response.data.title}`;
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Success', msg);
      }
    } catch (error: any) {
      console.error('Error importing article:', error);
      const msg = error.response?.data?.error || 'Failed to import article';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteArticle = async (id: string) => {
    try {
      await axios.delete(`${API_URL}/api/reference-articles/${id}`);
      setArticles(articles.filter(a => a.id !== id));
    } catch (error) {
      console.error('Error deleting article:', error);
    }
  };

  const fetchPodcastTopics = async () => {
    setLoadingPodcast(true);
    try {
      const response = await axios.get(`${API_URL}/api/podcast/topics`);
      setPodcastTopics(response.data);
    } catch (error) {
      console.error('Error fetching podcast topics:', error);
    } finally {
      setLoadingPodcast(false);
    }
  };

  const handlePodcastSearch = async (query: string) => {
    setPodcastSearch(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const response = await axios.get(`${API_URL}/api/podcast/search?q=${encodeURIComponent(query)}`);
      setSearchResults(response.data);
    } catch (error) {
      console.error('Error searching podcast:', error);
    } finally {
      setSearching(false);
    }
  };

  const openPodcastEpisode = (url: string) => {
    Linking.openURL(url);
  };

  const toggleEpisode = (episodeNumber: number) => {
    setExpandedEpisodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(episodeNumber)) {
        newSet.delete(episodeNumber);
      } else {
        newSet.add(episodeNumber);
      }
      return newSet;
    });
  };

  const handleSyncPodcast = async () => {
    setSyncing(true);
    try {
      const response = await axios.post(`${API_URL}/api/podcast/sync`);
      const { newEpisodes, totalEpisodes, totalTopics } = response.data;
      fetchPodcastTopics();
      const msg = newEpisodes > 0 
        ? `Added ${newEpisodes} new episodes! Total: ${totalEpisodes} episodes, ${totalTopics} topics`
        : `Already up to date: ${totalEpisodes} episodes, ${totalTopics} topics`;
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Sync Complete', msg);
      }
    } catch (error: any) {
      console.error('Error syncing podcast:', error);
      const msg = error.response?.data?.error || 'Failed to sync podcast data';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setSyncing(false);
    }
  };

  const startFlowchart = (flowchart: Flowchart) => {
    setSelectedFlowchart(flowchart);
    setCurrentNode(flowchart.startNode);
  };

  const handleAnswer = (answer: 'yes' | 'no') => {
    if (!selectedFlowchart) return;
    const node = selectedFlowchart.nodes[currentNode];
    if (answer === 'yes' && node.yesNext) {
      setCurrentNode(node.yesNext);
    } else if (answer === 'no' && node.noNext) {
      setCurrentNode(node.noNext);
    }
  };

  const resetFlowchart = () => {
    setSelectedFlowchart(null);
    setCurrentNode('');
  };

  const calculateFilterRC = () => {
    const c = parseFloat(filterCapValue);
    const r = parseFloat(filterResValue);
    if (isNaN(c) || isNaN(r) || c <= 0 || r <= 0) return null;
    const tau = (r * c) / 1000;
    const cutoff = 1 / (2 * Math.PI * r * (c / 1000000));
    return { tau: tau.toFixed(2), cutoff: cutoff.toFixed(2) };
  };

  const calculateBypassCap = () => {
    const r = parseFloat(cathodeResValue);
    if (isNaN(r) || r <= 0) return null;
    const cap25hz = 1000000 / (2 * Math.PI * r * 25);
    const cap100hz = 1000000 / (2 * Math.PI * r * 100);
    return { 
      full: cap25hz.toFixed(1),
      partial: cap100hz.toFixed(1),
    };
  };

  const calculatePlateDissipation = () => {
    const vPlate = parseFloat(plateVoltage);
    const iPlate = parseFloat(plateCurrent);
    const iScreen = parseFloat(screenCurrent) || 0;
    if (isNaN(vPlate) || isNaN(iPlate) || vPlate <= 0 || iPlate <= 0) return null;
    const platePower = (vPlate * iPlate) / 1000;
    const totalPower = (vPlate * (iPlate + iScreen)) / 1000;
    return {
      plate: platePower.toFixed(1),
      total: totalPower.toFixed(1),
    };
  };

  const calculateCathodeRes = () => {
    const i = parseFloat(cathodeCurrent);
    if (isNaN(i) || i <= 0) return null;
    const results = [
      { bias: 10, r: (10 / i * 1000).toFixed(0) },
      { bias: 15, r: (15 / i * 1000).toFixed(0) },
      { bias: 20, r: (20 / i * 1000).toFixed(0) },
    ];
    return results;
  };

  const renderFlowcharts = () => {
    if (selectedFlowchart) {
      const node = selectedFlowchart.nodes[currentNode];
      return (
        <View style={styles.flowchartActive}>
          <TouchableOpacity style={styles.backButton} onPress={resetFlowchart}>
            <Ionicons name="arrow-back" size={24} color="#f59e0b" />
            <Text style={styles.backButtonText}>Back to Flowcharts</Text>
          </TouchableOpacity>
          
          <Text style={styles.flowchartTitle}>{selectedFlowchart.name}</Text>
          <Text style={styles.flowchartSymptom}>{selectedFlowchart.symptom}</Text>
          
          <View style={styles.nodeCard}>
            {node.result ? (
              <>
                <View style={styles.resultHeader}>
                  <Ionicons name="checkmark-circle" size={28} color="#22c55e" />
                  <Text style={styles.resultLabel}>Diagnosis</Text>
                </View>
                <Text style={styles.resultText}>{node.result}</Text>
                {node.tip && (
                  <View style={styles.tipBox}>
                    <Ionicons name="bulb" size={18} color="#f59e0b" />
                    <Text style={styles.tipText}>{node.tip}</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.restartButton} onPress={() => setCurrentNode(selectedFlowchart.startNode)}>
                  <Ionicons name="refresh" size={20} color="#1f2937" />
                  <Text style={styles.restartButtonText}>Start Over</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.questionText}>{node.question}</Text>
                <View style={styles.answerButtons}>
                  <TouchableOpacity 
                    style={[styles.answerButton, styles.yesButton]} 
                    onPress={() => handleAnswer('yes')}
                  >
                    <Text style={styles.answerButtonText}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.answerButton, styles.noButton]} 
                    onPress={() => handleAnswer('no')}
                  >
                    <Text style={styles.answerButtonText}>No</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.flowchartList}>
        <Text style={styles.sectionTitle}>Troubleshooting Flowcharts</Text>
        <Text style={styles.sectionSubtitle}>Select a symptom to start diagnosis</Text>
        {FLOWCHARTS.map((fc) => (
          <TouchableOpacity 
            key={fc.id} 
            style={styles.flowchartItem}
            onPress={() => startFlowchart(fc)}
          >
            <View style={styles.flowchartIcon}>
              <Ionicons name="git-branch" size={24} color="#f59e0b" />
            </View>
            <View style={styles.flowchartInfo}>
              <Text style={styles.flowchartName}>{fc.name}</Text>
              <Text style={styles.flowchartDesc}>{fc.symptom}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#6b7280" />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderVoltages = () => (
    <View style={styles.voltageList}>
      <Text style={styles.sectionTitle}>Voltage Reference Cards</Text>
      <Text style={styles.sectionSubtitle}>Expected voltages by circuit family</Text>
      {VOLTAGE_CARDS.map((card) => (
        <View key={card.id} style={styles.voltageCard}>
          <TouchableOpacity 
            style={styles.voltageHeader}
            onPress={() => setExpandedCard(expandedCard === card.id ? null : card.id)}
          >
            <View>
              <Text style={styles.voltageName}>{card.name}</Text>
              <Text style={styles.voltageFamily}>{card.circuitFamily}</Text>
              <Text style={styles.voltageDesc}>{card.description}</Text>
            </View>
            <Ionicons 
              name={expandedCard === card.id ? 'chevron-up' : 'chevron-down'} 
              size={24} 
              color="#6b7280" 
            />
          </TouchableOpacity>
          {expandedCard === card.id && (
            <View style={styles.voltageTable}>
              {card.voltages.map((v, idx) => (
                <View key={idx} style={styles.voltageRow}>
                  <Text style={styles.voltageNode}>{v.node}</Text>
                  <Text style={styles.voltageValue}>{v.expected}</Text>
                  {v.notes && <Text style={styles.voltageNotes}>{v.notes}</Text>}
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );

  const renderCalculator = () => (
    <ScrollView style={styles.calculatorContainer}>
      <Text style={styles.sectionTitle}>Component Calculator</Text>
      <Text style={styles.sectionSubtitle}>Common amp calculations</Text>
      
      <View style={styles.calcCard}>
        <Text style={styles.calcTitle}>Filter RC Time Constant</Text>
        <Text style={styles.calcDesc}>Calculate ripple filter effectiveness</Text>
        <View style={styles.calcInputRow}>
          <View style={styles.calcInputGroup}>
            <Text style={styles.calcLabel}>Capacitance (uF)</Text>
            <TextInput
              style={styles.calcInput}
              value={filterCapValue}
              onChangeText={setFilterCapValue}
              keyboardType="numeric"
              placeholder="e.g. 47"
              placeholderTextColor="#6b7280"
            />
          </View>
          <View style={styles.calcInputGroup}>
            <Text style={styles.calcLabel}>Resistance (ohms)</Text>
            <TextInput
              style={styles.calcInput}
              value={filterResValue}
              onChangeText={setFilterResValue}
              keyboardType="numeric"
              placeholder="e.g. 1000"
              placeholderTextColor="#6b7280"
            />
          </View>
        </View>
        {calculateFilterRC() && (
          <View style={styles.calcResult}>
            <Text style={styles.calcResultText}>
              Time Constant: <Text style={styles.calcResultValue}>{calculateFilterRC()?.tau} ms</Text>
            </Text>
            <Text style={styles.calcResultText}>
              -3dB Cutoff: <Text style={styles.calcResultValue}>{calculateFilterRC()?.cutoff} Hz</Text>
            </Text>
          </View>
        )}
      </View>

      <View style={styles.calcCard}>
        <Text style={styles.calcTitle}>Cathode Bypass Capacitor</Text>
        <Text style={styles.calcDesc}>Size bypass cap for cathode resistor</Text>
        <View style={styles.calcInputGroup}>
          <Text style={styles.calcLabel}>Cathode Resistor (ohms)</Text>
          <TextInput
            style={styles.calcInput}
            value={cathodeResValue}
            onChangeText={setCathodeResValue}
            keyboardType="numeric"
            placeholder="e.g. 1500"
            placeholderTextColor="#6b7280"
          />
        </View>
        {calculateBypassCap() && (
          <View style={styles.calcResult}>
            <Text style={styles.calcResultText}>
              Full bypass (25Hz): <Text style={styles.calcResultValue}>{calculateBypassCap()?.full} uF</Text>
            </Text>
            <Text style={styles.calcResultText}>
              Partial bypass (100Hz): <Text style={styles.calcResultValue}>{calculateBypassCap()?.partial} uF</Text>
            </Text>
          </View>
        )}
      </View>

      <View style={styles.calcCard}>
        <Text style={styles.calcTitle}>Plate Dissipation</Text>
        <Text style={styles.calcDesc}>Calculate tube power dissipation</Text>
        <View style={styles.calcInputRow}>
          <View style={styles.calcInputGroup}>
            <Text style={styles.calcLabel}>Plate Voltage (V)</Text>
            <TextInput
              style={styles.calcInput}
              value={plateVoltage}
              onChangeText={setPlateVoltage}
              keyboardType="numeric"
              placeholder="e.g. 400"
              placeholderTextColor="#6b7280"
            />
          </View>
          <View style={styles.calcInputGroup}>
            <Text style={styles.calcLabel}>Plate Current (mA)</Text>
            <TextInput
              style={styles.calcInput}
              value={plateCurrent}
              onChangeText={setPlateCurrent}
              keyboardType="numeric"
              placeholder="e.g. 35"
              placeholderTextColor="#6b7280"
            />
          </View>
        </View>
        <View style={styles.calcInputGroup}>
          <Text style={styles.calcLabel}>Screen Current (mA, optional)</Text>
          <TextInput
            style={styles.calcInput}
            value={screenCurrent}
            onChangeText={setScreenCurrent}
            keyboardType="numeric"
            placeholder="e.g. 5"
            placeholderTextColor="#6b7280"
          />
        </View>
        {calculatePlateDissipation() && (
          <View style={styles.calcResult}>
            <Text style={styles.calcResultText}>
              Plate Dissipation: <Text style={styles.calcResultValue}>{calculatePlateDissipation()?.plate} W</Text>
            </Text>
            <Text style={styles.calcResultText}>
              Total (with screen): <Text style={styles.calcResultValue}>{calculatePlateDissipation()?.total} W</Text>
            </Text>
          </View>
        )}
      </View>

      <View style={styles.calcCard}>
        <Text style={styles.calcTitle}>Cathode Bias Resistor</Text>
        <Text style={styles.calcDesc}>Calculate resistor for desired bias voltage</Text>
        <View style={styles.calcInputGroup}>
          <Text style={styles.calcLabel}>Total Cathode Current (mA)</Text>
          <TextInput
            style={styles.calcInput}
            value={cathodeCurrent}
            onChangeText={setCathodeCurrent}
            keyboardType="numeric"
            placeholder="e.g. 40"
            placeholderTextColor="#6b7280"
          />
        </View>
        {calculateCathodeRes() && (
          <View style={styles.calcResult}>
            {calculateCathodeRes()?.map((item, idx) => (
              <Text key={idx} style={styles.calcResultText}>
                For {item.bias}V bias: <Text style={styles.calcResultValue}>{item.r} ohms</Text>
              </Text>
            ))}
          </View>
        )}
      </View>
      
      <View style={{ height: 40 }} />
    </ScrollView>
  );

  const renderArticles = () => (
    <ScrollView style={styles.articlesContainer}>
      <View style={styles.articlesHeader}>
        <View>
          <Text style={styles.sectionTitle}>Reference Articles</Text>
          <Text style={styles.sectionSubtitle}>Imported from robrobinette.com</Text>
        </View>
        <TouchableOpacity
          style={styles.importButton}
          onPress={() => setShowImportModal(true)}
        >
          <Ionicons name="add" size={20} color="#1f2937" />
          <Text style={styles.importButtonText}>Import</Text>
        </TouchableOpacity>
      </View>

      {loadingArticles ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>Loading articles...</Text>
        </View>
      ) : articles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color="#374151" />
          <Text style={styles.emptyTitle}>No Articles Yet</Text>
          <Text style={styles.emptySubtitle}>
            Import technical articles from robrobinette.com
          </Text>
          <TouchableOpacity
            style={styles.emptyImportButton}
            onPress={() => setShowImportModal(true)}
          >
            <Ionicons name="cloud-download-outline" size={20} color="#f59e0b" />
            <Text style={styles.emptyImportText}>Import Your First Article</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.articlesList}>
          {articles.map((article) => (
            <TouchableOpacity
              key={article.id}
              style={styles.articleCard}
              onPress={() => router.push(`/article/${article.id}` as any)}
            >
              <View style={styles.articleContent}>
                <Text style={styles.articleTitle} numberOfLines={2}>
                  {article.title}
                </Text>
                <View style={styles.articleMeta}>
                  {article.circuitFamily && (
                    <View style={styles.circuitBadge}>
                      <Text style={styles.circuitBadgeText}>{article.circuitFamily}</Text>
                    </View>
                  )}
                  <Text style={styles.articleSource}>
                    via {article.sourceName}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteArticle(article.id)}
              >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.creditSection}>
        <TouchableOpacity
          onPress={() => Linking.openURL('https://robrobinette.com')}
        >
          <Text style={styles.creditText}>
            Content sourced from{' '}
            <Text style={styles.creditLink}>robrobinette.com</Text>
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  const renderTavaTab = () => {
    const topicsToShow = podcastSearch.trim() ? searchResults : podcastTopics;
    const groupedByEpisode = topicsToShow.reduce((acc, topic) => {
      const epKey = `${topic.episodeNumber}-${topic.episodeTitle}`;
      if (!acc[epKey]) {
        acc[epKey] = {
          episodeNumber: topic.episodeNumber,
          episodeTitle: topic.episodeTitle,
          episodeUrl: topic.episodeUrl,
          topics: [],
        };
      }
      acc[epKey].topics.push(topic);
      return acc;
    }, {} as Record<string, { episodeNumber: number; episodeTitle: string; episodeUrl: string; topics: PodcastTopic[] }>);

    const episodes = Object.values(groupedByEpisode).sort((a, b) => a.episodeNumber - b.episodeNumber);

    const isSearching = podcastSearch.trim().length > 0;

    return (
      <ScrollView style={styles.tavaContainer}>
        <View style={styles.tavaHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>TAVA Podcast Index</Text>
            <Text style={styles.sectionSubtitle}>The Truth About Vintage Amps</Text>
          </View>
          <TouchableOpacity
            style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
            onPress={handleSyncPodcast}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator size="small" color="#1f2937" />
            ) : (
              <Ionicons name="refresh" size={18} color="#1f2937" />
            )}
            <Text style={styles.syncButtonText}>
              {syncing ? 'Syncing...' : 'Check Updates'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.podcastSearchContainer}>
          <Ionicons name="search" size={20} color="#9ca3af" />
          <TextInput
            style={styles.podcastSearchInput}
            placeholder="Search topics..."
            placeholderTextColor="#6b7280"
            value={podcastSearch}
            onChangeText={handlePodcastSearch}
          />
          {searching && <ActivityIndicator size="small" color="#f59e0b" />}
          {podcastSearch.length > 0 && (
            <TouchableOpacity onPress={() => { setPodcastSearch(''); setSearchResults([]); }}>
              <Ionicons name="close-circle" size={20} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>

        {loadingPodcast ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text style={styles.loadingText}>Loading podcast topics...</Text>
          </View>
        ) : episodes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="mic-outline" size={64} color="#374151" />
            <Text style={styles.emptyTitle}>
              {podcastSearch.trim() ? 'No Results' : 'No Episodes Yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {podcastSearch.trim() 
                ? `No topics match "${podcastSearch}"` 
                : 'Tap "Check Updates" to sync episodes'
              }
            </Text>
          </View>
        ) : (
          <View style={styles.episodesList}>
            {episodes.map((ep) => {
              const isExpanded = isSearching || expandedEpisodes.has(ep.episodeNumber);
              return (
                <View key={`ep-${ep.episodeNumber}`} style={styles.episodeCard}>
                  <TouchableOpacity 
                    style={styles.episodeHeader}
                    onPress={() => toggleEpisode(ep.episodeNumber)}
                  >
                    <View style={styles.episodeNumberBadge}>
                      <Text style={styles.episodeNumberText}>#{ep.episodeNumber}</Text>
                    </View>
                    <Text style={styles.episodeTitleText} numberOfLines={2}>
                      {ep.episodeTitle}
                    </Text>
                    <View style={styles.episodeHeaderIcons}>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          openPodcastEpisode(ep.episodeUrl);
                        }}
                        style={styles.openLinkButton}
                      >
                        <Ionicons name="open-outline" size={16} color="#9ca3af" />
                      </TouchableOpacity>
                      <Ionicons 
                        name={isExpanded ? "chevron-up" : "chevron-down"} 
                        size={20} 
                        color="#9ca3af" 
                      />
                    </View>
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={styles.topicsList}>
                      {ep.topics.map((topic) => (
                        <View key={topic.id} style={styles.topicItem}>
                          {topic.timestamp && (
                            <Text style={styles.topicTimestamp}>{topic.timestamp}</Text>
                          )}
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
          <TouchableOpacity
            onPress={() => Linking.openURL('https://fretboardjournal.com/the-truth-about-vintage-amps-podcast/')}
          >
            <Text style={styles.creditText}>
              Podcast from{' '}
              <Text style={styles.creditLink}>The Fretboard Journal</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'flowcharts' && styles.activeTab]}
          onPress={() => setActiveTab('flowcharts')}
        >
          <Ionicons 
            name="git-branch" 
            size={20} 
            color={activeTab === 'flowcharts' ? '#f59e0b' : '#9ca3af'} 
          />
          <Text style={[styles.tabText, activeTab === 'flowcharts' && styles.activeTabText]}>
            Flowcharts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'voltages' && styles.activeTab]}
          onPress={() => setActiveTab('voltages')}
        >
          <Ionicons 
            name="flash" 
            size={20} 
            color={activeTab === 'voltages' ? '#f59e0b' : '#9ca3af'} 
          />
          <Text style={[styles.tabText, activeTab === 'voltages' && styles.activeTabText]}>
            Voltages
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'calculator' && styles.activeTab]}
          onPress={() => setActiveTab('calculator')}
        >
          <Ionicons 
            name="calculator" 
            size={20} 
            color={activeTab === 'calculator' ? '#f59e0b' : '#9ca3af'} 
          />
          <Text style={[styles.tabText, activeTab === 'calculator' && styles.activeTabText]}>
            Calc
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'articles' && styles.activeTab]}
          onPress={() => setActiveTab('articles')}
        >
          <Ionicons 
            name="document-text" 
            size={20} 
            color={activeTab === 'articles' ? '#f59e0b' : '#9ca3af'} 
          />
          <Text style={[styles.tabText, activeTab === 'articles' && styles.activeTabText]}>
            Articles
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tava' && styles.activeTab]}
          onPress={() => setActiveTab('tava')}
        >
          <Ionicons 
            name="mic" 
            size={20} 
            color={activeTab === 'tava' ? '#f59e0b' : '#9ca3af'} 
          />
          <Text style={[styles.tabText, activeTab === 'tava' && styles.activeTabText]}>
            TAVA
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeTab === 'flowcharts' && <ScrollView>{renderFlowcharts()}</ScrollView>}
        {activeTab === 'voltages' && <ScrollView>{renderVoltages()}</ScrollView>}
        {activeTab === 'calculator' && renderCalculator()}
        {activeTab === 'articles' && renderArticles()}
        {activeTab === 'tava' && renderTavaTab()}
      </View>

      <Modal
        visible={showImportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Import Article</Text>
              <TouchableOpacity onPress={() => setShowImportModal(false)}>
                <Ionicons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Paste URL from robrobinette.com</Text>
            <TextInput
              style={styles.modalInput}
              value={importUrl}
              onChangeText={setImportUrl}
              placeholder="https://robrobinette.com/..."
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.modalHint}>
              Example: https://robrobinette.com/How_The_AB763_Deluxe_Reverb_Works.htm
            </Text>

            <TouchableOpacity
              style={[styles.modalButton, importing && styles.modalButtonDisabled]}
              onPress={handleImportArticle}
              disabled={importing || !importUrl.trim()}
            >
              {importing ? (
                <ActivityIndicator size="small" color="#1f2937" />
              ) : (
                <>
                  <Ionicons name="cloud-download" size={20} color="#1f2937" />
                  <Text style={styles.modalButtonText}>Import Article</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#f59e0b',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  activeTabText: {
    color: '#f59e0b',
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f59e0b',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 20,
  },
  flowchartList: {
    padding: 16,
  },
  flowchartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  flowchartIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  flowchartInfo: {
    flex: 1,
  },
  flowchartName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 4,
  },
  flowchartDesc: {
    fontSize: 14,
    color: '#9ca3af',
  },
  flowchartActive: {
    padding: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#f59e0b',
    marginLeft: 8,
  },
  flowchartTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e5e7eb',
    marginBottom: 4,
  },
  flowchartSymptom: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 24,
  },
  nodeCard: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 24,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 24,
    lineHeight: 28,
  },
  answerButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  answerButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  yesButton: {
    backgroundColor: '#22c55e',
  },
  noButton: {
    backgroundColor: '#ef4444',
  },
  answerButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  resultLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#22c55e',
  },
  resultText: {
    fontSize: 18,
    color: '#e5e7eb',
    lineHeight: 26,
    marginBottom: 16,
  },
  tipBox: {
    flexDirection: 'row',
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginBottom: 20,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#fbbf24',
    lineHeight: 20,
  },
  restartButton: {
    flexDirection: 'row',
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  restartButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  voltageList: {
    padding: 16,
  },
  voltageCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  voltageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
  },
  voltageName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 2,
  },
  voltageFamily: {
    fontSize: 14,
    color: '#f59e0b',
    marginBottom: 4,
  },
  voltageDesc: {
    fontSize: 13,
    color: '#9ca3af',
  },
  voltageTable: {
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  voltageRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  voltageNode: {
    flex: 1,
    fontSize: 14,
    color: '#e5e7eb',
  },
  voltageValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
    minWidth: 100,
    textAlign: 'right',
  },
  voltageNotes: {
    width: '100%',
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  calculatorContainer: {
    padding: 16,
  },
  calcCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  calcTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 4,
  },
  calcDesc: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 16,
  },
  calcInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  calcInputGroup: {
    flex: 1,
    marginBottom: 12,
  },
  calcLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 6,
  },
  calcInput: {
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e5e7eb',
    fontSize: 16,
  },
  calcResult: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  calcResultText: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 4,
  },
  calcResultValue: {
    color: '#22c55e',
    fontWeight: '600',
  },
  articlesContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  articlesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  importButtonText: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#9ca3af',
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    color: '#e5e7eb',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyImportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  emptyImportText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
  },
  articlesList: {
    gap: 12,
  },
  articleCard: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  articleContent: {
    flex: 1,
  },
  articleTitle: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  articleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  circuitBadge: {
    backgroundColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  circuitBadgeText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '600',
  },
  articleSource: {
    color: '#6b7280',
    fontSize: 12,
  },
  deleteButton: {
    padding: 8,
  },
  creditSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  creditText: {
    color: '#6b7280',
    fontSize: 12,
  },
  creditLink: {
    color: '#f59e0b',
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#f59e0b',
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalLabel: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  modalHint: {
    color: '#6b7280',
    fontSize: 12,
    marginBottom: 20,
  },
  modalButton: {
    flexDirection: 'row',
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalButtonText: {
    color: '#1f2937',
    fontSize: 16,
    fontWeight: '600',
  },
  tavaContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  tavaHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  syncButtonDisabled: {
    opacity: 0.7,
  },
  syncButtonText: {
    color: '#1f2937',
    fontSize: 13,
    fontWeight: '600',
  },
  podcastSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 10,
  },
  podcastSearchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  episodesList: {
    gap: 16,
  },
  episodeCard: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    overflow: 'hidden',
  },
  episodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#374151',
    gap: 12,
  },
  episodeNumberBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  episodeNumberText: {
    color: '#1f2937',
    fontSize: 12,
    fontWeight: 'bold',
  },
  episodeTitleText: {
    flex: 1,
    color: '#e5e7eb',
    fontSize: 15,
    fontWeight: '600',
  },
  episodeHeaderIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  openLinkButton: {
    padding: 4,
  },
  topicsList: {
    padding: 12,
    gap: 8,
  },
  topicItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  topicTimestamp: {
    color: '#f59e0b',
    fontSize: 12,
    fontFamily: 'monospace',
    minWidth: 50,
  },
  topicText: {
    flex: 1,
    color: '#d1d5db',
    fontSize: 14,
  },
});
