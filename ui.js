// ============================================================
// ui.js — TUI 风格界面渲染与交互
// ============================================================

// --- DOM 快捷工具 ---

/**
 * $(selector) -> Element
 * 输入: CSS 选择器
 * 输出: DOM 元素
 */
function $(selector) {
  return document.querySelector(selector)
}

/**
 * el(tag, attrs, children) -> Element
 * 输入: 标签名 + 属性对象 + 子元素数组(或文本)
 * 输出: 创建的 DOM 元素
 */
function el(tag, attrs, children) {
  var elem = document.createElement(tag)
  if (attrs) {
    Object.keys(attrs).forEach(function (key) {
      if (key === 'className') elem.className = attrs[key]
      else if (key === 'onClick') elem.addEventListener('click', attrs[key])
      else if (key === 'onChange') elem.addEventListener('input', attrs[key])
      else if (key === 'onKeyDown') elem.addEventListener('keydown', attrs[key])
      else if (key === 'onBlur') elem.addEventListener('blur', attrs[key])
      else elem.setAttribute(key, attrs[key])
    })
  }
  if (children) {
    if (Array.isArray(children)) {
      children.forEach(function (child) {
        if (typeof child === 'string') elem.appendChild(document.createTextNode(child))
        else if (child) elem.appendChild(child)
      })
    } else if (typeof children === 'string') {
      elem.textContent = children
    }
  }
  return elem
}

// --- 渲染入口 ---

/**
 * renderApp(state) -> void
 * 输入: 应用状态 {data, config, currentWeekId, selectedCategoryId, cursorPosition}
 * 输出: 无,全量重绘界面到 #app
 */
function renderApp(state) {
  var app = $('#app')
  if (!app) return
  app.innerHTML = ''
  app.appendChild(renderHeader(state))
  app.appendChild(renderMain(state))
  app.appendChild(renderFooter(state))
}

// --- Header 渲染 ---

/**
 * renderHeader(state) -> Element
 * 输入: 应用状态
 * 输出: header 行 DOM 元素
 * 布局: [Sync] [Config]   2026 Week 23   [Export] [Import]
 */
function renderHeader(state) {
  var header = el('div', { className: 'header' })

  var leftGroup = el('div', { className: 'header-left' })
  leftGroup.appendChild(renderButton('Sync', function () {
    if (typeof triggerSync === 'function') triggerSync(state)
  }))
  leftGroup.appendChild(renderButton('Config', function () {
    showConfigPanel(state)
  }))
  header.appendChild(leftGroup)

  var centerGroup = el('div', { className: 'header-center' })
  centerGroup.textContent = formatWeekDisplay(state.currentWeekId)
  header.appendChild(centerGroup)

  var rightGroup = el('div', { className: 'header-right' })
  rightGroup.appendChild(renderButton('Export', function () {
    if (typeof triggerExport === 'function') triggerExport(state)
  }))
  rightGroup.appendChild(renderButton('Import', function () {
    triggerImportFile(state)
  }))
  header.appendChild(rightGroup)

  return header
}

// --- Footer 渲染 ---

/**
 * renderFooter(state) -> Element
 * 输入: 应用状态
 * 输出: footer 行 DOM 元素
 * 布局: < 2026-W22             2026-W24 >
 */
function renderFooter(state) {
  var footer = el('div', { className: 'footer' })
  var prevId = prevWeekId(state.currentWeekId)
  var nextId = nextWeekId(state.currentWeekId)

  var prevBtn = el('span', {
    className: 'btn',
    onClick: function () { if (typeof changeWeek === 'function') changeWeek(state, 'prev') }
  })
  prevBtn.textContent = '< ' + prevId

  var nextBtn = el('span', {
    className: 'btn',
    onClick: function () { if (typeof changeWeek === 'function') changeWeek(state, 'next') }
  })
  nextBtn.textContent = nextId + ' >'

  footer.appendChild(prevBtn)
  var spacer = el('div', { className: 'footer-spacer' })
  footer.appendChild(spacer)
  footer.appendChild(nextBtn)

  return footer
}

// --- Main 区域渲染 ---

/**
 * renderMain(state) -> Element
 * 输入: 应用状态
 * 输出: 主内容区 DOM(左侧类别树 + 右侧任务列表)
 */
function renderMain(state) {
  var main = el('div', { className: 'main' })
  main.appendChild(renderSidebar(state))
  main.appendChild(renderContent(state))
  return main
}

// --- 侧边栏类别树 ---

/**
 * renderSidebar(state) -> Element
 * 输入: 应用状态
 * 输出: 左侧类别树面板
 */
function renderSidebar(state) {
  var sidebar = el('div', { className: 'sidebar' })

  var allLabel = el('div', {
    className: 'category-node ' + (state.selectedCategoryId === null ? 'selected' : '')
  })
  allLabel.appendChild(renderCategoryArrow(state, null))
  allLabel.appendChild(el('span', { className: 'category-name' }, 'All'))
  allLabel.addEventListener('click', function (e) {
    e.stopPropagation()
    if (typeof selectCategory === 'function') selectCategory(state, null)
  })
  sidebar.appendChild(allLabel)

  var tree = buildCategoryTree(state.data.categories)
  tree.forEach(function (node) {
    sidebar.appendChild(renderCategoryNode(state, node, 0))
  })

  sidebar.appendChild(el('div', { className: 'sidebar-divider' }))
  sidebar.appendChild(renderButton('+ Category', function () {
    showCategoryCreateInput(state, null)
  }))

  return sidebar
}

/**
 * renderCategoryNode(state, node, depth) -> Element
 * 输入: 状态 + 树节点 + 嵌套深度
 * 输出: 类别树节点 DOM(带展开/折叠)
 */
function renderCategoryNode(state, node, depth) {
  var hasChildren = node.children.length > 0
  var collapsed = hasChildren && state.collapsedCategoryIds && state.collapsedCategoryIds.indexOf(node.id) !== -1
  var isSelected = state.selectedCategoryId === node.id
  var confirming = state.deleteConfirm && state.deleteConfirm.type === 'category' && state.deleteConfirm.id === node.id
  var classes = 'category-node' + (isSelected ? ' selected' : '')
  var indent = '  '.repeat(depth)

  var row = el('div', { className: classes })
  row.appendChild(renderCategoryArrow(state, node))
  var nameSpan = el('span', { className: 'category-name' })
  nameSpan.textContent = indent + node.name
  row.appendChild(nameSpan)

  if (confirming) {
    row.appendChild(renderDangerButton('Y', function (e) {
      e.stopPropagation()
      if (typeof confirmDelete === 'function') confirmDelete(state)
    }))
    row.appendChild(renderDangerButton('N', function (e) {
      e.stopPropagation()
      if (typeof clearDeleteConfirm === 'function') clearDeleteConfirm(state)
    }))
  } else {
    row.appendChild(renderDangerButton('Del', function (e) {
      e.stopPropagation()
      if (typeof requestDeleteCategory === 'function') requestDeleteCategory(state, node.id)
    }))
  }

  row.addEventListener('click', function (e) {
    e.stopPropagation()
    if (typeof selectCategory === 'function') selectCategory(state, node.id)
  })

  var container = el('div', {})
  container.appendChild(row)
  if (!collapsed) {
    node.children.forEach(function (child) {
      container.appendChild(renderCategoryNode(state, child, depth + 1))
    })
  }
  return container
}

/**
 * renderCategoryArrow(state, node) -> Element
 * 输入: 状态 + 树节点(null 表示 All)
 * 输出: 展开/折叠箭头 DOM
 */
function renderCategoryArrow(state, node) {
  var arrow = el('span', { className: 'category-arrow' })
  if (!node) {
    arrow.textContent = '  '
    return arrow
  }
  var hasChildren = node.children.length > 0
  if (!hasChildren) {
    arrow.textContent = '  '
    return arrow
  }
  var collapsed = state.collapsedCategoryIds && state.collapsedCategoryIds.indexOf(node.id) !== -1
  arrow.textContent = collapsed ? '▶' : '▼'
  arrow.addEventListener('click', function (e) {
    e.stopPropagation()
    toggleCategoryCollapse(state, node.id)
  })
  return arrow
}

/**
 * toggleCategoryCollapse(state, categoryId) -> void
 * 输入: 状态 + 类别 ID
 * 输出: 无,切换折叠状态并重绘
 */
function toggleCategoryCollapse(state, categoryId) {
  if (!state.collapsedCategoryIds) state.collapsedCategoryIds = []
  var idx = state.collapsedCategoryIds.indexOf(categoryId)
  if (idx === -1) {
    state.collapsedCategoryIds.push(categoryId)
  } else {
    state.collapsedCategoryIds.splice(idx, 1)
  }
  if (typeof appRender === 'function') appRender(state)
}

// --- 内容区任务列表 ---

/**
 * renderContent(state) -> Element
 * 输入: 应用状态
 * 输出: 右侧内容区 DOM(任务列表 + 新建入口)
 */
function renderContent(state) {
  var content = el('div', { className: 'content' })

  var catPath = 'All'
  if (state.selectedCategoryId) {
    catPath = getCategoryPath(state.data.categories, state.selectedCategoryId)
  }
  var catHeader = el('div', { className: 'content-category-path' })
  catHeader.textContent = catPath
  content.appendChild(catHeader)

  var tasks = getTasksByCategoryAndWeek(state.data, state.selectedCategoryId, state.currentWeekId)
  var taskList = el('div', { className: 'task-list' })
  tasks.forEach(function (task, index) {
    var row = renderTaskRow(state, task, index)
    taskList.appendChild(row)
  })
  if (tasks.length === 0) {
    var emptyHint = el('div', { className: 'task-row dim' })
    emptyHint.textContent = '  No tasks for this week.'
    taskList.appendChild(emptyHint)
  }
  content.appendChild(taskList)

  var actions = el('div', { className: 'content-actions' })
  actions.appendChild(renderButton('+ Task', function () {
    showTaskCreateInput(state)
  }))
  actions.appendChild(renderButton('+ Recurring', function () {
    showRecurringCreateInput(state)
  }))
  if (state.selectedCategoryId !== null) {
    actions.appendChild(renderButton('+ Subcategory', function () {
      showCategoryCreateInput(state, state.selectedCategoryId)
    }))
  }
  content.appendChild(actions)

  if (state.inputMode) {
    content.appendChild(renderInputLine(state))
  }

  if (state.deleteConfirm) {
    content.appendChild(renderConfirmPrompt(state))
  }

  return content
}

/**
 * renderTaskRow(state, task, index) -> Element
 * 输入: 状态 + 任务对象 + 索引
 * 输出: 单行任务 DOM
 */
function renderTaskRow(state, task, index) {
  var isSelected = state.cursorPosition === index
  var confirming = state.deleteConfirm && state.deleteConfirm.type === 'task' && state.deleteConfirm.id === task.id
  var classes = 'task-row' + (isSelected ? ' selected' : '') + (task.completed ? ' completed' : '')
  var row = el('div', { className: classes })

  var check = task.completed ? '[✓]' : '[ ]'
  var checkSpan = el('span', { className: 'task-check', onClick: function (e) {
    e.stopPropagation()
    if (typeof toggleTask === 'function') toggleTask(state, task.id)
  }})
  checkSpan.textContent = check
  row.appendChild(checkSpan)

  var titleSpan = el('span', { className: 'task-title' })
  titleSpan.textContent = ' ' + task.title
  row.appendChild(titleSpan)

  if (task.recurringId) {
    var recTag = el('span', { className: 'task-tag' })
    recTag.textContent = ' [R]'
    row.appendChild(recTag)
  }

  var spacer = el('span', { className: 'task-spacer' })
  row.appendChild(spacer)

  if (confirming) {
    row.appendChild(renderDangerButton('Y', function (e) {
      e.stopPropagation()
      if (typeof confirmDelete === 'function') confirmDelete(state)
    }))
    row.appendChild(renderDangerButton('N', function (e) {
      e.stopPropagation()
      if (typeof clearDeleteConfirm === 'function') clearDeleteConfirm(state)
    }))
  } else {
    var editBtn = renderButton('Edit', function (e) {
      e.stopPropagation()
      showTaskEditInput(state, task)
    })
    row.appendChild(editBtn)

    var delBtn = renderDangerButton('Del', function (e) {
      e.stopPropagation()
      if (typeof requestDeleteCurrent === 'function') requestDeleteCurrent(state)
    })
    row.appendChild(delBtn)
  }

  return row
}

// --- 按钮 ---

/**
 * renderButton(label, onClick) -> Element
 * 输入: 按钮文字 + 点击回调
 * 输出: [label] 格式按钮 DOM
 */
function renderButton(label, onClick) {
  var span = el('span', { className: 'btn', onClick: onClick })
  span.textContent = '[' + label + ']'
  return span
}

function renderDangerButton(label, onClick) {
  var span = el('span', { className: 'btn btn-danger', onClick: onClick })
  span.textContent = '[' + label + ']'
  return span
}

// --- 输入行 ---

/**
 * renderInputLine(state) -> Element
 * 输入: 应用状态(含 inputMode 信息)
 * 输出: 输入行 DOM(竖线前缀 + 灰底输入区)
 */
function renderInputLine(state) {
  var container = el('div', { className: 'input-line' })

  var input = el('input', {
    type: 'text',
    className: 'input-field',
    placeholder: state.inputPlaceholder || '',
    autofocus: 'true',
    onKeyDown: function (e) {
      if (e.key === 'Enter' && input.value.trim()) {
        var value = input.value.trim()
        if (state.inputCallback) state.inputCallback(value)
      } else if (e.key === 'Escape') {
        if (state.onCancel) state.onCancel()
      }
    },
    onBlur: function () {
      setTimeout(function () {
        if (state.onCancel) state.onCancel()
      }, 150)
    }
  })
  container.appendChild(input)

  setTimeout(function () { input.focus() }, 50)
  return container
}

// --- 删除确认提示 ---

function renderConfirmPrompt(state) {
  var prompt = el('div', { className: 'confirm-prompt' })
  var label = state.deleteConfirm.type === 'task' ? 'Delete task' : 'Delete category'
  prompt.textContent = label + '? [Y] Confirm  [N] Cancel'
  return prompt
}

// --- 配置面板 ---

/**
 * showConfigPanel(state) -> void
 * 输入: 应用状态
 * 输出: 无,在界面显示配置模态面板
 */
function showConfigPanel(state) {
  removeOverlay()
  var overlay = el('div', { className: 'config-overlay' })
  var panel = el('div', { className: 'config-panel' })

  var title = el('div', { className: 'config-title' })
  title.textContent = 'Configuration'
  panel.appendChild(title)

  panel.appendChild(renderConfigField('Cloud URL', state.config.cloudURL || '', function (val) {
    state.config.cloudURL = val
  }))
  panel.appendChild(renderConfigField('Token', state.config.cloudToken || '', function (val) {
    state.config.cloudToken = val
  }, 'password'))
  panel.appendChild(renderConfigField('File Path', state.config.cloudFilePath || 'todolist-data.json', function (val) {
    state.config.cloudFilePath = val
  }))

  var actions = el('div', { className: 'config-actions' })
  actions.appendChild(renderButton('Save', function () {
    if (typeof saveConfigAndClose === 'function') saveConfigAndClose(state)
    removeOverlay()
    if (typeof appRender === 'function') appRender(state)
  }))
  actions.appendChild(renderButton('Cancel', function () {
    removeOverlay()
    if (typeof appRender === 'function') appRender(state)
  }))
  panel.appendChild(actions)

  overlay.appendChild(panel)
  document.body.appendChild(overlay)
}

function renderConfigField(label, value, onChange, type) {
  var row = el('div', { className: 'config-field' })
  var labelSpan = el('span', { className: 'config-label' })
  labelSpan.textContent = label + ': '
  row.appendChild(labelSpan)
  var input = el('input', {
    type: type || 'text',
    className: 'input-field',
    value: value,
    onChange: function (e) { onChange(e.target.value) }
  })
  row.appendChild(input)
  return row
}

function removeOverlay() {
  var existing = document.querySelector('.config-overlay')
  if (existing) existing.remove()
}

// --- 各类创建输入 ---

function showTaskCreateInput(state) {
  state.inputMode = 'createTask'
  state.inputPlaceholder = 'Enter task title...'
  state.inputCallback = function (title) {
    if (typeof createTaskFromInput === 'function') createTaskFromInput(state, title)
  }
  state.onCancel = function () {
    exitInputMode(state)
  }
  if (typeof appRender === 'function') appRender(state)
}

function showTaskEditInput(state, task) {
  state.inputMode = 'editTask'
  state.inputPlaceholder = 'Edit task title...'
  state.editTargetId = task.id
  state.inputCallback = function (title) {
    if (typeof editTaskFromInput === 'function') editTaskFromInput(state, task.id, title)
  }
  state.onCancel = function () {
    exitInputMode(state)
  }
  if (typeof appRender === 'function') appRender(state)
}

function showCategoryCreateInput(state, parentId) {
  state.inputMode = 'createCategory'
  state.inputPlaceholder = 'Enter category name...'
  state.categoryParentId = parentId
  state.inputCallback = function (name) {
    if (typeof createCategoryFromInput === 'function') createCategoryFromInput(state, name, parentId)
  }
  state.onCancel = function () {
    exitInputMode(state)
  }
  if (typeof appRender === 'function') appRender(state)
}

function showRecurringCreateInput(state) {
  removeOverlay()
  var overlay = el('div', { className: 'config-overlay' })
  var panel = el('div', { className: 'config-panel' })

  var title = el('div', { className: 'config-title' })
  title.textContent = 'New Recurring Task'
  panel.appendChild(title)

  var titleField = el('div', { className: 'config-field' })
  titleField.appendChild(el('span', { className: 'config-label' }, 'Title: '))
  var titleInput = el('input', { type: 'text', className: 'input-field' })
  titleField.appendChild(titleInput)
  panel.appendChild(titleField)

  var freqVal = { value: 1 }
  var freqField = el('div', { className: 'config-field' })
  freqField.appendChild(el('span', { className: 'config-label' }, 'Every N weeks: '))
  freqField.appendChild(renderIncrementControl(freqVal, 1))
  panel.appendChild(freqField)

  var countVal = { value: 4 }
  var countField = el('div', { className: 'config-field' })
  countField.appendChild(el('span', { className: 'config-label' }, 'Repeat N times: '))
  countField.appendChild(renderIncrementControl(countVal, 1))
  panel.appendChild(countField)

  var startField = el('div', { className: 'config-field' })
  startField.appendChild(el('span', { className: 'config-label' }, 'Start week: '))
  var startInput = el('input', { type: 'text', className: 'input-field', value: state.currentWeekId })
  startField.appendChild(startInput)
  panel.appendChild(startField)

  var actions = el('div', { className: 'config-actions' })
  actions.appendChild(renderButton('Create', function () {
    var recTitle = titleInput.value.trim()
    if (!recTitle) return
    var freq = freqVal.value
    var count = countVal.value
    var start = startInput.value.trim() || state.currentWeekId
    if (typeof createRecurringFromInput === 'function') {
      createRecurringFromInput(state, recTitle, freq, count, start)
    }
    removeOverlay()
    if (typeof appRender === 'function') appRender(state)
  }))
  actions.appendChild(renderButton('Cancel', function () {
    removeOverlay()
    if (typeof appRender === 'function') appRender(state)
  }))
  panel.appendChild(actions)

  overlay.appendChild(panel)
  document.body.appendChild(overlay)
  setTimeout(function () { titleInput.focus() }, 50)
}

/**
 * renderIncrementControl(valueHolder, min) -> Element
 * 输入: {value: number} + 最小值
 * 输出: [<<] [<] N [>] [>>] 自定义增减控件 DOM
 */
function renderIncrementControl(valueHolder, min) {
  var row = el('div', { className: 'increment-control' })

  var dec4Btn = renderButton('<<', function () {
    valueHolder.value = Math.max(min, (valueHolder.value || min) - 4)
    display.textContent = valueHolder.value
  })
  row.appendChild(dec4Btn)

  var decBtn = renderButton('<', function () {
    valueHolder.value = Math.max(min, (valueHolder.value || min) - 1)
    display.textContent = valueHolder.value
  })
  row.appendChild(decBtn)

  var display = el('span', { className: 'increment-value' })
  display.textContent = valueHolder.value
  row.appendChild(display)

  var incBtn = renderButton('>', function () {
    valueHolder.value = (valueHolder.value || min) + 1
    display.textContent = valueHolder.value
  })
  row.appendChild(incBtn)

  var inc4Btn = renderButton('>>', function () {
    valueHolder.value = (valueHolder.value || min) + 4
    display.textContent = valueHolder.value
  })
  row.appendChild(inc4Btn)

  return row
}

function exitInputMode(state) {
  state.inputMode = null
  state.inputCallback = null
  state.onCancel = null
  state.inputPlaceholder = ''
  state.editTargetId = null
  state.categoryParentId = null
  if (typeof appRender === 'function') appRender(state)
}

// --- 文件导入触发 ---

function triggerImportFile(state) {
  var input = el('input', {
    type: 'file',
    accept: '.json',
    onChange: function (e) {
      var file = e.target.files[0]
      if (!file) return
      var reader = new FileReader()
      reader.onload = function (evt) {
        if (typeof triggerImport === 'function') triggerImport(state, evt.target.result)
      }
      reader.readAsText(file)
      input.remove()
    }
  })
  document.body.appendChild(input)
  input.click()
}

// --- 状态消息 ---

/**
 * renderStatusMessage(text, type, duration) -> void
 * 输入: 消息文本 + 类型(info/error/success) + 显示时长(ms,默认3000)
 * 输出: 无,在底部短暂显示状态消息(自动消失)
 */
function renderStatusMessage(text, type, duration) {
  var existing = document.querySelector('.status-message')
  if (existing) existing.remove()
  var msg = el('div', { className: 'status-message status-' + (type || 'info') })
  msg.textContent = text
  document.body.appendChild(msg)
  setTimeout(function () {
    if (msg.parentNode) msg.remove()
  }, duration || 3000)
}
