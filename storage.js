// ============================================================
// storage.js — 本地 localStorage 持久化、CRUD、导入导出
// ============================================================

var STORAGE_KEY = 'todolist_data'
var CONFIG_KEY = 'todolist_config'

// --- 默认数据 ---

/**
 * getDefaultData() -> AppData
 * 输入: 无
 * 输出: 默认数据结构 {version, tasks, categories, recurringTasks, lastSync}
 */
function getDefaultData() {
  return {
    version: 1,
    tasks: [],
    categories: [],
    recurringTasks: [],
    lastSync: null
  }
}

// --- 数据加载与保存 ---

/**
 * loadData() -> AppData
 * 输入: 无
 * 输出: 从 localStorage 读取的数据,若无则返回默认数据
 */
function loadData() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      var parsed = JSON.parse(raw)
      return parsed
    }
  } catch (e) {
    // 解析失败则返回默认数据
  }
  return getDefaultData()
}

/**
 * saveData(data) -> void
 * 输入: AppData 对象
 * 输出: 无,写入 localStorage
 */
function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

// --- 配置加载与保存 ---

/**
 * loadConfig() -> AppConfig
 * 输入: 无
 * 输出: 配置对象 {cloudURL, cloudToken, cloudFilePath, lastPullHash}
 */
function loadConfig() {
  try {
    var raw = localStorage.getItem(CONFIG_KEY)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch (e) {
    // 解析失败
  }
  return {}
}

/**
 * saveConfig(config) -> void
 * 输入: AppConfig 对象
 * 输出: 无,写入 localStorage(敏感信息仅存本地)
 */
function saveConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
}

// --- 数据操作(不可变风格 - 返回新对象) ---

/**
 * copyData(data) -> AppData
 * 输入: AppData
 * 输出: 深拷贝副本
 */
function copyData(data) {
  return JSON.parse(JSON.stringify(data))
}

/**
 * addTask(data, task) -> AppData
 * 输入: AppData + Task 对象
 * 输出: 修改后的新 AppData
 */
function addTask(data, task) {
  var next = copyData(data)
  next.tasks.push(task)
  return next
}

/**
 * updateTask(data, taskId, updates) -> AppData
 * 输入: AppData + 任务 ID + 部分属性更新对象
 * 输出: 修改后的新 AppData
 */
function updateTask(data, taskId, updates) {
  var next = copyData(data)
  for (var i = 0; i < next.tasks.length; i++) {
    if (next.tasks[i].id === taskId) {
      Object.assign(next.tasks[i], updates)
      break
    }
  }
  return next
}

/**
 * deleteTask(data, taskId) -> AppData
 * 输入: AppData + 任务 ID
 * 输出: 修改后的新 AppData
 */
function deleteTask(data, taskId) {
  var next = copyData(data)
  next.tasks = next.tasks.filter(function (t) { return t.id !== taskId })
  return next
}

/**
 * deleteTasksByRecurringId(data, recurringId) -> AppData
 * 输入: AppData + 重复任务 ID
 * 输出: 删除所有关联实例后的新 AppData
 */
function deleteTasksByRecurringId(data, recurringId) {
  var next = copyData(data)
  next.tasks = next.tasks.filter(function (t) { return t.recurringId !== recurringId })
  return next
}

/**
 * addCategory(data, category) -> AppData
 * 输入: AppData + Category 对象
 * 输出: 修改后的新 AppData
 */
function addCategory(data, category) {
  var next = copyData(data)
  next.categories.push(category)
  return next
}

/**
 * deleteCategory(data, categoryId) -> AppData
 * 输入: AppData + 类别 ID
 * 输出: 修改后的新 AppData(级联删除子类别及关联任务)
 */
function deleteCategory(data, categoryId) {
  var next = copyData(data)
  var idsToRemove = collectDescendantIds(next.categories, categoryId)
  idsToRemove.push(categoryId)
  next.categories = next.categories.filter(function (c) { return idsToRemove.indexOf(c.id) === -1 })
  next.tasks = next.tasks.filter(function (t) { return idsToRemove.indexOf(t.categoryId) === -1 })
  next.recurringTasks = next.recurringTasks.filter(function (r) { return idsToRemove.indexOf(r.categoryId) === -1 })
  return next
}

/**
 * addRecurringTask(data, recurring) -> AppData
 * 输入: AppData + RecurringTask 对象
 * 输出: 修改后的新 AppData
 */
function addRecurringTask(data, recurring) {
  var next = copyData(data)
  next.recurringTasks.push(recurring)
  return next
}

/**
 * deleteRecurringTask(data, recurringId) -> AppData
 * 输入: AppData + 重复任务 ID
 * 输出: 修改后的新 AppData(仅删除定义,不删已生成实例)
 */
function deleteRecurringTask(data, recurringId) {
  var next = copyData(data)
  next.recurringTasks = next.recurringTasks.filter(function (r) { return r.id !== recurringId })
  return next
}

// --- 导入导出 ---

/**
 * exportToJSON(data) -> string
 * 输入: AppData
 * 输出: 格式化 JSON 字符串(缩进 2 空格,人类可读)
 */
function exportToJSON(data) {
  return JSON.stringify(data, null, 2)
}

/**
 * importFromJSON(json) -> AppData
 * 输入: JSON 字符串
 * 输出: 解析后的 AppData(含基本校验,缺失字段补默认值)
 */
function importFromJSON(json) {
  var parsed = JSON.parse(json)
  var defaults = getDefaultData()
  return {
    version: parsed.version || defaults.version,
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    categories: Array.isArray(parsed.categories) ? parsed.categories : [],
    recurringTasks: Array.isArray(parsed.recurringTasks) ? parsed.recurringTasks : [],
    lastSync: parsed.lastSync || null
  }
}

// --- 查询辅助 ---

/**
 * getTasksByCategoryAndWeek(data, categoryId, weekId) -> Task[]
 * 输入: AppData + 类别 ID(null=全部) + 周标识
 * 输出: 指定周和类别的任务
 */
function getTasksByCategoryAndWeek(data, categoryId, weekId) {
  return data.tasks.filter(function (t) {
    if (t.weekId !== weekId) return false
    if (categoryId === null) return true
    if (t.categoryId === categoryId) return true
    var descendants = collectDescendantIds(data.categories, categoryId)
    return descendants.indexOf(t.categoryId) !== -1
  })
}

/**
 * collectDescendantIds(categories, parentId) -> string[]
 * 输入: 扁平 Category[] + 父类别 ID
 * 输出: 所有子孙类别 ID 列表(递归)
 */
function collectDescendantIds(categories, parentId) {
  var result = []
  var children = categories.filter(function (c) { return c.parentId === parentId })
  children.forEach(function (child) {
    result.push(child.id)
    result = result.concat(collectDescendantIds(categories, child.id))
  })
  return result
}

/**
 * ensureRecurringInstances(data, weekId) -> AppData
 * 输入: AppData + 目标周标识
 * 输出: 补充完重复任务实例后的新 AppData
 */
function ensureRecurringInstances(data, weekId) {
  var next = copyData(data)
  var tasksByWeek = {}
  next.tasks.forEach(function (t) {
    if (!tasksByWeek[t.weekId]) tasksByWeek[t.weekId] = []
    tasksByWeek[t.weekId].push(t)
  })
  next.recurringTasks.forEach(function (r) {
    var newInstances = generateTaskInstances(r, tasksByWeek)
    newInstances.forEach(function (inst) {
      if (inst.weekId === weekId) {
        var exists = next.tasks.some(function (t) {
          return t.recurringId === inst.recurringId && t.weekId === inst.weekId
        })
        if (!exists) {
          next.tasks.push(inst)
        }
      }
    })
  })
  return next
}

// --- 同步快照 ---

var SYNC_SNAPSHOT_KEY = 'todolist_sync_snapshot'

/**
 * loadSyncSnapshot() -> AppData | null
 * 输入: 无
 * 输出: 从 localStorage 读取的上次同步成功后的 Base 快照,若不存在或解析失败则返回 null
 */
function loadSyncSnapshot() {
  try {
    var raw = localStorage.getItem(SYNC_SNAPSHOT_KEY)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch (e) {
    // 解析失败返回 null
  }
  return null
}

/**
 * saveSyncSnapshot(data) -> void
 * 输入: AppData 对象
 * 输出: 无,将 data 作为 Base 快照写入 localStorage
 */
function saveSyncSnapshot(data) {
  localStorage.setItem(SYNC_SNAPSHOT_KEY, JSON.stringify(data))
}
