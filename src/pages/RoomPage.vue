<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoom } from '@/composables/useRoom'
import { useExpire } from '@/composables/useExpire'
import { useMatchGame } from '@/composables/useMatchGame'
import { allTopics, getRandomQuestion } from '@/topics'
import type { Topic, TopicType, TopicTemplate, GameMode } from '@/types'
import { TOPIC_COLORS, TOPIC_EMOJIS } from '@/types'
import TopicCard from '@/components/TopicCard.vue'
import MemberAvatar from '@/components/MemberAvatar.vue'
import { copyToClipboard, getDaysRemaining } from '@/utils/helpers'

const route = useRoute()
const router = useRouter()
const { loadRoom, currentRoom, addTopic, removeTopic, startGame, error, loadRooms, setGameMode, startMatchGame } = useRoom()
const { isRoomExpired, getExpirationWarning } = useExpire()
const { getMatchRankings, getMemberSummary, calcProgress } = useMatchGame()

const topicContent = ref('')
const selectedType = ref<TopicType>('trouble')
const isAnonymous = ref(false)
const authorName = ref('')
const showAddTopic = ref(false)
const copySuccess = ref(false)
const selectedTemplate = ref<TopicTemplate | null>(null)

const roomId = computed(() => route.params.id as string)

const unflippedTopics = computed(() => 
  currentRoom.value?.topics.filter((t: Topic) => !t.isFlipped) || []
)

const flippedTopics = computed(() => 
  currentRoom.value?.topics.filter((t: Topic) => t.isFlipped) || []
)

const canStartGame = computed(() => 
  currentRoom.value?.topics.length && currentRoom.value.topics.length >= 1
)

const canStartMatchGame = computed(() => 
  currentRoom.value?.members.length && currentRoom.value.members.length >= 2
)

const expirationWarning = computed(() => 
  currentRoom.value ? getExpirationWarning(currentRoom.value.expiresAt) : null
)

const matchRankings = computed(() => {
  if (!currentRoom.value) return []
  return getMatchRankings(currentRoom.value)
})

const memberSummary = computed(() => {
  if (!currentRoom.value) return []
  const summary = getMemberSummary(currentRoom.value)
  return Object.entries(summary).map(([id, data]) => ({
    id,
    ...data
  })).sort((a, b) => b.avgRate - a.avgRate)
})

const overallProgress = computed(() => {
  if (!currentRoom.value) return { answered: 0, total: 0, percentage: 0 }
  return calcProgress(currentRoom.value)
})

const matchModeBadge = computed(() => {
  if (!currentRoom.value) return null
  return currentRoom.value.gameMode === 'match'
    ? { text: '默契局', emoji: '💞', color: 'bg-pink-100 text-pink-700' }
    : { text: '普通局', emoji: '🎴', color: 'bg-purple-100 text-purple-700' }
})

onMounted(() => {
  loadRooms()
  const success = loadRoom(roomId.value)
  if (!success) {
    router.push('/')
    return
  }
  
  if (currentRoom.value && isRoomExpired(currentRoom.value.expiresAt)) {
    alert('房间已过期，话题已自动消失')
    router.push('/')
    return
  }
  
  if (currentRoom.value?.status === 'playing') {
    if (currentRoom.value.gameMode === 'match') {
      router.push(`/room/${roomId.value}/match`)
    } else {
      router.push(`/room/${roomId.value}/game`)
    }
  }
  
  if (currentRoom.value?.members.length) {
    authorName.value = currentRoom.value.members[0].name
  }
})

const selectType = (type: TopicType) => {
  selectedType.value = type
  const template = allTopics.find((t: TopicTemplate) => t.type === type)
  selectedTemplate.value = template || null
  topicContent.value = ''
}

const useTemplateQuestion = () => {
  const question = getRandomQuestion(selectedType.value)
  if (question) {
    topicContent.value = question
  }
}

const handleAddTopic = () => {
  if (!topicContent.value.trim() || !currentRoom.value) return
  
  addTopic(
    roomId.value,
    topicContent.value.trim(),
    selectedType.value,
    authorName.value || '匿名',
    isAnonymous.value
  )
  
  topicContent.value = ''
  isAnonymous.value = false
  showAddTopic.value = false
}

const handleDeleteTopic = (topicId: string) => {
  if (confirm('确定要删除这个话题吗？')) {
    removeTopic(roomId.value, topicId)
  }
}

const handleCopyCode = () => {
  if (currentRoom.value) {
    copyToClipboard(currentRoom.value.code).then(() => {
      copySuccess.value = true
      setTimeout(() => {
        copySuccess.value = false
      }, 2000)
    })
  }
}

const handleSelectMode = (mode: GameMode) => {
  setGameMode(roomId.value, mode)
  
  if (mode === 'match') {
    if (startMatchGame(roomId.value)) {
      router.push(`/room/${roomId.value}/match`)
    }
  } else {
    if (startGame(roomId.value)) {
      router.push(`/room/${roomId.value}/game`)
    }
  }
}

const goBack = () => {
  router.push('/')
}

const goToGame = () => {
  if (currentRoom.value?.gameMode === 'match') {
    router.push(`/room/${roomId.value}/match`)
  } else {
    router.push(`/room/${roomId.value}/game`)
  }
}

const getMatchRateColor = (rate: number) => {
  if (rate >= 80) return 'from-pink-500 to-rose-500'
  if (rate >= 60) return 'from-orange-400 to-pink-500'
  if (rate >= 40) return 'from-yellow-400 to-orange-400'
  return 'from-gray-400 to-gray-500'
}

const getMatchRateLabel = (rate: number) => {
  if (rate >= 90) return '灵魂伴侣'
  if (rate >= 80) return '超级默契'
  if (rate >= 60) return '默契十足'
  if (rate >= 40) return '还不错哦'
  if (rate >= 20) return '需要磨合'
  return '最熟悉的陌生人'
}
</script>

<template>
  <div 
    v-if="currentRoom"
    class="room-page min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50"
  >
    <div class="max-w-4xl mx-auto px-4 py-6">
      <div class="flex items-center justify-between mb-6">
        <button 
          class="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          @click="goBack"
        >
          <span>←</span>
          <span>返回</span>
        </button>
        
        <button 
          v-if="currentRoom.status === 'ended'"
          class="px-4 py-2 bg-green-500 text-white rounded-full text-sm font-medium"
          @click="goToGame"
        >
          查看结果
        </button>
      </div>

      <div class="bg-white rounded-3xl p-6 shadow-lg mb-6">
        <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
          <div>
            <div class="flex items-center gap-3 mb-2 flex-wrap">
              <h1 class="text-2xl md:text-3xl font-bold text-gray-800">
                🎒 {{ currentRoom.name }}
              </h1>
              <span v-if="matchModeBadge" :class="['text-xs px-3 py-1 rounded-full font-medium', matchModeBadge.color]">
                {{ matchModeBadge.emoji }} {{ matchModeBadge.text }}
              </span>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <div class="flex items-center gap-2">
                <span class="text-gray-500">邀请码：</span>
                <button 
                  class="font-mono bg-purple-100 text-purple-700 px-3 py-1 rounded-lg hover:bg-purple-200 transition-colors flex items-center gap-1"
                  @click="handleCopyCode"
                >
                  <span>{{ currentRoom.code }}</span>
                  <span class="text-xs">📋</span>
                </button>
              </div>
              
              <span 
                v-if="expirationWarning"
                class="text-xs px-2 py-1 rounded-full"
                :class="{
                  'bg-red-100 text-red-600': getDaysRemaining(currentRoom.expiresAt) <= 1,
                  'bg-orange-100 text-orange-600': getDaysRemaining(currentRoom.expiresAt) > 1 && getDaysRemaining(currentRoom.expiresAt) <= 3,
                  'bg-yellow-100 text-yellow-600': getDaysRemaining(currentRoom.expiresAt) > 3
                }"
              >
                ⏰ {{ expirationWarning }}
              </span>
            </div>
          </div>
          
          <div class="text-center md:text-right">
            <div class="text-3xl font-bold text-purple-600">
              {{ currentRoom.topics.length }}
            </div>
            <div class="text-sm text-gray-500">个话题已投放</div>
          </div>
        </div>

        <div class="mb-6">
          <h3 class="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
            <span>👥</span> 成员 ({{ currentRoom.members.length }})
          </h3>
          <div class="flex flex-wrap gap-4">
            <MemberAvatar 
              v-for="member in currentRoom.members" 
              :key="member.id"
              :name="member.name"
              :avatar="member.avatar"
              :is-host="member.isHost"
              size="sm"
            />
          </div>
        </div>

        <div v-if="currentRoom.status === 'preparing'" class="space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button 
              class="px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl font-medium hover:opacity-90 transition-all flex flex-col items-start gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              :disabled="!canStartGame"
              @click="handleSelectMode('normal')"
            >
              <div class="flex items-center gap-2">
                <span class="text-2xl">🎴</span>
                <span class="text-lg font-bold">普通局</span>
              </div>
              <p class="text-sm text-white/80 text-left">
                轮流翻牌，聊聊大家提前丢好的话题
              </p>
              <p v-if="!canStartGame" class="text-xs text-white/60">
                ⚠️ 至少需要 1 个话题
              </p>
            </button>
            
            <button 
              class="px-6 py-4 bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-500 text-white rounded-2xl font-medium hover:opacity-90 transition-all flex flex-col items-start gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              :disabled="!canStartMatchGame"
              @click="handleSelectMode('match')"
            >
              <div class="flex items-center gap-2">
                <span class="text-2xl">💞</span>
                <span class="text-lg font-bold">双人默契局</span>
              </div>
              <p class="text-sm text-white/80 text-left">
                随机配对，两人同时作答看默契度
              </p>
              <p v-if="!canStartMatchGame" class="text-xs text-white/60">
                ⚠️ 至少需要 2 位成员
              </p>
            </button>
          </div>
          
          <button 
            class="w-full px-6 py-3 bg-white border-2 border-dashed border-purple-300 text-purple-600 rounded-xl font-medium hover:bg-purple-50 transition-colors"
            @click="showAddTopic = true"
          >
            + 丢话题
          </button>
        </div>
        
        <div v-else-if="currentRoom.status === 'playing'" class="flex gap-3">
          <button 
            class="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            @click="goToGame"
          >
            <span class="text-xl">▶️</span>
            继续游戏
          </button>
          <button 
            class="px-6 py-3 bg-white border-2 border-dashed border-purple-300 text-purple-600 rounded-xl font-medium hover:bg-purple-50 transition-colors"
            @click="showAddTopic = true"
          >
            + 追加话题
          </button>
        </div>
      </div>

      <div v-if="unflippedTopics.length > 0" class="mb-6">
        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>📥</span> 待聊话题 ({{ unflippedTopics.length }})
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TopicCard 
            v-for="topic in unflippedTopics" 
            :key="topic.id"
            :topic="topic"
            :can-delete="currentRoom.status === 'preparing'"
            @delete="handleDeleteTopic(topic.id)"
          />
        </div>
      </div>

      <div v-if="flippedTopics.length > 0">
        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>✅</span> 已聊话题 ({{ flippedTopics.length }})
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-70">
          <TopicCard 
            v-for="topic in flippedTopics" 
            :key="topic.id"
            :topic="topic"
          />
        </div>
      </div>

      <div v-if="currentRoom.gameMode === 'match' && matchRankings.length > 0" class="mb-6">
        <div class="bg-gradient-to-br from-pink-50 via-rose-50 to-fuchsia-50 rounded-3xl p-6 shadow-lg border border-pink-100">
          <h2 class="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <span>🏆</span> 默契表现排行榜
          </h2>

          <div class="mb-8">
            <div class="flex justify-between items-center mb-2">
              <span class="text-sm font-medium text-gray-600">总体进度</span>
              <span class="text-sm font-mono text-gray-600">{{ overallProgress.answered }} / {{ overallProgress.total }}</span>
            </div>
            <div class="h-3 bg-white/60 rounded-full overflow-hidden">
              <div 
                class="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all duration-500"
                :style="{ width: `${overallProgress.percentage}%` }"
              ></div>
            </div>
          </div>

          <div class="mb-8">
            <h3 class="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
              <span>💑</span> 最佳默契搭档
            </h3>
            <div class="space-y-3">
              <div 
                v-for="(item, index) in matchRankings" 
                :key="item.pairId"
                class="bg-white rounded-2xl p-4 shadow-sm"
              >
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-3">
                    <div 
                      class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm"
                      :class="{
                        'bg-yellow-400': index === 0,
                        'bg-gray-400': index === 1,
                        'bg-orange-400': index === 2,
                        'bg-gray-300': index > 2
                      }"
                    >
                      {{ index + 1 }}
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-gray-800">{{ item.pair.member1Name }}</span>
                      <span class="text-pink-400">💞</span>
                      <span class="font-bold text-gray-800">{{ item.pair.member2Name }}</span>
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-2xl font-bold text-pink-600">{{ item.matchRate }}%</div>
                    <div class="text-xs text-gray-500">{{ item.matchedRounds }} / {{ item.totalRounds }} 题</div>
                  </div>
                </div>
                <div class="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div 
                    class="h-full rounded-full transition-all duration-500 bg-gradient-to-r"
                    :class="getMatchRateColor(item.matchRate)"
                    :style="{ width: `${item.matchRate}%` }"
                  ></div>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-xs text-gray-500">默契指数：</span>
                  <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">
                    {{ getMatchRateLabel(item.matchRate) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="memberSummary.length > 0">
            <h3 class="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
              <span>👤</span> 个人默契表现
            </h3>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div 
                v-for="member in memberSummary" 
                :key="member.id"
                class="bg-white rounded-xl p-3 text-center shadow-sm"
              >
                <div class="text-lg font-bold text-gray-800 mb-1">{{ member.name }}</div>
                <div class="text-xl font-bold text-purple-600 mb-1">{{ member.avgRate }}%</div>
                <div class="text-xs text-gray-500">平均默契率</div>
                <div class="mt-2 pt-2 border-t border-gray-100">
                  <div class="text-xs text-gray-500">
                    答对 <span class="font-medium text-green-600">{{ member.totalMatches }}</span> / 
                    共 <span class="font-medium">{{ member.totalRounds }}</span> 题
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="currentRoom.topics.length === 0 && currentRoom.gameMode !== 'match'" class="text-center py-16 bg-white rounded-3xl shadow-md">
        <div class="text-6xl mb-4">🎁</div>
        <p class="text-gray-500 text-lg mb-4">保鲜袋还是空的，快丢点话题进去吧！</p>
        <button 
          class="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
          @click="showAddTopic = true"
        >
          + 丢第一个话题
        </button>
      </div>
    </div>

    <div 
      v-if="showAddTopic"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="showAddTopic = false"
    >
      <div class="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <h2 class="text-xl font-bold text-gray-800 mb-4 text-center">
          ✨ 丢个话题进去
        </h2>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            选择话题类型
          </label>
          <div class="grid grid-cols-3 gap-2">
            <button 
              v-for="template in allTopics" 
              :key="template.type"
              class="p-3 rounded-xl border-2 transition-all text-center"
              :class="{
                'border-purple-500 bg-purple-50': selectedType === template.type,
                'border-gray-200 hover:border-gray-300': selectedType !== template.type
              }"
              @click="selectType(template.type)"
            >
              <div class="text-2xl mb-1">{{ template.emoji }}</div>
              <div class="text-xs font-medium">{{ template.name }}</div>
            </button>
          </div>
        </div>

        <div class="mb-4">
          <div class="flex justify-between items-center mb-2">
            <label class="text-sm font-medium text-gray-700">
              话题内容
            </label>
            <button 
              v-if="selectedTemplate"
              class="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
              @click="useTemplateQuestion"
            >
              <span>🎲</span>
              随机一个
            </button>
          </div>
          <textarea 
            v-model="topicContent"
            placeholder="输入你想聊的话题..."
            rows="3"
            class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all resize-none"
            :style="{ borderLeftColor: TOPIC_COLORS[selectedType], borderLeftWidth: '4px' }"
          ></textarea>
          <p v-if="selectedTemplate" class="mt-2 text-xs text-gray-500">
            {{ TOPIC_EMOJIS[selectedTemplate.type] }} {{ selectedTemplate.description }}
          </p>
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            你的名字
          </label>
          <input 
            v-model="authorName"
            type="text" 
            placeholder="输入你的名字"
            class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
          />
        </div>

        <div class="mb-6">
          <label class="flex items-center gap-2 cursor-pointer">
            <input 
              v-model="isAnonymous"
              type="checkbox" 
              class="w-4 h-4 rounded text-purple-500 focus:ring-purple-400"
            />
            <span class="text-sm text-gray-600">🎭 匿名发布</span>
          </label>
        </div>

        <div v-if="error" class="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          {{ error }}
        </div>

        <div class="flex gap-3">
          <button 
            class="flex-1 px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            @click="showAddTopic = false"
          >
            取消
          </button>
          <button 
            class="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            :disabled="!topicContent.trim() || !authorName.trim()"
            @click="handleAddTopic"
          >
            丢进去！
          </button>
        </div>
      </div>
    </div>

    <div 
      v-if="copySuccess"
      class="fixed top-8 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-2"
    >
      <span>✓</span>
      <span>邀请码已复制</span>
    </div>
  </div>
</template>
