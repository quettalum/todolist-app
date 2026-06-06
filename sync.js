// ============================================================
// sync.js — GitHub 云端同步模块
// ============================================================

// --- URL 解析与构建 ---

/**
 * parseGitHubURL(url) -> {owner, repo}
 * 输入: GitHub 仓库 URL("https://github.com/user/repo")
 * 输出: {owner: "user", repo: "repo"}
 */
function parseGitHubURL(url) {
  var clean = url.replace(/\/+$/, '').replace(/\.git$/, '')
  var parts = clean.split('/')
  var owner = parts[parts.length - 2]
  var repo = parts[parts.length - 1]
  return { owner: owner, repo: repo }
}

/**
 * getCloudFilePath(config) -> string
 * 输入: AppConfig
 * 输出: 云端文件路径,默认 "todolist-data.json"
 */
function getCloudFilePath(config) {
  return config.cloudFilePath || 'todolist-data.json'
}

/**
 * buildAPIURL(config) -> string
 * 输入: AppConfig
 * 输出: GitHub API 完整 URL
 */
function buildAPIURL(config) {
  var parsed = parseGitHubURL(config.cloudURL)
  var filePath = getCloudFilePath(config)
  return 'https://api.github.com/repos/' + parsed.owner + '/' + parsed.repo + '/contents/' + filePath
}

// --- 合并辅助 ---

/**
 * idIndex(arr) -> object
 * 输入: 对象数组
 * 输出: {id: item} 格式的 Map 对象,按 id 索引
 */
function idIndex(arr) {
  var map = {}
  arr.forEach(function (item) { map[item.id] = item })
  return map
}

/**
 * copyItem(item) -> object
 * 输入: 单个 item 对象
 * 输出: 浅拷贝副本(仅复制所有自有属性)
 */
function copyItem(item) {
  var copy = {}
  Object.keys(item).forEach(function (key) { copy[key] = item[key] })
  return copy
}

/**
 * itemEqual(a, b, keys) -> boolean
 * 输入: 两个同类型对象 + 需要对比的属性名列表
 * 输出: 指定属性值都相等则返回 true
 */
function itemEqual(a, b, keys) {
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i]
    if (a[k] !== b[k]) return false
  }
  return true
}

// --- 配置校验 ---

/**
 * isConfigValid(config) -> boolean
 * 输入: AppConfig
 * 输出: 配置是否足以执行云端操作
 */
function isConfigValid(config) {
  return !!(config.cloudURL && config.cloudToken)
}

// --- 数据拉取 ---

/**
 * decodeBase64UTF8(base64) -> string
 * 输入: Base64 编码的 UTF-8 字符串
 * 输出: 正确解码的 JavaScript 字符串(支持中文等多字节字符)
 */
function decodeBase64UTF8(base64) {
  var clean = base64.replace(/\s/g, '')
  var binary = atob(clean)
  var bytes = new Uint8Array(binary.length)
  for (var i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder('utf-8').decode(bytes)
}

/**
 * recoverString(str) -> string
 * 输入: 可能被旧客户端双重编码损坏的字符串
 * 输出: 修复后的原始字符串,无法修复则返回原文
 * 旧客户端 bug: atob → JSON.parse 把 UTF-8 字节当成 Latin-1 字符,
 *   push 时再 encodeURIComponent → 产生双重 UTF-8 编码
 * 检测: 若所有字符码点 ≤ 0xFF,可能是受损的 Latin-1 冒充串,
 *   尝试用 UTF-8 解码还原
 */
function recoverString(str) {
  if (typeof str !== 'string') return str
  for (var i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 0xFF) return str
  }
  var bytes = new Uint8Array(str.length)
  for (var j = 0; j < str.length; j++) {
    bytes[j] = str.charCodeAt(j)
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch (e) {
    return str
  }
}

/**
 * recoverData(data) -> AppData
 * 输入: 拉取的数据(可能被旧客户端损坏)
 * 输出: 修复后的数据
 */
function recoverData(data) {
  if (!data) return data
  if (data.tasks) {
    data.tasks.forEach(function (t) { t.title = recoverString(t.title) })
  }
  if (data.categories) {
    data.categories.forEach(function (c) { c.name = recoverString(c.name) })
  }
  if (data.recurringTasks) {
    data.recurringTasks.forEach(function (r) { r.title = recoverString(r.title) })
  }
  return data
}

/**
 * pullData(config) -> Promise<AppData>
 * 输入: AppConfig
 * 输出: 从 GitHub 仓库拉取并解析的数据
 */
function pullData(config) {
  var url = buildAPIURL(config)
  return fetch(url, {
    headers: {
      'Authorization': 'token ' + config.cloudToken,
      'Accept': 'application/vnd.github.v3+json'
    }
  }).then(function (res) {
    if (res.status === 404) return null
    if (!res.ok) throw new Error('Pull failed: ' + res.status)
    return res.json()
  }).then(function (fileData) {
    if (!fileData) return null
    var content = fileData.content
    var decoded = decodeBase64UTF8(content)
    var data = importFromJSON(decoded)
    data = recoverData(data)
    return {
      data: data,
      sha: fileData.sha
    }
  })
}

// --- 数据推送 ---

/**
 * encodeBase64UTF8(str) -> string
 * 输入: JavaScript 字符串(含中文等多字节字符)
 * 输出: 正确的 Base64(UTF-8) 编码
 */
function encodeBase64UTF8(str) {
  var encoder = new TextEncoder()
  var bytes = encoder.encode(str)
  var binary = ''
  for (var i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * pushData(config, data, sha) -> Promise<{sha}>
 * 输入: AppConfig + AppData + 可选 sha(用于更新)
 * 输出: Promise,推送到 GitHub 仓库
 */
function pushData(config, data, sha) {
  var url = buildAPIURL(config)
  var json = exportToJSON(data)
  var encoded = encodeBase64UTF8(json)
  var body = {
    message: 'Update todolist data',
    content: encoded
  }
  if (sha) body.sha = sha
  return fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': 'token ' + config.cloudToken,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }).then(function (res) {
    if (!res.ok) {
      if (res.status === 409) {
        return res.json().then(function (errBody) {
          var msg = 'Push failed: 409 Conflict'
          if (errBody.message && errBody.message.indexOf('empty') !== -1) {
            msg += ' - Repository may be empty. Ensure the repo has at least one commit (e.g. a README).'
          } else if (errBody.message && errBody.message.indexOf('branch') !== -1) {
            msg += ' - The default branch may not exist. Try initializing the repo with a commit.'
          } else {
            msg += ' - The file may have been modified since last pull. Try syncing again.'
          }
          throw new Error(msg)
        })
      }
      throw new Error('Push failed: ' + res.status)
    }
    return res.json()
  }).then(function (result) {
    return { sha: result.content.sha }
  })
}

// --- 冲突解决 ---

/**
 * threeWayMergeArray(localArr, remoteArr, baseArr, compareKeys) -> Array
 * 输入: 本地数组 + 远程数组 + Base快照数组 + 对比字段列表
 * 输出: 三路合并后的数组
 * 仿 Git merge 逻辑,对每条记录判断增/删/改:
 *   - 仅在Base出现 → 已删除,不加入(此情况不会出现,id唯一)
 *   - 仅在Local出现 → 本地新增,保留
 *   - 仅在Remote出现 → 远程新增,添加
 *   - 三边都有 → 两边均未改 → 保留; 仅本地改 → 保留本地; 仅远程改 → 用远程; 两边都改 → 远程优先
 *   - Local+Base有而Remote无 → 远程删。本地未改则删,本地改了则保留
 *   - Remote+Base有而Local无 → 本地删。远程未改则删,远程改了则保留
 */
function threeWayMergeArray(localArr, remoteArr, baseArr, compareKeys) {
  var localMap = idIndex(localArr)
  var remoteMap = idIndex(remoteArr)
  var baseMap = idIndex(baseArr)

  var allIds = {}
  baseArr.forEach(function (x) { allIds[x.id] = true })
  localArr.forEach(function (x) { allIds[x.id] = true })
  remoteArr.forEach(function (x) { allIds[x.id] = true })

  var result = []
  var ids = Object.keys(allIds)

  for (var i = 0; i < ids.length; i++) {
    var id = ids[i]
    var inLocal = !!localMap[id]
    var inRemote = !!remoteMap[id]
    var inBase = !!baseMap[id]

    if (inBase && inLocal && inRemote) {
      var localChanged = !itemEqual(localMap[id], baseMap[id], compareKeys)
      var remoteChanged = !itemEqual(remoteMap[id], baseMap[id], compareKeys)
      if (!localChanged && !remoteChanged) {
        result.push(copyItem(localMap[id]))
      } else if (localChanged && !remoteChanged) {
        result.push(copyItem(localMap[id]))
      } else if (!localChanged && remoteChanged) {
        result.push(copyItem(remoteMap[id]))
      } else {
        result.push(copyItem(remoteMap[id]))
      }
    } else if (!inBase && inLocal && !inRemote) {
      result.push(copyItem(localMap[id]))
    } else if (!inBase && !inLocal && inRemote) {
      result.push(copyItem(remoteMap[id]))
    } else if (inBase && inLocal && !inRemote) {
      var localChanged2 = !itemEqual(localMap[id], baseMap[id], compareKeys)
      if (localChanged2) {
        result.push(copyItem(localMap[id]))
      }
    } else if (inBase && !inLocal && inRemote) {
      var remoteChanged2 = !itemEqual(remoteMap[id], baseMap[id], compareKeys)
      if (remoteChanged2) {
        result.push(copyItem(remoteMap[id]))
      }
    }
  }
  return result
}

/**
 * simpleTwoWayMerge(localData, remoteData) -> AppData
 * 输入: 本地 AppData + 远程 AppData
 * 输出: 合并后的 AppData(纯增量合并,作为无Base快照时的降级方案)
 * 逻辑: 保留本地所有条目,从远程补充本地没有的条目
 */
function simpleTwoWayMerge(localData, remoteData) {
  if (!remoteData) return localData
  var merged = copyData(localData)
  var localIds = {}
  merged.tasks.forEach(function (t) { localIds[t.id] = true })
  var localCatIds = {}
  merged.categories.forEach(function (c) { localCatIds[c.id] = true })
  var localRecIds = {}
  merged.recurringTasks.forEach(function (r) { localRecIds[r.id] = true })
  remoteData.tasks.forEach(function (rt) {
    if (!localIds[rt.id]) merged.tasks.push(rt)
  })
  remoteData.categories.forEach(function (rc) {
    if (!localCatIds[rc.id]) merged.categories.push(rc)
  })
  remoteData.recurringTasks.forEach(function (rr) {
    if (!localRecIds[rr.id]) merged.recurringTasks.push(rr)
  })
  return merged
}

/**
 * resolveConflict(localData, remoteData, baseData) -> AppData
 * 输入: 本地 AppData + 远程 AppData + Base快照 AppData(首次同步为null)
 * 输出: 三路合并后的 AppData
 * 无Base快照时降级为 simpleTwoWayMerge
 */
function resolveConflict(localData, remoteData, baseData) {
  if (!remoteData) return localData
  if (!baseData) return simpleTwoWayMerge(localData, remoteData)

  var merged = copyData(localData)

  merged.tasks = threeWayMergeArray(
    localData.tasks, remoteData.tasks, baseData.tasks,
    ['title', 'categoryId', 'weekId', 'completed', 'recurringId']
  )

  merged.categories = threeWayMergeArray(
    localData.categories, remoteData.categories, baseData.categories,
    ['name', 'parentId', 'order']
  )

  merged.recurringTasks = threeWayMergeArray(
    localData.recurringTasks, remoteData.recurringTasks, baseData.recurringTasks,
    ['title', 'categoryId', 'frequencyWeeks', 'repeatCount', 'startWeekId']
  )

  return merged
}

// --- 完整同步流程 ---

/**
 * syncWithCloud(config, localData) -> Promise<{data, status}>
 * 输入: AppConfig + 本地 AppData
 * 输出: {data: AppData, status: "synced"|"pushed"|"error"|"no_config"}
 * 流程: pull → 三路合并(使用Base快照) → push → 保存新快照
 */
function syncWithCloud(config, localData) {
  if (!isConfigValid(config)) {
    return Promise.resolve({ data: localData, status: 'no_config' })
  }
  var baseData = loadSyncSnapshot()
  return pullData(config).then(function (pullResult) {
    if (pullResult === null) {
      return pushData(config, localData).then(function (pushResult) {
        var nextConfig = {}
        Object.assign(nextConfig, config)
        nextConfig.lastPullHash = pushResult.sha
        saveConfig(nextConfig)
        var nextData = copyData(localData)
        nextData.lastSync = formatDateISO()
        saveSyncSnapshot(nextData)
        return { data: nextData, status: 'pushed', config: nextConfig }
      })
    }
    var merged = resolveConflict(localData, pullResult.data, baseData)
    return pushData(config, merged, pullResult.sha).then(function (pushResult) {
      var nextConfig = {}
      Object.assign(nextConfig, config)
      nextConfig.lastPullHash = pushResult.sha
      saveConfig(nextConfig)
      var nextData = copyData(merged)
      nextData.lastSync = formatDateISO()
      saveSyncSnapshot(nextData)
      return { data: nextData, status: 'synced', config: nextConfig }
    })
  }).catch(function (err) {
    return { data: localData, status: 'error', error: err.message }
  })
}
