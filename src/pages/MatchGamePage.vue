<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoom } from '@/composables/useRoom'
import { useExpire } from '@/composables/useExpire'
import { useMatchGame } from '@/composables/useMatchGame'
import MemberAvatar from '@/components/MemberAvatar.vue'
import type { MatchRound, MatchPair } from '@/types'

const route = useRoute()
const router = useRouter()
const { loadRooms, loadRoom, currentRoom, resetGame } = useRoom()
const { isRoomExpired } = useExpire()
const {
  showingResult,
  tempAnswer1,
  tempAnswer2,
  revealStep,
  getCurrentPair,
  getCurrentRound,
  getPairResult,
  calcProgress,
  calcPairProgress,
  submitAnswers,
  judgeMatch,
  goToNextRound,
  endMatchGame,
  resetTempState,
  getMatchRankings,
} = useMatchGame()

const roomId = computed(() => route.params.id as string)
const showEndConfirm = ref(false)
const showResetConfirm = ref(false)
const submittingAnswers = ref(false)
const phase = ref<'answer' | 'reveal' | 'judge' | 'result'>('answer')

const currentPair = computed<MatchPair | undefined>(() => {
  if (!currentRoom.value) return undefined
  return getCurrentPair(currentRoom.value)
})

const currentRound = computed<MatchRound | undefined>(() => {
  if (!currentRoom.value) return undefined
  return getCurrentRound(currentRoom.value)
})

const pairProgress = computed(() => {
  if (!currentRoom.value || !currentPair.value) return { answered: 0, total: 0, percentage: 0 }
  return calcPairProgress(currentRoom.value, currentPair.value.id)
})

const overallProgress = computed(() => {
  if (!currentRoom.value) return { answered: 0, total: 0, percentage: 0 }
  return calcProgress(currentRoom.value)
})

const currentPairResult = computed(() => {
  if (!currentRoom.value || !currentPair.value) return undefined
  return getPairResult(currentRoom.value, currentPair.value.id)
})

const member1 = computed(() => {
  if (!currentRoom.value || !currentPair.value) return undefined
  return currentRoom.value.members.find(m => m.id === currentPair.value!.member1Id)
})

const member2 = computed(() => {
  if (!currentRoom.value || !currentPair.value) return undefined
  return currentRoom.value.members.find(m => m.id === currentPair.value!.member2Id)
})

const canSubmit = computed(() => {
  return tempAnswer1.value.trim() && tempAnswer2.value.trim() && !submittingAnswers.value
})

const matchRankingsPreview = computed(() => {
  if (!currentRoom.value) return []
  return getMatchRankings(currentRoom.value).slice(0, 3)
})

onMounted(() => {
  loadRooms()
  const success = loadRoom(roomId.value)
  if (!success) {
    router.push('/')
    return
  }
  
  if (currentRoom.value && isRoomExpired(currentRoom.value.expiresAt)) {
    alert('房间已过期')
    router.push('/')
    return
  }
  
  if (currentRoom.value?.status !== 'playing') {
    router.push(`/room/${roomId.value}`)
    return
  }
  
  resetTempState()
  phase.value = 'answer'
})

const handleSubmitAnswers = async () => {
  if (!canSubmit.value) return
  
  submittingAnswers.value = true
  const result = submitAnswers(roomId.value)
  
  setTimeout(() => {
    submittingAnswers.value = false
    if (result) {
      loadRoom(roomId.value)
      phase.value = 'reveal'
      revealStep.value = 0
    }
  }, 500)
}

const handleReveal = () => {
  if (revealStep.value < 2) {
    revealStep.value++
    if (revealStep.value === 2) {
      phase.value = 'judge'
    }
  }
}

const handleJudge = (isMatch: boolean) => {
  judgeMatch(roomId.value, isMatch)
  loadRoom(roomId.value)
  phase.value = 'result'
  showingResult.value = true
}

const handleNext = () => {
  const result = goToNextRound(roomId.value)
  loadRoom(roomId.value)
  
  if (result.isGameEnd) {
    endMatchGame(roomId.value)
    loadRoom(roomId.value)
    router.push(`/room/${roomId.value}`)
    return
  }
  
  resetTempState()
  phase.value = 'answer'
}

const handleEndGame = () => {
  if (confirm('确定要结束默契局吗？已答的题目会保留统计。')) {
    endMatchGame(roomId.value)
    showEndConfirm.value = false
    router.push(`/room/${roomId.value}`)
  }
}

const handleResetGame = () => {
  if (confirm('确定要重新开始吗？所有默契局进度会重置。')) {
    resetGame(roomId.value)
    showResetConfirm.value = false
    router.push(`/room/${roomId.value}`)
  }
}

const goBack = () => {
  router.push(`/room/${roomId.value}`)
}
</script>

<template>
  <div 
    v-if="currentRoom && currentPair && currentRound"
    class="match-game-page min-h-screen bg-gradient-to-br from-pink-900 via-rose-900 to-fuchsia-900 text-white"
  >
    <div class="fixed inset-0 overflow-hidden pointer-events-none">
      <div class="absolute top-10 left-10 text-6xl opacity-20 animate-pulse">💕</div>
      <div class="absolute top-20 right-20 text-5xl opacity-20 animate-pulse" style="animation-delay: 0.5s">💖</div>
      <div class="absolute bottom-20 left-20 text-5xl opacity-20 animate-pulse" style="animation-delay: 1s">💗</div>
      <div class="absolute bottom-10 right-10 text-6xl opacity-20 animate-pulse" style="animation-delay: 1.5s">💞</div>
    </div>

    <div class="relative z-10 max-w-3xl mx-auto px-4 py-6">
      <div class="flex items-center justify-between mb-6">
        <button 
          class="flex items-center gap-2 text-white/80 hover:text-white transition-colors"
          @click="goBack"
        >
          <span>←</span>
          <span>返回房间</span>
        </button>
        
        <div class="text-center">
          <h1 class="text-xl font-bold">{{ currentRoom.name }}</h1>
          <div class="text-sm text-white/60">💞 双人默契局</div>
        </div>
        
        <div class="w-20"></div>
      </div>

      <div class="bg-white/10 backdrop-blur-md rounded-2xl p-4 mb-6">
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm text-white/80">总体进度</span>
          <span class="text-sm font-mono">{{ overallProgress.answered }} / {{ overallProgress.total }}</span>
        </div>
        <div class="h-3 bg-white/20 rounded-full overflow-hidden">
          <div 
            class="h-full bg-gradient-to-r from-pink-400 to-rose-400 rounded-full transition-all duration-500"
            :style="{ width: `${overallProgress.percentage}%` }"
          ></div>
        </div>
        <div class="mt-2 text-right text-xs text-white/60">
          {{ overallProgress.percentage }}% 完成
        </div>
      </div>

      <div class="bg-white/10 backdrop-blur-md rounded-2xl p-5 mb-6">
        <div class="flex items-center justify-center gap-6 mb-4">
          <div class="text-center">
            <div v-if="member1" class="mb-2">
              <MemberAvatar 
                :name="member1.name"
                :avatar="member1.avatar"
                :is-host="member1.isHost"
                size="md"
              />
            </div>
            <div class="font-bold text-lg">{{ currentPair.member1Name }}</div>
          </div>
          
          <div class="text-4xl animate-pulse">💞</div>
          
          <div class="text-center">
            <div v-if="member2" class="mb-2">
              <MemberAvatar 
                :name="member2.name"
                :avatar="member2.avatar"
                :is-host="member2.isHost"
                size="md"
              />
            </div>
            <div class="font-bold text-lg">{{ currentPair.member2Name }}</div>
          </div>
        </div>
        
        <div class="flex items-center justify-between text-sm text-white/70">
          <span>第 {{ pairProgress.answered + 1 }} / {{ pairProgress.total }} 题</span>
          <div class="flex items-center gap-1">
            <span>当前默契：</span>
            <span v-if="currentPairResult" class="font-bold text-pink-300">
              {{ currentPairResult.matchedRounds }} / {{ pairProgress.answered }} 题 ({{ pairProgress.answered > 0 ? Math.round(currentPairResult.matchedRounds / pairProgress.answered * 100) : 0 }}%)
            </span>
          </div>
        </div>
      </div>

      <div class="bg-gradient-to-br from-white/15 to-white/5 backdrop-blur-md rounded-3xl p-6 mb-6 shadow-2xl border border-white/10">
        <div class="text-center mb-6">
          <div class="inline-flex items-center gap-2 px-4 py-2 bg-pink-500/30 rounded-full mb-4">
            <span class="text-2xl">💬</span>
            <span class="text-sm font-medium">默契考验第 {{ pairProgress.answered + 1 }} 题</span>
          </div>
          <h2 class="text-2xl md:text-3xl font-bold leading-relaxed">
            {{ currentRound.questionContent }}
          </h2>
        </div>

        <div v-if="phase === 'answer'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
            <label class="block text-sm font-medium mb-3 flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center text-xs font-bold">1</span>
              {{ currentPair.member1Name }} 的答案
            </label>
            <textarea 
              v-model="tempAnswer1"
              placeholder="写下你的答案...不要让对方看到哦 👀"
              rows="4"
              class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:border-pink-400 focus:ring-2 focus:ring-pink-400/30 outline-none transition-all resize-none"
            ></textarea>
          </div>
          
          <div class="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
            <label class="block text-sm font-medium mb-3 flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-fuchsia-500 flex items-center justify-center text-xs font-bold">2</span>
              {{ currentPair.member2Name }} 的答案
            </label>
            <textarea 
              v-model="tempAnswer2"
              placeholder="写下你的答案...不要让对方看到哦 👀"
              rows="4"
              class="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/30 outline-none transition-all resize-none"
            ></textarea>
          </div>
        </div>

        <div v-if="phase === 'reveal' || phase === 'judge' || phase === 'result'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div 
            class="bg-white/10 rounded-2xl p-4 backdrop-blur-sm transition-all duration-500"
            :class="{ 'ring-2 ring-pink-400': revealStep >= 1 }"
          >
            <label class="block text-sm font-medium mb-3 flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-pink-500 flex items-center justify-center text-xs font-bold">1</span>
              {{ currentPair.member1Name }} 的答案
            </label>
            <div 
              v-if="revealStep >= 1"
              class="px-4 py-3 rounded-xl bg-white/15 border border-pink-400/50 min-h-[100px] flex items-center justify-center"
            >
              <p class="text-lg font-medium text-center leading-relaxed break-words">
                {{ currentRound.answer1 }}
              </p>
            </div>
            <div 
              v-else
              class="px-4 py-3 rounded-xl bg-black/30 border border-white/10 min-h-[100px] flex items-center justify-center cursor-pointer hover:bg-black/40 transition-all"
              @click="handleReveal"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🙈</div>
                <p class="text-sm text-white/60">点击揭晓答案</p>
              </div>
            </div>
          </div>
          
          <div 
            class="bg-white/10 rounded-2xl p-4 backdrop-blur-sm transition-all duration-500"
            :class="{ 'ring-2 ring-fuchsia-400': revealStep >= 2 }"
          >
            <label class="block text-sm font-medium mb-3 flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-fuchsia-500 flex items-center justify-center text-xs font-bold">2</span>
              {{ currentPair.member2Name }} 的答案
            </label>
            <div 
              v-if="revealStep >= 2"
              class="px-4 py-3 rounded-xl bg-white/15 border border-fuchsia-400/50 min-h-[100px] flex items-center justify-center"
            >
              <p class="text-lg font-medium text-center leading-relaxed break-words">
                {{ currentRound.answer2 }}
              </p>
            </div>
            <div 
              v-else-if="revealStep === 1"
              class="px-4 py-3 rounded-xl bg-black/30 border border-white/10 min-h-[100px] flex items-center justify-center cursor-pointer hover:bg-black/40 transition-all"
              @click="handleReveal"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🙈</div>
                <p class="text-sm text-white/60">点击揭晓答案</p>
              </div>
            </div>
            <div 
              v-else
              class="px-4 py-3 rounded-xl bg-black/40 border border-white/5 min-h-[100px] flex items-center justify-center opacity-50"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🔒</div>
                <p class="text-sm text-white/40">先揭晓上面的答案</p>
              </div>
            </div>
          </div>
        </div>

        <div v-if="phase === 'result'" class="mt-6 pt-6 border-t border-white/10">
          <div 
            class="text-center p-6 rounded-2xl"
            :class="currentRound.isMatch ? 'bg-green-500/20' : 'bg-orange-500/20'"
          >
            <div class="text-5xl mb-3">
              {{ currentRound.isMatch ? '🎉' : '😅' }}
            </div>
            <div class="text-2xl font-bold mb-2">
              {{ currentRound.isMatch ? '默契！' : '不太默契哦' }}
            </div>
            <p class="text-white/70 text-sm">
              {{ currentRound.isMatch ? '你们果然心有灵犀一点通！' : '没关系，各有各的想法也很有趣~' }}
            </p>
          </div>
        </div>
      </div>

      <div v-if="phase === 'answer'" class="mb-6">
        <button 
          class="w-full px-6 py-4 bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-500 rounded-2xl font-bold text-lg hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          :disabled="!canSubmit"
          @click="handleSubmitAnswers"
        >
          <span v-if="submittingAnswers" class="animate-spin">⏳</span>
          <span v-else>📝</span>
          {{ submittingAnswers ? '提交中...' : '提交答案' }}
        </button>
      </div>

      <div v-if="phase === 'reveal' && revealStep === 1" class="mb-6">
        <button 
          class="w-full px-6 py-4 bg-gradient-to-r from-fuchsia-500 to-purple-500 rounded-2xl font-bold text-lg hover:opacity-90 transition-all shadow-lg flex items-center justify-center gap-2"
          @click="handleReveal"
        >
          <span>✨</span>
          揭晓第二位答案
        </button>
      </div>

      <div v-if="phase === 'judge'" class="grid grid-cols-2 gap-3 mb-6">
        <button 
          class="px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl font-bold text-lg hover:opacity-90 transition-all shadow-lg flex flex-col items-center gap-1"
          @click="handleJudge(true)"
        >
          <span class="text-2xl">🤝</span>
          默契！
        </button>
        <button 
          class="px-6 py-4 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl font-bold text-lg hover:opacity-90 transition-all shadow-lg flex flex-col items-center gap-1"
          @click="handleJudge(false)"
        >
          <span class="text-2xl">🤷</span>
          不默契
        </button>
      </div>

      <div v-if="phase === 'result'" class="mb-6">
        <button 
          class="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl font-bold text-lg hover:opacity-90 transition-all shadow-lg flex items-center justify-center gap-2"
          @click="handleNext"
        >
          <span>➡️</span>
          下一题
        </button>
      </div>

      <div class="flex gap-3">
        <button 
          class="flex-1 px-4 py-3 bg-white/10 backdrop-blur-md rounded-xl hover:bg-white/20 transition-all text-sm"
          @click="showResetConfirm = true"
        >
          🔄 重新开始
        </button>
        <button 
          class="flex-1 px-4 py-3 bg-red-500/80 hover:bg-red-500 rounded-xl transition-all text-sm"
          @click="showEndConfirm = true"
        >
          ⏹️ 结束游戏
        </button>
      </div>

      <div v-if="matchRankingsPreview.length > 0" class="mt-6">
        <div class="bg-white/5 backdrop-blur-md rounded-2xl p-4">
          <h3 class="text-sm font-medium text-white/70 mb-3 flex items-center gap-2">
            <span>🏆</span> 实时默契排行
          </h3>
          <div class="space-y-2">
            <div 
              v-for="(item, index) in matchRankingsPreview" 
              :key="item.pairId"
              class="flex items-center justify-between text-sm"
            >
              <div class="flex items-center gap-2">
                <span 
                  class="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                  :class="{
                    'bg-yellow-400 text-gray-900': index === 0,
                    'bg-gray-400 text-gray-900': index === 1,
                    'bg-orange-400 text-gray-900': index === 2
                  }"
                >
                  {{ index + 1 }}
                </span>
                <span class="text-white/80">
                  {{ item.pair.member1Name }} & {{ item.pair.member2Name }}
                </span>
              </div>
              <span class="font-bold text-pink-300">{{ item.matchRate }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div 
      v-if="showEndConfirm"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="showEndConfirm = false"
    >
      <div class="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center">
        <div class="text-5xl mb-4">😢</div>
        <h3 class="text-xl font-bold text-gray-800 mb-2">结束默契局？</h3>
        <p class="text-gray-500 text-sm mb-6">
          已答的题目会保留统计数据
        </p>
        
        <div class="flex gap-3">
          <button 
            class="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            @click="showEndConfirm = false"
          >
            继续玩
          </button>
          <button 
            class="flex-1 px-4 py-3 bg-red-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
            @click="handleEndGame"
          >
            结束
          </button>
        </div>
      </div>
    </div>

    <div 
      v-if="showResetConfirm"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="showResetConfirm = false"
    >
      <div class="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center">
        <div class="text-5xl mb-4">🔄</div>
        <h3 class="text-xl font-bold text-gray-800 mb-2">重新开始？</h3>
        <p class="text-gray-500 text-sm mb-6">
          默契局进度会全部重置
        </p>
        
        <div class="flex gap-3">
          <button 
            class="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            @click="showResetConfirm = false"
          >
            取消
          </button>
          <button 
            class="flex-1 px-4 py-3 bg-purple-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
            @click="handleResetGame"
          >
            重新开始
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
