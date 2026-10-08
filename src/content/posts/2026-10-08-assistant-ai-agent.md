---
title: assistant-ai-agent架构解读
slug: assistant-ai-agent
description: assistant-ai-agent
publishedAt: 2026-10-08
updatedAt: 2026-10-08
tags:
  - 实战
attachments: []
draft: true
---
架构解读

一、assistant-ai-agent（引擎层，约 20 万行）

模块地图

agent-server：HTTP 入口（SSE），立即返回连接 + 线程池异步

agent-gateway：内容安全 → 限流 → 历史消息 → 意图链 → 执行器分发

agent-core：ReAct 9 个 Handler 定义、模型管理、工具元数据、策略插件、实验

agent-runtime：ReActEngine while 循环驱动、Workflow DAG、流式解析

agent-tool：业务工具（搜索/POI/订单/天气…），继承 BaseTool

agent-support：SSE 协议、消息队列、第三方 RPC

设计决策清单（每条都是面试素材）

① AgentContext 穿透全层 一个上下文对象贯穿所有层，每层在上面读写，不层层传参。任何位置都能拿到完整上下文。

② 意图→执行器完全配置化 意图 code 到执行器的映射走 Lion 配置中心，新增执行器=实现 BaseExecutor + 加一行配置，不改代码切换路由。

③ 意图链三层降级 规则（干预/业务模板）→ 模型（通用意图模型）→ 兜底（慢搜意图）。确定性优先，模型兜底，保证任何情况有结果。

④ ReAct 拆 9 个 Handler 不是技术洁癖：每个 Handler 可独立开关（isEnabled）、可插监控拦截器（ReActPhaseMonitorInterceptor）、单测独立、不同 Agent 场景复用引擎只换 Handler 组合。本质是责任链+策略模式。

⑤ 循环保险丝 maxLoopCountPerRequest 走 Lion 配置，超限返回 MAX_LOOP_EXCEEDED。这是防死循环烧 token 的硬兜底。

⑥ 异常分层 BusinessExecuteException 里区分可重试（塞错误信息进上下文 continue）和不可重试（降级返回）。handleBusinessException 返回 shouldRetry 决定走向。

⑦ 每轮 token 打点 finally 块里 markLoopTokenMonitor/accumulateLoopTokens/resetLoopTokens——成本可观测是生产系统的标配。

⑧ 记忆体系双轨

短期（HistoryMessageManager，gateway 层）：20 轮/24K 截断 + 可选压缩 + 重试去重

长期（MemoryLoadManager，core 层）：插件化 loader、按 searchSource 配置、并行+1秒超时+异常不抛出

⑨ 中间启停 MidStartLoopHook/ContinuationService 支持从某个阶段中间恢复——Agent 执行中断后不是从头再来。

⑩ 动态工具加载 ToolPrepareHandler + ToolMetaRegistry + HybridToolSearchStrategy——不是每次全量工具列表，按场景/意图动态选工具，省 token 提准确率。

二、assistant-api（接入层，约 9 万行）

核心职责

会话生命周期（SessionManager）、限流（RateLimitManager）、内容审核、干预规则（InterveneActionProcessor + Sug干预文档）、loading 态、历史消息、双通道下发。

设计决策清单

① SSE 客户端调下游 DeepSearchService 用 OkHttp（OkHttpClientManager）建 SSE 长连接调 agent 层，URL 走 Lion 配置（xtAgenticSearchUrl）。

② think/text 流分离 DeepThinkParseSeparateBufferedReader——把模型的思考过程（think）和正式回答（text）从流里拆开，前端可以分别渲染（思考过程折叠展示）。

③ 双通道下发 在线 H5 走 SSE 直推（EmitterRegistry）；APP 走 Pike 长连接（PikePushService），PikeFailureTrackingService 追踪推送失败。

④ Loading 态先行 LoadingSendService 在 AI 响应前先推 loading，降低感知延迟——首字慢的体验优化。

⑤ 干预体系 InterveneActionProcessor + Sug干预规则文档——特定 query 直接走人工配置的答案/动作，不经过模型，保核心场景的确定性。

三、AI 友好工具（题外话存档）

工具	位置	作用

AGENTS.md	两个项目根目录	构建命令、代码规范、模块架构——AI 的入职手册

学习笔记/（7 篇）	agent 项目	架构叙事：请求链路/ReAct/Strategy/Tool/Workflow/监控

.gitnexus/	api 项目	已建索引：11694 符号、300 执行流，可查调用关系/影响面

Sug干预规则文档.md	api 项目	业务规则文档

组合原则：AGENTS.md 管"规矩"（怎么干活），学习笔记管"原理"（系统怎么运转）。

四、ReAct 引擎知识图谱（阅读总图）

主结构：一个入口 + 一个循环 + 九个工位

ReActEngine.execute()（只管循环控制，不认识业务）

  → PreLoopHandler（只跑一次：初始化/长期记忆）

  → while 主循环（LoopCheckHandler 把门）:

\    每轮 9 工位流水线：

\    ① PreProcess 裁剪/token统计  ② Prompt 拼system  ③ Message 拼历史

\    ④ ToolPrepare 动态工具列表   ⑤ ModelCall 三级选模型+调用

\    ⑥ OutputParse 解析(协调员)   ⑦ ToolDispatch 识别工具调用

\    ⑧ ToolExecute 并发执行       ⑨ PostProcess 后处理

\    出口：① ActionType=OUTPUT→SUCCESS ② 轮次≥maxLoop→MAX_LOOP ③ 异常→分类重试/终止

两条结缔组织（关联全图的关键）

① PhaseResult.extraInfo = 数据总线：9 个 Handler 互不调用，靠共享 Map 传数据。 Message 写 MESSAGES、ToolPrepare 写 TOOLS → ModelCall 取来调用、写 STREAM_RESPONSE_SPEC → OutputParse 取来消费、写回 ActionType。单看任何 Handler 不知道数据哪来的——答案永远在上一工位贴了什么。

② 状态寿命：context 跨轮（用户/历史/轮次/ActionType/降级状态）；phaseResult 轮内（标志位+数据总线）。

文件坐标表

文件	位置	职责

ReActEngine（runtime）	最外层 while	循环控制+三出口+异常分类+token打点

SkillReactAgent	Handler 注册表	9 个 Handler 容器，纯 getter

ModelCallHandlerImpl	工位⑤	降级>插件>主模型 三级选择，每轮重估

OutputPhaseHandlerImpl	工位⑥	协调员；真解析在 StreamEventConsumer（边解析边推SSE）

LoopCheckHandlerImpl+MaxLoopResolver	循环门口	读标志位；上限解析 FF>Lion>默认，handoff 翻倍

阅读纪律

读任何文件先问：①它在图的哪个工位？②它从 extraInfo 取了什么、放了什么？ 读完用一句话说清"在哪、干什么、和谁怎么传数据"，才算读完。

五、检索与存储设施

语义缓存：Elasticsearch（Poros 客户端），query_vector 用 dense_vector 类型，KNN 检索（底层 HNSW）+ term 过滤（searchSource/cityId/geoHash/createTime），按时间滚动索引

内容检索：BS/Maise 内部搜索平台（SearchContentBsQueryService），含 embedding 索引（ugc-embeddings-wangjing-task）

选型逻辑：未上 Milvus/Qdrant——①量级未到 ②ES 一次查询同时做向量+标量混合过滤 ③复用成熟运维体系

面试关联：语义缓存 = 降本题"入口语义缓存"的实物；HNSW vs 全量扫描；混合过滤是高频考点
