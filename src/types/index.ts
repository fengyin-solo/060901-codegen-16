export type GameMode = 'normal' | 'match'

export interface Room {
  id: string
  name: string
  code: string
  createdAt: string
  expiresAt: string
  status: 'preparing' | 'playing' | 'ended'
  currentTurn: number
  members: Member[]
  topics: Topic[]
  shuffledTopics: string[]
  gameMode: GameMode
  matchData: MatchData | null
}

export interface MatchPair {
  id: string
  member1Id: string
  member2Id: string
  member1Name: string
  member2Name: string
}

export interface MatchRound {
  id: string
  pairId: string
  questionId: string
  questionContent: string
  answer1: string
  answer2: string
  isMatch: boolean | null
  answeredAt: string | null
}

export interface MatchResult {
  pairId: string
  totalRounds: number
  matchedRounds: number
  matchRate: number
}

export interface MatchData {
  pairs: MatchPair[]
  rounds: MatchRound[]
  currentPairIndex: number
  currentRoundIndex: number
  results: MatchResult[]
}

export interface Topic {
  id: string
  roomId: string
  content: string
  type: TopicType
  author: string
  isAnonymous: boolean
  isFlipped: boolean
  createdAt: string
  color: string
}

export interface Member {
  id: string
  roomId: string
  name: string
  avatar: string
  isHost: boolean
}

export type TopicType = 'trouble' | 'music' | 'gossip' | 'recommend' | 'deep' | 'silly' | 'match'

export interface TopicTemplate {
  type: TopicType
  name: string
  emoji: string
  description: string
  questions: string[]
}

export const TOPIC_COLORS: Record<TopicType, string> = {
  trouble: '#FF6B6B',
  music: '#FFD93D',
  gossip: '#FF85A2',
  recommend: '#6BCB77',
  deep: '#9D4EDD',
  silly: '#4ECDC4',
  match: '#F472B6'
}

export const TOPIC_EMOJIS: Record<TopicType, string> = {
  trouble: '😤',
  music: '🎵',
  gossip: '☕',
  recommend: '💡',
  deep: '🤔',
  silly: '🤪',
  match: '💞'
}

export const AVATAR_EMOJIS = [
  '😀', '😎', '🥳', '🤗', '😇', '🤩', '😜', '🤭',
  '🐱', '🐶', '🐼', '🦊', '🐨', '🐯', '🦁', '🐸'
]
