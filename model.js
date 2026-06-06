// ============================================================
// model.js — 数据模型、日期工具、任务/类别/重复任务结构
// ============================================================

// --- 日期工具函数 ---

/**
 * getWeekId(date) -> string
 * 输入: Date 对象或 null(默认当前日期)
 * 输出: "2026-W23" 格式的周标识
 * 按 ISO 8601 计算年份和周数
 */
function getWeekId(date = null) {
  const d = date instanceof Date ? new Date(date) : new Date()
  const dayNum = d.getDay() || 7
  d.setDate(d.getDate() + 4 - dayNum)
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return d.getFullYear() + '-W' + String(weekNo).padStart(2, '0')
}

/**
 * parseWeekId(weekId) -> {year, week}
 * 输入: "2026-W23"
 * 输出: {year: 2026, week: 23}
 */
function parseWeekId(weekId) {
  const [year, week] = weekId.split('-W')
  return { year: parseInt(year), week: parseInt(week) }
}

/**
 * getWeekRange(weekId) -> {start: Date, end: Date}
 * 输入: 周标识字符串
 * 输出: 该周的起止 Date 对象(周一 ~ 周日)
 */
function getWeekRange(weekId) {
  const { year, week } = parseWeekId(weekId)
  const simple = new Date(year, 0, 1 + (week - 1) * 7)
  const dayOfWeek = simple.getDay()
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(simple)
  monday.setDate(simple.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { start: monday, end: sunday }
}

/**
 * nextWeekId(weekId) -> string
 * 输入: 当前周标识
 * 输出: 下一周的周标识(跨越年份边界正确处理)
 */
function nextWeekId(weekId) {
  const range = getWeekRange(weekId)
  const nextMonday = new Date(range.end)
  nextMonday.setDate(nextMonday.getDate() + 1)
  return getWeekId(nextMonday)
}

/**
 * prevWeekId(weekId) -> string
 * 输入: 当前周标识
 * 输出: 上一周的周标识(跨越年份边界正确处理)
 */
function prevWeekId(weekId) {
  const range = getWeekRange(weekId)
  const prevSunday = new Date(range.start)
  prevSunday.setDate(prevSunday.getDate() - 1)
  return getWeekId(prevSunday)
}

/**
 * formatWeekDisplay(weekId) -> string
 * 输入: "2026-W23"
 * 输出: "2026 Week 23 (06/01 - 06/07)" 人类可读格式
 */
function formatWeekDisplay(weekId) {
  const { year, week } = parseWeekId(weekId)
  const range = getWeekRange(weekId)
  const fmt = (d) => {
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return m + '/' + day
  }
  return year + ' Week ' + week + ' (' + fmt(range.start) + ' - ' + fmt(range.end) + ')'
}

/**
 * formatDateISO(date) -> string
 * 输入: Date 对象(默认当前)
 * 输出: "2026-06-06T12:00:00.000Z" ISO 字符串
 */
function formatDateISO(date = null) {
  return (date instanceof Date ? date : new Date()).toISOString()
}

// --- 数据模型构造函数 ---

/**
 * createTask(overrides) -> Task
 * 输入: 可选的属性覆盖对象
 * 输出: 完整 Task 对象 {id, title, categoryId, weekId, completed, createdAt, recurringId}
 */
function createTask(overrides = {}) {
  return {
    id: overrides.id || crypto.randomUUID(),
    title: overrides.title || '',
    categoryId: overrides.categoryId || null,
    weekId: overrides.weekId || getWeekId(),
    completed: overrides.completed || false,
    createdAt: overrides.createdAt || formatDateISO(),
    recurringId: overrides.recurringId || null
  }
}

/**
 * createCategory(overrides) -> Category
 * 输入: 可选的属性覆盖对象
 * 输出: 完整 Category 对象 {id, name, parentId, order}
 */
function createCategory(overrides = {}) {
  return {
    id: overrides.id || crypto.randomUUID(),
    name: overrides.name || '',
    parentId: overrides.parentId || null,
    order: overrides.order || 0
  }
}

/**
 * createRecurringTask(overrides) -> RecurringTask
 * 输入: 可选的属性覆盖对象
 * 输出: 完整 RecurringTask 对象 {id, title, categoryId, frequencyWeeks, repeatCount, startWeekId, createdAt}
 * 默认: frequencyWeeks=1, repeatCount=4 (每周一次,共4次=一个月)
 */
function createRecurringTask(overrides = {}) {
  return {
    id: overrides.id || crypto.randomUUID(),
    title: overrides.title || '',
    categoryId: overrides.categoryId || null,
    frequencyWeeks: overrides.frequencyWeeks || 1,
    repeatCount: overrides.repeatCount || 4,
    startWeekId: overrides.startWeekId || getWeekId(),
    createdAt: overrides.createdAt || formatDateISO()
  }
}

// --- 类别树构造 ---

/**
 * buildCategoryTree(categories) -> CategoryNode[]
 * 输入: 扁平 Category[] 数组
 * 输出: 嵌套树结构 [{id, name, order, children: [...]}]
 */
function buildCategoryTree(categories) {
  const map = {}
  const roots = []
  const sorted = [...categories].sort((a, b) => a.order - b.order)
  sorted.forEach(function (cat) {
    map[cat.id] = { id: cat.id, name: cat.name, parentId: cat.parentId, order: cat.order, children: [] }
  })
  sorted.forEach(function (cat) {
    const node = map[cat.id]
    if (cat.parentId && map[cat.parentId]) {
      map[cat.parentId].children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

// --- 重复任务实例生成 ---

/**
 * generateTaskInstances(recurring, tasksByWeek) -> Task[]
 * 输入: RecurringTask 对象 + 已有任务 Map({weekId: [Task, ...]})
 * 输出: 需要新增的 Task 实例数组(跳过已存在的)
 */
function generateTaskInstances(recurring, tasksByWeek) {
  const instances = []
  let currentWeek = recurring.startWeekId
  for (let i = 0; i < recurring.repeatCount; i++) {
    const existing = (tasksByWeek[currentWeek] || []).some(function (t) {
      return t.recurringId === recurring.id
    })
    if (!existing) {
      instances.push(createTask({
        title: recurring.title,
        categoryId: recurring.categoryId,
        weekId: currentWeek,
        recurringId: recurring.id
      }))
    }
    currentWeek = nextWeekId(currentWeek)
    for (let skip = 1; skip < recurring.frequencyWeeks; skip++) {
      currentWeek = nextWeekId(currentWeek)
    }
  }
  return instances
}

/**
 * getCategoryChain(categories, categoryId) -> string[]
 * 输入: 扁平 Category[] + 目标类别 ID
 * 输出: 从根到目标的类别 ID 列表(含自身)
 */
function getCategoryChain(categories, categoryId) {
  const chain = []
  let current = categoryId
  while (current) {
    chain.unshift(current)
    const cat = categories.find(function (c) { return c.id === current })
    current = cat ? cat.parentId : null
  }
  return chain
}

/**
 * getCategoryPath(categories, categoryId) -> string
 * 输入: 扁平 Category[] + 目标类别 ID
 * 输出: "Parent > Child > Target" 路径字符串
 */
function getCategoryPath(categories, categoryId) {
  const chain = getCategoryChain(categories, categoryId)
  return chain.map(function (id) {
    const cat = categories.find(function (c) { return c.id === id })
    return cat ? cat.name : '?'
  }).join(' > ')
}
