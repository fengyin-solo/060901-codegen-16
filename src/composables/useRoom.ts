import { ref, computed, onMounted } from 'vue'
import type { Room, Topic, Member, TopicType, GameMode, MatchPair, MatchRound, MatchResult } from '@/types'
import { TOPIC_COLORS } from '@/types'
import { 
  getRooms, getRoomById, getRoomByCode, saveRoom, deleteRoom 
} from '@/utils/storage'
import { 
  generateId, generateRoomCode, addDays, getRandomItem, shuffleArray 
} from '@/utils/helpers'
import { AVATAR_EMOJIS } from '@/types'
import { getRandomMatchQuestions } from '@/topics'

const ROUNDS_PER_PAIR = 5

export function useRoom() {
  const rooms = ref<Room[]>([])
  const currentRoom = ref<Room | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const loadRooms = () => {
    rooms.value = getRooms()
  }

  const createRoom = (name: string, hostName: string): Room => {
    const now = new Date()
    const expiresAt = addDays(now, 7)
    
    const room: Room = {
      id: generateId(),
      name,
      code: generateRoomCode(),
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'preparing',
      currentTurn: 0,
      members: [
        {
          id: generateId(),
          roomId: '',
          name: hostName,
          avatar: getRandomItem(AVATAR_EMOJIS),
          isHost: true
        }
      ],
      topics: [],
      shuffledTopics: [],
      gameMode: 'normal',
      matchData: null
    }
    
    room.members.forEach(m => m.roomId = room.id)
    saveRoom(room)
    loadRooms()
    return room
  }

  const joinRoomByCode = (code: string, memberName: string): Room | null => {
    const room = getRoomByCode(code.toUpperCase())
    if (!room) {
      error.value = '房间不存在'
      return null
    }
    
    const existingMember = room.members.find(m => m.name === memberName)
    if (existingMember) {
      currentRoom.value = room
      return room
    }
    
    const newMember: Member = {
      id: generateId(),
      roomId: room.id,
      name: memberName,
      avatar: getRandomItem(AVATAR_EMOJIS),
      isHost: false
    }
    
    room.members.push(newMember)
    saveRoom(room)
    loadRooms()
    currentRoom.value = room
    return room
  }

  const loadRoom = (id: string): boolean => {
    const room = getRoomById(id)
    if (room) {
      currentRoom.value = room
      return true
    }
    error.value = '房间不存在'
    return false
  }

  const addTopic = (
    roomId: string, 
    content: string, 
    type: TopicType, 
    author: string,
    isAnonymous: boolean = false
  ): Topic | null => {
    const room = getRoomById(roomId)
    if (!room) return null

    const topic: Topic = {
      id: generateId(),
      roomId,
      content,
      type,
      author,
      isAnonymous,
      isFlipped: false,
      createdAt: new Date().toISOString(),
      color: TOPIC_COLORS[type]
    }

    room.topics.push(topic)
    saveRoom(room)
    
    if (currentRoom.value?.id === roomId) {
      currentRoom.value = room
    }
    loadRooms()
    
    return topic
  }

  const removeTopic = (roomId: string, topicId: string): boolean => {
    const room = getRoomById(roomId)
    if (!room) return false

    room.topics = room.topics.filter(t => t.id !== topicId)
    saveRoom(room)
    
    if (currentRoom.value?.id === roomId) {
      currentRoom.value = room
    }
    loadRooms()
    
    return true
  }

  const startGame = (roomId: string): boolean => {
    const room = getRoomById(roomId)
    if (!room || room.topics.length < 1) {
      error.value = '至少需要1个话题才能开始'
      return false
    }

    room.status = 'playing'
    room.currentTurn = 0
    room.shuffledTopics = shuffleArray(room.topics.map(t => t.id))
    saveRoom(room)
    
    if (currentRoom.value?.id === roomId) {
      currentRoom.value = room
    }
    loadRooms()
    
    return true
  }

  const endGame = (roomId: string): boolean => {
    const room = getRoomById(roomId)
    if (!room) return false

    room.status = 'ended'
    saveRoom(room)
    
    if (currentRoom.value?.id === roomId) {
      currentRoom.value = room
    }
    loadRooms()
    
    return true
  }

  const resetGame = (roomId: string): boolean => {
    const room = getRoomById(roomId)
    if (!room) return false

    room.status = 'preparing'
    room.currentTurn = 0
    room.shuffledTopics = []
    room.matchData = null
    room.topics.forEach(t => t.isFlipped = false)
    saveRoom(room)
    
    if (currentRoom.value?.id === roomId) {
      currentRoom.value = room
    }
    loadRooms()
    
    return true
  }

  const setGameMode = (roomId: string, mode: GameMode): boolean => {
    const room = getRoomById(roomId)
    if (!room || room.status !== 'preparing') return false

    room.gameMode = mode
    if (mode === 'normal') {
      room.matchData = null
    }
    saveRoom(room)
    
    if (currentRoom.value?.id === roomId) {
      currentRoom.value = room
    }
    loadRooms()
    
    return true
  }

  const generateMatchPairs = (members: Member[]): MatchPair[] => {
    const pairs: MatchPair[] = []
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        pairs.push({
          id: generateId(),
          member1Id: members[i].id,
          member2Id: members[j].id,
          member1Name: members[i].name,
          member2Name: members[j].name
        })
      }
    }
    return shuffleArray(pairs)
  }

  const generateMatchRounds = (pairs: MatchPair[]): MatchRound[] => {
    const rounds: MatchRound[] = []
    const totalQuestions = pairs.length * ROUNDS_PER_PAIR
    const questions = getRandomMatchQuestions(totalQuestions)
    
    let qIndex = 0
    pairs.forEach(pair => {
      for (let r = 0; r < ROUNDS_PER_PAIR; r++) {
        rounds.push({
          id: generateId(),
          pairId: pair.id,
          questionId: `q-${qIndex}`,
          questionContent: questions[qIndex % questions.length],
          answer1: '',
          answer2: '',
          isMatch: null,
          answeredAt: null
        })
        qIndex++
      }
    })
    return rounds
  }

  const startMatchGame = (roomId: string): boolean => {
    const room = getRoomById(roomId)
    if (!room || room.members.length < 2) {
      error.value = '默契局至少需要2位成员'
      return false
    }

    const pairs = generateMatchPairs(room.members)
    const rounds = generateMatchRounds(pairs)
    const results: MatchResult[] = pairs.map(p => ({
      pairId: p.id,
      totalRounds: ROUNDS_PER_PAIR,
      matchedRounds: 0,
      matchRate: 0
    }))

    room.status = 'playing'
    room.gameMode = 'match'
    room.matchData = {
      pairs,
      rounds,
      currentPairIndex: 0,
      currentRoundIndex: 0,
      results
    }
    saveRoom(room)
    
    if (currentRoom.value?.id === roomId) {
      currentRoom.value = room
    }
    loadRooms()
    
    return true
  }

  const removeRoom = (id: string): boolean => {
    deleteRoom(id)
    loadRooms()
    if (currentRoom.value?.id === id) {
      currentRoom.value = null
    }
    return true
  }

  const activeRooms = computed(() => 
    rooms.value.filter(r => r.status !== 'ended')
  )

  onMounted(() => {
    loadRooms()
  })

  return {
    rooms,
    currentRoom,
    loading,
    error,
    activeRooms,
    loadRooms,
    createRoom,
    joinRoomByCode,
    loadRoom,
    addTopic,
    removeTopic,
    startGame,
    endGame,
    resetGame,
    removeRoom,
    setGameMode,
    startMatchGame,
    generateMatchPairs,
  }
}
