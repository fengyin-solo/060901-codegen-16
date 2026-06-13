import { ref } from 'vue'
import type { Room, MatchPair, MatchRound, MatchResult } from '@/types'
import { getRoomById, saveRoom } from '@/utils/storage'

export function useMatchGame() {
  const submitting = ref(false)
  const showingResult = ref(false)
  const tempAnswer1 = ref('')
  const tempAnswer2 = ref('')
  const revealStep = ref(0)

  const getCurrentPair = (room: Room): MatchPair | undefined => {
    if (!room.matchData) return undefined
    return room.matchData.pairs[room.matchData.currentPairIndex]
  }

  const getPairRounds = (room: Room, pairId: string): MatchRound[] => {
    if (!room.matchData) return []
    return room.matchData.rounds.filter(r => r.pairId === pairId)
  }

  const getCurrentRound = (room: Room): MatchRound | undefined => {
    if (!room.matchData) return undefined
    const pair = getCurrentPair(room)
    if (!pair) return undefined
    const pairRounds = getPairRounds(room, pair.id)
    return pairRounds[room.matchData.currentRoundIndex]
  }

  const getPairResult = (room: Room, pairId: string): MatchResult | undefined => {
    if (!room.matchData) return undefined
    return room.matchData.results.find(r => r.pairId === pairId)
  }

  const getAnsweredRoundsForPair = (room: Room, pairId: string): MatchRound[] => {
    return getPairRounds(room, pairId).filter(r => r.answeredAt !== null)
  }

  const calcProgress = (room: Room): { answered: number; total: number; percentage: number } => {
    if (!room.matchData) return { answered: 0, total: 0, percentage: 0 }
    const answered = room.matchData.rounds.filter(r => r.answeredAt !== null).length
    const total = room.matchData.rounds.length
    return {
      answered,
      total,
      percentage: total > 0 ? Math.round((answered / total) * 100) : 0
    }
  }

  const calcPairProgress = (room: Room, pairId: string): { answered: number; total: number; percentage: number } => {
    const pairRounds = getPairRounds(room, pairId)
    const answered = pairRounds.filter(r => r.answeredAt !== null).length
    const total = pairRounds.length
    return {
      answered,
      total,
      percentage: total > 0 ? Math.round((answered / total) * 100) : 0
    }
  }

  const isAllPairsFinished = (room: Room): boolean => {
    if (!room.matchData) return false
    return room.matchData.rounds.every(r => r.answeredAt !== null)
  }

  const submitAnswers = (roomId: string): MatchRound | null => {
    const room = getRoomById(roomId)
    if (!room || !room.matchData) return null
    if (!tempAnswer1.value.trim() || !tempAnswer2.value.trim()) return null

    submitting.value = true

    const round = getCurrentRound(room)
    if (!round) {
      submitting.value = false
      return null
    }

    const roundInData = room.matchData.rounds.find(r => r.id === round.id)
    if (!roundInData) {
      submitting.value = false
      return null
    }

    roundInData.answer1 = tempAnswer1.value.trim()
    roundInData.answer2 = tempAnswer2.value.trim()
    roundInData.answeredAt = new Date().toISOString()

    saveRoom(room)
    submitting.value = false

    return roundInData
  }

  const judgeMatch = (roomId: string, isMatch: boolean): boolean => {
    const room = getRoomById(roomId)
    if (!room || !room.matchData) return false

    const round = getCurrentRound(room)
    if (!round) return false

    const roundInData = room.matchData.rounds.find(r => r.id === round.id)
    if (!roundInData) return false

    roundInData.isMatch = isMatch

    if (isMatch) {
      const result = room.matchData.results.find(r => r.pairId === roundInData.pairId)
      if (result) {
        result.matchedRounds++
        result.matchRate = Math.round((result.matchedRounds / result.totalRounds) * 100)
      }
    }

    saveRoom(room)
    return true
  }

  const goToNextRound = (roomId: string): { nextPair: MatchPair | null; nextRound: MatchRound | null; isGameEnd: boolean } => {
    const room = getRoomById(roomId)
    if (!room || !room.matchData) return { nextPair: null, nextRound: null, isGameEnd: true }

    const currentPair = room.matchData.pairs[room.matchData.currentPairIndex]
    const pairRounds = getPairRounds(room, currentPair.id)
    const nextRoundIndex = room.matchData.currentRoundIndex + 1

    if (nextRoundIndex < pairRounds.length) {
      room.matchData.currentRoundIndex = nextRoundIndex
      saveRoom(room)
      return {
        nextPair: currentPair,
        nextRound: pairRounds[nextRoundIndex],
        isGameEnd: false
      }
    } else {
      const nextPairIndex = room.matchData.currentPairIndex + 1
      if (nextPairIndex < room.matchData.pairs.length) {
        room.matchData.currentPairIndex = nextPairIndex
        room.matchData.currentRoundIndex = 0
        saveRoom(room)
        const nextPair = room.matchData.pairs[nextPairIndex]
        const nextPairRounds = getPairRounds(room, nextPair.id)
        return {
          nextPair,
          nextRound: nextPairRounds[0],
          isGameEnd: false
        }
      } else {
        return {
          nextPair: null,
          nextRound: null,
          isGameEnd: true
        }
      }
    }
  }

  const endMatchGame = (roomId: string): boolean => {
    const room = getRoomById(roomId)
    if (!room) return false

    room.status = 'ended'
    saveRoom(room)
    return true
  }

  const resetTempState = () => {
    tempAnswer1.value = ''
    tempAnswer2.value = ''
    showingResult.value = false
    revealStep.value = 0
  }

  const getMatchRankings = (room: Room): (MatchResult & { pair: MatchPair })[] => {
    if (!room.matchData) return []
    const rankings = room.matchData.results
      .map(r => ({
        ...r,
        pair: room.matchData!.pairs.find(p => p.id === r.pairId)!
      }))
      .sort((a, b) => b.matchRate - a.matchRate || b.matchedRounds - a.matchedRounds)
    return rankings
  }

  const getMemberSummary = (room: Room): Record<string, { name: string; totalMatches: number; totalRounds: number; avgRate: number }> => {
    if (!room.matchData) return {}
    const summary: Record<string, { name: string; totalMatches: number; totalRounds: number; avgRate: number }> = {}

    room.members.forEach(m => {
      summary[m.id] = {
        name: m.name,
        totalMatches: 0,
        totalRounds: 0,
        avgRate: 0
      }
    })

    room.matchData.results.forEach(result => {
      const pair = room.matchData!.pairs.find(p => p.id === result.pairId)
      if (!pair) return

      summary[pair.member1Id].totalMatches += result.matchedRounds
      summary[pair.member1Id].totalRounds += result.totalRounds
      summary[pair.member2Id].totalMatches += result.matchedRounds
      summary[pair.member2Id].totalRounds += result.totalRounds
    })

    Object.values(summary).forEach(s => {
      s.avgRate = s.totalRounds > 0 ? Math.round((s.totalMatches / s.totalRounds) * 100) : 0
    })

    return summary
  }

  return {
    submitting,
    showingResult,
    tempAnswer1,
    tempAnswer2,
    revealStep,
    getCurrentPair,
    getCurrentRound,
    getPairRounds,
    getPairResult,
    getAnsweredRoundsForPair,
    calcProgress,
    calcPairProgress,
    isAllPairsFinished,
    submitAnswers,
    judgeMatch,
    goToNextRound,
    endMatchGame,
    resetTempState,
    getMatchRankings,
    getMemberSummary,
  }
}
