---
title: assistant-ai-agent学习路径
slug: assistant-ai-agent学习路径
description: assistant-ai-agent学习路径
publishedAt: 2026-10-08
updatedAt: 2026-10-08
tags:
  - assistant-ai-agent学习路径
attachments: []
draft: true
---
01 整体架构鸟瞰



1. 一条用户消息的完整链路



下面是真实的调用栈，每行对应一个类/方法：



POST /xtAgent/agenticStreamSearch

\    │

\    ▼

XtAgenticServiceController.xtAgenticStreamSearch()

  agent-server/src/main/java/.../controller/XtAgenticServiceController.java

\- 创建 SearchSseEmitter（SSE 长连接对象）

\- 把业务逻辑提交到线程池异步执行（ThreadPoolExecutorUtil.getAgentExecutorService()）

\- 立即返回 emitter 给 Spring，HTTP 响应头发出，SSE 连接建立

\    │

\    ▼  （线程池里异步跑）

XtAgenticService.handleXtAgenticStreamSearch()

  agent-server/src/main/java/.../service/XtAgenticService.java

\- initAgentContext()：把 HTTP 请求字段翻译成 AgentContext 对象

\    （用户信息、设备信息、地理位置、历史消息、searchSource……）

\- 调用 gatewayService.handleXtAgenticStreamSearch(agentContext)

\    │

\    ▼

GatewayService.handleXtAgenticStreamSearch()

  agent-gateway/src/main/java/.../service/GatewayService.java

\- 内容安全检查（ContentSecurityManager）

\- 加载历史会话消息（HistoryMessageManager）

\- 执行意图识别链（IntentChainManager.executeIntentChain()）

\    → 返回 IntentResult，写入 agentContext.intentResult

\- 执行器分发（ExecutorDispatchService.dispatchBusinessExecutor()）

\    → 根据意图选择执行器

\    → 执行器调用 execute(agentContext)

\    │

\    ├── 走 ReAct 路径（最常见）

\    │       ▼

\    │   SkillReActAgentExecutor.doBusinessExecutor()

\    │   agent-gateway/src/main/java/.../executor/SkillReActAgentExecutor.java

\    │   - 调用 ReActEngine.execute(agentContext)

\    │           ▼

\    │       ReActEngine.executeReactProcess()

\    │       agent-runtime/src/main/java/.../react/ReActEngine.java

\    │       - PreLoopHandler  （循环前初始化，只跑一次）

\    │       - while (shouldContinue) {

\    │           - PreProcessHandler   （每轮：消息裁剪/token统计）

\    │           - PromptHandler       （每轮：system prompt组装）

\    │           - MessageHandler      （每轮：消息历史组装）

\    │           - ToolPrepareHandler  （每轮：动态工具加载）

\    │           - ModelCallHandler    （每轮：调用 LLM，拿流式响应）

\    │           - OutputParseHandler  （每轮：解析流式输出）

\    │           - ToolDispatchHandler （每轮：识别工具调用）

\    │           - ToolExecuteHandler  （每轮：并发执行工具）

\    │           - PostProcessHandler  （每轮：后处理）

\    │         }

\    │

\    ├── 走 Workflow 路径

\    │       ▼

\    │   OnlineWorkflowExecutor / AgentWorkflowExecutor

\    │   → DAG 节点引擎（LlmNode / ToolCallNode / StaticNode…）

\    │

\    ├── 走 A2A 路径

\    │       ▼

\    │   A2AExecutor → 调用另一个 Agent 服务

\    │

\    └── 走兜底缓存路径

\    ▼

\    EmergencyCacheExecutor → 直接返回缓存结果

\    │

\    ▼  （所有路径都往这里写流式事件）

AgentStreamEventConsumer → SseStreamProtocol → SearchSseEmitter

agent-support/src/main/java/.../stream/AgentStreamEventConsumer.java

\- 每次 LLM 吐出一个 token / 工具调用进度 / 最终回复

\- 封装成 SSE 事件（text/think/tool_start/tool_end/error…）

\- 推送给客户端

\    │

\    ▼

客户端（APP / H5）实时收到流式内容

关键设计：请求进来立刻返回 SSE 连接，AI 思考过程实时推流，不阻塞等待。



2. 各模块边界



agent-server — HTTP 入口 & 业务编排



做什么：



接收 HTTP 请求，校验参数

构建 AgentContext（把请求字段翻译成内部统一对象）

把工作丢进线程池（异步化），返回 SSE 连接

处理 SSE 错误事件

不做什么：

不知道意图是什么，不调 LLM，不定义工具。



核心类：



XtAgenticServiceController — HTTP 入口

XtAgenticService — 构建 AgentContext，调用 GatewayService

agent-gateway — 意图路由 & 执行器调度



做什么：



内容安全、限流

按优先级执行意图识别链，得出 IntentResult（意图枚举）

根据意图枚举路由到对应执行器

执行器调用下层 core/runtime 执行真正的 AI 推理

不做什么：

不直接调 LLM，不定义工具实现。



核心类：



GatewayService — 网关总入口

IntentChainManager — 意图识别链管理

ExecutorDispatchService — 执行器分发

各 *Executor — 不同执行路径的实现

agent-core — ReAct 引擎 & 上下文 & 模型 & 工具管理



做什么：



定义 ReAct 各阶段 Handler 接口（PreLoop/Prompt/ModelCall…）

管理 LLM 模型（ChatModelManager，对接美团内部 Friday 模型服务）

管理工具元数据（ToolMetaRegistry，动态工具搜索策略）

策略插件体系（Strategy/StrategyRegistry/StrategySelector）

Prompt 组装、消息裁剪、Token 计算

实验/AB 框架（ExperimentEngine）

不做什么：

不做 HTTP，不做网关路由，不实现具体业务工具。



核心类：



SkillReactAgent — Handler 容器（把所有 Handler 聚合在一起）

各 \*Handler + \*HandlerImpl — 各阶段实现

StrategyRegistry / StrategySelector — 插件调度

ChatModelManager — 模型管理

agent-runtime — 执行引擎（驱动 core）



做什么：



ReActEngine：驱动 core 的 Handler 链，管理 while 循环、异常重试、Token 监控

WorkflowOnlineParseService：解析平台下发的 Workflow 配置，构建 DAG 并执行

流式响应解析（LlmFridayHandler 等）

中间启停钩子（MidStartLoopHook，支持从某个阶段中间开始恢复）

不做什么：

不实现业务工具，不做 HTTP。



核心类：



ReActEngine — ReAct 主循环驱动

AwareReActEngine — 接口

agent-tool — 工具实现



做什么：



具体业务工具的实现（搜索、POI、订单、天气、猫眼、大众点评…）

每个工具继承 BaseTool，实现 executeInternal()

通过 @ToolMetaConfig 注解声明 meta（类别、场景、tier）

不做什么：

不做调度，不做路由。



agent-common — 公共基础



所有模块共用的类型（AgentContext、枚举、常量、工具类）

无业务逻辑

agent-support — 第三方集成 & 流式协议



SSE 流式推送协议（AgentStreamEventConsumer、SseStreamProtocol）

Mafka 消息队列生产者

第三方服务 RPC 封装

3. 架构全图



┌────────────────────────────────────────────────────────────────┐

│                      外部调用方 (APP / H5)                      │

└───────────────────────────┬────────────────────────────────────┘

\    │  POST /xtAgent/agenticStreamSearch

\    │  ← SSE 长连接，流式推流 →

┌───────────────────────────▼────────────────────────────────────┐

│                      agent-server 层                            │

│   XtAgenticServiceController                                   │

│        └─ XtAgenticService.initAgentContext()                  │

│             └─ 构建 AgentContext（统一上下文对象）              │

└───────────────────────────┬────────────────────────────────────┘

\    │

┌───────────────────────────▼────────────────────────────────────┐

│                      agent-gateway 层                           │

│   GatewayService                                               │

│    ├─ ContentSecurityManager（内容安全）                        │

│    ├─ HistoryMessageManager（历史消息）                         │

│    ├─ AgentLimitManager（限流）                                 │

│    │                                                            │

│    ├─ IntentChainManager（意图识别链）                          │

│    │    ├─ \[Layer 1: RULE_LEVEL]                               │

│    │    │   ├─ IntentInterventionHandler（干预规则）            │

│    │    │   ├─ TemplateRuleHandler（模板规则）                  │

│    │    │   └─ A2AIntentHandler（A2A上下文判断）               │

│    │    ├─ \[Layer 2: MODEL_LEVEL]                              │

│    │    │   ├─ DquIntentHandler（DQU意图模型）                  │

│    │    │   └─ IntentModelHandler（通用意图模型）               │

│    │    └─ \[Layer 3: FALLBACK_LEVEL]                           │

│    │        └─ FallbackIntentHandler（兜底：慢搜意图）          │

│    │                                                            │

│    └─ ExecutorDispatchService（执行器分发）                     │

│         ├─ SKILL_REACT_EXECUTOR（默认 ReAct）                  │

│         ├─ REACT_AGENT_EXECUTOR                                │

│         ├─ ONLINE_WORKFLOW_EXECUTOR（在线Workflow）             │

│         ├─ WORKFLOW_EXECUTOR                                   │

│         ├─ A2A_EXECUTOR（多Agent协作）                          │

│         ├─ OVERVIEW_EXECUTOR（概览模式）                        │

│         └─ EMERGENCY_CACHE_EXECUTOR（限流兜底）                 │

└────────────┬───────────────────────────────┬───────────────────┘

\    │ ReAct路径                      │ Workflow路径

┌────────────▼────────────┐      ┌────────────▼──────────────────┐

│      agent-core 层       │      │      agent-runtime 层          │

│                          │      │                                │

│  SkillReactAgent         │      │  ReActEngine（驱动core）        │

│  （Handler 容器）         │◄─────┤   - 管理 while 循环            │

│   ├─ PreLoopHandler      │      │   - 异常重试                   │

│   ├─ PromptHandler       │      │   - Token 监控                 │

│   ├─ MessageHandler      │      │                                │

│   ├─ ToolPrepareHandler  │      │  WorkflowOnlineParseService   │

│   ├─ ModelCallHandler    │      │   - 解析 DAG 配置              │

│   ├─ OutputParseHandler  │      │   - LlmNode（LLM调用节点）     │

│   ├─ ToolDispatchHandler │      │   - ToolCallNode（工具节点）    │

│   ├─ ToolExecuteHandler  │      │   - StaticNode（静态回复节点）  │

│   ├─ PostProcessHandler  │      │   - ConcatNode（拼接节点）      │

│   └─ LoopCheckHandler    │      └────────────────────────────────┘

│                          │

│  ChatModelManager        │      ┌───────────────────────────────┐

│  （对接Friday模型）        │      │      agent-tool 层             │

│                          │      │  各业务 Tool 实现               │

│  ToolMetaRegistry        │      │  （搜索/POI/订单/天气/猫眼…）   │

│  HybridToolSearchStrategy│      │  继承 BaseTool<T>              │

│                          │      └───────────────────────────────┘

│  StrategyRegistry        │

│  StrategySelector        │

│  ExperimentEngine        │

└──────────────────────────┘

\    │

┌────────────▼────────────────────────────────────────────────────┐

│           agent-support / agent-common                           │

│   AgentStreamEventConsumer → SseStreamProtocol → SSE推流        │

│   公共类型 / 工具类 / 监控常量                                    │

└──────────────────────────────────────────────────────────────────┘

4. 三个最重要的设计决策（认知锚点）



① AgentContext 是穿透全层的上下文载体



XtAgenticService.initAgentContext()

  → 创建 ReactAgentContext（实现了 AgentContext 接口）

  → 写入用户信息、设备信息、地理位置、历史消息、searchSource



GatewayService

  → 写入 intentResult（意图识别结果）

  → 写入 executeContextMap（实验分组、快速路由覆盖标记…）



ReActEngine / Handlers

  → 写入 currentLoopCount（当前轮次）

  → 写入 activatedSkills（激活的 skill）

  → 写入 extraInfoMap（模型名、token 统计…）

每一层都在同一个对象上读写，不用层层传参，任何地方都能拿到完整上下文。



② 意图 → 执行器 完全配置化



// ExecutorDispatchService.java

String executorName = gatewayLionConfig

\    .getAgentIntent2ExecutorTypeMap()           // Lion 配置，Key=意图code，Value=执行器名

\    .get(intentResult.getIntentEnum().getCode());

ExecutorEnum executorEnum = ExecutorEnum.valueOf(executorName);

意图 code 到执行器名字的映射来自 Lion（美团配置中心），不改代码就能切换路由。

新增执行器只需：① 实现 BaseExecutor，声明 getExecutor() 返回新枚举 ② Lion 配置加一条映射。



③ ReAct 是"思考 → 工具 → 思考"的循环，不是一次性调用



第 1 轮：

  组装 Prompt + 历史消息 → 调 LLM

  LLM 说："我需要搜一下餐厅" → 输出 tool_call(search_poi)

  → 执行 search_poi 工具 → 拿到餐厅列表



第 2 轮：

  把餐厅列表作为 tool result 塞回消息 → 再调 LLM

  LLM 说："好的，这里有几家不错的..." → 输出最终文本

  → OutputParseHandler 识别是 OUTPUT 类型，退出循环



结束。

LoopCheckHandler.shouldContinue() 检查 phaseResult.isContinueExecution() 决定是否继续。

LoopCheckHandler.isMaxLoopExceeded() 检查 currentLoopCount >= maxLoopCountPerRequest（Lion配置）防无限循环。
