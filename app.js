// ============================================================
// app.js — 应用调度核心
// ============================================================

var APP_STATE = null

// --- 状态管理 ---

function createInitialState() {
  var data = loadData()
  var config = loadConfig()
  var weekId = getWeekId()
  data = ensureRecurringInstances(data, weekId)
  saveData(data)
  return {
    data: data,
    config: config,
    currentWeekId: weekId,
    selectedCategoryId: null,
    cursorPosition: 0,
    mode: 'normal',
    inputMode: null,
    inputCallback: null,
    onCancel: null,
    inputPlaceholder: '',
    editTargetId: null,
    categoryParentId: null,
    collapsedCategoryIds: [],
    undoStack: [],
    redoStack: [],
    deleteConfirm: null,
    sidebarOpen: false
  }
}

// --- 撤销/重做 ---

function saveUndoSnapshot(state) {
  state.undoStack.push({
    data: copyData(state.data),
    selectedCategoryId: state.selectedCategoryId,
    cursorPosition: state.cursorPosition,
    currentWeekId: state.currentWeekId
  })
  state.redoStack = []
}

function doUndo(state) {
  if (state.undoStack.length === 0) return
  state.redoStack.push({
    data: copyData(state.data),
    selectedCategoryId: state.selectedCategoryId,
    cursorPosition: state.cursorPosition,
    currentWeekId: state.currentWeekId
  })
  var snap = state.undoStack.pop()
  state.data = snap.data
  state.selectedCategoryId = snap.selectedCategoryId
  state.cursorPosition = snap.cursorPosition
  state.currentWeekId = snap.currentWeekId
  saveData(state.data)
  appRender(state)
}

function doRedo(state) {
  if (state.redoStack.length === 0) return
  state.undoStack.push({
    data: copyData(state.data),
    selectedCategoryId: state.selectedCategoryId,
    cursorPosition: state.cursorPosition,
    currentWeekId: state.currentWeekId
  })
  var snap = state.redoStack.pop()
  state.data = snap.data
  state.selectedCategoryId = snap.selectedCategoryId
  state.cursorPosition = snap.cursorPosition
  state.currentWeekId = snap.currentWeekId
  saveData(state.data)
  appRender(state)
}

// --- 删除确认 ---

function setDeleteConfirm(state, type, id) {
  state.deleteConfirm = { type: type, id: id }
  state.inputMode = null
  appRender(state)
}

function clearDeleteConfirm(state) {
  state.deleteConfirm = null
  appRender(state)
}

function confirmDelete(state) {
  if (!state.deleteConfirm) return
  saveUndoSnapshot(state)
  if (state.deleteConfirm.type === 'task') {
    var taskToDelete = state.data.tasks.find(function (t) { return t.id === state.deleteConfirm.id })
    if (taskToDelete && taskToDelete.recurringId) {
      state.data = deleteTasksByRecurringId(state.data, taskToDelete.recurringId)
      state.data = deleteRecurringTask(state.data, taskToDelete.recurringId)
    } else {
      state.data = deleteTask(state.data, state.deleteConfirm.id)
    }
    saveData(state.data)
    var tasks = getTasksByCategoryAndWeek(state.data, state.selectedCategoryId, state.currentWeekId)
    if (state.cursorPosition >= tasks.length && tasks.length > 0) {
      state.cursorPosition = tasks.length - 1
    }
    if (tasks.length === 0) state.cursorPosition = 0
  } else if (state.deleteConfirm.type === 'category') {
    var idsToRemove = collectDescendantIds(state.data.categories, state.deleteConfirm.id)
    idsToRemove.push(state.deleteConfirm.id)
    state.data = deleteCategory(state.data, state.deleteConfirm.id)
    if (idsToRemove.indexOf(state.selectedCategoryId) !== -1) {
      state.selectedCategoryId = null
    }
    state.cursorPosition = 0
    saveData(state.data)
  }
  state.deleteConfirm = null
  appRender(state)
}

// --- 全局键盘事件 ---

function bindGlobalEvents() {
  document.addEventListener('keydown', function (e) {
    if (!APP_STATE) return
    if (document.querySelector('.config-overlay')) return

    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault()
      doUndo(APP_STATE)
      return
    }
    if (e.ctrlKey && e.key === 'Z') {
      e.preventDefault()
      doRedo(APP_STATE)
      return
    }

    if (APP_STATE.deleteConfirm) {
      if (e.key === 'y') {
        e.preventDefault()
        confirmDelete(APP_STATE)
      } else if (e.key === 'n' || e.key === 'Escape') {
        e.preventDefault()
        clearDeleteConfirm(APP_STATE)
      }
      return
    }

    if (APP_STATE.inputMode) return

    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault()
      moveCursor(1)
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault()
      moveCursor(-1)
    } else if (e.key === 'n') {
      e.preventDefault()
      showTaskCreateInput(APP_STATE)
    } else if (e.key === 'h' || e.key === 'ArrowLeft') {
      e.preventDefault()
      changeWeek(APP_STATE, 'prev')
    } else if (e.key === 'l' || e.key === 'ArrowRight') {
      e.preventDefault()
      changeWeek(APP_STATE, 'next')
    } else if (e.key === 'd') {
      e.preventDefault()
      requestDeleteCurrent(APP_STATE)
    } else if (e.key === ' ') {
      e.preventDefault()
      toggleCurrent(APP_STATE)
    } else if (e.key === 'c') {
      e.preventDefault()
      triggerSync(APP_STATE)
    } else if (e.key === 'u') {
      e.preventDefault()
      doUndo(APP_STATE)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      exitInputMode(APP_STATE)
    }
  })
}

// --- 移动光标 ---

function moveCursor(delta) {
  var tasks = getTasksByCategoryAndWeek(APP_STATE.data, APP_STATE.selectedCategoryId, APP_STATE.currentWeekId)
  var max = tasks.length - 1
  var next = APP_STATE.cursorPosition + delta
  if (next < 0) next = max
  if (next > max) next = 0
  APP_STATE.cursorPosition = next
  appRender(APP_STATE)
}

// --- 切换周 ---

function changeWeek(state, direction) {
  var nextId = direction === 'next' ? nextWeekId(state.currentWeekId) : prevWeekId(state.currentWeekId)
  state.currentWeekId = nextId
  state.data = ensureRecurringInstances(state.data, nextId)
  saveData(state.data)
  state.cursorPosition = 0
  appRender(state)
}

// --- 选择类别 ---

function selectCategory(state, categoryId) {
  state.selectedCategoryId = categoryId
  state.cursorPosition = 0
  appRender(state)
}

// --- 任务操作 ---

function createTaskFromInput(state, title) {
  saveUndoSnapshot(state)
  var task = createTask({
    title: title,
    categoryId: state.selectedCategoryId,
    weekId: state.currentWeekId
  })
  state.data = addTask(state.data, task)
  saveData(state.data)
  exitInputMode(state)
  appRender(state)
}

function editTaskFromInput(state, taskId, title) {
  saveUndoSnapshot(state)
  state.data = updateTask(state.data, taskId, { title: title })
  saveData(state.data)
  exitInputMode(state)
  appRender(state)
}

function toggleTask(state, taskId) {
  var task = state.data.tasks.find(function (t) { return t.id === taskId })
  if (!task) return
  saveUndoSnapshot(state)
  state.data = updateTask(state.data, taskId, { completed: !task.completed })
  saveData(state.data)
  appRender(state)
}

function toggleCurrent(state) {
  var tasks = getTasksByCategoryAndWeek(state.data, state.selectedCategoryId, state.currentWeekId)
  var task = tasks[state.cursorPosition]
  if (!task) return
  toggleTask(state, task.id)
}

function requestDeleteCurrent(state) {
  var tasks = getTasksByCategoryAndWeek(state.data, state.selectedCategoryId, state.currentWeekId)
  var task = tasks[state.cursorPosition]
  if (!task) return
  setDeleteConfirm(state, 'task', task.id)
}

// --- 类别操作 ---

function createCategoryFromInput(state, name, parentId) {
  saveUndoSnapshot(state)
  var cat = createCategory({ name: name, parentId: parentId })
  state.data = addCategory(state.data, cat)
  saveData(state.data)
  exitInputMode(state)
  state.selectedCategoryId = cat.id
  appRender(state)
}

function doDeleteCategory(state, categoryId) {
  var idsToRemove = collectDescendantIds(state.data.categories, categoryId)
  idsToRemove.push(categoryId)
  state.data = deleteCategory(state.data, categoryId)
  if (idsToRemove.indexOf(state.selectedCategoryId) !== -1) {
    state.selectedCategoryId = null
  }
  saveData(state.data)
  appRender(state)
}

function requestDeleteCategory(state, categoryId) {
  setDeleteConfirm(state, 'category', categoryId)
}

// --- 重复任务操作 ---

function createRecurringFromInput(state, title, freqWeeks, repeatCount, startWeekId) {
  saveUndoSnapshot(state)
  var recurring = createRecurringTask({
    title: title,
    categoryId: state.selectedCategoryId,
    frequencyWeeks: freqWeeks,
    repeatCount: repeatCount,
    startWeekId: startWeekId
  })
  state.data = addRecurringTask(state.data, recurring)
  state.data = ensureRecurringInstances(state.data, state.currentWeekId)
  saveData(state.data)
  appRender(state)
}

// --- 配置保存 ---

function saveConfigAndClose(state) {
  saveConfig(state.config)
  appRender(state)
}

// --- 云端同步 ---

function triggerSync(state) {
  renderStatusMessage('Syncing...', 'info', 5000)
  syncWithCloud(state.config, state.data).then(function (result) {
    state.data = result.data
    if (result.config) {
      state.config = result.config
    }
    saveData(state.data)
    if (result.status === 'synced' || result.status === 'pushed') {
      renderStatusMessage('Sync completed.', 'success', 3000)
    } else if (result.status === 'no_config') {
      renderStatusMessage('No cloud config. Use [Config] to set up.', 'error', 4000)
    } else if (result.status === 'error') {
      renderStatusMessage('Sync error: ' + (result.error || 'unknown'), 'error', 4000)
    }
    appRender(state)
  })
}

// --- 导入导出 ---

function triggerExport(state) {
  var json = exportToJSON(state.data)
  var blob = new Blob([json], { type: 'application/json' })
  var url = URL.createObjectURL(blob)
  var a = document.createElement('a')
  a.href = url
  a.download = 'todolist-data.json'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  renderStatusMessage('Exported todolist-data.json', 'success', 3000)
}

function triggerImport(state, json) {
  saveUndoSnapshot(state)
  try {
    var imported = importFromJSON(json)
    state.data = imported
    state.data = ensureRecurringInstances(state.data, state.currentWeekId)
    saveData(state.data)
    state.cursorPosition = 0
    state.selectedCategoryId = null
    appRender(state)
    renderStatusMessage('Imported successfully.', 'success', 3000)
  } catch (e) {
    renderStatusMessage('Import failed: invalid JSON file.', 'error', 4000)
  }
}

// --- 渲染代理 ---

function appRender(state) {
  renderApp(state)
  scrollToSelectedTask()
}

function scrollToSelectedTask() {
  var selected = document.querySelector('.task-row.selected')
  if (selected) {
    selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

// --- Service Worker ---

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  var swPath = window.location.pathname.replace(/[^\/]*$/, '') + 'sw.js'
  navigator.serviceWorker.register(swPath).then(function (reg) {
    querySWVersion()
    reg.addEventListener('updatefound', function () {
      var installing = reg.installing
      if (!installing) return
      installing.addEventListener('statechange', function () {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          installing.postMessage({ type: 'SKIP_WAITING' })
          window.location.reload(true)
        }
      })
    })
    if (reg.waiting && navigator.serviceWorker.controller) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      window.location.reload(true)
    }
  }).catch(function () {})
}

function querySWVersion() {
  if (!navigator.serviceWorker.controller) return
  navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' })
}

navigator.serviceWorker.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'VERSION') {
    window.SW_ACTUAL_VERSION = event.data.version
    updateVersionDisplay()
  }
})

function updateVersionDisplay() {
  var el = document.querySelector('.header-version')
  if (el) {
    el.textContent = window.SW_ACTUAL_VERSION || (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '')
  }
}

// --- 缓存清理 ---

function clearAllCaches() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      return Promise.all(regs.map(function (r) { return r.unregister() }))
    }).then(function () {
      return caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k) }))
      })
    }).then(function () {
      window.location.reload(true)
    })
  } else {
    window.location.reload(true)
  }
}

// --- 启动入口 ---

function initApp() {
  APP_STATE = createInitialState()
  appRender(APP_STATE)
  bindGlobalEvents()
  registerServiceWorker()
}
