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
 * buildAPIURL(config, pathType) -> string
 * 输入: AppConfig + "contents"|"blob"
 * 输出: GitHub API 完整 URL
 * pathType="contents": API 端点(含文件路径)
 */
function buildAPIURL(config, pathType) {
  var parsed = parseGitHubURL(config.cloudURL)
  var filePath = getCloudFilePath(config)
  return 'https://api.github.com/repos/' + parsed.owner + '/' + parsed.repo + '/contents/' + filePath
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
    content: encoded,
    branch: 'main'
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
    if (!res.ok) throw new Error('Push failed: ' + res.status)
    return res.json()
  }).then(function (result) {
    return { sha: result.content.sha }
  })
}

// --- 冲突解决 ---

/**
 * resolveConflict(localData, remoteData) -> AppData
 * 输入: 本地 AppData + 远程 AppData
 * 输出: 合并后的 AppData(基于任务 ID,两侧保留,以远程为基准合并)
 */
function resolveConflict(localData, remoteData) {
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

// --- 完整同步流程 ---

/**
 * syncWithCloud(config, localData) -> Promise<{data, status}>
 * 输入: AppConfig + 本地 AppData
 * 输出: {data: AppData, status: "synced"|"pulled"|"pushed"|"error"|"no_config"}
 */
function syncWithCloud(config, localData) {
  if (!isConfigValid(config)) {
    return Promise.resolve({ data: localData, status: 'no_config' })
  }
  return pullData(config).then(function (pullResult) {
    if (pullResult === null) {
      return pushData(config, localData).then(function (pushResult) {
        var nextConfig = {}
        Object.assign(nextConfig, config)
        nextConfig.lastPullHash = pushResult.sha
        saveConfig(nextConfig)
        var nextData = copyData(localData)
        nextData.lastSync = formatDateISO()
        return { data: nextData, status: 'pushed', config: nextConfig }
      })
    }
    var merged = resolveConflict(localData, pullResult.data)
    return pushData(config, merged, pullResult.sha).then(function (pushResult) {
      var nextConfig = {}
      Object.assign(nextConfig, config)
      nextConfig.lastPullHash = pushResult.sha
      saveConfig(nextConfig)
      var nextData = copyData(merged)
      nextData.lastSync = formatDateISO()
      return { data: nextData, status: 'synced', config: nextConfig }
    })
  }).catch(function (err) {
    return { data: localData, status: 'error', error: err.message }
  })
}
